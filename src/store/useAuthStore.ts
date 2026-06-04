import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { runPersonalizationBatch } from "../services/personalizationService";
import { normalizeFixedInterestIds } from "../utils/interests";
import type { Session } from "@supabase/supabase-js";
import { useSettingsStore } from "./useSettingsStore";
import { useOnboardingStore } from "./useOnboardingStore";
import type { AppUser, Perms, Interest } from "../types";

interface AuthState {
	isLoggedIn: boolean;
	user: AppUser | null;
	providerToken: string | null;
	providerRefreshToken: string | null;

	login: () => Promise<boolean>;
	reconnectGoogle: () => Promise<boolean>;
	logout: () => Promise<void>;
	handleAuthChange: (session: Session | null) => Promise<void>;
	ensureProviderToken: (forceRefresh?: boolean) => Promise<string | null>;
	loadUserSettings: () => Promise<void>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _pendingProviderTokenRefresh: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
	isLoggedIn: load<boolean>("mb_login", false),
	user: null,
	providerToken: null,
	providerRefreshToken: null,

	login: async () => {
		if (!supabase) {
			set({ isLoggedIn: true });
			save("mb_login", true);
			return true;
		}

		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				scopes: [
					"https://www.googleapis.com/auth/calendar",
					"https://www.googleapis.com/auth/tasks",
					"https://www.googleapis.com/auth/fitness.activity.read",
					"https://www.googleapis.com/auth/fitness.sleep.read",
					"https://www.googleapis.com/auth/fitness.heart_rate.read",
				].join(" "),
				queryParams: {
					access_type: "offline",
					prompt: "select_account",
					include_granted_scopes: "true",
				},
				redirectTo: window.location.origin,
			},
		});

		if (error) {
			console.error("Supabase login error:", error.message);
			return false;
		}

		return true;
	},

	reconnectGoogle: async () => {
		set({ providerToken: null });
		const didStart = await get().login();
		if (didStart === false) {
			throw new Error("Failed to reconnect Google");
		}
		return didStart;
	},

	logout: async () => {
		set({ isLoggedIn: false, user: null, providerToken: null, providerRefreshToken: null });
		useOnboardingStore.getState().reset();
		useSettingsStore.getState().resetInterests();
		save("mb_login", false);

		if (supabase) {
			try {
				const { error } = await supabase.auth.signOut();
				if (error) {
					console.error("Supabase logout error:", error.message);
				}
			} catch (e) {
				console.error("Logout failed:", e);
			}
		}
	},

	handleAuthChange: async (session) => {
		if (session) {
			const u = session.user;
			const uMeta = (u?.user_metadata ?? {}) as Record<string, unknown>;
			const nextProviderToken = session.provider_token ?? get().providerToken;
			// provider_refresh_token은 최초 OAuth 콜백 시에만 제공됨 — 있을 때만 갱신
			const nextRefreshToken = session.provider_refresh_token ?? get().providerRefreshToken;
			const user: AppUser = {
				id: u.id,
				email: u.email ?? "",
				displayName: (uMeta.full_name as string) || (u.email ?? ""),
				avatarUrl: (uMeta.avatar_url as string) || null,
			};
			set({
				isLoggedIn: true,
				user,
				providerToken: nextProviderToken,
				providerRefreshToken: nextRefreshToken,
			});
			save("mb_login", true);
			await get().loadUserSettings();
			return;
		}

		set({ isLoggedIn: false, user: null, providerToken: null, providerRefreshToken: null });
		useOnboardingStore.getState().reset();
		useSettingsStore.getState().resetInterests();
		save("mb_login", false);
	},

	ensureProviderToken: async (forceRefresh = false) => {
		// forceRefresh: 만료(401)로 강제 갱신 — 캐시/persisted provider_token을 신뢰하지 않음
		if (!forceRefresh) {
			const existing = get().providerToken;
			if (existing) return existing;
		} else {
			set({ providerToken: null });
		}

		if (!supabase) return null;

		// force 갱신은 항상 새 refresh를 시작 (stale 토큰으로 piggyback 방지)
		if (!forceRefresh && _pendingProviderTokenRefresh) return _pendingProviderTokenRefresh;

		_pendingProviderTokenRefresh = (async () => {
			try {
				// 1) 세션에 아직 토큰이 살아있는지 확인
				const {
					data: { session },
				} = await supabase.auth.getSession();
				// session에서 받은 refresh_token을 저장 (있을 때만)
				if (session?.provider_refresh_token) {
					set({ providerRefreshToken: session.provider_refresh_token });
				}
				// forceRefresh일 땐 persisted provider_token이 만료됐을 수 있으므로 신뢰하지 않음
				if (!forceRefresh) {
					const token = session?.provider_token ?? null;
					if (token) {
						set({ providerToken: token });
						return token;
					}
				}

				// 2) Supabase 세션 refresh (provider_token은 보통 null로 옴)
				const {
					data: { session: refreshedSession },
				} = await supabase.auth.refreshSession();
				const refreshedToken = refreshedSession?.provider_token ?? null;
				if (refreshedToken) {
					set({ providerToken: refreshedToken });
					return refreshedToken;
				}

				// 3) provider_refresh_token으로 Google 토큰 직접 갱신
				const refreshToken = session?.provider_refresh_token ?? get().providerRefreshToken;
				if (refreshToken && SUPABASE_URL && SUPABASE_ANON_KEY) {
					try {
						const res = await fetch(`${SUPABASE_URL}/functions/v1/google-refresh`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
							},
							body: JSON.stringify({ refresh_token: refreshToken }),
						});
						const data = await res.json() as { access_token?: string; error?: string };
						if (data.access_token) {
							set({ providerToken: data.access_token });
							return data.access_token;
						}
						console.warn("[gcal] google-refresh failed:", data.error);
					} catch (refreshErr) {
						console.warn("[gcal] google-refresh request failed:", refreshErr);
					}
				}

				return null;
			} catch (err) {
				console.warn("[gcal] ensureProviderToken failed:", err);
				return null;
			} finally {
				_pendingProviderTokenRefresh = null;
			}
		})();

		return _pendingProviderTokenRefresh;
	},

	loadUserSettings: async () => {
		if (!supabase) return;

		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		const { data } = await supabase
			.from("user_settings")
			.select("*")
			.eq("id", user.id)
			.single();

		if (data) {
			const dbData = data as Record<string, unknown>;
			const fixedInterestIds = normalizeFixedInterestIds(dbData.fixed_interests);
			const onboardingPermsRaw = dbData.onboarding_perms;
			const onboardingPerms: Perms =
				onboardingPermsRaw && typeof onboardingPermsRaw === "object"
					? {
							fit: Boolean((onboardingPermsRaw as Record<string, unknown>).fit),
							cal: Boolean((onboardingPermsRaw as Record<string, unknown>).cal),
						}
					: { fit: false, cal: false };
			const keywordInterests: Interest[] = Array.isArray(dbData.keyword_interests)
				? (dbData.keyword_interests as Interest[])
				: [];

			useOnboardingStore.getState().hydrate(
				(dbData.persona as string) ?? null,
				onboardingPerms,
				fixedInterestIds,
			);
			useSettingsStore.getState().hydrateInterests(fixedInterestIds, keywordInterests);

			runPersonalizationBatch()
				.then((interests) => {
					if (Array.isArray(interests) && interests.length > 0) {
						useSettingsStore.getState().setKeywordInterests(interests);
					}
				})
				.catch(() => {});
		} else {
			useOnboardingStore.getState().reset();
			useOnboardingStore.getState().setShowOnboarding(true);
			useSettingsStore.getState().resetInterests();
		}
	},
}));
