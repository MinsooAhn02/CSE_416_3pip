import { createClient, SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn(
		"[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env에 설정되지 않았습니다. 오프라인 모드로 동작합니다.",
	);
}

/**
 * Custom storage adapter that strips ONLY `provider_refresh_token` from the
 * Supabase session before it is written to localStorage.
 *
 * Why not strip `provider_token` too:
 * Supabase explicitly does NOT refresh OAuth provider tokens — once the
 * `provider_token` is gone from the persisted session, there is no way to
 * recover it short of a full re-login. Stripping it caused Google
 * Calendar / Tasks / Fit to silently fail on every page reload because
 * `fetchTomorrowCalendar` (and other Google-API callers) saw `null` from
 * `ensureProviderToken()`. The access token expires in 1 h anyway, so
 * persisting it gives the same effective exposure window as a short-lived
 * in-memory copy.
 *
 * Why strip `provider_refresh_token`:
 * The refresh token is long-lived and would let an attacker mint new access
 * tokens indefinitely. We don't use it from the browser (Supabase manages
 * its own JWT refresh server-side), so removing it costs no functionality.
 */
const secureStorage = {
	getItem: (key: string): string | null => localStorage.getItem(key),
	setItem: (key: string, value: string): void => {
		// Key pattern for Supabase auth sessions: sb-<ref>-auth-token
		if (key.includes("-auth-token")) {
			try {
				const parsed = JSON.parse(value) as Record<string, unknown>;
				delete parsed.provider_refresh_token;
				localStorage.setItem(key, JSON.stringify(parsed));
				return;
			} catch {
				// Parsing failed — fall through and store the raw value
			}
		}
		localStorage.setItem(key, value);
	},
	removeItem: (key: string): void => localStorage.removeItem(key),
};

// Google 로그인 직후(OAuth 콜백)로 열린 페이지인지 — createClient가 URL을 정리하기 전에 판별.
// App이 "새 로그인 → 강제 새로고침" / "그냥 새로고침 → 캐시 사용"을 구분하는 데 씀.
export const openedFromOAuthRedirect: boolean =
	typeof window !== "undefined" &&
	(window.location.hash.includes("access_token=") || /[?&]code=/.test(window.location.search));

/**
 * 현재 로그인 사용자 — 로컬 세션에서 읽음 (네트워크 호출 없음).
 * auth.getUser()는 매번 /auth/v1/user를 호출하고 탭 간 auth 잠금을 잡아, 탭 여러 개에서
 * "Lock ... was released because another request stole it"로 hydrate가 실패했음 (BACKLOG R10).
 * DB 접근은 어차피 서버(RLS)가 JWT로 다시 검증하므로 클라이언트 쪽 식별은 세션으로 충분.
 */
export const getSessionUser = async (): Promise<User | null> =>
	supabase ? (await supabase.auth.getSession()).data.session?.user ?? null : null;

export const supabase: SupabaseClient | null =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey, {
				auth: { storage: secureStorage },
		  })
		: null;
