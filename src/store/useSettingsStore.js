import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";

/* Supabase DB에 설정 동기화 (백그라운드, 비차단) */
const syncSettings = async (fields) => {
	if (!supabase) return;
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) {
			await supabase.from("user_settings").upsert({ id: user.id, ...fields });
		}
	} catch (e) {
		console.warn("Settings sync failed:", e.message);
	}
};

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

	/* DB에서 불러온 설정으로 덮어쓰기 */
	hydrateFromDB: async (data) => {
		if (!data && supabase) {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				const { data: dbData } = await supabase
					.from("user_settings")
					.select("*")
					.eq("id", user.id)
					.single();
				data = dbData;
			}
		}
		if (!data) return;
		const patch = {};
		if (data.theme) {
			patch.theme = data.theme;
			save("mb_theme", data.theme);
		}
		if (data.clock_style) {
			patch.clockStyle = data.clock_style;
			save("mb_clock", data.clock_style);
		}
		if (data.tone) {
			patch.tone = data.tone;
			save("mb_tone", data.tone);
		}
		if (data.briefing_length) {
			patch.bLen = data.briefing_length;
			save("mb_blen", data.briefing_length);
		}
		if (data.voice_on != null) {
			patch.voiceOn = data.voice_on;
			save("mb_voice", data.voice_on);
		}
		if (data.bg_image !== undefined) {
			patch.bgImage = data.bg_image;
			save("mb_bg", data.bg_image);
		}
		if (Object.keys(patch).length) set(patch);
	},

	setTheme: (t) => {
		set({ theme: t });
		save("mb_theme", t);
		syncSettings({ theme: t });
	},
	setBgImage: (img) => {
		set({ bgImage: img });
		save("mb_bg", img);
		syncSettings({ bg_image: img });
	},
	removeBg: () => {
		set({ bgImage: null });
		save("mb_bg", null);
		syncSettings({ bg_image: null });
	},
	setShowSettings: (v) => set({ showSettings: v }),
	setSettingsTab: (t) => set({ settingsTab: t }),
	setShowBriefSettings: (v) => set({ showBriefSettings: v }),
	setTone: (t) => {
		set({ tone: t });
		save("mb_tone", t);
		syncSettings({ tone: t });
	},
	setBLen: (l) => {
		set({ bLen: l });
		save("mb_blen", l);
		syncSettings({ briefing_length: l });
	},
	setVoiceOn: (v) => {
		set({ voiceOn: v });
		save("mb_voice", v);
		syncSettings({ voice_on: v });
	},
	setClockStyle: (s) => {
		set({ clockStyle: s });
		save("mb_clock", s);
		syncSettings({ clock_style: s });
	},
}));
