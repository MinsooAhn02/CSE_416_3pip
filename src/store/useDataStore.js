import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { formatLocalDate } from "../utils/date";
import { useSettingsStore } from "./useSettingsStore";
import { useAuthStore } from "./useAuthStore";
import i18n from "../l10n/i18n";
import { fetchCalendarEvents as mockFetchCalendarEvents } from "../mock/data";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const EDGE_TIMEOUT_MS = 25000;

/* ────────────────────────────────────────────
   1-hour Access-Time-based Caching
   ──────────────────────────────────────────── */
const CACHE_THRESHOLD_MS = 60 * 60 * 1000; // 1시간

const ACCESS_TIME_KEY = "mb_last_access_time";

const getLastAccessTime = () => load(ACCESS_TIME_KEY, 0);
const setLastAccessTime = () => save(ACCESS_TIME_KEY, Date.now());

/**
 * 접속 시간 기준으로 캐시가 유효한지 판단.
 * Δt = (현재 시간 - 마지막 접속 시간)
 * Δt > 1시간이면 stale → 전체 API 재호출
 * Δt ≤ 1시간이면 fresh → 캐시 사용
 */
const isCacheStale = () => {
	const lastAccess = getLastAccessTime();
	if (!lastAccess) return true;
	const delta = Date.now() - lastAccess;
	return delta > CACHE_THRESHOLD_MS;
};

/* ── Edge Function 호출 헬퍼 (직접 fetch - supabase.functions.invoke 대체) ── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const invokeEdgeDetailed = async (fnName, body = {}) => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
	const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
	const startedAt = Date.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timer);

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			console.warn(`[edge] ${fnName} HTTP ${res.status}:`, text);
			return {
				ok: false,
				data: null,
				error: `HTTP ${res.status}: ${text}`,
				timedOut: false,
				elapsedMs: Date.now() - startedAt,
			};
		}

		const data = await res.json();

		return {
			ok: true,
			data,
			error: null,
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	} catch (e) {
		clearTimeout(timer);
		if (e.name === "AbortError") {
			console.warn(`[edge] ${fnName} timed out after ${EDGE_TIMEOUT_MS}ms`);
			return {
				ok: false,
				data: null,
				error: `timeout ${EDGE_TIMEOUT_MS}ms`,
				timedOut: true,
				elapsedMs: Date.now() - startedAt,
			};
		}
		console.warn(`[edge] ${fnName} failed:`, e.message);
		return {
			ok: false,
			data: null,
			error: e.message || "Edge invoke failed",
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	}
};

const invokeEdge = async (fnName, body = {}) => {
	const result = await invokeEdgeDetailed(fnName, body);
	return result?.ok ? result.data : null;
};

/* ── 로컬 캐시 헬퍼 (localStorage graceful fallback) ── */
const cached = (key, fallback) => load(`mb_cache_${key}`, fallback);
const cacheIt = (key, data) => {
	save(`mb_cache_${key}`, data);
	save(`mb_cache_${key}_at`, Date.now());
};

/* ── 위치 캐시 (module scope) ──
 * Geolocation을 매 refresh마다 다시 호출하면 브라우저 권한 상태에 따라
 * 6초까지 블록될 수 있고, 최악의 경우 resolve/reject 중 어느 쪽도 호출되지
 * 않아 fetch 함수가 영원히 hang 되는 문제가 있었음.
 * → 첫 호출 시 위치를 얻어 module scope에 캐시 (5분), 이후에는 즉시 반환.
 *   내부적으로 hard timeout(6.5s) race를 걸어 hang을 방지.
 */
let _geoCache = null; // { lat, lon, at }
const GEO_CACHE_MS = 5 * 60 * 1000;

const getGeoPosition = async () => {
	if (_geoCache && Date.now() - _geoCache.at < GEO_CACHE_MS) {
		return { lat: _geoCache.lat, lon: _geoCache.lon };
	}
	if (typeof navigator === "undefined" || !navigator.geolocation) return null;
	try {
		const pos = await Promise.race([
			new Promise((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					timeout: 6000,
					maximumAge: GEO_CACHE_MS,
				}),
			),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("geolocation hard-timeout")),
					6500,
				),
			),
		]);
		_geoCache = {
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
			at: Date.now(),
		};
		return { lat: _geoCache.lat, lon: _geoCache.lon };
	} catch {
		return null;
	}
};

/* ── DB 캐시 헬퍼 (api_cache 테이블) ── */
/** Auth store에서 동기적으로 userId를 읽는다. 네트워크 요청 없음. */
const getUserId = () => {
	return useAuthStore.getState()?.user?.id ?? null;
};

const toCacheRowId = (userId, cacheKey) => `u:${userId}:${cacheKey}`;

/**
 * DB 캐시 읽기 - 1시간 접속시간 기반.
 * forceRefresh=true이면 캐시 무시 (수동 새로고침).
 * Returns { data, fetchedAt } so callers can stamp the real fetch time
 * instead of "now" (fixes the stale last-updated display bug).
 */
const readApiCache = async (cacheKey, userIdArg, forceRefresh = false) => {
	if (forceRefresh) return null;
	if (!supabase) return null;
	const userId = userIdArg ?? (await getUserId());
	if (!userId) return null;

	const rowId = toCacheRowId(userId, cacheKey);
	const { data, error } = await supabase
		.from("api_cache")
		.select("data, fetched_at")
		.eq("id", rowId)
		.single();

	if (error) {
		if (error.code !== "PGRST116") {
			console.warn(`api_cache read failed [${cacheKey}]:`, error.message);
		}
		return null;
	}

	if (!data?.fetched_at) return null;
	const fetchedAtMs = new Date(data.fetched_at).getTime();
	const age = Date.now() - fetchedAtMs;
	if (!Number.isFinite(age) || age > CACHE_THRESHOLD_MS) return null;

	return { data: data.data ?? null, fetchedAt: fetchedAtMs };
};

const writeApiCache = async (cacheKey, payload, userIdArg) => {
	if (!supabase) return;
	const userId = userIdArg ?? (await getUserId());
	if (!userId) return;

	const rowId = toCacheRowId(userId, cacheKey);
	const { error } = await supabase.from("api_cache").upsert({
		id: rowId,
		user_id: userId,
		data: payload,
		fetched_at: new Date().toISOString(),
	});

	if (error) {
		console.warn(`api_cache write failed [${cacheKey}]:`, error.message);
	}
};

/* ── 유틸리티 ── */
const extractLayoutWidgetIds = (layouts) => {
	if (!layouts || typeof layouts !== "object") return new Set();
	const ids = new Set();
	for (const key of Object.keys(layouts)) {
		const bpLayout = layouts[key];
		if (!Array.isArray(bpLayout)) continue;
		for (const item of bpLayout) {
			if (item?.i) ids.add(item.i);
		}
	}
	return ids;
};

const defaultStockSymbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"];

const normalizeStockSymbols = (symbols) => {
	if (!Array.isArray(symbols) || symbols.length === 0)
		return defaultStockSymbols;
	const unique = Array.from(
		new Set(
			symbols
				.map((s) =>
					String(s || "")
						.trim()
						.toUpperCase(),
				)
				.filter(Boolean),
		),
	);
	if (unique.length === 0) return defaultStockSymbols;
	return unique.slice(0, 4);
};

const numberFormatter = new Intl.NumberFormat("ko-KR", {
	maximumFractionDigits: 2,
});

const extractJsonObject = (text) => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
};

/* ── 날씨: Groq LLM 추정 (유일한 소스) ── */
const normalizeGroqWeather = (payload) => {
	if (!payload || typeof payload !== "object") return null;
	const temp = Number(payload.temp);
	const humidity = Number(payload.humidity);
	const precipitation = Number(payload.precipitation);
	return {
		temp: Number.isFinite(temp) ? temp : 20,
		city: String(payload.city || "서울"),
		condition: String(payload.condition || payload.description || "정보 없음"),
		precipitation: Number.isFinite(precipitation) ? precipitation : 0,
		airQuality: String(payload.airQuality || "정보 없음"),
		humidity: Number.isFinite(humidity) ? humidity : 50,
	};
};

/* ── 주식 정규화 ── */
const normalizeStockItem = (item) => {
	if (!item) return null;
	if ("name" in item && "value" in item) return item;

	const numericChange = Number(item.change ?? 0);
	const numericPrice = Number(item.price ?? 0);

	return {
		name: item.symbol === "SP500" ? "S&P 500" : item.symbol,
		value: numberFormatter.format(numericPrice),
		change:
			typeof item.changePercent === "string"
				? item.changePercent.replace(/^\+/, "")
				: `${numericChange >= 0 ? "+" : ""}${numberFormatter.format(numericChange)}`,
		up: numericChange >= 0,
	};
};

const hasMeaningfulStockValues = (rows) => {
	if (!Array.isArray(rows) || rows.length === 0) return false;
	return rows.some((row) => {
		// Raw edge 응답은 { price: number } 형태
		const rawPrice = Number(row?.price ?? 0);
		if (rawPrice > 0) return true;
		// normalizeStockItem 통과 후 캐시에 저장된 형태는 { value: "1,234.56" }
		// → 여기도 인식하지 못하면 주식 DB 캐시가 항상 bypass 되어
		//   매번 API를 두드림 (과거 latent 버그).
		const v = row?.value;
		if (typeof v !== "string") return false;
		const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
		return Number.isFinite(parsed) && parsed > 0;
	});
};

/* ── 건강 데이터 정규화: Steps + Sleep 유효 필터링 ── */
const normalizeHealthData = (raw) => {
	if (!raw || typeof raw !== "object") return null;
	return {
		steps: Number(raw.steps) || 0,
		stepsGoal: 10000,
		sleep: Number(raw.sleep) || 0,
		sleepGoal: 8,
		calories: Number(raw.calories) || 0,
		caloriesGoal: 2200,
		heartRate: Number(raw.heartRate) || 0,
		water: 0,
		waterGoal: 8,
	};
};

const GOOGLE_HEALTH_AUTH_ERROR =
	"Google Health connection expired. Reconnect Google to sync Health again.";

const GOOGLE_HEALTH_API_DISABLED_ERROR =
	"Google Fitness API is disabled for this Google Cloud project. Enable it in Google Cloud, wait a few minutes, then reconnect Google.";

const isGoogleHealthAuthErrorMessage = (message = "") => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("google oauth token required") ||
		normalized.includes("unauthorized") ||
		normalized.includes("access token") ||
		normalized.includes("permission") ||
		normalized.includes("insufficient") ||
		normalized.includes("401")
	);
};

const isGoogleHealthApiDisabledMessage = (message = "") => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("accessnotconfigured") ||
		normalized.includes("service_disabled") ||
		normalized.includes("fitness api has not been used") ||
		normalized.includes("google fit 403") ||
		normalized.includes("google fit api has not been used")
	);
};

const getGoogleHealthErrorMessage = (message = "") => {
	if (isGoogleHealthApiDisabledMessage(message)) {
		return GOOGLE_HEALTH_API_DISABLED_ERROR;
	}
	if (isGoogleHealthAuthErrorMessage(message)) {
		return GOOGLE_HEALTH_AUTH_ERROR;
	}
	return message || "Failed to load Google Health data.";
};

/* ══════════════════════════════════════════════
   Store
   ══════════════════════════════════════════════ */
export const useDataStore = create((set, get) => ({
	weather: null,
	stocks: [],
	trends: [],
	trendsAnswer: null,
	trendsResults: [],
	news: [],
	newsAnswer: null,
	newsResults: [],
	calEvents: [],
	healthData: null,
	rawData: {
		weather: null,
		stocks: null,
		trends: null,
		news: null,
	},
	onboardingProfile: null,
	activeWidgetIds: [],
	usingDefaultWeatherLocation: false,
	manualWeatherCity: load("mb_manual_city", null),
	loading: {},
	errors: {},
	/* Per-key API health for the temporary status indicator:
	 * "ok" = real API data loaded (from network or fresh cache)
	 * "error" = request failed (even if mock fallback is showing)
	 * null = never attempted */
	apiStatus: {},
	fetchedLanguage: {},   // { news: "ko", trends: "ko" } — 마지막 fetch 시 언어
	lastFetchedAt: load("mb_last_fetched_at", {}),
	setActiveWidgetIds: (ids) => set({ activeWidgetIds: ids }),
	setApiStatus: (key, status) =>
		set((s) => ({ apiStatus: { ...s.apiStatus, [key]: status } })),
	markFetched: (key, ts) =>
		set((s) => {
			const next = { ...s.lastFetchedAt, [key]: ts ?? Date.now() };
			save("mb_last_fetched_at", next);
			return { lastFetchedAt: next };
		}),
	getLastUpdatedMinutes: (key) => {
		const ts = get().lastFetchedAt?.[key];
		if (!ts) return null;
		const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
		return Number.isFinite(mins) ? mins : null;
	},

	/* ══════════════════════════════════════════
	   날씨 (Weather)
	   - OpenWeatherMap API (실제 날씨 데이터)
	   - 브라우저 Geolocation으로 현재 위치 자동 감지
	   - 실패 시 mock fallback
	   ══════════════════════════════════════════ */
	setManualWeatherCity: async (city) => {
		const trimmed = city?.trim() || null;
		if (!trimmed) {
			save("mb_manual_city", null);
			set({ manualWeatherCity: null });
			return { ok: true };
		}
		// Nominatim으로 도시명 → 좌표 변환 (무료, 키 불필요)
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`,
				{ headers: { "Accept-Language": "en" } },
			);
			const results = await res.json();
			if (!results?.length) return { ok: false, error: `City "${trimmed}" not found` };
			const { lat, lon, display_name } = results[0];
			const cityData = { name: trimmed, displayName: display_name.split(",")[0], lat: parseFloat(lat), lon: parseFloat(lon) };
			save("mb_manual_city", cityData);
			set({ manualWeatherCity: cityData });
			return { ok: true };
		} catch {
			return { ok: false, error: "Geocoding failed" };
		}
	},

	fetchWeather: async (latArg, lonArg, userId, force = false) => {
		const manualCity = get().manualWeatherCity;

		// ── 위치 결정: 수동 도시 > Geolocation > 서울 기본값 ──
		let lat = latArg ?? 37.5665;
		let lon = lonArg ?? 126.978;
		let usingDefault = true;

		if (manualCity?.lat != null) {
			lat = manualCity.lat;
			lon = manualCity.lon;
			usingDefault = false;
		} else if (latArg == null && lonArg == null) {
			const geo = await getGeoPosition();
			if (geo) {
				lat = geo.lat;
				lon = geo.lon;
				usingDefault = false;
			}
		} else {
			usingDefault = false;
		}
		set({ usingDefaultWeatherLocation: usingDefault });

		// 좌표를 소수점 1자리로 반올림 → 동일 지역 캐시 재사용
		const rLat = Math.round(lat * 10) / 10;
		const rLon = Math.round(lon * 10) / 10;
		const cacheKey = `weather_${rLat}_${rLon}`;

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data) {
				set({ weather: dbCached.data, usingDefaultWeatherLocation: usingDefault });
				cacheIt("weather", dbCached.data);
				get().markFetched("weather", dbCached.fetchedAt);
				get().setApiStatus("weather", "ok");
				return;
			}
		}

		set((s) => ({
			loading: { ...s.loading, weather: true },
			errors: { ...s.errors, weather: null },
		}));
		try {
			// OpenWeatherMap Edge Function 호출
			const edge = await invokeEdgeDetailed("weather", { lat: rLat, lon: rLon });

			if (edge?.ok && edge.data && !edge.data.error) {
				const parsed = normalizeGroqWeather(edge.data);
				if (parsed) {
					set({ weather: parsed });
					cacheIt("weather", parsed);
					await writeApiCache(cacheKey, parsed, userId);
					get().markFetched("weather");
					get().setApiStatus("weather", "ok");
					return;
				}
			}

			set((s) => ({ errors: { ...s.errors, weather: "Connection failed. Please try again later." } }));
			set({ weather: null });
			get().markFetched("weather");
			get().setApiStatus("weather", "error");
		} catch (e) {
			console.warn("fetchWeather failed:", e?.message || e);
			set((s) => ({ errors: { ...s.errors, weather: "Connection failed. Please try again later." } }));
			set({ weather: null });
			get().markFetched("weather");
			get().setApiStatus("weather", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, weather: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   주식/환율 (Stocks - Twelve Data)
	   사용자 선택 심볼을 파라미터로 전달
	   ══════════════════════════════════════════ */
	fetchStocks: async (symbols = defaultStockSymbols, userId, force = false) => {
		const normalizedSymbols = normalizeStockSymbols(symbols);
		const cacheKey = `stocks_${normalizedSymbols.join("_")}`;

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data && hasMeaningfulStockValues(dbCached.data)) {
				set({ stocks: dbCached.data });
				cacheIt("stocks", dbCached.data);
				get().markFetched("stocks", dbCached.fetchedAt);
				get().setApiStatus("stocks", "ok");
				return; // ← loading 상태 변경 없음
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, stocks: true },
			errors: { ...s.errors, stocks: null },
		}));
		try {


			const edge = await invokeEdgeDetailed("stocks", {
				symbols: normalizedSymbols,
			});

			if (
				edge?.ok &&
				Array.isArray(edge.data) &&
				hasMeaningfulStockValues(edge.data)
			) {
				set((s) => ({
					rawData: { ...s.rawData, stocks: edge.data },
				}));
				const normalized = edge.data.map(normalizeStockItem).filter(Boolean);
				set({ stocks: normalized });
				cacheIt("stocks", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				get().markFetched("stocks");
				get().setApiStatus("stocks", "ok");
				return;
			}

			set((s) => ({
				errors: { ...s.errors, stocks: "Connection failed. Please try again later." },
				rawData: { ...s.rawData, stocks: edge?.data ?? null },
			}));
			set({ stocks: [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} catch (e) {
			console.warn("fetchStocks failed:", e?.message || e);
			set((s) => ({ errors: { ...s.errors, stocks: "Connection failed. Please try again later." } }));
			set({ stocks: [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, stocks: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   실시간 트렌드 (Tavily API)
	   trends: 해시태그 배열
	   trendsAnswer: AI 요약 문자열
	   trendsResults: 출처 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchTrends: async (userId, force = false) => {
		const lang = i18n.language || "ko";
		const isEn = lang === "en";

		// 트렌드는 관심사 무관 — 세상에서 실제로 뜨는 것을 보여줌
		const cacheKey = `trends_full_${lang}`;

		// 언어 변경 시 강제 재호출
		if (!force && get().fetchedLanguage?.trends && get().fetchedLanguage.trends !== lang) {
			force = true;
		}

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data?.trends || dbCached?.data?.results?.length) {
				set({
					trends: dbCached.data.trends ?? [],
					trendsAnswer: dbCached.data.answer ?? null,
					trendsResults: dbCached.data.results ?? [],
					fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
				});
				cacheIt("trends", dbCached.data);
				get().markFetched("trends", dbCached.fetchedAt);
				get().setApiStatus("trends", "ok");
				return;
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, trends: true },
			errors: { ...s.errors, trends: null },
		}));
		try {
			const trendsQuery = isEn
				? "today major trending news worldwide technology AI politics economy entertainment sports latest"
				: "오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스";
			const koNewsDomains = ["news.naver.com", "yna.co.kr", "chosun.com", "joins.com", "hani.co.kr", "news1.kr"];

			const edge = await invokeEdgeDetailed("tavily", {
				query: trendsQuery,
				include_domains: isEn ? [] : koNewsDomains,
			});
			if (edge?.data) {
				set((s) => ({ rawData: { ...s.rawData, trends: edge.data } }));
			}

			if (edge?.ok && edge.data?.trends) {
				const full = {
					trends: edge.data.trends,
					answer: edge.data.answer ?? null,
					results: (edge.data.results ?? []).slice(0, 7).map((r) => ({
						title: r.title ?? "",
						url: r.url ?? "",
						content: r.content ?? "",
					})),
				};
				set({
					trends: full.trends,
					trendsAnswer: full.answer,
					trendsResults: full.results,
				});
				cacheIt("trends", full);
				await writeApiCache(cacheKey, full, userId);
				get().markFetched("trends");
				get().setApiStatus("trends", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, trends: lang } }));
				return;
			}

			set((s) => ({ errors: { ...s.errors, trends: "Connection failed. Please try again later." } }));
			set({ trendsResults: [], trends: [] });
			get().markFetched("trends");
			get().setApiStatus("trends", "error");
		} catch (e) {
			console.warn("fetchTrends failed:", e?.message || e);
			set((s) => ({ errors: { ...s.errors, trends: "Connection failed. Please try again later." } }));
			set({ trendsResults: [], trends: [] });
			get().markFetched("trends");
			get().setApiStatus("trends", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, trends: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   뉴스 (Tavily API - 별도 호출)
	   news: 뉴스 키워드 배열
	   newsAnswer: AI 요약 문자열
	   newsResults: 뉴스 기사 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchNews: async (userId, force = false) => {
		const lang = i18n.language || "ko";
		const isEn = lang === "en";

		// 관심사 키워드 (상위 5개)
		const keywordInterests = useSettingsStore.getState().keywordInterests ?? [];
		const topKeywords = keywordInterests
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
			.slice(0, 5)
			.map((k) => k.keyword)
			.filter(Boolean);
		const interestFingerprint = topKeywords.join("+") || "base";

		// 위치 정보로 지역 뉴스 캐시 키 결정
		let locationLabel = "KR";
		let locationObj = null;
		const geo = await getGeoPosition();
		if (geo) {
			const lat = Math.round(geo.lat * 10) / 10;
			const lon = Math.round(geo.lon * 10) / 10;
			locationLabel = `${lat}_${lon}`;
			locationObj = { lat, lon };
		}

		const cacheKey = `news_${locationLabel}_${lang}_${interestFingerprint}`;

		// 언어 변경 시 강제 재호출
		if (!force && get().fetchedLanguage?.news && get().fetchedLanguage.news !== lang) {
			force = true;
		}

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data?.results) {
				set({
					news: dbCached.data.news ?? [],
					newsAnswer: dbCached.data.answer ?? null,
					newsResults: dbCached.data.results ?? [],
					fetchedLanguage: { ...get().fetchedLanguage, news: lang },
				});
				cacheIt("news", dbCached.data);
				get().markFetched("news", dbCached.fetchedAt);
				get().setApiStatus("news", "ok");
				return;
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, news: true },
			errors: { ...s.errors, news: null },
		}));
		try {
			// 지역 뉴스 5개 + 글로벌 뉴스 5개 병렬 호출
			const interestClause = topKeywords.length > 0
				? (isEn ? ` topics: ${topKeywords.join(", ")}` : ` 관심: ${topKeywords.join(", ")}`)
				: "";
			const localQuery = isEn
				? (locationObj
					? `latest local news today near lat ${locationObj.lat} lon ${locationObj.lon}${interestClause}`
					: `latest South Korea news today breaking${interestClause}`)
				: (locationObj
					? `현재 위치(위도 ${locationObj.lat}, 경도 ${locationObj.lon}) 주변 지역 최신 뉴스 속보${interestClause}`
					: `대한민국 최신 뉴스 속보${interestClause}`);

			const koNewsDomains = ["news.naver.com", "yna.co.kr", "chosun.com", "joins.com", "hani.co.kr", "news1.kr"];
			const globalNewsQuery = isEn
				? "world top breaking news headlines today"
				: "세계 주요 뉴스 속보 오늘";

			const [localEdge, globalEdge] = await Promise.all([
				invokeEdgeDetailed("tavily", {
					query: localQuery,
					mode: "news",
					max_results: 5,
					location: locationObj,
					include_domains: isEn ? [] : koNewsDomains,
				}),
				invokeEdgeDetailed("tavily", {
					query: globalNewsQuery,
					mode: "news",
					max_results: 5,
					include_domains: isEn ? [] : koNewsDomains,
				}),
			]);

			if (localEdge?.data) {
				set((s) => ({ rawData: { ...s.rawData, news: localEdge.data } }));
			}

			const localResults = localEdge?.ok ? (localEdge.data?.results ?? []) : [];
			const globalResults = globalEdge?.ok ? (globalEdge.data?.results ?? []) : [];

			if (localResults.length > 0 || globalResults.length > 0) {
				const merged = [...localResults, ...globalResults].slice(0, 10).map((r) => ({
					title: r.title ?? "",
					url: r.url ?? "",
					content: r.content ?? "",
					image: r.image ?? null,
					published_date: r.published_date ?? null,
				}));
				const full = {
					news: [],
					answer: localEdge?.data?.answer ?? globalEdge?.data?.answer ?? null,
					results: merged,
				};
				set({
					news: full.news,
					newsAnswer: full.answer,
					newsResults: full.results,
				});
				cacheIt("news", full);
				await writeApiCache(cacheKey, full, userId);
				get().markFetched("news");
				get().setApiStatus("news", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, news: lang } }));
				return;
			}

			set((s) => ({ errors: { ...s.errors, news: "Connection failed. Please try again later." } }));
			set({ newsResults: [] });
			get().markFetched("news");
			get().setApiStatus("news", "error");
		} catch (e) {
			console.warn("fetchNews failed:", e?.message || e);
			set((s) => ({ errors: { ...s.errors, news: "Connection failed. Please try again later." } }));
			set({ newsResults: [] });
			get().markFetched("news");
			get().setApiStatus("news", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, news: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   캘린더 (Google Calendar)
	   오늘 일정(Today's Schedule)만 가져오기
	   ══════════════════════════════════════════ */
	fetchCalendar: async (userId, force = false) => {
		if (!supabase) {
			const mock = await mockFetchCalendarEvents();
			set({ calEvents: mock });
			get().markFetched("calendar");
			return;
		}

		try {
			const cacheKey = "calendar_today";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ calEvents: dbCached.data });
					cacheIt("calendar", dbCached.data);
					get().markFetched("calendar", dbCached.fetchedAt);
					return;
				}
			}

			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token;
			if (!token) {
				const mock = await mockFetchCalendarEvents();
				set({ calEvents: mock });
				get().markFetched("calendar");
				return;
			}

			const data = await invokeEdge("events", { token, todayOnly: true });
			if (data && Array.isArray(data)) {
				// 프론트에서도 오늘 일정만 필터링 (안전장치)
				const todayStr = formatLocalDate();
				const todayEvents = data.filter((ev) => {
					const start = ev.start;
					if (!start) return false;
					return String(start).startsWith(todayStr);
				});
				set({ calEvents: todayEvents });
				cacheIt("calendar", todayEvents);
				await writeApiCache(cacheKey, todayEvents, userId);
				get().markFetched("calendar");
			} else {
				const mock = await mockFetchCalendarEvents();
				set({ calEvents: cached("calendar", mock) });
				get().markFetched("calendar");
			}
		} catch (e) {
			console.warn("fetchCalendar failed:", e?.message || e);
			try {
				const mock = await mockFetchCalendarEvents();
				set({ calEvents: cached("calendar", mock) });
			} catch {
				/* mock 실패 무시 */
			}
			get().markFetched("calendar");
		}
	},

	/* ══════════════════════════════════════════
	   건강 (Google Fitness)
	   Steps + Sleep 중심, 나머지는 보조 데이터
	   ══════════════════════════════════════════ */
	fetchHealth: async (userId, force = false) => {
		if (!supabase) {
			set((s) => ({ errors: { ...s.errors, health: "Connection failed. Please try again later." } }));
			set({ healthData: null });
			get().setApiStatus("health", "error");
			return;
		}

		set((s) => ({
			loading: { ...s.loading, health: true },
			errors: { ...s.errors, health: null },
		}));

		try {
			const cacheKey = "health_default";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ healthData: dbCached.data });
					cacheIt("health", dbCached.data);
					get().setApiStatus("health", "ok");
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
			if (!token) {
				set((s) => ({ errors: { ...s.errors, health: "Connection failed. Please try again later." } }));
				set({ healthData: null });
				get().setApiStatus("health", "error");
				return;
			}

			const edge = await invokeEdgeDetailed("fitness", { token });
			if (edge?.ok && edge.data) {
				const normalized = normalizeHealthData(edge.data);
				set({ healthData: normalized });
				cacheIt("health", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				get().setApiStatus("health", "ok");
			} else {
				set((s) => ({ errors: { ...s.errors, health: "Connection failed. Please try again later." } }));
				set({ healthData: null });
				get().setApiStatus("health", "error");
			}
		} catch (e) {
			console.warn("fetchHealth failed:", e?.message || e);
			set((s) => ({ errors: { ...s.errors, health: "Connection failed. Please try again later." } }));
			set({ healthData: null });
			get().setApiStatus("health", "error");
		}
	},

	/* ══════════════════════════════════════════
	   전체 fetch (캐시 우선 최적화)

	   옵션:
	   - useExistingCache: true → 캐시 있으면 API 호출 생략 (로그인 직후)
	   - useExistingCache: false (기본값) → 기존 동작 (1시간 stale 체크)

	   1) useExistingCache=true → force=false로 모든 fetch 호출 (캐시 우선)
	   2) useExistingCache=false → isCacheStale() 결과에 따라 force 결정
	   3) 위젯별 수동 새로고침 → 개별 fetch 함수에서 force=true로 직접 호출
	   ══════════════════════════════════════════ */
	fetchAll: async (options = {}) => {
		const { useExistingCache = false } = options;
		const store = get();

		// useExistingCache=true면 항상 캐시 우선 (force=false)
		// useExistingCache=false면 기존 30분 stale 체크 적용
		const shouldForceRefresh = useExistingCache ? false : isCacheStale();

		let userId = null;
		let visibleWidgets = Object.keys(DEFAULT_VIS).filter(
			(key) => DEFAULT_VIS[key],
		);

		if (supabase) {
			try {
				userId = getUserId();
				if (userId) {
					const [settingsRes, layoutRes] = await Promise.all([
						supabase.from("user_settings").select("*").eq("id", userId).single(),
						supabase
							.from("widget_layouts")
							.select("layouts")
							.eq("id", userId)
							.single(),
					]);

					const settings = settingsRes.data ?? null;
					const layouts = layoutRes.data?.layouts ?? null;

					set({
						onboardingProfile: {
							age: null,
							interests: [],
							persona: settings?.persona ?? null,
						},
					});

					const visibility = {
						...DEFAULT_VIS,
						...(settings?.vis ?? {}),
					};

					// Use visibility as the authoritative source.
					// layouts only determine grid positions — they should not gate fetching.
					// Smart widgets from layouts are additive.
					const layoutIds = extractLayoutWidgetIds(layouts);
					const smartFromLayouts = [...layoutIds].filter((id) =>
						id.startsWith("smart_"),
					);
					visibleWidgets = [
						...Object.keys(visibility).filter((id) => visibility[id] === true),
						...smartFromLayouts,
					];
				}
			} catch (dbErr) {
				console.warn("[fetchAll] DB query failed, using defaults:", dbErr?.message);
			}
		}

		set({ activeWidgetIds: visibleWidgets });



		const stockSymbols =
			useSettingsStore?.getState?.()?.stockSymbols ?? defaultStockSymbols;

		const jobs = [];
		if (visibleWidgets.includes("weather"))
			jobs.push(
				store
					.fetchWeather(undefined, undefined, userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchWeather failed in fetchAll:", e?.message),
					),
			);
		if (visibleWidgets.includes("stocks"))
			jobs.push(
				store
					.fetchStocks(stockSymbols, userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchStocks failed in fetchAll:", e?.message),
					),
			);
		if (visibleWidgets.includes("trends"))
			jobs.push(
				store
					.fetchTrends(userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchTrends failed in fetchAll:", e?.message),
					),
			);
		if (visibleWidgets.includes("news"))
			jobs.push(
				store
					.fetchNews(userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchNews failed in fetchAll:", e?.message),
					),
			);
		if (visibleWidgets.includes("calendar"))
			jobs.push(
				store
					.fetchCalendar(userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchCalendar failed in fetchAll:", e?.message),
					),
			);
		if (visibleWidgets.includes("health"))
			jobs.push(
				store
					.fetchHealth(userId, shouldForceRefresh)
					.catch((e) =>
						console.warn("fetchHealth failed in fetchAll:", e?.message),
					),
			);

		await Promise.all(jobs);

		// fetchAll 완료 후 접속 시간 갱신
		setLastAccessTime();
	},
}));

// 언어 변경 시 뉴스/트렌드 자동 재호출 (React 렌더 사이클 외부에서도 동작)
i18n.on("languageChanged", () => {
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	if (store.apiStatus?.news === "ok" || store.apiStatus?.news === "error") {
		store.fetchNews(userId, true);
	}
	if (store.apiStatus?.trends === "ok" || store.apiStatus?.trends === "error") {
		store.fetchTrends(userId, true);
	}
});

// 관심사 변경 시 뉴스/트렌드 자동 재호출
const getInterestFingerprint = (keywordInterests) => {
	const top = (keywordInterests ?? [])
		.slice()
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
		.slice(0, 5)
		.map((k) => k.keyword)
		.filter(Boolean);
	return top.join("+") || "base";
};

let _prevInterestFingerprint = getInterestFingerprint(
	useSettingsStore.getState().keywordInterests,
);

useSettingsStore.subscribe((state) => {
	const fingerprint = getInterestFingerprint(state.keywordInterests);
	if (fingerprint === _prevInterestFingerprint) return;
	_prevInterestFingerprint = fingerprint;

	// 뉴스만 재호출 — 트렌드는 관심사와 무관하게 세계 트렌드를 반영
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	if (store.apiStatus?.news === "ok" || store.apiStatus?.news === "error") {
		store.fetchNews(userId, true);
	}
});
