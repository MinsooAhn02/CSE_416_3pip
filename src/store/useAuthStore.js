import { create } from "zustand";
import { load, save } from "../utils/storage";

export const useAuthStore = create((set, get) => ({
	isLoggedIn: load("mb_login", false),
	onboarded: load("mb_onboarded", false),
	showOnboarding: false,
	obStep: 0,
	selCats: load("mb_cats", []),
	perms: load("mb_perms", { fit: false, cal: false }),

	login: () => {
		set({ isLoggedIn: true });
		save("mb_login", true);
	},
	logout: () => {
		set({ isLoggedIn: false });
		save("mb_login", false);
	},
	setShowOnboarding: (v) => set({ showOnboarding: v }),
	setObStep: (v) => set({ obStep: v }),
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
	finishOB: () => {
		const { selCats, perms } = get();
		set({ onboarded: true, showOnboarding: false });
		save("mb_onboarded", true);
		save("mb_cats", selCats);
		save("mb_perms", perms);
	},
}));
