import { create } from "zustand";
import { load, save } from "../utils/storage";

export const useSettingsStore = create((set) => ({
	theme: load("mb_theme", "dark"),
	bgImage: load("mb_bg", null),
	clockStyle: load("mb_clock", "digital"),
	showSettings: false,
	settingsTab: "widgets",
	showBriefSettings: false,
	tone: load("mb_tone", "friendly"),
	bLen: load("mb_blen", "medium"),
	voiceOn: load("mb_voice", false),

	setTheme: (t) => {
		set({ theme: t });
		save("mb_theme", t);
	},
	setBgImage: (img) => {
		set({ bgImage: img });
		save("mb_bg", img);
	},
	removeBg: () => {
		set({ bgImage: null });
		save("mb_bg", null);
	},
	setShowSettings: (v) => set({ showSettings: v }),
	setSettingsTab: (t) => set({ settingsTab: t }),
	setShowBriefSettings: (v) => set({ showBriefSettings: v }),
	setTone: (t) => {
		set({ tone: t });
		save("mb_tone", t);
	},
	setBLen: (l) => {
		set({ bLen: l });
		save("mb_blen", l);
	},
	setVoiceOn: (v) => {
		set({ voiceOn: v });
		save("mb_voice", v);
	},
	setClockStyle: (s) => {
		set({ clockStyle: s });
		save("mb_clock", s);
	},
}));
