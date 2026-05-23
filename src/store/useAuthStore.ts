import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { runPersonalizationBatch } from "../services/personalizationService";
import { normalizeFixedInterestIds } from "../utils/interests";
import type { Session } from "@supabase/supabase-js";
import { useSettingsStore } from "./useSettingsStore";
import type { AppUser, Perms, Interest } from "../types";

interface AuthState {
	isLoggedIn: boolean;
	onboarded: boolean;
	showOnboarding: boolean;
	obStep: number;
	selCats: string[];
	perms: Perms;
	persona: string | null;
	user: AppUser | null;
	providerToken: string | null;

	login: () => Promise<boolean>;
	reconnectGoogle: () => Promise<boolean>;
	logout: () => Promise<void>;
	handleAuthChange: (session: Session | null) => Promise<void>;
	ensureProviderToken: () => Promise<string | null>;
	loadUserSettings: () => Promise<void>;
	setShowOnboarding: (v: boolean) => void;
	setObStep: (v: number) => void;
	setPersona: (p: string | null) => void;
	toggleCat: (id: string) => void;
	setPerms: (updater: Perms | ((prev: Perms) => Perms)) => void;
	finishOB: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
	isLoggedIn: load<boolean>("mb_login", false),
	onboarded: false,
	showOnboarding: false,
	obStep: 0,
	selCats: [],
	perms: { fit: false, cal: false },
	persona: null,
	user: null,
	providerToken: null,

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
		set({
			isLoggedIn: false,
			user: null,
			providerToken: null,
			onboarded: false,
			showOnboarding: false,
			obStep: 0,
			selCats: [],
			perms: { fit: false, cal: false },
			persona: null,
		});
		useSettingsStore.setState({ fixedInterestIds: [], keywordInterests: [] });
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
			await get().loadUserSettings();
			return;
		}

		set({
			isLoggedIn: false,
			user: null,
			providerToken: null,
			onboarded: false,
			showOnboarding: false,
			obStep: 0,
			selCats: [],
			perms: { fit: false, cal: false },
			persona: null,
		});
		useSettingsStore.setState({ fixedInterestIds: [], keywordInterests: [] });
		save("mb_login", false);
	},

	ensureProviderToken: async () => {
		const existing = get().providerToken;
		if (existing) return existing;

		if (!supabase) return null;

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.provider_token ?? null;
			if (token) {
				set({ providerToken: token });
				return token;
			}

			const {
				data: { session: refreshedSession },
			} = await supabase.auth.refreshSession();
			const refreshedToken = refreshedSession?.provider_token ?? null;
			if (refreshedToken) {
				set({ providerToken: refreshedToken });
			}
			return refreshedToken;
		} catch (err) {
			console.warn("[gcal] ensureProviderToken failed:", err);
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
			set({
				onboarded: true,
				persona: (dbData.persona as string) ?? null,
				perms: onboardingPerms,
				selCats: fixedInterestIds,
			});
			useSettingsStore.setState({
				fixedInterestIds,
				keywordInterests: Array.isArray(dbData.keyword_interests)
					? (dbData.keyword_interests as Interest[])
					: [],
			});

			runPersonalizationBatch()
				.then((interests) => {
					if (Array.isArray(interests) && interests.length > 0) {
						useSettingsStore.setState({ keywordInterests: interests });
					}
				})
				.catch(() => {});
		} else {
			set({
				onboarded: false,
				showOnboarding: true,
				obStep: 0,
				selCats: [],
				perms: { fit: false, cal: false },
				persona: null,
			});
			useSettingsStore.setState({ fixedInterestIds: [] });
		}
	},

	setShowOnboarding: (v) => set({ showOnboarding: v }),
	setObStep: (v) => set({ obStep: v }),
	setPersona: (p) => set({ persona: p }),
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
		const normalizedSelCats = normalizeFixedInterestIds(selCats);
		const normalizedPerms: Perms = {
			fit: Boolean(perms?.fit),
			cal: Boolean(perms?.cal),
		};
		set({
			onboarded: true,
			showOnboarding: false,
			selCats: normalizedSelCats,
			perms: normalizedPerms,
		});
		useSettingsStore.setState({ fixedInterestIds: normalizedSelCats });

		if (supabase) {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				const { error } = await supabase.from("user_settings").upsert({
					id: user.id,
					persona,
					fixed_interests: normalizedSelCats,
					onboarding_perms: normalizedPerms,
				});
				if (error) {
					console.warn("Fixed interests save failed:", error.message);
					await supabase.from("user_settings").upsert({
						id: user.id,
						persona,
						onboarding_perms: normalizedPerms,
					});
				}
			}
		}
	},
}));
