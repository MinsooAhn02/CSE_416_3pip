import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { normalizeFixedInterestIds } from "../utils/interests";
import { useSettingsStore } from "./useSettingsStore";
import type { Perms } from "../types";

interface OnboardingState {
	onboarded: boolean;
	showOnboarding: boolean;
	obStep: number;
	selCats: string[];
	perms: Perms;
	persona: string | null;

	setOnboarded: (v: boolean) => void;
	setShowOnboarding: (v: boolean) => void;
	setObStep: (v: number) => void;
	setPersona: (p: string | null) => void;
	toggleCat: (id: string) => void;
	setPerms: (updater: Perms | ((prev: Perms) => Perms)) => void;
	/** Batch-set onboarding fields coming from DB (no sync side-effect). */
	hydrate: (persona: string | null, perms: Perms, selCats: string[]) => void;
	/** Reset all onboarding state (logout / session clear). */
	reset: () => void;
	finishOB: () => Promise<void>;
}

const INITIAL_PERMS: Perms = { fit: false, cal: false };

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
	onboarded: false,
	showOnboarding: false,
	obStep: 0,
	selCats: [],
	perms: INITIAL_PERMS,
	persona: null,

	setOnboarded: (v) => set({ onboarded: v }),
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

	hydrate: (persona, perms, selCats) =>
		set({ onboarded: true, persona, perms, selCats }),

	reset: () =>
		set({
			onboarded: false,
			showOnboarding: false,
			obStep: 0,
			selCats: [],
			perms: INITIAL_PERMS,
			persona: null,
		}),

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
		useSettingsStore.getState().setFixedInterestIds(normalizedSelCats);

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
