import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { formatLocalDate, shiftDateString } from "../utils/date";
import { getInterestFingerprint, getTopInterestKeywords } from "../utils/interests";
import { useSettingsStore } from "./useSettingsStore";
import { useAuthStore } from "./useAuthStore";
import { useOnboardingStore } from "./useOnboardingStore";
import i18n from "../l10n/i18n";
import { handleApiError } from "../utils/errorHandler";
const EDGE_TIMEOUT_MS = 25000;

/* ────────────────────────────────────────────
   4-hour Access-Time-based Caching
   ──────────────────────────────────────────── */
const CACHE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6시간 (raised from 4h to reduce Tavily API cost)

// 언어별 in-memory 캐시 — 언어 전환 시 로딩 없이 즉시 표시
const _trendsMemCache: Record<string, { trends: string[]; trendsResults: ArticleItem[] }> = {}; // { ko: { trends, trendsResults }, en: {...} }

// 문제 5 fix: 앱 부팅 시 단일 warm-up을 보장하기 위한 게이트.
// fetchAll이 여러 번 호출되더라도 DB 읽기는 한 번만 수행.
let _trendsWarmupPromise: Promise<null> | null = null;

const ACCESS_TIME_KEY = "mb_last_access_time";

const getLastAccessTime = (): number => load(ACCESS_TIME_KEY, 0);
const setLastAccessTime = (): void => save(ACCESS_TIME_KEY, Date.now());

/**
 * 접속 시간 기준으로 캐시가 유효한지 판단.
 * Δt = (현재 시간 - 마지막 접속 시간)
 * Δt > 1시간이면 stale → 전체 API 재호출
 * Δt ≤ 1시간이면 fresh → 캐시 사용
 */
const isCacheStale = (): boolean => {
	const lastAccess = getLastAccessTime();
	if (!lastAccess) return true;
	const delta = Date.now() - lastAccess;
	return delta > CACHE_THRESHOLD_MS;
};

/* ── Edge Function 호출 헬퍼 (직접 fetch - supabase.functions.invoke 대체) ── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface EdgeResult {
	ok: boolean;
	data: unknown;
	error: string | null;
	errorType: string | null;
	timedOut: boolean;
	elapsedMs: number;
}

const invokeEdgeDetailed = async (fnName: string, body: Record<string, unknown> = {}): Promise<EdgeResult | null> => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY || isGuest()) return null;
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

		const data: unknown = await res.json();

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
		const err = e as Error;
		if (err.name === "AbortError") {
			handleApiError(err, `edge:${fnName}`, { userVisible: true });
			return {
				ok: false,
				data: null,
				error: `timeout ${EDGE_TIMEOUT_MS}ms`,
				errorType: "timeout",
				timedOut: true,
				elapsedMs: Date.now() - startedAt,
			};
		}
		handleApiError(err, `edge:${fnName}`);
		return {
			ok: false,
			data: null,
			error: err.message || "Edge invoke failed",
			errorType: "network",
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	}
};

const invokeEdge = async (fnName: string, body: Record<string, unknown> = {}): Promise<unknown> => {
	const result = await invokeEdgeDetailed(fnName, body);
	return result?.ok ? result.data : null;
};

const resolveAppLanguage = (value = i18n.language): string =>
	String(value || "en").toLowerCase().startsWith("ko") ? "ko" : "en";

const getI18nText = (key: string, options: Record<string, unknown>, fallback: string): string => {
	const translated = i18n.t(key, options);
	return translated && translated !== key ? translated : fallback;
};

const getErrorText = (key: string, options: Record<string, unknown>, fallback: string): string =>
	getI18nText(`errors.${key}`, options, fallback);

const extractEdgeErrorMessage = (raw: unknown): string => {
	const text = String(raw || "").trim();
	if (!text) return "";

	const jsonMatch = text.match(/\{[\s\S]*\}$/);
	if (jsonMatch) {
		try {
			const parsed: unknown = JSON.parse(jsonMatch[0]);
			if (parsed && typeof parsed === "object") {
				const p = parsed as Record<string, unknown>;
				if (typeof p?.error === "string" && p.error.trim()) {
					return p.error.trim();
				}
				if (typeof p?.message === "string" && p.message.trim()) {
					return p.message.trim();
				}
			}
		} catch {
			/* ignore */
		}
	}

	return text;
};

const getTavilyErrorMessage = (raw: unknown): string => {
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
		return getErrorText("tavily_no_key", {}, "Tavily API key is not configured in Supabase.");
	}
	if (normalized.includes("tavily 401") || normalized.includes("tavily 403")) {
		return getErrorText("tavily_rejected", {}, "Tavily request was rejected. Check the API key and permissions.");
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
const cached = <T>(key: string, fallback: T): T => load(`mb_cache_${key}`, fallback);
const cacheIt = (key: string, data: unknown): void => {
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
interface GeoCache { lat: number; lon: number; at: number }
let _geoCache: GeoCache | null = null;
const GEO_CACHE_MS = 5 * 60 * 1000;

const getGeoPosition = async (): Promise<{ lat: number; lon: number } | null> => {
	if (_geoCache && Date.now() - _geoCache.at < GEO_CACHE_MS) {
		return { lat: _geoCache.lat, lon: _geoCache.lon };
	}
	if (typeof navigator === "undefined" || !navigator.geolocation) return null;
	try {
		const pos = await Promise.race([
			new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					timeout: 6000,
					maximumAge: GEO_CACHE_MS,
				}),
			),
			new Promise<never>((_, reject) =>
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
const getUserId = (): string | null => {
	return useAuthStore.getState()?.user?.id ?? null;
};

const shortHash = (str: string): string => {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
	}
	return h.toString(36);
};

const toCacheRowId = (userId: string, cacheKey: string): string => {
	const raw = `u:${userId}:${cacheKey}`;
	if (raw.length <= 64) return raw;
	return `h:${userId.slice(0, 8)}:${shortHash(raw)}`;
};

interface ApiCacheResult {
	data: unknown;
	fetchedAt: number;
}

/**
 * DB 캐시 읽기 - 1시간 접속시간 기반.
 * forceRefresh=true이면 캐시 무시 (수동 새로고침).
 * Returns { data, fetchedAt } so callers can stamp the real fetch time
 * instead of "now" (fixes the stale last-updated display bug).
 */
const readApiCache = async (
	cacheKey: string,
	userIdArg: string | null | undefined,
	forceRefresh = false,
): Promise<ApiCacheResult | null> => {
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
		if ((error as { code?: string }).code !== "PGRST116") {
			handleApiError(error, `cache_read:${cacheKey}`);
		}
		return null;
	}

	const row = data as { data: unknown; fetched_at: string | null } | null;
	if (!row?.fetched_at) return null;
	const fetchedAtMs = new Date(row.fetched_at).getTime();
	const age = Date.now() - fetchedAtMs;
	if (!Number.isFinite(age) || age > CACHE_THRESHOLD_MS) return null;

	return { data: row.data ?? null, fetchedAt: fetchedAtMs };
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
const warmupTrendsMemCache = async (userIdArg: string | null): Promise<null> => {
	if (_trendsWarmupPromise) return _trendsWarmupPromise;
	const userId = userIdArg ?? (await getUserId());
	if (!userId || !supabase) return null;

	_trendsWarmupPromise = (async (): Promise<null> => {
		const langs = ["ko", "en"];
		await Promise.all(
			langs.map(async (lang) => {
				if (_trendsMemCache[lang]) return; // 이미 fetchTrends가 채웠으면 건드리지 않음
				try {
					const dbCached = await readApiCache(`trends_full_${lang}`, userId, false);
					const payload = dbCached?.data as Record<string, unknown> | null;
					const results = Array.isArray(payload?.results) ? (payload.results as ArticleItem[]) : [];
					if (results.length === 0) return;

					if (lang === "ko") {
						if (shouldBackfillKoreanCache(payload)) return;
						const hasKorean = results.some((item) =>
							HANGUL_REGEX.test(String(item?.title || "")),
						);
						if (!hasKorean) return; // stale 영어 캐시면 warm-up 생략
					}

					if (_trendsMemCache[lang]) return; // race 방지
					_trendsMemCache[lang] = {
						trends: Array.isArray(payload?.trends) ? (payload.trends as string[]) : [],
						trendsResults: results,
					};
				} catch {
					/* warm-up 실패는 silently 허용 — fetchTrends에서 정상 재시도 */
				}
			}),
		);
		return null;
	})();

	try {
		await _trendsWarmupPromise;
	} catch {
		_trendsWarmupPromise = null;
	}
	return null;
};

const writeApiCache = async (
	cacheKey: string,
	payload: unknown,
	userIdArg: string | null | undefined,
	fetchedAtArg: number | null = null,
): Promise<void> => {
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
const extractLayoutWidgetIds = (layouts: unknown): Set<string> => {
	if (!layouts || typeof layouts !== "object") return new Set();
	const ids = new Set<string>();
	for (const key of Object.keys(layouts as Record<string, unknown>)) {
		const bpLayout = (layouts as Record<string, unknown>)[key];
		if (!Array.isArray(bpLayout)) continue;
		for (const item of bpLayout as { i?: string }[]) {
			if (item?.i) ids.add(item.i);
		}
	}
	return ids;
};

const defaultStockSymbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"];
const STOCK_SYMBOL_ALIAS_MAP: Record<string, string> = {
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
const HANGUL_REGEX = /[가-힣]/;
const LATIN_REGEX = /[A-Za-zÀ-ɏ]/;
const FOREIGN_SCRIPT_REGEX =
	/[Ѐ-ӿ぀-ヿ㐀-䶿一-鿿豈-﫿؀-ۿ฀-๿ऀ-ॿ]/;

const normalizeStockSymbols = (symbols: unknown[]): string[] => {
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

const normalizeReadableText = (value: unknown): string =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim();

const getUrlHost = (value = ""): string => {
	try {
		return new URL(String(value || "")).hostname.toLowerCase();
	} catch {
		return String(value || "").toLowerCase();
	}
};

const cleanTrendTitle = (raw = ""): string =>
	normalizeReadableText(raw)
		.replace(/\s*[-–|]\s*[^-–|]{2,35}$/, "")
		.replace(/\[.*?\]/g, "")
		.replace(/["'`*_#]/g, "")
		.trim();

const scoreLocalizedText = (text: unknown, language: string): number => {
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

const scoreArticleForLanguage = (item: ArticleItem, language: string): number => {
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

const normalizeArticleItem = (item: unknown): ArticleItem => {
	const i = item as Record<string, unknown> | null;
	return {
		title: normalizeReadableText(i?.title),
		url: String(i?.url || "").trim(),
		content: normalizeReadableText(i?.content),
		image: (i?.image ?? null) as string | null,
		published_date: (i?.published_date ?? null) as string | null,
	};
};

const normalizeArticleList = (items: unknown[] = [], limit = 10): ArticleItem[] =>
	(Array.isArray(items) ? items : [])
		.map(normalizeArticleItem)
		.filter((item) => item.title || item.url)
		.slice(0, limit);

const countPatternMatches = (value = "", pattern: RegExp): number =>
	(normalizeReadableText(value).match(pattern) ?? []).length;

const hasHangulText = (value = ""): boolean => HANGUL_REGEX.test(String(value || ""));

const needsKoreanTranslation = (value = ""): boolean => {
	const sample = normalizeReadableText(value);
	if (!sample) return false;
	const hangulCount = countPatternMatches(sample, /[가-힣]/g);
	const latinCount = countPatternMatches(sample, /[A-Za-zÀ-ɏ]/g);
	const foreignCount = countPatternMatches(
		sample,
		/[Ѐ-ӿ぀-ヿ㐀-䶿一-鿿豈-﫿؀-ۿ฀-๿ऀ-ॿ]/g,
	);

	if (hangulCount === 0) return true;
	if (foreignCount > hangulCount) return true;
	// Titles like "Trump tariff fight - 연합뉴스" contain Hangul, but are still English.
	return latinCount >= 12 && latinCount > hangulCount * 2;
};

const extractJsonArray = (text: unknown): unknown[] | null => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	try {
		const parsed: unknown = JSON.parse(trimmed);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		const match = trimmed.match(/\[[\s\S]*\]/);
		if (!match) return null;
		try {
			const parsed: unknown = JSON.parse(match[0]);
			return Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}
};

const translateTextToKorean = async (value = ""): Promise<string> => {
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

	const edgeData = edge?.data as Record<string, unknown> | null;
	const translated = normalizeReadableText(edgeData?.text);
	return translated || sourceText;
};

const translateArticlesToKorean = async (items: ArticleItem[] = []): Promise<ArticleItem[]> => {
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

	let translatedByIndex = new Map<number, { title: string; content: string }>();

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

		const edgeData = edge?.data as Record<string, unknown> | null;
		const parsed = extractJsonArray(edgeData?.text);
		if (Array.isArray(parsed) && parsed.length > 0) {
			translatedByIndex = new Map(
				(parsed as unknown[])
					.map((item) => {
						const i = item as Record<string, unknown>;
						const index = Number(i?.index);
						if (!Number.isInteger(index) || index < 0) return null;
						return [
							index,
							{
								title: normalizeReadableText(i?.title),
								content: normalizeReadableText(i?.content),
							},
						] as [number, { title: string; content: string }];
					})
					.filter((entry): entry is [number, { title: string; content: string }] => entry !== null),
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

const dedupeArticles = (items: ArticleItem[] = []): ArticleItem[] => {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key =
			String(item?.url || "").trim().toLowerCase() ||
			String(item?.title || "").trim().toLowerCase();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const filterByAllowedDomains = (items: ArticleItem[], language: string): ArticleItem[] => {
	if (!Array.isArray(items) || items.length === 0) return items;
	const allowedDomains = language === "ko" ? KO_NEWS_DOMAINS : EN_NEWS_DOMAINS;
	return items.filter((item) => {
		const host = getUrlHost(item?.url);
		// Exclude English-language subdomains (e.g. en.yna.co.kr) from Korean feed
		if (language === "ko" && /^en\./i.test(host)) return false;
		return allowedDomains.some((domain) => host.includes(domain));
	});
};

const filterLocalizedArticles = (
	items: unknown[],
	language: string,
	limit = 10,
): ArticleItem[] => {
	const scored = dedupeArticles(
		(Array.isArray(items) ? items : [])
			.map((item) => {
				const normalized = normalizeArticleItem(item);
				if (!normalized.title && !normalized.url) return null;
				const score = scoreArticleForLanguage(normalized, language);
				return { ...normalized, __score: score };
			})
			.filter((item): item is ArticleItem & { __score: number } => item !== null)
			.sort((a, b) => (b as ArticleItem & { __score: number }).__score - (a as ArticleItem & { __score: number }).__score),
	);

	if (language === "ko") {
		const localized = (scored as (ArticleItem & { __score?: number })[])
			.filter((item) => (item.__score ?? 0) > 0)
			.map(({ __score: _score, ...rest }) => rest as ArticleItem);
		return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
	}

	const localized = (scored as (ArticleItem & { __score?: number })[])
		.filter((item) => (item.__score ?? 0) > 0)
		.map(({ __score: _score, ...rest }) => rest as ArticleItem);
	return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
};

const buildTrendTitlesFromResults = (items: ArticleItem[], limit = 8): string[] =>
	Array.from(
		new Set(
			(Array.isArray(items) ? items : [])
				.map((item) => cleanTrendTitle(item?.title))
				.filter((title) => title.length >= 5 && title.length <= 80),
		),
	).slice(0, limit);

const buildLocalizedTrendTitles = async (
	items: ArticleItem[],
	fallbackTitles: string[] = [],
	language: string,
	limit = 8,
): Promise<string[]> => {
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

const shouldBackfillKoreanCache = (payload: unknown): boolean => {
	if (!payload || typeof payload !== "object") return false;
	const p = payload as Record<string, unknown>;
	const results = Array.isArray(p.results) ? (p.results as Record<string, unknown>[]) : [];
	const trends = Array.isArray(p.trends) ? (p.trends as string[]) : [];

	return (
		results.some(
			(item) =>
				needsKoreanTranslation(String(item?.title || "")) ||
				(item?.content && needsKoreanTranslation(String(item.content))),
		) || trends.some((title) => needsKoreanTranslation(title))
	);
};

const numberFormatter = new Intl.NumberFormat("ko-KR", {
	maximumFractionDigits: 2,
});

/* ── 날씨: Groq LLM 추정 (유일한 소스) ── */
const normalizeGroqWeather = (payload: unknown): WeatherData | null => {
	if (!payload || typeof payload !== "object") return null;
	const p = payload as Record<string, unknown>;
	const temp = Number(p.temp);
	const humidity = Number(p.humidity);
	const precipitation = Number(p.precipitation);
	const airQualityIndex = typeof p.airQualityIndex === "number" ? p.airQualityIndex : undefined;
	const conditionId = typeof p.conditionId === "number" ? p.conditionId : undefined;
	return {
		temp: Number.isFinite(temp) ? temp : 20,
		city: String(p.city || "Seoul"),
		condition: String(p.condition || p.description || "N/A"),
		conditionId,
		precipitation: Number.isFinite(precipitation) ? precipitation : 0,
		airQuality: p.airQuality ? String(p.airQuality) : undefined,
		airQualityIndex,
		humidity: Number.isFinite(humidity) ? humidity : 50,
	};
};

/* ── 주식 정규화 ── */
const toTwoDecimalPercentString = (value: unknown): string | null => {
	const cleaned = String(value ?? "")
		.replace(/,/g, "")
		.replace(/%/g, "")
		.trim();
	const n = Number(cleaned);
	if (!Number.isFinite(n)) return null;
	return `${n.toFixed(2)}%`;
};

const toStockDisplayValue = (value: unknown): string => {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return "--";
	return numberFormatter.format(n);
};

interface RawStockRow {
	symbol?: string;
	name?: string;
	value?: string | number;
	change?: string | number;
	up?: boolean;
	type?: string;
	currency?: string;
	price?: number;
	changePercent?: string | number;
}

const normalizeStockItem = (item: unknown): StockItem | null => {
	if (!item) return null;
	const row = item as RawStockRow;
	if ("name" in row && "value" in row) {
		// Cached item — backfill symbol if missing (old cache format)
		const normalizedChange = toTwoDecimalPercentString(row.change);
		const normalizedValue = toStockDisplayValue(
			typeof row.value === "string"
				? row.value.replace(/[^0-9.\-]/g, "")
				: row.value,
		);
		const baseItem =
			normalizedChange != null ? { ...row, change: normalizedChange } : row;
		const normalizedItem = { ...baseItem, value: normalizedValue };
		if (!("symbol" in row)) {
			return {
				...normalizedItem,
				symbol: row.name === "S&P 500" ? "SP500" : (row.name ?? ""),
				name: row.name ?? "",
				value: normalizedValue,
				change: normalizedChange ?? String(row.change ?? ""),
				up: row.up ?? false,
			} as StockItem;
		}
		return normalizedItem as StockItem;
	}

	const numericChange = Number(row.change ?? 0);
	const numericPrice = Number(row.price ?? 0);
	const normalizedPercent = toTwoDecimalPercentString(row.changePercent);

	return {
		symbol: row.symbol ?? "",
		name: row.symbol === "SP500" ? "S&P 500" :
			row.symbol === "CRUDE" ? "WTI Crude" :
			row.symbol === "DXY" ? "Dollar Index" :
			row.symbol === "DJI" ? "Dow Jones" :
			(row.symbol ?? ""),
		value: toStockDisplayValue(numericPrice),
		change:
			normalizedPercent ??
			`${numericChange >= 0 ? "+" : ""}${numberFormatter.format(numericChange)}`,
		up: numericChange >= 0,
		...(row.type != null && { type: row.type }),
		...(row.currency != null && { currency: row.currency }),
	};
};

const hasMeaningfulStockValues = (rows: unknown[]): boolean => {
	if (!Array.isArray(rows) || rows.length === 0) return false;
	return rows.some((row) => {
		const r = row as RawStockRow | null;
		// Raw edge 응답은 { price: number } 형태
		const rawPrice = Number(r?.price ?? 0);
		if (rawPrice > 0) return true;
		// normalizeStockItem 통과 후 캐시에 저장된 형태는 { value: "1,234.56" }
		// → 여기도 인식하지 못하면 주식 DB 캐시가 항상 bypass 되어
		//   매번 API를 두드림 (과거 latent 버그).
		const v = r?.value;
		if (typeof v !== "string") return false;
		const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
		return Number.isFinite(parsed) && parsed > 0;
	});
};

const getStockSymbolKey = (row: unknown): string => {
	const r = row as RawStockRow | null;
	const upper = String(r?.symbol ?? r?.name ?? "")
		.trim()
		.toUpperCase();
	if (!upper) return "";
	return STOCK_SYMBOL_ALIAS_MAP[upper] ?? upper;
};

const getStockRowNumericValue = (row: unknown): number => {
	const r = row as RawStockRow | null;
	const rawPrice = Number(r?.price ?? 0);
	if (Number.isFinite(rawPrice) && rawPrice > 0) return rawPrice;
	const v = r?.value;
	if (typeof v !== "string") return 0;
	const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

const pickBestStockRowsForSymbols = (symbols: unknown[], ...sources: unknown[][]): unknown[] => {
	const normalizedSymbols = normalizeStockSymbols(symbols);
	const bestByKey = new Map<string, unknown>();

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
		.filter((row): row is unknown => row !== undefined);
};

/* ── 건강 데이터 정규화: Steps + Sleep 유효 필터링 ── */
const normalizeHealthData = (raw: unknown): HealthData | null => {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	return {
		steps: Number(r.steps) || 0,
		stepsGoal: 10000,
		sleep: Number(r.sleep) || 0,
		sleepGoal: 8,
		calories: Number(r.calories) || 0,
		caloriesGoal: 2200,
		heartRate: Number(r.heartRate) || 0,
		water: 0,
		waterGoal: 8,
	};
};

const isGoogleHealthAuthErrorMessage = (message = ""): boolean => {
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

const isGoogleHealthApiDisabledMessage = (message = ""): boolean => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("accessnotconfigured") ||
		normalized.includes("service_disabled") ||
		normalized.includes("fitness api has not been used") ||
		normalized.includes("google fit 403") ||
		normalized.includes("google fit api has not been used")
	);
};

const getGoogleHealthErrorMessage = (message = ""): string => {
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
   Type definitions
   ══════════════════════════════════════════════ */

export interface WeatherData {
	temp: number;
	city: string;
	condition: string;
	conditionId?: number;
	precipitation: number;
	airQuality?: string;
	airQualityIndex?: number;
	humidity?: number;
	icon?: string;
}

export interface StockItem {
	symbol: string;
	name: string;
	value: string;
	change: string;
	up: boolean;
	type?: string;
	currency?: string;
}

export interface ArticleItem {
	title: string;
	url: string;
	content: string;
	image: string | null;
	published_date: string | null;
	source?: string;
}

export interface HealthData {
	steps: number;
	stepsGoal: number;
	sleep: number;
	sleepGoal: number;
	calories: number;
	caloriesGoal: number;
	heartRate: number;
	water: number;
	waterGoal: number;
}

export interface ManualCity {
	name: string;
	displayName: string;
	lat: number;
	lon: number;
}

export interface CalendarEventBasic {
	id?: string;
	title?: string;
	summary?: string;
	start: string;
	end?: string;
	location?: string;
	description?: string;
	allDay?: boolean;
	startTime?: string;
	endTime?: string;
}

interface DataState {
	weather: WeatherData | null;
	stocks: StockItem[];
	trends: string[];
	trendsResults: ArticleItem[];
	newsAnswer: string | null;
	newsResults: ArticleItem[];
	calEvents: CalendarEventBasic[];
	tomorrowEvents: CalendarEventBasic[];
	healthData: HealthData | null;
	rawData: { weather: unknown; stocks: unknown };
	onboardingProfile: { age: number | string | null; interests: string[]; persona: string | null } | null;
	activeWidgetIds: string[];
	usingDefaultWeatherLocation: boolean;
	manualWeatherCity: ManualCity | null;
	loading: Record<string, boolean>;
	errors: Record<string, string | null>;
	apiStatus: Record<string, "ok" | "error" | null>;
	fetchedLanguage: Record<string, string>;
	lastFetchedAt: Record<string, number>;
	initialFetchDone: boolean;

	setActiveWidgetIds: (ids: string[]) => void;
	setApiStatus: (key: string, status: "ok" | "error" | null) => void;
	markFetched: (key: string, ts?: number | null) => void;
	getLastUpdatedMinutes: (key: string) => number | null;
	clearFeedForLanguageSwitch: () => void;

	setManualWeatherCity: (city: string | null) => Promise<{ ok: boolean; error?: string }>;
	fetchWeather: (
		latArg?: number | null,
		lonArg?: number | null,
		userId?: string | null,
		force?: boolean,
	) => Promise<void>;

	fetchStocks: (
		symbols?: string[],
		userId?: string | null,
		force?: boolean,
	) => Promise<void>;
	validateStockSymbol: (symbol: string) => Promise<boolean>;

	fetchTrends: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchNews: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchCalendar: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchTomorrowCalendar: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchHealth: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchAll: (options?: { useExistingCache?: boolean }) => Promise<void>;
}

/* ══════════════════════════════════════════════
   Store
   ══════════════════════════════════════════════ */
export const useDataStore = create<DataState>()((set, get) => ({
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
	initialFetchDone: false, // 첫 fetchAll 완료 여부 — 브리핑이 일부 데이터만으로 생성되는 것 방지
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
			const results = await res.json() as { lat: string; lon: string; display_name: string }[];
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
			const cityData: ManualCity = {
				name: trimmed,
				displayName: display_name.split(",")[0],
				lat: parseFloat(lat),
				lon: parseFloat(lon),
			};
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
		if (isGuest()) return; // 샘플 날씨 유지 + 위치 권한 팝업 방지
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
		const lang = i18n.language?.startsWith("ko") ? "ko" : "en";
		const cacheKey = `weather_${rLat}_${rLon}_${lang}`;

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data) {
				set({ weather: dbCached.data as WeatherData, usingDefaultWeatherLocation: usingDefault });
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
			// OpenWeatherMap Edge Function 호출 (lang 전달 → 현지화 condition/city)
			const edge = await invokeEdgeDetailed("weather", { lat: rLat, lon: rLon, lang });
			const edgeData = edge?.data as Record<string, unknown> | null;

			if (edge?.ok && edgeData && !edgeData.error) {
				const parsed = normalizeGroqWeather(edgeData);
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
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		const normalizedSymbols = normalizeStockSymbols(symbols);
		const cacheKey = `stocks_${normalizedSymbols.join("_")}`;
		const localCachedStocks = cached<unknown[]>("stocks", []);
		const localCachedAt = Number(load("mb_cache_stocks_at", 0));
		const previousStocks = Array.isArray(get().stocks) ? get().stocks : [];

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data && hasMeaningfulStockValues(dbCached.data as unknown[])) {
				const pickedCachedRows = pickBestStockRowsForSymbols(
					normalizedSymbols,
					dbCached.data as unknown[],
				);
				if (hasMeaningfulStockValues(pickedCachedRows)) {
					set((s) => ({
						stocks: pickedCachedRows as StockItem[],
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
					stocks: pickedLocalRows as StockItem[],
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
					? (edge.data as unknown[]).map(normalizeStockItem).filter((r): r is StockItem => r !== null)
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
					set({ stocks: merged as StockItem[] });
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
					stocks: fallbackRows as StockItem[],
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
					stocks: fallbackRows as StockItem[],
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
			const row = edge.data[0] as RawStockRow | null;
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
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
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
			const dbData = dbCached?.data as Record<string, unknown> | null;
			const localizedResults = filterLocalizedArticles(
				(dbData?.results ?? []) as unknown[],
				lang,
				7,
			);
			const fallbackResults = normalizeArticleList((dbData?.results ?? []) as unknown[], 7);
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
				cacheLanguageMismatch ? [] : (dbData?.trends ?? []) as string[],
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
				if (lang === "ko" && dbCached && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
				get().markFetched("trends", dbCached?.fetchedAt);
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
			const edgeData = edge?.data as Record<string, unknown> | null;

			if (edge?.ok && edgeData?.trends) {
				const localizedResults = filterLocalizedArticles(
					(edgeData.results ?? []) as unknown[],
					lang,
					7,
				);
				const fallbackResults = normalizeArticleList((edgeData.results ?? []) as unknown[], 7);
				const rawDisplayResults =
					localizedResults.length > 0 ? localizedResults : fallbackResults;
				const displayResults =
					lang === "ko"
						? await translateArticlesToKorean(rawDisplayResults)
						: rawDisplayResults;
				const displayTrends = await buildLocalizedTrendTitles(
					displayResults,
					(edgeData.trends ?? []) as string[],
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
					trends: getTavilyErrorMessage(edge?.error || edgeData?.error || ""),
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
					trends: getTavilyErrorMessage((e as Error)?.message || ""),
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
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
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
			const dbData = dbCached?.data as Record<string, unknown> | null;
			const rawDisplayResults = filterLocalizedArticles(
				(dbData?.results ?? []) as unknown[],
				lang,
				10,
			);
			const displayResults =
				lang === "ko"
					? await translateArticlesToKorean(rawDisplayResults)
					: rawDisplayResults;
			if (displayResults.length > 0) {
				const full = {
					answer: (dbData?.answer ?? null) as string | null,
					results: displayResults,
				};
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
					fetchedLanguage: { ...get().fetchedLanguage, news: lang },
				});
				if (lang === "ko" && dbCached && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
				get().markFetched("news", dbCached?.fetchedAt);
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

			const localEdgeData = localEdge?.data as Record<string, unknown> | null;
			const globalEdgeData = globalEdge?.data as Record<string, unknown> | null;

			const localRawResults = localEdge?.ok ? ((localEdgeData?.results ?? []) as unknown[]) : [];
			const localResults = filterLocalizedArticles(localRawResults, lang, 5);
			const localExtendedResults = filterLocalizedArticles(localRawResults, lang, 12);
			const globalResults = globalEdge?.ok
				? filterLocalizedArticles((globalEdgeData?.results ?? []) as unknown[], lang, 5)
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
					answer: (localEdgeData?.answer ?? globalEdgeData?.answer ?? null) as string | null,
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
				// 뉴스와 중복되는 URL은 제외하여 브리핑에서 두 섹션이 동일해지지 않도록 함
				if ((get().trends ?? []).length === 0 && localExtendedResults.length > 0) {
					try {
						const newsUrls = new Set(
							(get().newsResults ?? []).map((a) => (a as ArticleItem).url).filter(Boolean),
						);
						const uniqueExtended = localExtendedResults.filter(
							(a) => !newsUrls.has((a as ArticleItem).url),
						);
						const sourceForTrends = uniqueExtended.length >= 3 ? uniqueExtended : localExtendedResults;
						const translatedExtended =
							lang === "ko"
								? await translateArticlesToKorean(sourceForTrends)
								: sourceForTrends;
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
					answer: (localEdgeData?.answer ?? globalEdgeData?.answer ?? null) as string | null,
					results: [] as ArticleItem[],
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
						localEdgeData?.error ||
						globalEdge?.error ||
						globalEdgeData?.error ||
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
					news: getTavilyErrorMessage((e as Error)?.message || ""),
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
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.cal) {
			set({ calEvents: [] });
			get().markFetched("calendar");
			return;
		}
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
					set({ calEvents: dbCached.data as CalendarEventBasic[] });
					cacheIt("calendar", dbCached.data);
					get().markFetched("calendar", dbCached.fetchedAt);
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
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
				const todayEvents = (data as CalendarEventBasic[]).filter((ev) => {
					const start = ev.start;
					if (!start) return false;
					return String(start).startsWith(todayStr);
				});
				set({ calEvents: todayEvents });
				cacheIt("calendar", todayEvents);
				await writeApiCache(cacheKey, todayEvents, userId);
				get().markFetched("calendar");
			} else {
				set({ calEvents: cached<CalendarEventBasic[]>("calendar", []) });
				get().markFetched("calendar");
			}
		} catch (e) {
			handleApiError(e, "fetchCalendar");
			set({ calEvents: cached<CalendarEventBasic[]>("calendar", []) });
			get().markFetched("calendar");
		}
	},

	/* ══════════════════════════════════════════
	   캘린더 - 내일 일정 (Tomorrow)
	   오후 브리핑에서 사용
	   ══════════════════════════════════════════ */
	fetchTomorrowCalendar: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.cal) {
			set({ tomorrowEvents: [] });
			return;
		}
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
					set({ tomorrowEvents: dbCached.data as CalendarEventBasic[] });
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
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
				const filtered = (data as CalendarEventBasic[]).filter((ev) =>
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
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.fit) {
			set({ healthData: null });
			get().markFetched("health");
			get().setApiStatus("health", null);
			return;
		}
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
					set({ healthData: dbCached.data as HealthData });
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
				const edgeData = edge?.data as Record<string, unknown> | null;
				set((s) => ({
					errors: {
						...s.errors,
						health: getGoogleHealthErrorMessage(
							String(edge?.error || edgeData?.error || ""),
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
					health: getGoogleHealthErrorMessage((e as Error)?.message || ""),
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
		if (isGuest()) return; // 게스트는 샘플 데이터만 사용
		const { useExistingCache = false } = options;
		const store = get();

		// useExistingCache=true면 항상 캐시 우선 (force=false)
		// useExistingCache=false면 기존 30분 stale 체크 적용
		const shouldForceRefresh = useExistingCache ? false : isCacheStale();

		let userId: string | null = null;
		let visibleWidgets = Object.keys(DEFAULT_VIS).filter(
			(key) => (DEFAULT_VIS as Record<string, boolean>)[key],
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

					const settings = settingsRes.data as Record<string, unknown> | null;
					const layouts = (layoutRes.data as { layouts?: unknown } | null)?.layouts ?? null;

					set({
						onboardingProfile: {
							age: null,
							interests: [],
							persona: (settings?.persona ?? null) as string | null,
						},
					});

					const visibility: Record<string, boolean> = {
						...(DEFAULT_VIS as Record<string, boolean>),
						...((settings?.vis as Record<string, boolean>) ?? {}),
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

		const jobs: Promise<unknown>[] = [];
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
		set({ initialFetchDone: true });

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

// fetchAll 동시 실행 방지: 초기화·5분 폴링·탭 복귀가 겹치면 진행 중인 작업을 재사용
// (캐시가 비었을 때 같은 Tavily/Groq 요청이 중복으로 나가던 문제)
const runFetchAll = useDataStore.getState().fetchAll;
let fetchAllInFlight: Promise<void> | null = null;
useDataStore.setState({
	fetchAll: (options) =>
		(fetchAllInFlight ??= runFetchAll(options).finally(() => {
			fetchAllInFlight = null;
		})),
});

// 관심사 변경 시 뉴스 자동 재호출 — 상위 키워드 "구성"이 바뀔 때만.
// 순서만 바뀌는 경우(개인화 배치 점수 갱신 등)는 결과가 같으므로 정렬해서 비교
const getInterestFingerprintFromState = (settingsState: ReturnType<typeof useSettingsStore.getState>): string =>
	getInterestFingerprint(
		settingsState?.fixedInterestIds,
		settingsState?.keywordInterests,
		5,
	).split("+").sort().join("+");

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
