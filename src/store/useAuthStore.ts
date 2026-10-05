import { create } from "zustand";
import { load, save, clearUserData, LAST_USER_KEY } from "../utils/storage";
import { supabase, getSessionUser } from "../lib/supabase";
import { runPersonalizationBatch } from "../services/personalizationService";
import { normalizeFixedInterestIds } from "../utils/interests";
import type { Session } from "@supabase/supabase-js";
import { useSettingsStore } from "./useSettingsStore";
import { useOnboardingStore } from "./useOnboardingStore";
import type { AppUser, Perms, Interest } from "../types";
import { handleApiError } from "../utils/errorHandler";
import { isGuest } from "../lib/guest";
import { callEdge } from "../lib/edge";

let settingsLoadedFor: string | null = null;
let settingsLoadPromise: Promise<void> = Promise.resolve();
/** 관심사(user_settings) 로드 완료 대기 — App이 fetchAll 전에 기다려야 뉴스가 처음부터
 *  실제 관심사 기준 캐시를 읽음 (안 그러면 기본 관심사로 먼저 읽고 바뀌면서 Tavily/Groq 재호출) */
// 8초 상한: 네트워크·auth 잠금으로 멈춰도 초기 로딩 전체가 영원히 막히지 않게
export const waitForUserSettings = (): Promise<void> =>
	Promise.race([settingsLoadPromise, new Promise<void>((resolve) => setTimeout(resolve, 8000))]);

interface AuthState {
	isLoggedIn: boolean;
	/** Google 토큰을 더 이상 갱신할 수 없음 → 재연결 배너 표시 (캘린더/할 일이 캐시로 조용히 대체되던 문제) */
	googleReconnectNeeded: boolean;
	dismissGoogleReconnect: () => void;
	user: AppUser | null;
	providerToken: string | null;

	/** consent=true: 동의 화면을 다시 띄워 Google이 refresh token을 새로 발급하게 함 (재연결용) */
	login: (opts?: { consent?: boolean }) => Promise<boolean>;
	reconnectGoogle: () => Promise<boolean>;
	logout: () => Promise<void>;
	handleAuthChange: (session: Session | null) => Promise<void>;
	ensureProviderToken: (forceRefresh?: boolean) => Promise<string | null>;
	loadUserSettings: () => Promise<void>;
}

let _pendingProviderTokenRefresh: Promise<string | null> | null = null;
let lastStoredRefreshToken: string | null = null;
// Google access token 만료 시각 (발급 후 1시간). 세션에 저장된 provider_token은 발급 시각을 모르므로
// 로그인 시각(last_sign_in_at) 기준으로 추정 — 만료된 토큰을 계속 써서 Google 호출이 401로 실패하던 문제
let providerTokenExpiresAt = 0;
const TOKEN_SAFETY_MS = 5 * 60 * 1000;
const sessionTokenExpiry = (session: Session | null): number => {
	const signedInAt = Date.parse(session?.user?.last_sign_in_at ?? "");
	return Number.isFinite(signedInAt) ? signedInAt + 60 * 60 * 1000 - TOKEN_SAFETY_MS : 0;
};

const GOOGLE_REFRESH_TIMEOUT_MS = 25000;
type GoogleRefreshResult = { access_token?: string; expires_in?: number; error?: string; status: number };

/**
 * google-refresh Edge Function 호출 (BACKLOG R2). Google refresh token은 서버 DB에 암호화 보관되고
 * 브라우저는 보관하지 않음: OAuth 직후 { action: "store" } 1회, 이후 { action: "refresh" }로 갱신.
 * 409 reconnect_required = 서버에 토큰이 없거나 Google이 거부 → 동의 화면 포함 재연결 필요.
 */
const callGoogleRefresh = async (body: Record<string, unknown>): Promise<GoogleRefreshResult> => {
	if (!supabase) return { status: 0 };
	const r = await callEdge("google-refresh", body, { timeoutMs: GOOGLE_REFRESH_TIMEOUT_MS });
	if (!r) return { status: 0 };
	const payload = r.data && typeof r.data === "object" ? (r.data as object) : {};
	return { ...payload, status: r.ok ? 200 : r.status };
};

export const useAuthStore = create<AuthState>()((set, get) => ({
	isLoggedIn: load<boolean>("mb_login", false),
	googleReconnectNeeded: false,
	dismissGoogleReconnect: () => set({ googleReconnectNeeded: false }),
	user: null,
	providerToken: null,

	login: async ({ consent = false } = {}) => {
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
					// Google은 처음 동의할 때만 refresh token을 줌 → 재연결은 consent로 강제 재발급
					prompt: consent ? "consent select_account" : "select_account",
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
		const didStart = await get().login({ consent: true });
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
		set({ isLoggedIn: false, user: null, providerToken: null });
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
		// 이 계정의 로컬 데이터(일기·브리핑·일정 캐시 등) 삭제 후 새로고침 —
		// 메모리에 남은 스토어 상태까지 비워야 다음 사람(또는 둘러보기)에게 안 보임
		await clearUserData();
		localStorage.removeItem(LAST_USER_KEY);
		window.location.reload();
	},

	handleAuthChange: async (session) => {
		if (session) {
			const u = session.user;
			// 이 브라우저에 다른 계정 데이터가 남아 있으면 지우고 새로고침 (스토어는 로드 시점에 localStorage를 읽음)
			const lastUserId = load<string | null>(LAST_USER_KEY, null);
			if (lastUserId !== u.id) {
				save(LAST_USER_KEY, u.id);
				if (lastUserId) {
					await clearUserData();
					window.location.reload();
					return;
				}
			}
			const uMeta = (u?.user_metadata ?? {}) as Record<string, unknown>;
			const nextProviderToken = session.provider_token ?? get().providerToken;
			if (session.provider_token) providerTokenExpiresAt = sessionTokenExpiry(session);
			// provider_refresh_token은 OAuth 콜백 직후 세션에만 있음(localStorage엔 저장 안 됨) →
			// 서버에 암호화 보관해 두고 이후 갱신은 서버가 처리 (R2). 실패해도 로그인 흐름은 계속
			const refreshToken = session.provider_refresh_token;
			if (refreshToken && refreshToken !== lastStoredRefreshToken) {
				lastStoredRefreshToken = refreshToken;
				callGoogleRefresh({ action: "store", refresh_token: refreshToken }).then((r) => {
					if (r.status !== 200) {
						lastStoredRefreshToken = null;
						handleApiError(new Error(`store refresh token: HTTP ${r.status} ${r.error ?? ""}`), "auth:google_token_store");
					}
				});
			}
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
		set({ isLoggedIn: false, user: null, providerToken: null });
		useOnboardingStore.getState().reset();
		useSettingsStore.getState().resetInterests();
		save("mb_login", false);
	},

	ensureProviderToken: async (forceRefresh = false) => {
		// forceRefresh: 만료(401)로 강제 갱신 — 캐시/persisted provider_token을 신뢰하지 않음
		if (!forceRefresh) {
			const existing = get().providerToken;
			if (existing && Date.now() < providerTokenExpiresAt) return existing;
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

				// forceRefresh일 땐 persisted provider_token이 만료됐을 수 있으므로 신뢰하지 않음
				if (!forceRefresh) {
					const token = session?.provider_token ?? null;
					const expiresAt = sessionTokenExpiry(session);
					if (token && Date.now() < expiresAt) {
						providerTokenExpiresAt = expiresAt;
						set({ providerToken: token, googleReconnectNeeded: false });
						return token;
					}
				}

				// 2) 서버에 보관된 refresh token으로 갱신 (R2).
				// (예전의 supabase.auth.refreshSession() 단계는 provider_token을 돌려주지 않아 뺐음 —
				//  auth 잠금만 잡고 다중 탭 경합(R10)을 키웠음)
				const r = await callGoogleRefresh({ action: "refresh" });
				if (r.access_token) {
					providerTokenExpiresAt = Date.now() + ((r.expires_in ?? 3600) * 1000) - TOKEN_SAFETY_MS;
					set({ providerToken: r.access_token, googleReconnectNeeded: false });
					return r.access_token;
				}
				if (r.error !== "reconnect_required") console.warn("[gcal] google-refresh failed:", r.status, r.error);

				// 세션·refresh token 모두 실패 → 재로그인 외엔 방법 없음.
				// Google 데이터를 쓰는 사용자(캘린더·건강 권한)에게만 배너 — 안 쓰는 사람에겐 의미 없음
				const perms = useOnboardingStore.getState().perms;
				if (perms.cal || perms.fit) set({ googleReconnectNeeded: true });
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

		const user = await getSessionUser();
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
