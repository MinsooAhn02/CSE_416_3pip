import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
	isLoggedIn: load("mb_login", false),
	onboarded: load("mb_onboarded", false),
	showOnboarding: false,
	obStep: 0,
	selCats: load("mb_cats", []),
	perms: load("mb_perms", { fit: false, cal: false }),
	persona: load("mb_persona", null),
	user: null, // { id, email, displayName, avatarUrl }
	providerToken: null, // Google access token for Calendar/Fit

	/* ── Supabase Auth ── */
	login: async () => {
		if (supabase) {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					scopes: [
						"https://www.googleapis.com/auth/calendar.readonly",
						"https://www.googleapis.com/auth/fitness.activity.read",
						"https://www.googleapis.com/auth/fitness.sleep.read",
						"https://www.googleapis.com/auth/fitness.heart_rate.read",
					].join(" "),
					redirectTo: window.location.origin,
				},
			});
			if (error) console.error("Supabase login error:", error.message);
			// 실제 상태 세팅은 onAuthStateChange 리스너에서 처리
		} else {
			// Supabase 미설정 시 기존 로컬 데모 모드
			set({ isLoggedIn: true });
			save("mb_login", true);
		}
	},

	logout: async () => {
		if (supabase) await supabase.auth.signOut();
		set({
			isLoggedIn: false,
			user: null,
			providerToken: null,
			onboarded: false,
		});
		save("mb_login", false);
		save("mb_onboarded", false);
	},

	/* Supabase Auth 상태 변경 시 호출 */
	handleAuthChange: async (session) => {
		if (session) {
			const u = session.user;
			const user = {
				id: u.id,
				email: u.email,
				displayName: u.user_metadata?.full_name || u.email,
				avatarUrl: u.user_metadata?.avatar_url || null,
			};
			set({
				isLoggedIn: true,
				user,
				providerToken: session.provider_token || get().providerToken,
			});
			save("mb_login", true);

			// DB에서 사용자 설정 불러오기
			await get().loadUserSettings();
		} else {
			set({ isLoggedIn: false, user: null, providerToken: null });
			save("mb_login", false);
		}
	},

	/* provider token 보장 헬퍼 (calendar/fitness 라우팅용) */
	ensureProviderToken: async () => {
		const existing = get().providerToken;
		if (existing) return existing;
		if (!supabase) return null;

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token ?? null;
			if (token) set({ providerToken: token });
			return token;
		} catch {
			return null;
		}
	},

	/* DB에서 사용자 설정 로드 */
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
			set({
				onboarded: true,
				persona: data.persona,
				perms: { fit: true, cal: true },
			});
			save("mb_onboarded", true);
			save("mb_persona", data.persona);
		} else {
			// 신규 유저: 온보딩 모달 표시
			set({ onboarded: false, showOnboarding: true, obStep: 0 });
			save("mb_onboarded", false);
		}
	},

	/* ── Onboarding (기존 유지) ── */
	setShowOnboarding: (v) => set({ showOnboarding: v }),
	setObStep: (v) => set({ obStep: v }),
	setPersona: (p) => {
		set({ persona: p });
		save("mb_persona", p);
	},
	toggleCat: (id) =>
		set((s) => ({
			selCats: s.selCats.includes(id)
				? s.selCats.filter((c) => c !== id)
				: [...s.selCats, id],
		})),
	setPerms: (updater) =>
		set((s) => ({
			perms: typeof updater === "function" ? updater(s.perms) : updater,
		})),

	finishOB: async () => {
		const { selCats, perms, persona } = get();
		set({ onboarded: true, showOnboarding: false });
		save("mb_onboarded", true);
		save("mb_cats", selCats);
		save("mb_perms", perms);
		save("mb_persona", persona);

		// Supabase DB에 저장
		if (supabase) {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				await supabase.from("user_settings").upsert({
					id: user.id,
					persona,
				});
			}
		}
	},
}));
