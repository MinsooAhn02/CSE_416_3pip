import { supabase } from "../../lib/supabase";
import { load, save } from "../../utils/storage";
import { useAuthStore } from "../../store/useAuthStore";
import { handleApiError } from "../../utils/errorHandler";
import { HANGUL_REGEX } from "./articles";
import { shouldBackfillKoreanCache } from "./translate";
import { ArticleItem } from "./types";


/* ────────────────────────────────────────────
   4-hour Access-Time-based Caching
   ──────────────────────────────────────────── */
export const CACHE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6시간 (raised from 4h to reduce Tavily API cost)

// 언어별 in-memory 캐시 — 언어 전환 시 로딩 없이 즉시 표시
export const _trendsMemCache: Record<string, { trends: string[]; trendsResults: ArticleItem[] }> = {}; // { ko: { trends, trendsResults }, en: {...} }

// 문제 5 fix: 앱 부팅 시 단일 warm-up을 보장하기 위한 게이트.
// fetchAll이 여러 번 호출되더라도 DB 읽기는 한 번만 수행.
let _trendsWarmupPromise: Promise<null> | null = null;

export const ACCESS_TIME_KEY = "mb_last_access_time";

export const getLastAccessTime = (): number => load(ACCESS_TIME_KEY, 0);
export const setLastAccessTime = (): void => save(ACCESS_TIME_KEY, Date.now());

/**
 * 접속 시간 기준으로 캐시가 유효한지 판단.
 * Δt = (현재 시간 - 마지막 접속 시간)
 * Δt > 1시간이면 stale → 전체 API 재호출
 * Δt ≤ 1시간이면 fresh → 캐시 사용
 */
export const isCacheStale = (): boolean => {
	const lastAccess = getLastAccessTime();
	if (!lastAccess) return true;
	const delta = Date.now() - lastAccess;
	return delta > CACHE_THRESHOLD_MS;
};

/* ── 로컬 캐시 헬퍼 (localStorage graceful fallback) ── */
export const cached = <T>(key: string, fallback: T): T => load(`mb_cache_${key}`, fallback);
export const cacheIt = (key: string, data: unknown): void => {
	save(`mb_cache_${key}`, data);
	save(`mb_cache_${key}_at`, Date.now());
};


/* ── DB 캐시 헬퍼 (api_cache 테이블) ── */
/** Auth store에서 동기적으로 userId를 읽는다. 네트워크 요청 없음. */
export const getUserId = (): string | null => {
	return useAuthStore.getState()?.user?.id ?? null;
};

export const shortHash = (str: string): string => {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
	}
	return h.toString(36);
};

export const toCacheRowId = (userId: string, cacheKey: string): string => {
	const raw = `u:${userId}:${cacheKey}`;
	if (raw.length <= 64) return raw;
	return `h:${userId.slice(0, 8)}:${shortHash(raw)}`;
};

export interface ApiCacheResult {
	data: unknown;
	fetchedAt: number;
}

/**
 * DB 캐시 읽기 - 1시간 접속시간 기반.
 * forceRefresh=true이면 캐시 무시 (수동 새로고침).
 * Returns { data, fetchedAt } so callers can stamp the real fetch time
 * instead of "now" (fixes the stale last-updated display bug).
 */
export const readApiCache = async (
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
export const warmupTrendsMemCache = async (userIdArg: string | null): Promise<null> => {
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

export const writeApiCache = async (
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
