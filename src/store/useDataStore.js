import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { formatLocalDate } from "../utils/date";
import { getInterestFingerprint, getTopInterestKeywords } from "../utils/interests";
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

const resolveAppLanguage = (value = i18n.language) =>
	String(value || "en").toLowerCase().startsWith("ko") ? "ko" : "en";

const getI18nText = (key, options, fallback) => {
	const translated = i18n.t(key, options);
	return translated && translated !== key ? translated : fallback;
};

const getErrorText = (key, options, fallback) =>
	getI18nText(`errors.${key}`, options, fallback);

const extractEdgeErrorMessage = (raw) => {
	const text = String(raw || "").trim();
	if (!text) return "";

	const jsonMatch = text.match(/\{[\s\S]*\}$/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]);
			if (typeof parsed?.error === "string" && parsed.error.trim()) {
				return parsed.error.trim();
			}
			if (typeof parsed?.message === "string" && parsed.message.trim()) {
				return parsed.message.trim();
			}
		} catch {
			/* ignore */
		}
	}

	return text;
};

const getTavilyErrorMessage = (raw) => {
	const message = extractEdgeErrorMessage(raw);
	const normalized = message.toLowerCase();

	if (!message) {
		return getErrorText(
			"connection_failed",
			{},
			"Connection failed. Please try again later.",
		);
	}
	if (normalized.includes("tavily_api_key not set")) {
		return i18n.language?.toLowerCase().startsWith("ko")
			? "Supabase에 Tavily API 키가 설정되어 있지 않습니다."
			: "Tavily API key is not configured in Supabase.";
	}
	if (normalized.includes("tavily 401") || normalized.includes("tavily 403")) {
		return i18n.language?.toLowerCase().startsWith("ko")
			? "Tavily 요청이 거부되었습니다. API 키 또는 권한 설정을 확인해주세요."
			: "Tavily request was rejected. Check the API key and permissions.";
	}
	if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
		return getErrorText(
			"network_error",
			{},
			"Network error. Please try again.",
		);
	}
	return message;
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

const shortHash = (str) => {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
	}
	return h.toString(36);
};

const toCacheRowId = (userId, cacheKey) => {
	const raw = `u:${userId}:${cacheKey}`;
	if (raw.length <= 64) return raw;
	return `h:${userId.slice(0, 8)}:${shortHash(raw)}`;
};

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
const KO_NEWS_DOMAINS = [
	"news.naver.com",
	"yna.co.kr",
	"chosun.com",
	"joins.com",
	"hani.co.kr",
	"news1.kr",
];
const EN_NEWS_DOMAINS = [
	"reuters.com",
	"apnews.com",
	"bbc.com",
	"cnn.com",
	"nytimes.com",
	"theguardian.com",
	"npr.org",
	"wsj.com",
	"bloomberg.com",
];
const HANGUL_REGEX = /[\uac00-\ud7a3]/;
const LATIN_REGEX = /[A-Za-z\u00C0-\u024F]/;
const FOREIGN_SCRIPT_REGEX =
	/[\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u0600-\u06FF\u0E00-\u0E7F\u0900-\u097F]/;

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
	return unique;
};

const normalizeReadableText = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim();

const getUrlHost = (value = "") => {
	try {
		return new URL(String(value || "")).hostname.toLowerCase();
	} catch {
		return String(value || "").toLowerCase();
	}
};

const cleanTrendTitle = (raw = "") =>
	normalizeReadableText(raw)
		.replace(/\s*[-–|]\s*[^-–|]{2,35}$/, "")
		.replace(/\[.*?\]/g, "")
		.replace(/["'`*_#]/g, "")
		.trim();

const scoreLocalizedText = (text, language) => {
	const sample = normalizeReadableText(text);
	if (!sample) return 0;

	const hasHangul = HANGUL_REGEX.test(sample);
	const hasLatin = LATIN_REGEX.test(sample);
	const hasForeignScript = FOREIGN_SCRIPT_REGEX.test(sample);

	if (language === "ko") {
		let score = 0;
		if (hasHangul) score += 3;
		if (hasLatin && !hasHangul) score -= 2;
		if (hasForeignScript && !hasHangul) score -= 3;
		return score;
	}

	let score = 0;
	if (hasLatin) score += 3;
	if (hasHangul) score -= 3;
	if (hasForeignScript) score -= 3;
	return score;
};

const scoreArticleForLanguage = (item, language) => {
	const title = normalizeReadableText(item?.title);
	const host = getUrlHost(item?.url);

	const titleScore = scoreLocalizedText(title, language);
	const hostBonus =
		language === "ko"
			? KO_NEWS_DOMAINS.some((domain) => host.includes(domain))
				? 2
				: 0
			: EN_NEWS_DOMAINS.some((domain) => host.includes(domain))
				? 2
				: 0;

	if (language === "ko") {
		return titleScore > 0 ? titleScore * 4 + hostBonus : -1;
	}

	if (titleScore > 0) return titleScore * 4 + hostBonus;
	return hostBonus > 1 ? hostBonus : -1;
};

const normalizeArticleItem = (item) => ({
	title: normalizeReadableText(item?.title),
	url: String(item?.url || "").trim(),
	content: normalizeReadableText(item?.content),
	image: item?.image ?? null,
	published_date: item?.published_date ?? null,
});

const normalizeArticleList = (items = [], limit = 10) =>
	(Array.isArray(items) ? items : [])
		.map(normalizeArticleItem)
		.filter((item) => item.title || item.url)
		.slice(0, limit);

const hasHangulText = (value = "") => HANGUL_REGEX.test(String(value || ""));

const needsKoreanTranslation = (value = "") => {
	const sample = normalizeReadableText(value);
	if (!sample) return false;
	return !hasHangulText(sample);
};

const extractJsonArray = (text) => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	try {
		const parsed = JSON.parse(trimmed);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		const match = trimmed.match(/\[[\s\S]*\]/);
		if (!match) return null;
		try {
			const parsed = JSON.parse(match[0]);
			return Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}
};

const translateTextToKorean = async (value = "") => {
	const sourceText = normalizeReadableText(value);
	if (!sourceText || !needsKoreanTranslation(sourceText)) return sourceText;

	const edge = await invokeEdgeDetailed("groq", {
		system: [
			"You translate the user's text into natural Korean.",
			"Return only the translated Korean text.",
			"Do not add quotes, bullets, labels, or explanations.",
		].join("\n"),
		prompt: sourceText,
		temperature: 0.1,
	});

	const translated = normalizeReadableText(edge?.data?.text);
	return translated || sourceText;
};

const translateArticlesToKorean = async (items = []) => {
	const normalizedItems = normalizeArticleList(items, items.length || 10);
	if (normalizedItems.length === 0) return [];

	const targets = normalizedItems
		.map((item, index) => ({
			index,
			title: item.title || "",
			content: normalizeReadableText(item.content).slice(0, 240),
			needsTitle: needsKoreanTranslation(item.title),
			needsContent: needsKoreanTranslation(item.content),
		}))
		.filter((item) => item.needsTitle || item.needsContent);

	let translatedByIndex = new Map();

	if (targets.length > 0) {
		const payload = targets.map(
			({ index, title, content, needsTitle, needsContent }) => ({
				index,
				title,
				content,
				needsTitle,
				needsContent,
			}),
		);

		const edge = await invokeEdgeDetailed("groq", {
			system: [
				"You translate news titles and short summaries into natural Korean.",
				"Return only a JSON array.",
				"Each item must be {\"index\": number, \"title\": string, \"content\": string}.",
				"Keep the same order and indexes.",
				"Translate only the fields that need Korean and leave the others natural.",
				"Do not add code fences or explanations.",
			].join("\n"),
			prompt: `Translate the following JSON array into Korean and return JSON only:\n${JSON.stringify(
				payload,
			)}`,
			temperature: 0.1,
		});

		const parsed = extractJsonArray(edge?.data?.text);
		if (Array.isArray(parsed) && parsed.length > 0) {
			translatedByIndex = new Map(
				parsed
					.map((item) => {
						const index = Number(item?.index);
						if (!Number.isInteger(index) || index < 0) return null;
						return [
							index,
							{
								title: normalizeReadableText(item?.title),
								content: normalizeReadableText(item?.content),
							},
						];
					})
					.filter(Boolean),
			);
		}
	}

	const mergedItems = normalizedItems.map((item, index) => {
		const translated = translatedByIndex.get(index);
		if (!translated) return item;
		return {
			...item,
			title: translated.title || item.title,
			content: translated.content || item.content,
		};
	});

	const fallbackTranslated = await Promise.all(
		mergedItems.map(async (item) => {
			const nextTitle = needsKoreanTranslation(item.title)
				? await translateTextToKorean(item.title)
				: item.title;
			const nextContent =
				item.content && needsKoreanTranslation(item.content)
					? await translateTextToKorean(
							normalizeReadableText(item.content).slice(0, 240),
						)
					: item.content;
			return {
				...item,
				title: nextTitle || item.title,
				content: nextContent || item.content,
			};
		}),
	);

	return fallbackTranslated;
};

const dedupeArticles = (items = []) => {
	const seen = new Set();
	return items.filter((item) => {
		const key =
			String(item?.url || "").trim().toLowerCase() ||
			String(item?.title || "").trim().toLowerCase();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const filterLocalizedArticles = (items, language, limit = 10) =>
	dedupeArticles(
		(Array.isArray(items) ? items : [])
			.map((item) => {
				const normalized = normalizeArticleItem(item);
				const score = scoreArticleForLanguage(normalized, language);
				return score > 0 ? { ...normalized, __score: score } : null;
			})
			.filter(Boolean)
			.sort((a, b) => b.__score - a.__score),
	)
		.slice(0, limit)
		.map(({ __score, ...rest }) => rest);

const buildTrendTitlesFromResults = (items, limit = 8) =>
	Array.from(
		new Set(
			(Array.isArray(items) ? items : [])
				.map((item) => cleanTrendTitle(item?.title))
				.filter((title) => title.length >= 5 && title.length <= 80),
		),
	).slice(0, limit);

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
	if ("name" in item && "value" in item) {
		// Cached item — backfill symbol if missing (old cache format)
		if (!("symbol" in item)) {
			return { ...item, symbol: item.name === "S&P 500" ? "SP500" : item.name };
		}
		return item;
	}

	const numericChange = Number(item.change ?? 0);
	const numericPrice = Number(item.price ?? 0);

	return {
		symbol: item.symbol,
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
		return getErrorText(
			"google_health_api_disabled",
			{},
			"Google Fitness API is disabled for this Google Cloud project. Enable it in Google Cloud, wait a few minutes, then reconnect Google.",
		);
	}
	if (isGoogleHealthAuthErrorMessage(message)) {
		return getErrorText(
			"google_health_auth",
			{},
			"Google Health connection expired. Reconnect Google to sync Health again.",
		);
	}
	return (
		message ||
		getErrorText("load_error", {}, "Failed to load Google Health data.")
	);
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
			if (!results?.length) {
				return {
					ok: false,
					error: getErrorText(
						"city_not_found",
						{ city: trimmed },
						`City "${trimmed}" not found.`,
					),
				};
			}
			const { lat, lon, display_name } = results[0];
			const cityData = { name: trimmed, displayName: display_name.split(",")[0], lat: parseFloat(lat), lon: parseFloat(lon) };
			save("mb_manual_city", cityData);
			set({ manualWeatherCity: cityData });
			return { ok: true };
		} catch {
			return {
				ok: false,
				error: getErrorText(
					"geocoding_failed",
					{},
					"Failed to find the city location.",
				),
			};
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

			set((s) => ({
				errors: {
					...s.errors,
					weather: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ weather: null });
			get().markFetched("weather");
			get().setApiStatus("weather", "error");
		} catch (e) {
			console.warn("fetchWeather failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					weather: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
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
				errors: {
					...s.errors,
					stocks: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
				rawData: { ...s.rawData, stocks: edge?.data ?? null },
			}));
			set({ stocks: [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} catch (e) {
			console.warn("fetchStocks failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					stocks: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ stocks: [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, stocks: false } }));
		}
	},

	validateStockSymbol: async (symbol) => {
		try {
			const edge = await invokeEdgeDetailed("stocks", { symbols: [symbol] });
			if (!edge?.ok || !Array.isArray(edge.data) || edge.data.length === 0) return false;
			return Number(edge.data[0]?.price ?? 0) > 0;
		} catch {
			return false;
		}
	},

	/* ══════════════════════════════════════════
	   실시간 트렌드 (Tavily API)
	   trends: 해시태그 배열
	   trendsAnswer: AI 요약 문자열
	   trendsResults: 출처 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchTrends: async (userId, force = false) => {
		const lang = resolveAppLanguage();
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
			const localizedResults = filterLocalizedArticles(
				dbCached?.data?.results ?? [],
				lang,
				7,
			);
			const fallbackResults = normalizeArticleList(dbCached?.data?.results ?? [], 7);
			const rawDisplayResults =
				localizedResults.length > 0 ? localizedResults : fallbackResults;
			const displayResults =
				lang === "ko"
					? await translateArticlesToKorean(rawDisplayResults)
					: rawDisplayResults;
			const displayTrends =
				buildTrendTitlesFromResults(displayResults, 8).length > 0
					? buildTrendTitlesFromResults(displayResults, 8)
					: dbCached?.data?.trends ?? [];
			if (displayResults.length > 0 || displayTrends.length > 0) {
				set({
					trends: displayTrends,
					trendsAnswer: dbCached.data.answer ?? null,
					trendsResults: displayResults,
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
				? "English-language major trending news headlines today worldwide technology AI politics economy entertainment sports latest"
				: "반드시 한국어 기사 제목만 사용. 영어/일본어/중국어/러시아어 등 외국어 제목 제외. 오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스";
			const includeDomains = isEn ? EN_NEWS_DOMAINS : KO_NEWS_DOMAINS;

			const edge = await invokeEdgeDetailed("tavily", {
				query: trendsQuery,
				include_domains: includeDomains,
			});
			if (edge?.data) {
				set((s) => ({ rawData: { ...s.rawData, trends: edge.data } }));
			}

			if (edge?.ok && edge.data?.trends) {
				const localizedResults = filterLocalizedArticles(
					edge.data.results ?? [],
					lang,
					7,
				);
				const fallbackResults = normalizeArticleList(edge.data.results ?? [], 7);
				const rawDisplayResults =
					localizedResults.length > 0 ? localizedResults : fallbackResults;
				const displayResults =
					lang === "ko"
						? await translateArticlesToKorean(rawDisplayResults)
						: rawDisplayResults;
				const displayTrends =
					buildTrendTitlesFromResults(displayResults, 8).length > 0
						? buildTrendTitlesFromResults(displayResults, 8)
						: edge.data.trends ?? [];
				const full = {
					trends: displayTrends,
					answer: edge.data.answer ?? null,
					results: displayResults,
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

			set((s) => ({
				errors: {
					...s.errors,
					trends: getTavilyErrorMessage(edge?.error || edge?.data?.error || ""),
				},
			}));
			set({ trendsResults: [], trends: [] });
			get().markFetched("trends");
			get().setApiStatus("trends", "error");
		} catch (e) {
			console.warn("fetchTrends failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					trends: getTavilyErrorMessage(e?.message || ""),
				},
			}));
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
		const lang = resolveAppLanguage();
		const isEn = lang === "en";

		// 관심사 키워드 (상위 5개)
		const settingsState = useSettingsStore.getState();
		const topKeywords = getTopInterestKeywords(
			settingsState.fixedInterestIds,
			settingsState.keywordInterests,
			5,
		);
		const interestFingerprint =
			getInterestFingerprint(
				settingsState.fixedInterestIds,
				settingsState.keywordInterests,
				5,
			);

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
			const localizedResults = filterLocalizedArticles(
				dbCached?.data?.results ?? [],
				lang,
				10,
			);
			const fallbackResults = normalizeArticleList(dbCached?.data?.results ?? [], 10);
			const rawDisplayResults =
				localizedResults.length > 0 ? localizedResults : fallbackResults;
			const displayResults =
				lang === "ko"
					? await translateArticlesToKorean(rawDisplayResults)
					: rawDisplayResults;
			if (displayResults.length > 0) {
				set({
					news: dbCached.data.news ?? [],
					newsAnswer: dbCached.data.answer ?? null,
					newsResults: displayResults,
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
				? (isEn ? ` topics: ${topKeywords.join(", ")}` : ` 관심사: ${topKeywords.join(", ")}`)
				: "";
			const localQuery = isEn
				? (locationObj
					? `latest English-language local breaking news today near latitude ${locationObj.lat} longitude ${locationObj.lon}${interestClause}`
					: `latest English-language South Korea breaking news today${interestClause}`)
				: (locationObj
					? `반드시 한국어 기사 제목만 사용하고 영어/외국어 기사 제목은 제외. 현재 위치(위도 ${locationObj.lat}, 경도 ${locationObj.lon}) 주변 지역의 한국어 최신 뉴스 속보${interestClause}`
					: `반드시 한국어 기사 제목만 사용하고 영어/외국어 기사 제목은 제외. 대한민국 한국어 최신 뉴스 속보${interestClause}`);

			const includeDomains = isEn ? EN_NEWS_DOMAINS : KO_NEWS_DOMAINS;
			const globalNewsQuery = isEn
				? "top English-language world breaking news headlines today"
				: "반드시 한국어 기사 제목만 사용하고 영어/외국어 기사 제목은 제외. 한국어 기사 기준 세계 주요 뉴스 속보 오늘";

			const [localEdge, globalEdge] = await Promise.all([
				invokeEdgeDetailed("tavily", {
					query: localQuery,
					mode: "news",
					max_results: 5,
					location: locationObj,
					include_domains: includeDomains,
				}),
				invokeEdgeDetailed("tavily", {
					query: globalNewsQuery,
					mode: "news",
					max_results: 5,
					include_domains: includeDomains,
				}),
			]);

			if (localEdge?.data) {
				set((s) => ({ rawData: { ...s.rawData, news: localEdge.data } }));
			}

			const localResults = localEdge?.ok
				? filterLocalizedArticles(localEdge.data?.results ?? [], lang, 5)
				: [];
			const globalResults = globalEdge?.ok
				? filterLocalizedArticles(globalEdge.data?.results ?? [], lang, 5)
				: [];
			const fallbackLocalResults = localEdge?.ok
				? normalizeArticleList(localEdge.data?.results ?? [], 5)
				: [];
			const fallbackGlobalResults = globalEdge?.ok
				? normalizeArticleList(globalEdge.data?.results ?? [], 5)
				: [];
			const chosenLocalResults =
				localResults.length > 0 ? localResults : fallbackLocalResults;
			const chosenGlobalResults =
				globalResults.length > 0 ? globalResults : fallbackGlobalResults;
			const didFetchAny = Boolean(localEdge?.ok || globalEdge?.ok);

			if (chosenLocalResults.length > 0 || chosenGlobalResults.length > 0) {
				const merged = dedupeArticles([
					...chosenLocalResults,
					...chosenGlobalResults,
				]).slice(0, 10);
				const finalResults =
					lang === "ko"
						? await translateArticlesToKorean(merged)
						: merged;
				const full = {
					news: [],
					answer: localEdge?.data?.answer ?? globalEdge?.data?.answer ?? null,
					results: finalResults,
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

			if (didFetchAny) {
				const full = {
					news: [],
					answer: localEdge?.data?.answer ?? globalEdge?.data?.answer ?? null,
					results: [],
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

			set((s) => ({
				errors: {
					...s.errors,
					news: getTavilyErrorMessage(
						localEdge?.error ||
						localEdge?.data?.error ||
						globalEdge?.error ||
						globalEdge?.data?.error ||
						"",
					),
				},
			}));
			set({ newsResults: [] });
			get().markFetched("news");
			get().setApiStatus("news", "error");
		} catch (e) {
			console.warn("fetchNews failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					news: getTavilyErrorMessage(e?.message || ""),
				},
			}));
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
			set((s) => ({
				errors: {
					...s.errors,
					health: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
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
					get().markFetched("health", dbCached.fetchedAt);
					get().setApiStatus("health", "ok");
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
			if (!token) {
				set((s) => ({
					errors: {
						...s.errors,
						health: getGoogleHealthErrorMessage("unauthorized"),
					},
				}));
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
				get().markFetched("health");
				get().setApiStatus("health", "ok");
			} else {
				set((s) => ({
					errors: {
						...s.errors,
						health: getGoogleHealthErrorMessage(
							edge?.error || edge?.data?.error || "",
						),
					},
				}));
				set({ healthData: null });
				get().markFetched("health");
				get().setApiStatus("health", "error");
			}
		} catch (e) {
			console.warn("fetchHealth failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					health: getGoogleHealthErrorMessage(e?.message || ""),
				},
			}));
			set({ healthData: null });
			get().markFetched("health");
			get().setApiStatus("health", "error");
		} finally {
			set((s) => ({
				loading: { ...s.loading, health: false },
			}));
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
const getInterestFingerprintFromState = (settingsState) =>
	getInterestFingerprint(
		settingsState?.fixedInterestIds,
		settingsState?.keywordInterests,
		5,
	);

let _prevInterestFingerprint = getInterestFingerprintFromState(
	useSettingsStore.getState(),
);

useSettingsStore.subscribe((state) => {
	const fingerprint = getInterestFingerprintFromState(state);
	if (fingerprint === _prevInterestFingerprint) return;
	_prevInterestFingerprint = fingerprint;

	// 뉴스만 재호출 — 트렌드는 관심사와 무관하게 세계 트렌드를 반영
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	if (store.apiStatus?.news === "ok" || store.apiStatus?.news === "error") {
		store.fetchNews(userId, true);
	}
});
