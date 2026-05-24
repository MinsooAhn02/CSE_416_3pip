import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn(
		"[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env에 설정되지 않았습니다. 오프라인 모드로 동작합니다.",
	);
}

/**
 * Custom storage adapter that strips Google OAuth tokens from the Supabase
 * session before it is written to localStorage.
 *
 * Supabase automatically persists the entire session object (including
 * `provider_token` and `provider_refresh_token`) under the key
 * `sb-<project-ref>-auth-token`. These tokens are Google OAuth access/refresh
 * tokens with broad Calendar/Drive scopes. Leaving them in localStorage means
 * they survive page reloads and are readable by any script on the page (XSS).
 *
 * The tokens are still available in-session via `useAuthStore.providerToken`
 * (populated from `session.provider_token` on every auth state change), so
 * runtime Calendar API calls are unaffected. They just do not persist to disk.
 */
const secureStorage = {
	getItem: (key: string): string | null => localStorage.getItem(key),
	setItem: (key: string, value: string): void => {
		// Key pattern for Supabase auth sessions: sb-<ref>-auth-token
		if (key.includes("-auth-token")) {
			try {
				const parsed = JSON.parse(value) as Record<string, unknown>;
				delete parsed.provider_token;
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

export const supabase: SupabaseClient | null =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey, {
				auth: { storage: secureStorage },
		  })
		: null;
