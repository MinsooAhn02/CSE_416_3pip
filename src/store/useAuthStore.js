import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";

const PROVIDER_TOKEN_KEY = "mb_google_provider_token";

export const useAuthStore = create((set, get) => ({
	isLoggedIn: load("mb_login", false),
	onboarded: load("mb_onboarded", false),
	showOnboarding: false,
	obStep: 0,
	selCats: load("mb_cats", []),
	perms: load("mb_perms", { fit: false, cal: false }),
	persona: load("mb_persona", null),
	user: null,
	providerToken: load(PROVIDER_TOKEN_KEY, null),

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
					prompt: "consent",
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
		save(PROVIDER_TOKEN_KEY, null);
		const didStart = await get().login();
		if (didStart === false) {
			throw new Error("Failed to reconnect Google");
		}
		return didStart;
	},

	logout: async () => {
		set({
			isLoggedIn: false,
			user: null,
			providerToken: null,
			onboarded: false,
		});
		save("mb_login", false);
		save("mb_onboarded", false);
		save(PROVIDER_TOKEN_KEY, null);

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
			const nextProviderToken =
				session.provider_token || get().providerToken || load(PROVIDER_TOKEN_KEY, null);
			const user = {
				id: u.id,
				email: u.email,
				displayName: u.user_metadata?.full_name || u.email,
				avatarUrl: u.user_metadata?.avatar_url || null,
			};
			set({
				isLoggedIn: true,
				user,
				providerToken: nextProviderToken,
			});
			save("mb_login", true);
			save(PROVIDER_TOKEN_KEY, nextProviderToken);
			await get().loadUserSettings();
			return;
		}

		set({ isLoggedIn: false, user: null, providerToken: null });
		save("mb_login", false);
		save(PROVIDER_TOKEN_KEY, null);
	},

	ensureProviderToken: async () => {
		const existing = get().providerToken;
		if (existing) return existing;

		const stored = load(PROVIDER_TOKEN_KEY, null);
		if (stored) {
			set({ providerToken: stored });
			return stored;
		}

		if (!supabase) return null;

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token ?? null;
			if (token) {
				set({ providerToken: token });
				save(PROVIDER_TOKEN_KEY, token);
				return token;
			}

			const {
				data: { session: refreshedSession },
			} = await supabase.auth.refreshSession();
			const refreshedToken = refreshedSession?.provider_token ?? null;
			if (refreshedToken) {
				set({ providerToken: refreshedToken });
				save(PROVIDER_TOKEN_KEY, refreshedToken);
			}
			return refreshedToken;
		} catch {
			return null;
		}
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
			set({
				onboarded: true,
				persona: data.persona,
				perms: { fit: true, cal: true },
			});
			save("mb_onboarded", true);
			save("mb_persona", data.persona);
			return;
		}

		set({ onboarded: false, showOnboarding: true, obStep: 0 });
		save("mb_onboarded", false);
	},

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
