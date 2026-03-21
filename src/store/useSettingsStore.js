import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { DEFAULT_PRIORITY_ORDER } from "../constants";

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

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useSettingsStore = create((set, get) => ({
	theme: load("mb_theme", "dark"),
	bgImage: load("mb_bg", null),
	clockStyle: load("mb_clock", "digital"),
	tempUnit: load("mb_temp_unit", "c"),
	stockSymbols: load("mb_stock_symbols", [
		"KOSPI",
		"NASDAQ",
		"SP500",
		"USDKRW",
	]),
	showSettings: false,
	settingsTab: "widgets",
	showBriefSettings: false,
	tone: load("mb_tone", "friendly"),
	bLen: load("mb_blen", "medium"),
	voiceOn: load("mb_voice", false),
	
	// Data Priority (REQ-US-006)
	priorityOrder: load("mb_priority_order", DEFAULT_PRIORITY_ORDER),
	
	// First-Login Briefing Modal (REQ-WS-006)
	showFirstLoginBriefing: load("mb_show_first_login_briefing", true),
	lastBriefingShown: load("mb_last_briefing_shown", null),
	showFirstLoginModal: false,

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
		if (data.temp_unit) {
			patch.tempUnit = data.temp_unit;
			save("mb_temp_unit", data.temp_unit);
		}
		if (Array.isArray(data.stock_symbols) && data.stock_symbols.length > 0) {
			patch.stockSymbols = data.stock_symbols;
			save("mb_stock_symbols", data.stock_symbols);
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
		// Priority order (REQ-US-006)
		if (Array.isArray(data.priority_order) && data.priority_order.length > 0) {
			patch.priorityOrder = data.priority_order;
			save("mb_priority_order", data.priority_order);
		}
		// First-Login Briefing toggle (REQ-WS-006)
		if (data.show_first_login_briefing != null) {
			patch.showFirstLoginBriefing = data.show_first_login_briefing;
			save("mb_show_first_login_briefing", data.show_first_login_briefing);
		}
		if (data.last_briefing_shown) {
			patch.lastBriefingShown = data.last_briefing_shown;
			save("mb_last_briefing_shown", data.last_briefing_shown);
		}
		if (Object.keys(patch).length) set(patch);
		
		// Check if First-Login Modal should show (REQ-WS-006)
		const today = todayStr();
		const { showFirstLoginBriefing, lastBriefingShown } = get();
		if (showFirstLoginBriefing && lastBriefingShown !== today) {
			set({ showFirstLoginModal: true });
		}
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
	setTempUnit: (u) => {
		set({ tempUnit: u });
		save("mb_temp_unit", u);
		syncSettings({ temp_unit: u });
	},
	setStockSymbols: (symbols) => {
		set({ stockSymbols: symbols });
		save("mb_stock_symbols", symbols);
		syncSettings({ stock_symbols: symbols });
	},

	// Data Priority (REQ-US-006)
	setPriorityOrder: (order) => {
		set({ priorityOrder: order });
		save("mb_priority_order", order);
		syncSettings({ priority_order: order });
	},

	// First-Login Briefing Modal (REQ-WS-006)
	setShowFirstLoginBriefing: (v) => {
		set({ showFirstLoginBriefing: v });
		save("mb_show_first_login_briefing", v);
		syncSettings({ show_first_login_briefing: v });
	},
	setShowFirstLoginModal: (v) => set({ showFirstLoginModal: v }),
	dismissFirstLoginModal: () => {
		const today = todayStr();
		set({ showFirstLoginModal: false, lastBriefingShown: today });
		save("mb_last_briefing_shown", today);
		syncSettings({ last_briefing_shown: today });
	},

	// Check and trigger First-Login Modal (called on app init)
	checkFirstLoginModal: () => {
		const { showFirstLoginBriefing, lastBriefingShown } = get();
		const today = todayStr();
		if (showFirstLoginBriefing && lastBriefingShown !== today) {
			set({ showFirstLoginModal: true });
		}
	},
}));
