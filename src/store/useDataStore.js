import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { useSettingsStore } from "./useSettingsStore";
import { useAuthStore } from "./useAuthStore";
import {
	fetchWeather as mockFetchWeather,
	fetchStocks as mockFetchStocks,
	fetchTrends as mockFetchTrends,
	fetchRestaurants as mockFetchRestaurants,
	fetchCalendarEvents as mockFetchCalendarEvents,
	fetchHealthData as mockFetchHealthData,
} from "../mock/data";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const EDGE_TIMEOUT_MS = 25000;

/* ────────────────────────────────────────────
   30-minute Access-Time-based Caching
   ──────────────────────────────────────────── */
const CACHE_THRESHOLD_MS = 30 * 60 * 1000; // 30분

const ACCESS_TIME_KEY = "mb_last_access_time";

const getLastAccessTime = () => load(ACCESS_TIME_KEY, 0);
const setLastAccessTime = () => save(ACCESS_TIME_KEY, Date.now());

/**
 * 접속 시간 기준으로 캐시가 유효한지 판단.
 * Δt = (현재 시간 - 마지막 접속 시간)
 * Δt > 30분이면 stale → 전체 API 재호출
 * Δt ≤ 30분이면 fresh → 캐시 사용
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

/* ── DB 캐시 헬퍼 (api_cache 테이블) ── */
/** Auth store에서 동기적으로 userId를 읽는다. 네트워크 요청 없음. */
const getUserId = () => {
	return useAuthStore.getState()?.user?.id ?? null;
};

const toCacheRowId = (userId, cacheKey) => `u:${userId}:${cacheKey}`;

/**
 * DB 캐시 읽기 - 30분 접속시간 기반.
 * forceRefresh=true이면 캐시 무시 (수동 새로고침).
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
	const age = Date.now() - new Date(data.fetched_at).getTime();
	if (!Number.isFinite(age) || age > CACHE_THRESHOLD_MS) return null;

	return data.data ?? null;
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
	return rows.some((row) => Number(row?.price ?? 0) > 0);
};

/* ── 맛집 정규화 ── */
const normalizeRestaurantItem = (item) => {
	if (!item) return null;
	if ("price" in item || "rating" in item) return item;

	return {
		name: item.name,
		category: item.category?.split(" > ").pop() ?? "맛집",
		distance: item.distance ? `${item.distance}m` : "거리 정보 없음",
		address: item.address,
		url: item.url,
	};
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
	restaurants: [],
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
	loading: {},
	errors: {},
	lastFetchedAt: load("mb_last_fetched_at", {}),
	setActiveWidgetIds: (ids) => set({ activeWidgetIds: ids }),
	markFetched: (key) =>
		set((s) => {
			const next = { ...s.lastFetchedAt, [key]: Date.now() };
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
	   - Groq LLM 추정 (유일한 소스)
	   - 실패 시 mock fallback
	   ══════════════════════════════════════════ */
	fetchWeather: async (lat = 37.5665, lon = 126.978, userId, force = false) => {
		set((s) => ({
			loading: { ...s.loading, weather: true },
			errors: { ...s.errors, weather: null },
		}));
		try {
			const cacheKey = `weather_${lat}_${lon}`;

			// 캐시 확인 (force=true면 수동 새로고침 → 캐시 무시)
			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached) {

					set({ weather: dbCached });
					cacheIt("weather", dbCached);
					get().markFetched("weather");
					return;
				}
			}


			// Groq LLM 날씨 추정
			const groqEdge = await invokeEdgeDetailed("groq", {
				system:
					"너는 날씨 정보 생성기다. 반드시 JSON 객체만 반환하고 다른 텍스트를 포함하지 마라.",
				prompt: [
					"아래 좌표 기준으로 현실적인 현재 날씨 추정 JSON을 만들어라.",
					`lat=${lat}, lon=${lon}`,
					"반드시 다음 키만 포함: temp, city, condition, precipitation, airQuality, humidity",
					"제약: temp/humidity/precipitation은 숫자, city/condition/airQuality는 문자열",
					'예시 형식: {"temp":18,"city":"서울","condition":"맑음","precipitation":10,"airQuality":"보통","humidity":45}',
				].join("\n"),
				temperature: 0.2,
			});
			const parsed = normalizeGroqWeather(
				extractJsonObject(groqEdge?.data?.text),
			);

			if (groqEdge?.ok && parsed) {
				set((s) => ({
					rawData: {
						...s.rawData,
						weather: {
							source: "groq",
							text: groqEdge.data?.text ?? null,
							parsed,
						},
					},
				}));
				set({ weather: parsed });
				cacheIt("weather", parsed);
				await writeApiCache(cacheKey, parsed, userId);
				get().markFetched("weather");
				return;
			}

			// 에러 기록 후 mock fallback
			set((s) => ({
				errors: {
					...s.errors,
					weather: groqEdge?.error || "날씨 API 호출에 실패했습니다.",
				},
				rawData: {
					...s.rawData,
					weather: {
						source: "fallback",
						groqEdge: groqEdge?.data,
					},
				},
			}));
			const mock = await mockFetchWeather(lat, lon);
			set({ weather: cached("weather", mock) });
			get().markFetched("weather");
		} catch (e) {
			console.warn("fetchWeather failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					weather: e?.message || "날씨 데이터를 불러오지 못했습니다.",
				},
			}));
			try {
				const mock = await mockFetchWeather();
				set({ weather: cached("weather", mock) });
			} catch {
				/* mock도 실패하면 무시 */
			}
			get().markFetched("weather");
		} finally {
			set((s) => ({ loading: { ...s.loading, weather: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   주식/환율 (Stocks - Twelve Data)
	   사용자 선택 심볼을 파라미터로 전달
	   ══════════════════════════════════════════ */
	fetchStocks: async (symbols = defaultStockSymbols, userId, force = false) => {
		set((s) => ({
			loading: { ...s.loading, stocks: true },
			errors: { ...s.errors, stocks: null },
		}));
		try {
			const normalizedSymbols = normalizeStockSymbols(symbols);
			const cacheKey = `stocks_${normalizedSymbols.join("_")}`;

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached && hasMeaningfulStockValues(dbCached)) {

					set({ stocks: dbCached });
					cacheIt("stocks", dbCached);
					get().markFetched("stocks");
					return;
				}
			}


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
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					stocks: edge?.error || "주식 API가 유효하지 않은 값을 반환했습니다.",
				},
				rawData: { ...s.rawData, stocks: edge?.data ?? null },
			}));
			const mock = await mockFetchStocks();
			set({ stocks: cached("stocks", mock) });
			get().markFetched("stocks");
		} catch (e) {
			console.warn("fetchStocks failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					stocks: e?.message || "주식 데이터를 불러오지 못했습니다.",
				},
			}));
			try {
				const mock = await mockFetchStocks();
				set({ stocks: cached("stocks", mock) });
			} catch {
				/* mock 실패 무시 */
			}
			get().markFetched("stocks");
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
		set((s) => ({
			loading: { ...s.loading, trends: true },
			errors: { ...s.errors, trends: null },
		}));
		try {
			const cacheKey = "trends_full";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached && dbCached.trends) {

					set({
						trends: dbCached.trends,
						trendsAnswer: dbCached.answer ?? null,
						trendsResults: dbCached.results ?? [],
					});
					cacheIt("trends", dbCached);
					get().markFetched("trends");
					return;
				}
			}


			const edge = await invokeEdgeDetailed("tavily", {
				query:
					"대한민국 실시간 이슈, 기술, 경제, 캠퍼스, 라이프스타일 관련 최신 트렌드 7개",
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
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					trends: edge?.error || "트렌드 API 응답이 비어 있습니다.",
				},
			}));
			const mock = await mockFetchTrends();
			set({ trends: cached("trends", mock) });
			get().markFetched("trends");
		} catch (e) {
			console.warn("fetchTrends failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					trends: e?.message || "트렌드를 불러오지 못했습니다.",
				},
			}));
			try {
				const mock = await mockFetchTrends();
				set({ trends: cached("trends", mock) });
			} catch {
				/* mock 실패 무시 */
			}
			get().markFetched("trends");
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
		set((s) => ({
			loading: { ...s.loading, news: true },
			errors: { ...s.errors, news: null },
		}));
		try {
			const cacheKey = "news_full";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached && dbCached.results) {
					set({
						news: dbCached.news ?? [],
						newsAnswer: dbCached.answer ?? null,
						newsResults: dbCached.results ?? [],
					});
					cacheIt("news", dbCached);
					get().markFetched("news");
					return;
				}
			}

			const edge = await invokeEdgeDetailed("tavily", {
				query: "대한민국 최신 뉴스 헤드라인 주요 뉴스 속보 10개",
			});
			if (edge?.data) {
				set((s) => ({ rawData: { ...s.rawData, news: edge.data } }));
			}

			if (edge?.ok && edge.data?.results) {
				const full = {
					news: edge.data.trends ?? [],
					answer: edge.data.answer ?? null,
					results: (edge.data.results ?? []).slice(0, 10).map((r) => ({
						title: r.title ?? "",
						url: r.url ?? "",
						content: r.content ?? "",
					})),
				};
				set({
					news: full.news,
					newsAnswer: full.answer,
					newsResults: full.results,
				});
				cacheIt("news", full);
				await writeApiCache(cacheKey, full, userId);
				get().markFetched("news");
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					news: edge?.error || "뉴스 API 응답이 비어 있습니다.",
				},
			}));
			// 뉴스 mock fallback (trends mock 재사용)
			const mock = await mockFetchTrends();
			set({ newsResults: mock.map((t) => ({ title: t, url: "", content: "" })) });
			get().markFetched("news");
		} catch (e) {
			console.warn("fetchNews failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					news: e?.message || "뉴스를 불러오지 못했습니다.",
				},
			}));
			get().markFetched("news");
		} finally {
			set((s) => ({ loading: { ...s.loading, news: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   주변 맛집 (Kakao Places)
	   ══════════════════════════════════════════ */
	fetchRestaurants: async (
		query = "맛집",
		lat = 37.5665,
		lon = 126.978,
		userId,
		force = false,
	) => {
		set((s) => ({ loading: { ...s.loading, restaurants: true } }));
		try {
			const cacheKey = `restaurants_${query}_${lat}_${lon}`;

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached) {
					set({ restaurants: dbCached });
					cacheIt("restaurants", dbCached);
					return;
				}
			}

			const data = await invokeEdge("kakao-places", {
				query,
				lat,
				lon,
				radius: 1200,
			});
			if (data) {
				const normalized = data.map(normalizeRestaurantItem).filter(Boolean);
				set({ restaurants: normalized });
				cacheIt("restaurants", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				return;
			}

			const mock = await mockFetchRestaurants();
			set({ restaurants: cached("restaurants", mock) });
		} catch (e) {
			console.warn("fetchRestaurants failed:", e?.message || e);
			try {
				const mock = await mockFetchRestaurants();
				set({ restaurants: cached("restaurants", mock) });
			} catch {
				/* mock 실패 무시 */
			}
		} finally {
			set((s) => ({ loading: { ...s.loading, restaurants: false } }));
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
				if (dbCached) {
					set({ calEvents: dbCached });
					cacheIt("calendar", dbCached);
					get().markFetched("calendar");
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

			const data = await invokeEdge("calendar", { token, todayOnly: true });
			if (data && Array.isArray(data)) {
				// 프론트에서도 오늘 일정만 필터링 (안전장치)
				const now = new Date();
				const todayStr = now.toISOString().slice(0, 10);
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
			const mock = await mockFetchHealthData();
			set({ healthData: mock });
			return;
		}

		try {
			const cacheKey = "health_default";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached) {
					set({ healthData: dbCached });
					cacheIt("health", dbCached);
					return;
				}
			}

			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token;
			if (!token) {
				const mock = await mockFetchHealthData();
				set({ healthData: mock });
				return;
			}

			const data = await invokeEdge("fitness", { token });
			if (data) {
				const normalized = normalizeHealthData(data);
				set({ healthData: normalized });
				cacheIt("health", normalized);
				await writeApiCache(cacheKey, normalized, userId);
			} else {
				const mock = await mockFetchHealthData();
				set({ healthData: cached("health", mock) });
			}
		} catch (e) {
			console.warn("fetchHealth failed:", e?.message || e);
			try {
				const mock = await mockFetchHealthData();
				set({ healthData: cached("health", mock) });
			} catch {
				/* mock 실패 무시 */
			}
		}
	},

	/* ══════════════════════════════════════════
	   전체 fetch (접속 시간 기반 30분 캐싱)

	   1) 접속 시 Δt > 30분 → 모든 API 즉시 호출 (auto-refresh)
	   2) Δt ≤ 30분 → 캐시 사용 (API 호출 생략)
	   3) 위젯별 수동 새로고침 → force=true로 시간제한 없이 호출
	   ══════════════════════════════════════════ */
	fetchAll: async () => {
		const store = get();
		const shouldForceRefresh = isCacheStale();

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

					const layoutIds = extractLayoutWidgetIds(layouts);
					if (layoutIds.size > 0) {
						visibleWidgets = [...layoutIds].filter(
							(widgetId) =>
								widgetId.startsWith("smart_") || visibility[widgetId] === true,
						);
					} else {
						visibleWidgets = Object.keys(visibility).filter(
							(widgetId) => visibility[widgetId] === true,
						);
					}
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
		if (visibleWidgets.includes("restaurants"))
			jobs.push(
				store
					.fetchRestaurants(
						"맛집",
						undefined,
						undefined,
						userId,
						shouldForceRefresh,
					)
					.catch((e) =>
						console.warn("fetchRestaurants failed in fetchAll:", e?.message),
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
