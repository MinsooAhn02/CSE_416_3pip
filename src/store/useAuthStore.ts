import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { runPersonalizationBatch } from "../services/personalizationService";
import { normalizeFixedInterestIds } from "../utils/interests";
import type { Session } from "@supabase/supabase-js";
import { useSettingsStore } from "./useSettingsStore";
import { useOnboardingStore } from "./useOnboardingStore";
import type { AppUser, Perms, Interest } from "../types";
import { handleApiError } from "../utils/errorHandler";
import { isGuest } from "../lib/guest";

let settingsLoadedFor: string | null = null;
let settingsLoadPromise: Promise<void> = Promise.resolve();
/** 관심사(user_settings) 로드 완료 대기 — App이 fetchAll 전에 기다려야 뉴스가 처음부터
 *  실제 관심사 기준 캐시를 읽음 (안 그러면 기본 관심사로 먼저 읽고 바뀌면서 Tavily/Groq 재호출) */
export const waitForUserSettings = (): Promise<void> => settingsLoadPromise;

interface AuthState {
	isLoggedIn: boolean;
	/** Google 토큰을 더 이상 갱신할 수 없음 → 재연결 배너 표시 (캘린더/할 일이 캐시로 조용히 대체되던 문제) */
	googleReconnectNeeded: boolean;
	dismissGoogleReconnect: () => void;
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
	googleReconnectNeeded: false,
	dismissGoogleReconnect: () => set({ googleReconnectNeeded: false }),
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
		// 게스트 상태는 메모리에만 있음 → 새로고침이 샘플 데이터까지 깔끔하게 지움
		if (isGuest()) {
			window.location.reload();
			return;
		}
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
			// getSession + onAuthStateChange(INITIAL_SESSION/TOKEN_REFRESHED/SIGNED_IN)가 같은 유저로
			// 여러 번 들어옴 → 유저당 1회만 로드 (개인화 배치 Groq 중복 호출·점수 이중 기록 방지)
			if (settingsLoadedFor !== u.id) {
				settingsLoadedFor = u.id;
				settingsLoadPromise = get().loadUserSettings().catch(() => {});
				await settingsLoadPromise;
			}
			return;
		}

		if (isGuest()) return; // 세션 없음 이벤트가 둘러보기 화면을 로그인 화면으로 튕기지 않게
		settingsLoadedFor = null;
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

		if (!supabase || isGuest()) return null;

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
						set({ providerToken: token, googleReconnectNeeded: false });
						return token;
					}
				}

				// 2) Supabase 세션 refresh (provider_token은 보통 null로 옴)
				const {
					data: { session: refreshedSession },
				} = await supabase.auth.refreshSession();
				const refreshedToken = refreshedSession?.provider_token ?? null;
				if (refreshedToken) {
					set({ providerToken: refreshedToken, googleReconnectNeeded: false });
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
								apikey: SUPABASE_ANON_KEY,
								Authorization: `Bearer ${refreshedSession?.access_token ?? session?.access_token ?? SUPABASE_ANON_KEY}`,
							},
							body: JSON.stringify({ refresh_token: refreshToken }),
						});
						const data = await res.json() as { access_token?: string; error?: string };
						if (data.access_token) {
							set({ providerToken: data.access_token, googleReconnectNeeded: false });
							return data.access_token;
						}
						console.warn("[gcal] google-refresh failed:", data.error);
					} catch (refreshErr) {
						console.warn("[gcal] google-refresh request failed:", refreshErr);
					}
				}

				// 세션·refresh token 모두 실패 → 재로그인 외엔 방법 없음
				set({ googleReconnectNeeded: true });
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
		if (!user) {
			settingsLoadedFor = null;
			return;
		}

		const { data, error } = await supabase
			.from("user_settings")
			.select("*")
			.eq("id", user.id)
			.maybeSingle();

		// 네트워크/락/RLS 오류를 "신규 유저"로 오인하면 설정 초기화 + 온보딩 재노출 → 기존 데이터 덮어씀
		if (error) {
			handleApiError(error, "auth:load_user_settings");
			settingsLoadedFor = null; // 다음 auth 이벤트에서 재시도
			return;
		}

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
