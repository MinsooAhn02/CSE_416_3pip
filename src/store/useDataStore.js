import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { formatLocalDate, shiftDateString } from "../utils/date";
import { getInterestFingerprint, getTopInterestKeywords } from "../utils/interests";
import { useSettingsStore } from "./useSettingsStore";
import { useAuthStore } from "./useAuthStore";
import i18n from "../l10n/i18n";
import { handleApiError } from "../utils/errorHandler";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const EDGE_TIMEOUT_MS = 25000;

/* ────────────────────────────────────────────
   4-hour Access-Time-based Caching
   ──────────────────────────────────────────── */
const CACHE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6시간 (raised from 4h to reduce Tavily API cost)

// 언어별 in-memory 캐시 — 언어 전환 시 로딩 없이 즉시 표시
const _trendsMemCache = {}; // { ko: { trends, trendsResults }, en: {...} }

// 문제 5 fix: 앱 부팅 시 단일 warm-up을 보장하기 위한 게이트.
// fetchAll이 여러 번 호출되더라도 DB 읽기는 한 번만 수행.
let _trendsWarmupPromise = null;

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

	let bearerToken = SUPABASE_ANON_KEY;
	if (supabase) {
		const { data: { session } } = await supabase.auth.getSession();
		if (session?.access_token) bearerToken = session.access_token;
	}

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${bearerToken}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timer);

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			handleApiError(
				{ message: `HTTP ${res.status}: ${text}` },
				`edge:${fnName}`,
				{ httpStatus: res.status },
			);
			return {
				ok: false,
				data: null,
				error: `HTTP ${res.status}: ${text}`,
				errorType: res.status >= 500 ? "http_5xx" : "http_4xx",
				timedOut: false,
				elapsedMs: Date.now() - startedAt,
			};
		}

		const data = await res.json();

		return {
			ok: true,
			data,
			error: null,
			errorType: null,
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	} catch (e) {
		clearTimeout(timer);
		if (e.name === "AbortError") {
			handleApiError(e, `edge:${fnName}`, { userVisible: true });
			return {
				ok: false,
				data: null,
				error: `timeout ${EDGE_TIMEOUT_MS}ms`,
				errorType: "timeout",
				timedOut: true,
				elapsedMs: Date.now() - startedAt,
			};
		}
		handleApiError(e, `edge:${fnName}`);
		return {
			ok: false,
			data: null,
			error: e.message || "Edge invoke failed",
			errorType: "network",
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
			handleApiError(error, `cache_read:${cacheKey}`);
		}
		return null;
	}

	if (!data?.fetched_at) return null;
	const fetchedAtMs = new Date(data.fetched_at).getTime();
	const age = Date.now() - fetchedAtMs;
	if (!Number.isFinite(age) || age > CACHE_THRESHOLD_MS) return null;

	return { data: data.data ?? null, fetchedAt: fetchedAtMs };
};

/**
 * 문제 5 fix: 앱 초기화 시 양 언어(ko/en) trends DB 캐시를 _trendsMemCache로 미리 읽어옴.
 * 이렇게 하면 F5 직후 첫 언어 전환도 로딩 없이 즉시 표시됨.
 *
 * - 부팅당 1회만 수행 (_trendsWarmupPromise 게이트)
 * - 추가 API 호출 없음 (DB read만)
 * - lang=ko 캐시에 한국어 결과가 0개면(문제 1과 동일한 stale 영어 캐시) 해당 슬롯은 비움
 * - 동시 진행 중인 fetchTrends가 _trendsMemCache[lang]를 set한 경우, 기존 값을 보존
 */
const warmupTrendsMemCache = async (userIdArg) => {
	if (_trendsWarmupPromise) return _trendsWarmupPromise;
	const userId = userIdArg ?? (await getUserId());
	if (!userId || !supabase) return null;

	_trendsWarmupPromise = (async () => {
		const langs = ["ko", "en"];
		await Promise.all(
			langs.map(async (lang) => {
				if (_trendsMemCache[lang]) return; // 이미 fetchTrends가 채웠으면 건드리지 않음
				try {
					const dbCached = await readApiCache(`trends_full_${lang}`, userId, false);
					const results = dbCached?.data?.results ?? [];
					if (!Array.isArray(results) || results.length === 0) return;

					if (lang === "ko") {
						if (shouldBackfillKoreanCache(dbCached.data)) return;
						const hasKorean = results.some((item) =>
							HANGUL_REGEX.test(String(item?.title || "")),
						);
						if (!hasKorean) return; // stale 영어 캐시면 warm-up 생략
					}

					if (_trendsMemCache[lang]) return; // race 방지
					_trendsMemCache[lang] = {
						trends: dbCached.data.trends ?? [],
						trendsResults: results,
					};
				} catch {
					/* warm-up 실패는 silently 허용 — fetchTrends에서 정상 재시도 */
				}
			}),
		);
	})();

	try {
		await _trendsWarmupPromise;
	} catch {
		_trendsWarmupPromise = null;
	}
	return null;
};

const writeApiCache = async (cacheKey, payload, userIdArg, fetchedAtArg = null) => {
	if (!supabase) return;
	const userId = userIdArg ?? (await getUserId());
	if (!userId) return;

	const rowId = toCacheRowId(userId, cacheKey);
	const fetchedAt = fetchedAtArg ? new Date(fetchedAtArg) : new Date();
	const { error } = await supabase.from("api_cache").upsert({
		id: rowId,
		user_id: userId,
		data: payload,
		fetched_at: Number.isFinite(fetchedAt.getTime())
			? fetchedAt.toISOString()
			: new Date().toISOString(),
	});

	if (error) {
		handleApiError(error, `cache_write:${cacheKey}`);
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
const STOCK_SYMBOL_ALIAS_MAP = {
	KOSPI: "KOSPI",
	KS11: "KOSPI",
	"^KOSPI": "KOSPI",
	"^KS11": "KOSPI",
	NASDAQ: "NASDAQ",
	IXIC: "NASDAQ",
	"^IXIC": "NASDAQ",
	SP500: "SP500",
	"SP 500": "SP500",
	"S&P500": "SP500",
	"S&P 500": "SP500",
	SPX: "SP500",
	"^SPX": "SP500",
	USDKRW: "USDKRW",
	"USD/KRW": "USDKRW",
	"USD-KRW": "USDKRW",
};
const KO_NEWS_DOMAINS = [
	"news.naver.com",
	"yna.co.kr",
	"chosun.com",
	"joins.com",
	"hani.co.kr",
	"news1.kr",
	"khan.co.kr",
	"donga.com",
	"hankyung.com",
	"mk.co.kr",
	"ytn.co.kr",
	"jtbc.co.kr",
	"sbs.co.kr",
	"imnews.imbc.com",
	"news.kbs.co.kr",
	"edaily.co.kr",
	"zdnet.co.kr",
	"etnews.com",
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
				.map((s) => STOCK_SYMBOL_ALIAS_MAP[s] ?? s)
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
	const content = normalizeReadableText(item?.content);
	const host = getUrlHost(item?.url);

	const titleScore = scoreLocalizedText(title, language);
	const contentScore = scoreLocalizedText(content, language);
	const isKoHost = KO_NEWS_DOMAINS.some((domain) => host.includes(domain));
	const isEnHost = EN_NEWS_DOMAINS.some((domain) => host.includes(domain));
	const hostBonus = language === "ko" ? (isKoHost ? 2 : 0) : (isEnHost ? 2 : 0);

	if (language === "ko") {
		if (titleScore > 0) return titleScore * 4 + hostBonus;
		if (contentScore > 0) return contentScore * 2 + hostBonus;
		if (isKoHost) return hostBonus;
		return -1;
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

const countPatternMatches = (value = "", pattern) =>
	(normalizeReadableText(value).match(pattern) ?? []).length;

const hasHangulText = (value = "") => HANGUL_REGEX.test(String(value || ""));

const needsKoreanTranslation = (value = "") => {
	const sample = normalizeReadableText(value);
	if (!sample) return false;
	const hangulCount = countPatternMatches(sample, /[\uac00-\ud7a3]/g);
	const latinCount = countPatternMatches(sample, /[A-Za-z\u00C0-\u024F]/g);
	const foreignCount = countPatternMatches(
		sample,
		/[\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u0600-\u06FF\u0E00-\u0E7F\u0900-\u097F]/g,
	);

	if (hangulCount === 0) return true;
	if (foreignCount > hangulCount) return true;
	// Titles like "Trump tariff fight - 연합뉴스" contain Hangul, but are still English.
	return latinCount >= 12 && latinCount > hangulCount * 2;
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

const filterByAllowedDomains = (items, language) => {
	if (!Array.isArray(items) || items.length === 0) return items;
	const allowedDomains = language === "ko" ? KO_NEWS_DOMAINS : EN_NEWS_DOMAINS;
	return items.filter((item) => {
		const host = getUrlHost(item?.url);
		// Exclude English-language subdomains (e.g. en.yna.co.kr) from Korean feed
		if (language === "ko" && /^en\./i.test(host)) return false;
		return allowedDomains.some((domain) => host.includes(domain));
	});
};

const filterLocalizedArticles = (items, language, limit = 10) => {
	const scored = dedupeArticles(
		(Array.isArray(items) ? items : [])
			.map((item) => {
				const normalized = normalizeArticleItem(item);
				if (!normalized.title && !normalized.url) return null;
				const score = scoreArticleForLanguage(normalized, language);
				return { ...normalized, __score: score };
			})
			.filter(Boolean)
			.sort((a, b) => b.__score - a.__score),
	);

	if (language === "ko") {
		const localized = scored
			.filter((item) => item.__score > 0)
			.map(({ __score, ...rest }) => rest);
		return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
	}

	const localized = scored
		.filter((item) => item.__score > 0)
		.map(({ __score, ...rest }) => rest);
	return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
};

const buildTrendTitlesFromResults = (items, limit = 8) =>
	Array.from(
		new Set(
			(Array.isArray(items) ? items : [])
				.map((item) => cleanTrendTitle(item?.title))
				.filter((title) => title.length >= 5 && title.length <= 80),
		),
	).slice(0, limit);

const buildLocalizedTrendTitles = async (
	items,
	fallbackTitles = [],
	language,
	limit = 8,
) => {
	const articleTitles = buildTrendTitlesFromResults(items, limit);
	const sourceTitles = articleTitles.length > 0 ? articleTitles : fallbackTitles;
	const uniqueTitles = Array.from(
		new Set(
			(Array.isArray(sourceTitles) ? sourceTitles : [])
				.map((title) => cleanTrendTitle(title))
				.filter((title) => title.length >= 2 && title.length <= 80),
		),
	).slice(0, limit);

	if (language !== "ko") return uniqueTitles;

	const translatedTitles = await Promise.all(
		uniqueTitles.map(async (title) =>
			needsKoreanTranslation(title) ? translateTextToKorean(title) : title,
		),
	);

	return Array.from(
		new Set(
			translatedTitles
				.map((title) => cleanTrendTitle(title))
				.filter((title) => title.length >= 2 && hasHangulText(title)),
		),
	).slice(0, limit);
};

const shouldBackfillKoreanCache = (payload) => {
	if (!payload || typeof payload !== "object") return false;
	const results = Array.isArray(payload.results) ? payload.results : [];
	const trends = Array.isArray(payload.trends) ? payload.trends : [];

	return (
		results.some(
			(item) =>
				needsKoreanTranslation(item?.title) ||
				(item?.content && needsKoreanTranslation(item.content)),
		) || trends.some((title) => needsKoreanTranslation(title))
	);
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
		city: String(payload.city || "Seoul"),
		condition: String(payload.condition || payload.description || "N/A"),
		precipitation: Number.isFinite(precipitation) ? precipitation : 0,
		airQuality: String(payload.airQuality || "N/A"),
		humidity: Number.isFinite(humidity) ? humidity : 50,
	};
};

/* ── 주식 정규화 ── */
const toTwoDecimalPercentString = (value) => {
	const cleaned = String(value ?? "")
		.replace(/,/g, "")
		.replace(/%/g, "")
		.trim();
	const n = Number(cleaned);
	if (!Number.isFinite(n)) return null;
	return `${n.toFixed(2)}%`;
};

const toStockDisplayValue = (value) => {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return "--";
	return numberFormatter.format(n);
};

const normalizeStockItem = (item) => {
	if (!item) return null;
	if ("name" in item && "value" in item) {
		// Cached item — backfill symbol if missing (old cache format)
		const normalizedChange = toTwoDecimalPercentString(item.change);
		const normalizedValue = toStockDisplayValue(
			typeof item.value === "string"
				? item.value.replace(/[^0-9.\-]/g, "")
				: item.value,
		);
		const baseItem =
			normalizedChange != null ? { ...item, change: normalizedChange } : item;
		const normalizedItem = { ...baseItem, value: normalizedValue };
		if (!("symbol" in item)) {
			return {
				...normalizedItem,
				symbol: item.name === "S&P 500" ? "SP500" : item.name,
			};
		}
		return normalizedItem;
	}

	const numericChange = Number(item.change ?? 0);
	const numericPrice = Number(item.price ?? 0);
	const normalizedPercent = toTwoDecimalPercentString(item.changePercent);

	return {
		symbol: item.symbol,
		name: item.symbol === "SP500" ? "S&P 500" :
			item.symbol === "CRUDE" ? "WTI Crude" :
			item.symbol === "DXY" ? "Dollar Index" :
			item.symbol === "DJI" ? "Dow Jones" :
			item.symbol,
		value: toStockDisplayValue(numericPrice),
		change:
			normalizedPercent ??
			`${numericChange >= 0 ? "+" : ""}${numberFormatter.format(numericChange)}`,
		up: numericChange >= 0,
		...(item.type != null && { type: item.type }),
		...(item.currency != null && { currency: item.currency }),
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

const getStockSymbolKey = (row) => {
	const upper = String(row?.symbol ?? row?.name ?? "")
		.trim()
		.toUpperCase();
	if (!upper) return "";
	return STOCK_SYMBOL_ALIAS_MAP[upper] ?? upper;
};

const getStockRowNumericValue = (row) => {
	const rawPrice = Number(row?.price ?? 0);
	if (Number.isFinite(rawPrice) && rawPrice > 0) return rawPrice;
	const v = row?.value;
	if (typeof v !== "string") return 0;
	const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

const mergeStocksWithPreviousValidValues = (nextRows, prevRows) => {
	if (!Array.isArray(nextRows) || nextRows.length === 0) return [];
	const prevByKey = new Map(
		(Array.isArray(prevRows) ? prevRows : [])
			.map((row) => [getStockSymbolKey(row), row])
			.filter(([key]) => Boolean(key)),
	);
	return nextRows.map((row) => {
		if (getStockRowNumericValue(row) > 0) return row;
		const key = getStockSymbolKey(row);
		const prev = prevByKey.get(key);
		return prev && getStockRowNumericValue(prev) > 0 ? prev : row;
	});
};

const pickBestStockRowsForSymbols = (symbols, ...sources) => {
	const normalizedSymbols = normalizeStockSymbols(symbols);
	const bestByKey = new Map();

	for (const source of sources) {
		const rows = Array.isArray(source) ? source : [];
		for (const row of rows) {
			const key = getStockSymbolKey(row);
			if (!key) continue;
			const current = bestByKey.get(key);
			const currentValue = getStockRowNumericValue(current);
			const incomingValue = getStockRowNumericValue(row);
			if (!current || (incomingValue > 0 && currentValue <= 0)) {
				bestByKey.set(key, row);
			}
		}
	}

	return normalizedSymbols
		.map((symbol) => bestByKey.get(symbol))
		.filter(Boolean);
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
	trendsResults: [],
	newsAnswer: null,
	newsResults: [],
	calEvents: [],
	tomorrowEvents: [],
	healthData: null,
	rawData: {
		weather: null,
		stocks: null,
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

	/* 언어 전환 시 뉴스/트렌드 즉시 초기화 — 새 언어로 fetch 전까지 빈 상태 유지 */
	clearFeedForLanguageSwitch: () =>
		set((s) => ({
			newsResults: [],
			trendsResults: [],
			loading: { ...s.loading, news: true, trends: true },
			errors: { ...s.errors, news: null, trends: null },
		})),

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
			handleApiError(e, "fetchWeather");
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
		const localCachedStocks = cached("stocks", []);
		const localCachedAt = Number(load("mb_cache_stocks_at", 0));
		const previousStocks = Array.isArray(get().stocks) ? get().stocks : [];

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data && hasMeaningfulStockValues(dbCached.data)) {
				const pickedCachedRows = pickBestStockRowsForSymbols(
					normalizedSymbols,
					dbCached.data,
				);
				if (hasMeaningfulStockValues(pickedCachedRows)) {
					set((s) => ({
						stocks: pickedCachedRows,
						errors: { ...s.errors, stocks: null },
					}));
					cacheIt("stocks", pickedCachedRows);
					get().markFetched("stocks", dbCached.fetchedAt);
					get().setApiStatus("stocks", "ok");
					return; // ← loading 상태 변경 없음
				}
			}

			const pickedLocalRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(pickedLocalRows)) {
				set((s) => ({
					stocks: pickedLocalRows,
					errors: { ...s.errors, stocks: null },
				}));
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
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

			const normalizedEdgeRows =
				edge?.ok && Array.isArray(edge.data)
					? edge.data.map(normalizeStockItem).filter(Boolean)
					: [];

			if (edge?.ok && Array.isArray(edge.data)) {
				set((s) => ({
					rawData: { ...s.rawData, stocks: edge.data },
				}));
				const merged = pickBestStockRowsForSymbols(
					normalizedSymbols,
					normalizedEdgeRows,
					previousStocks,
					localCachedStocks,
				);
				if (hasMeaningfulStockValues(merged)) {
					set({ stocks: merged });
					cacheIt("stocks", merged);
					await writeApiCache(cacheKey, merged, userId);
					get().markFetched("stocks");
					get().setApiStatus("stocks", "ok");
					return;
				}
			}

			const fallbackRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				normalizedEdgeRows,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(fallbackRows)) {
				set((s) => ({
					stocks: fallbackRows,
					errors: { ...s.errors, stocks: null },
				}));
				cacheIt("stocks", fallbackRows);
				await writeApiCache(cacheKey, fallbackRows, userId);
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
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
			set({ stocks: previousStocks.length > 0 ? previousStocks : [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} catch (e) {
			handleApiError(e, "fetchStocks");

			const fallbackRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(fallbackRows)) {
				set((s) => ({
					stocks: fallbackRows,
					errors: { ...s.errors, stocks: null },
				}));
				cacheIt("stocks", fallbackRows);
				await writeApiCache(cacheKey, fallbackRows, userId);
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
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
			}));
			set({ stocks: previousStocks.length > 0 ? previousStocks : [] });
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
			const row = edge.data[0];
			if (!row || typeof row !== "object") return false;
			return Number(row.price ?? 0) > 0;
		} catch {
			return false;
		}
	},

	/* ══════════════════════════════════════════
	   실시간 트렌드 (Tavily API)
	   trends: 해시태그 배열
	   trendsResults: 출처 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchTrends: async (userId, force = false) => {
		const lang = resolveAppLanguage();
		const isEn = lang === "en";

		// 트렌드는 관심사 무관 — 세상에서 실제로 뜨는 것을 보여줌
		const cacheKey = `trends_full_${lang}`;

		// ✅ 1순위: 메모리 캐시 — 언어 전환 시 즉시 표시 (로딩 없음)
		if (!force && _trendsMemCache[lang]) {
			const mem = _trendsMemCache[lang];
			set({
				trends: mem.trends,
				trendsResults: mem.trendsResults,
				fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
			});
			get().setApiStatus("trends", "ok");
			return;
		}

		// ✅ 2순위: DB 캐시 확인 (cacheKey에 언어가 포함되어 있으므로 언어별로 독립 캐시됨)
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			const localizedResults = filterLocalizedArticles(
				dbCached?.data?.results ?? [],
				lang,
				7,
			);
			const fallbackResults = normalizeArticleList(dbCached?.data?.results ?? [], 7);
			// 문제 1 fix: 캐시 read 시 언어 검증.
			// lang=ko인데 캐시 데이터에 한국어 결과가 하나도 없으면(낡은 영어 캐시)
			// 캐시 무시하고 fresh fetch로 진행 — 영어 데이터를 한글로 강제 번역해 보여주는
			// 어색한 결과를 방지.
			const cacheLanguageMismatch =
				lang === "ko" &&
				localizedResults.length === 0 &&
				fallbackResults.length > 0;
			if (cacheLanguageMismatch) {
				console.info(
					`[trends] ${cacheKey} cache invalidated: no Korean content in cached data`,
				);
			}
			const rawDisplayResults =
				localizedResults.length > 0 ? localizedResults : fallbackResults;
			const displayResults =
				cacheLanguageMismatch
					? []
					: lang === "ko"
						? await translateArticlesToKorean(rawDisplayResults)
						: rawDisplayResults;
			const displayTrends = await buildLocalizedTrendTitles(
				displayResults,
				cacheLanguageMismatch ? [] : dbCached?.data?.trends ?? [],
				lang,
				8,
			);
			if (displayResults.length > 0 || displayTrends.length > 0) {
				const full = {
					trends: displayTrends,
					results: displayResults,
				};
				_trendsMemCache[lang] = {
					trends: full.trends,
					trendsResults: full.results,
				};
				set({
					trends: full.trends,
					trendsResults: full.results,
					fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
				});
				if (lang === "ko" && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
				get().markFetched("trends", dbCached.fetchedAt);
				get().setApiStatus("trends", "ok");
				return;
			}
		}

		// ✅ 3순위: 이미 로드된 news 결과에서 트렌드 파생 (Tavily 호출 절약)
		if (!force) {
			const currentNewsResults = get().newsResults ?? [];
			const newsLang = get().fetchedLanguage?.news;
			if (currentNewsResults.length >= 3 && newsLang === lang) {
				try {
					const derivedTrends = await buildLocalizedTrendTitles(
						currentNewsResults,
						[],
						lang,
						8,
					);
					if (derivedTrends.length >= 2) {
						const trendsResults = currentNewsResults.slice(0, 7);
						_trendsMemCache[lang] = { trends: derivedTrends, trendsResults };
						set({
							trends: derivedTrends,
							trendsResults,
							fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
						});
						await writeApiCache(
							cacheKey,
							{ trends: derivedTrends, results: trendsResults },
							userId,
						);
						get().markFetched("trends");
						get().setApiStatus("trends", "ok");
						return;
					}
				} catch (e) {
					handleApiError(e, "fetchTrends:derive");
				}
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
				const displayTrends = await buildLocalizedTrendTitles(
					displayResults,
					edge.data.trends ?? [],
					lang,
					8,
				);
				const full = {
					trends: displayTrends,
					results: displayResults,
				};
				_trendsMemCache[lang] = {
					trends: full.trends,
					trendsResults: full.results,
				};
				set({
					trends: full.trends,
					trendsResults: full.results,
				});
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
			handleApiError(e, "fetchTrends");
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

		const cacheKey = `news_${lang}_${interestFingerprint}`;

		// ✅ 캐시 우선 확인 (cacheKey에 언어가 포함되어 있으므로 언어별로 독립 캐시됨)
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			const rawDisplayResults = filterLocalizedArticles(
				dbCached?.data?.results ?? [],
				lang,
				10,
			);
			const displayResults =
				lang === "ko"
					? await translateArticlesToKorean(rawDisplayResults)
					: rawDisplayResults;
			if (displayResults.length > 0) {
				const full = {
					answer: dbCached.data.answer ?? null,
					results: displayResults,
				};
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
					fetchedLanguage: { ...get().fetchedLanguage, news: lang },
				});
				if (lang === "ko" && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
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
			// 로컬 뉴스 5개 + 글로벌 뉴스 5개 병렬 호출 (geolocation 제거 — 언어별 쿼리로 대체)
			const interestClause = topKeywords.length > 0
				? (isEn ? ` Focus topics: ${topKeywords.join(", ")}.` : ` 관심 주제: ${topKeywords.join(", ")}.`)
				: "";
			const localQuery = isEn
				? `Top 10 live issues in America: politics, tech, economy, lifestyle trends today.${interestClause}`
				: `대한민국 실시간 주요 뉴스: 정치, 경제, IT, 라이프스타일, 사회 트렌드 오늘.${interestClause}`;

			const includeDomains = isEn ? EN_NEWS_DOMAINS : KO_NEWS_DOMAINS;
			const globalNewsQuery = isEn
				? "Top world breaking news today: international politics, business, technology, science."
				: "오늘의 세계 주요 뉴스 속보: 국제 정치, 경제, 기술, 과학.";

			const [localEdge, globalEdge] = await Promise.all([
				invokeEdgeDetailed("tavily", {
					query: localQuery,
					mode: "news",
					max_results: 12,
					...(includeDomains.length > 0 ? { include_domains: includeDomains } : {}),
				}),
				invokeEdgeDetailed("tavily", {
					query: globalNewsQuery,
					mode: "news",
					max_results: 5,
				}),
			]);

			const localRawResults = localEdge?.ok ? (localEdge.data?.results ?? []) : [];
			const localResults = filterLocalizedArticles(localRawResults, lang, 5);
			const localExtendedResults = filterLocalizedArticles(localRawResults, lang, 12);
			const globalResults = globalEdge?.ok
				? filterLocalizedArticles(globalEdge.data?.results ?? [], lang, 5)
				: [];
			const didFetchAny = Boolean(localEdge?.ok || globalEdge?.ok);

			if (localResults.length > 0 || globalResults.length > 0) {
				const merged = dedupeArticles([
					...localResults,
					...globalResults,
				]).slice(0, 10);
				const finalResults =
					lang === "ko"
						? await translateArticlesToKorean(merged)
						: merged;
				const full = {
					answer: localEdge?.data?.answer ?? globalEdge?.data?.answer ?? null,
					results: finalResults,
				};
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
				});
				await writeApiCache(cacheKey, full, userId);
				get().markFetched("news");
				get().setApiStatus("news", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, news: lang } }));

				// trends 상태가 비어 있으면 local 확장 결과(12건)에서 파생 — 별도 Tavily 호출 절약
				if ((get().trends ?? []).length === 0 && localExtendedResults.length > 0) {
					try {
						const translatedExtended =
							lang === "ko"
								? await translateArticlesToKorean(localExtendedResults)
								: localExtendedResults;
						const derivedTrends = await buildLocalizedTrendTitles(
							translatedExtended,
							[],
							lang,
							8,
						);
						if (derivedTrends.length > 0) {
							const trendsResults = translatedExtended.slice(0, 7);
							const trendsCacheKey = `trends_full_${lang}`;
							_trendsMemCache[lang] = { trends: derivedTrends, trendsResults };
							set({ trends: derivedTrends, trendsResults });
							await writeApiCache(
								trendsCacheKey,
								{ trends: derivedTrends, results: trendsResults },
								userId,
							);
							get().markFetched("trends");
							get().setApiStatus("trends", "ok");
							set((s) => ({
								fetchedLanguage: { ...s.fetchedLanguage, trends: lang },
							}));
						}
					} catch (e) {
						handleApiError(e, "fetchNews:trends");
					}
				}

				return;
			}

			if (didFetchAny) {
				const full = {
					answer: localEdge?.data?.answer ?? globalEdge?.data?.answer ?? null,
					results: [],
				};
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
				});
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
			handleApiError(e, "fetchNews");
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
			set({ calEvents: [] });
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
				set({ calEvents: [] });
				get().markFetched("calendar");
				return;
			}

			const todayStr = formatLocalDate();
			const startLocalToday = new Date(`${todayStr}T00:00:00`);
			const endLocalToday = new Date(startLocalToday.getTime() + 24 * 60 * 60 * 1000);
			const data = await invokeEdge("events", {
				token,
				timeMin: startLocalToday.toISOString(),
				timeMax: endLocalToday.toISOString(),
			});
			if (data && Array.isArray(data)) {
				// 프론트에서도 오늘 일정만 필터링 (안전장치)
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
				set({ calEvents: cached("calendar", []) });
				get().markFetched("calendar");
			}
		} catch (e) {
			handleApiError(e, "fetchCalendar");
			set({ calEvents: cached("calendar", []) });
			get().markFetched("calendar");
		}
	},

	/* ══════════════════════════════════════════
	   캘린더 - 내일 일정 (Tomorrow)
	   오후 브리핑에서 사용
	   ══════════════════════════════════════════ */
	fetchTomorrowCalendar: async (userId, force = false) => {
		if (!supabase) {
			set({ tomorrowEvents: [] });
			return;
		}

		const tomorrowStr = shiftDateString(formatLocalDate(), 1);
		const cacheKey = `calendar_${tomorrowStr}`;

		try {
			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ tomorrowEvents: dbCached.data });
					return;
				}
			}

			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token;
			if (!token) {
				set({ tomorrowEvents: [] });
				return;
			}

			const startLocal = new Date(`${tomorrowStr}T00:00:00`);
			const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
			const data = await invokeEdge("events", {
				token,
				timeMin: startLocal.toISOString(),
				timeMax: endLocal.toISOString(),
			});
			if (data && Array.isArray(data)) {
				const filtered = data.filter((ev) =>
					String(ev?.start ?? "").startsWith(tomorrowStr),
				);
				set({ tomorrowEvents: filtered });
				await writeApiCache(cacheKey, filtered, userId);
			} else {
				set({ tomorrowEvents: [] });
			}
		} catch (e) {
			handleApiError(e, "fetchTomorrowCalendar");
			set({ tomorrowEvents: [] });
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
			handleApiError(e, "fetchHealth");
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
				handleApiError(dbErr, "fetchAll:db");
			}
		}

		set({ activeWidgetIds: visibleWidgets });

		// 문제 5 fix: 양 언어 trends 캐시를 메모리에 미리 적재 (DB read만, API 호출 없음).
		// fetchTrends와 병렬로 진행 — fetchTrends가 끝나기 전이라도 다른 언어는 이미 준비됨.
		if (userId && visibleWidgets.includes("trends")) {
			warmupTrendsMemCache(userId).catch(() => {});
		}

		const stockSymbols =
			useSettingsStore?.getState?.()?.stockSymbols ?? defaultStockSymbols;
		const fixedIndexSymbols =
			useSettingsStore?.getState?.()?.fixedIndexSymbols ?? [];
		const allStockSymbols = [
			...new Set([...fixedIndexSymbols, ...stockSymbols]),
		];

		const jobs = [];
		if (visibleWidgets.includes("weather"))
			jobs.push(
				store
					.fetchWeather(undefined, undefined, userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:weather"),
					),
			);
		if (visibleWidgets.includes("stocks"))
			jobs.push(
				store
					.fetchStocks(allStockSymbols, userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:stocks"),
					),
			);
		// news → trends 순서로 실행: fetchNews가 trends를 파생하면 Tavily 호출 1회 절약
		if (visibleWidgets.includes("trends") && visibleWidgets.includes("news")) {
			jobs.push(
				store
					.fetchNews(userId, shouldForceRefresh)
					.then(() => store.fetchTrends(userId, shouldForceRefresh))
					.catch((e) =>
						handleApiError(e, "fetchAll:news+trends"),
					),
			);
		} else {
			if (visibleWidgets.includes("trends"))
				jobs.push(
					store
						.fetchTrends(userId, shouldForceRefresh)
						.catch((e) =>
							handleApiError(e, "fetchAll:trends"),
						),
				);
			if (visibleWidgets.includes("news"))
				jobs.push(
					store
						.fetchNews(userId, shouldForceRefresh)
						.catch((e) =>
							handleApiError(e, "fetchAll:news"),
						),
				);
		}
		if (visibleWidgets.includes("calendar")) {
			jobs.push(
				store
					.fetchCalendar(userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:calendar"),
					),
			);
		}
		// 브리핑은 FIXED_WIDGET이므로 calendar 위젯 표시 여부와 무관하게 항상 fetch
		jobs.push(
			store
				.fetchTomorrowCalendar(userId, shouldForceRefresh)
				.catch((e) =>
					handleApiError(e, "fetchAll:tomorrow"),
				),
		);
		if (visibleWidgets.includes("health"))
			jobs.push(
				store
					.fetchHealth(userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:health"),
					),
			);

		await Promise.all(jobs);

		// fetchAll 완료 후 접속 시간 갱신
		setLastAccessTime();
	},
}));

// 언어 변경 시 뉴스/트렌드 즉시 초기화 후 새 언어로 강제 재호출
i18n.on("languageChanged", () => {
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	const hasNews = store.apiStatus?.news === "ok" || store.apiStatus?.news === "error";
	const hasTrends = store.apiStatus?.trends === "ok" || store.apiStatus?.trends === "error";
	if (hasNews || hasTrends) {
		store.clearFeedForLanguageSwitch();
	}
	// news 먼저 완료 후 trends 실행 — fetchNews가 trends를 파생하면 Tavily 1회 절약
	if (hasNews) {
		store.fetchNews(userId, false).then(() => {
			if (hasTrends) store.fetchTrends(userId, false);
		});
	} else if (hasTrends) {
		store.fetchTrends(userId, false);
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
