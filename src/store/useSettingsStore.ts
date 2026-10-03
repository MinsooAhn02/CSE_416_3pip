import { create } from "zustand";
import toast from "react-hot-toast";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { DEFAULT_PRIORITY_ORDER } from "../constants";
import i18n from "../l10n/i18n";
import { normalizeFixedInterestIds } from "../utils/interests";
import { handleApiError } from "../utils/errorHandler";
import { formatLocalDate } from "../utils/date";
import type { Interest } from "../types";

export const DEFAULT_PIN_LOCK_MODE = "immediate";
export const DEFAULT_DIARY_LANGUAGE = "app";

export interface PinLockOption {
	id: string;
	label: string;
	description: string;
}

export const PIN_LOCK_OPTIONS: PinLockOption[] = [
	{
		id: "off",
		label: "PIN off",
		description: "You will not be asked for a PIN when opening the diary.",
	},
	{
		id: "immediate",
		label: "Immediate lock",
		description: "Diary locks again as soon as you close it.",
	},
	{
		id: "5m",
		label: "Lock after 5 minutes",
		description: "Stays unlocked for 5 minutes after the last PIN check.",
	},
	{
		id: "30m",
		label: "Lock after 30 minutes",
		description: "Stays unlocked for 30 minutes after the last PIN check.",
	},
	{
		id: "1h",
		label: "Lock after 1 hour",
		description: "Stays unlocked for 1 hour after the last PIN check.",
	},
	{
		id: "3h",
		label: "Lock after 3 hours",
		description: "Stays unlocked for 3 hours after the last PIN check.",
	},
	{
		id: "6h",
		label: "Lock after 6 hours",
		description: "Stays unlocked for 6 hours after the last PIN check.",
	},
];

const PIN_LOCK_TIMEOUT_MS: Record<string, number> = {
	"5m": 5 * 60 * 1000,
	"30m": 30 * 60 * 1000,
	"1h": 60 * 60 * 1000,
	"3h": 3 * 60 * 60 * 1000,
	"6h": 6 * 60 * 60 * 1000,
};

export const getPinLockTimeoutMs = (mode: string): number | null =>
	PIN_LOCK_TIMEOUT_MS[mode] ?? null;

/* Fires a single "saved" toast, debounced by toast id so rapid
 * changes don't stack. Kept inside the store so every setter
 * shares the same UX. */
const notifySaved = (): void => {
	toast.success(i18n.t("toast.settings_saved"), {
		id: "settings-saved",
		duration: 1800,
	});
};

/* Supabase DB에 설정 동기화 (백그라운드, 비차단).
 * 로컬 저장은 이미 끝났으므로 "저장됨" 토스트는 즉시 뜨고, DB 동기화가 실패하면
 * 같은 토스트 id로 교체해 사용자에게 알림 (예전엔 실패해도 조용히 넘어갔음) */
const syncSettings = async (fields: Record<string, unknown>): Promise<void> => {
	if (!supabase) return;
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		const { error } = await supabase.from("user_settings").upsert({ id: user.id, ...fields });
		if (error) throw error;
	} catch (e) {
		handleApiError(e, "settings:sync");
		toast.error(i18n.t("toast.settings_sync_failed"), { id: "settings-saved", duration: 4000 });
	}
};

const todayStr = (): string => formatLocalDate(); // UTC면 KST 09시 전엔 "어제"가 됨

export interface SettingsState {
	// State fields
	theme: string;
	bgImage: string | null;
	clockStyle: string;
	is12Hour: boolean;
	tempUnit: string;
	stockSymbols: string[];
	fixedIndexSymbols: string[];
	showSettings: boolean;
	settingsTab: string;
	tone: string;
	voiceOn: boolean;
	pinLockMode: string;
	diaryLanguage: string;
	fixedInterestIds: string[];
	priorityOrder: string[];
	showFirstLoginBriefing: boolean;
	lastBriefingShown: string | null;
	showFirstLoginModal: boolean;
	keywordInterests: Interest[];

	// Actions
	hydrateFromDB: (data?: Record<string, unknown> | null) => Promise<void>;
	setTheme: (t: string) => void;
	setBgImage: (img: string | null) => void;
	removeBg: () => void;
	setShowSettings: (v: boolean) => void;
	setSettingsTab: (t: string) => void;
	setTone: (t: string) => void;
	setVoiceOn: (v: boolean) => void;
	setPinLockMode: (mode: string) => void;
	setDiaryLanguage: (language: string) => void;
	setClockStyle: (s: string) => void;
	setIs12Hour: (v: boolean) => void;
	setTempUnit: (u: string) => void;
	setStockSymbols: (symbols: string[]) => void;
	setFixedIndexSymbols: (symbols: string[]) => void;
	setPriorityOrder: (order: string[]) => void;
	setShowFirstLoginBriefing: (v: boolean) => void;
	setShowFirstLoginModal: (v: boolean) => void;
	dismissFirstLoginModal: () => void;
	setFixedInterestIds: (ids: string[]) => void;
	setKeywordInterests: (interests: Interest[]) => void;
	/** Hydrate interests from DB without triggering a sync back to the server. */
	hydrateInterests: (ids: string[], keywords: Interest[]) => void;
	/** Clear all interests from local state without syncing to DB (use on logout / session clear). */
	resetInterests: () => void;
	addKeywordInterest: (keyword: string, category?: string) => void;
	bumpKeyword: (keyword: string, category?: string, delta?: number) => void;
	removeKeywordInterest: (keyword: string) => void;
	resetKeywordInterests: () => void;
	checkFirstLoginModal: () => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
	theme: load("mb_theme", "dark"),
	bgImage: load("mb_bg", null),
	clockStyle: load("mb_clock", "digital"),
	is12Hour: load("mb_is_12hour", true),
	tempUnit: load("mb_temp_unit", "c"),
	stockSymbols: load("mb_stock_symbols", [
		"KOSPI",
		"NASDAQ",
		"SP500",
		"USDKRW",
	]),
	fixedIndexSymbols: load("mb_fixed_index_symbols", [
		"SP500",
		"KOSPI",
		"NASDAQ",
		"USDKRW",
		"VIX",
		"CRUDE",
		"DXY",
		"DJI",
	]),
	showSettings: false,
	settingsTab: "widgets",
	tone: load("mb_tone", "friendly"),
	voiceOn: load("mb_voice", false),
	pinLockMode: load("mb_pin_lock_mode", DEFAULT_PIN_LOCK_MODE),
	diaryLanguage: load("mb_diary_language", DEFAULT_DIARY_LANGUAGE),
	fixedInterestIds: [],

	// Data Priority (REQ-US-006)
	priorityOrder: load("mb_priority_order", DEFAULT_PRIORITY_ORDER),

	// First-Login Briefing Modal (REQ-WS-006)
	showFirstLoginBriefing: load("mb_show_first_login_briefing", true),
	lastBriefingShown: load("mb_last_briefing_shown", null),
	showFirstLoginModal: false,

	// 개인화 관심 키워드 (DB에서 hydrate, [{keyword, category, score}])
	keywordInterests: [],

	/* DB에서 불러온 설정으로 덮어쓰기 */
	hydrateFromDB: async (data?: Record<string, unknown> | null) => {
		let resolved = data;
		if (!resolved && supabase) {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				const { data: dbData } = await supabase
					.from("user_settings")
					.select("*")
					.eq("id", user.id)
					.single();
				resolved = dbData as Record<string, unknown> | null;
			}
		}
		if (!resolved) return;
		const patch: Partial<SettingsState> = {};
		if (resolved.theme) {
			patch.theme = resolved.theme as string;
			save("mb_theme", resolved.theme);
		}
		if (resolved.clock_style) {
			patch.clockStyle = resolved.clock_style as string;
			save("mb_clock", resolved.clock_style);
		}
		if (resolved.temp_unit) {
			patch.tempUnit = resolved.temp_unit as string;
			save("mb_temp_unit", resolved.temp_unit);
		}
		if (Array.isArray(resolved.stock_symbols) && resolved.stock_symbols.length > 0) {
			patch.stockSymbols = resolved.stock_symbols as string[];
			save("mb_stock_symbols", resolved.stock_symbols);
		}
		if (resolved.tone) {
			patch.tone = resolved.tone as string;
			save("mb_tone", resolved.tone);
		}
		if (resolved.voice_on != null) {
			patch.voiceOn = resolved.voice_on as boolean;
			save("mb_voice", resolved.voice_on);
		}
		if (resolved.pin_lock_mode) {
			patch.pinLockMode = resolved.pin_lock_mode as string;
			save("mb_pin_lock_mode", resolved.pin_lock_mode);
		}
		if (resolved.bg_image !== undefined) {
			patch.bgImage = resolved.bg_image as string | null;
			save("mb_bg", resolved.bg_image);
		}
		// Priority order (REQ-US-006)
		if (Array.isArray(resolved.priority_order) && resolved.priority_order.length > 0) {
			patch.priorityOrder = resolved.priority_order as string[];
			save("mb_priority_order", resolved.priority_order);
		}
		// First-Login Briefing toggle (REQ-WS-006)
		if (resolved.show_first_login_briefing != null) {
			patch.showFirstLoginBriefing = resolved.show_first_login_briefing as boolean;
			save("mb_show_first_login_briefing", resolved.show_first_login_briefing);
		}
		if (resolved.last_briefing_shown) {
			patch.lastBriefingShown = resolved.last_briefing_shown as string;
			save("mb_last_briefing_shown", resolved.last_briefing_shown);
		}
		// 개인화 관심 키워드
		if (Array.isArray(resolved.keyword_interests)) {
			patch.keywordInterests = resolved.keyword_interests as Interest[];
		}
		if (Array.isArray(resolved.fixed_interests)) {
			const fixedInterestIds = normalizeFixedInterestIds(resolved.fixed_interests as string[]);
			patch.fixedInterestIds = fixedInterestIds;
		}
		if (Object.keys(patch).length) set(patch);

		// Check if First-Login Modal should show (REQ-WS-006)
		const today = todayStr();
		const { showFirstLoginBriefing, lastBriefingShown } = get();
		if (showFirstLoginBriefing && lastBriefingShown !== today) {
			set({ showFirstLoginModal: true });
		}
	},

	setTheme: (t: string) => {
		set({ theme: t });
		save("mb_theme", t);
		syncSettings({ theme: t });
		notifySaved();
	},
	setBgImage: (img: string | null) => {
		set({ bgImage: img });
		save("mb_bg", img);
		syncSettings({ bg_image: img });
		notifySaved();
	},
	removeBg: () => {
		set({ bgImage: null });
		save("mb_bg", null);
		syncSettings({ bg_image: null });
		notifySaved();
	},
	setShowSettings: (v: boolean) => set({ showSettings: v }),
	setSettingsTab: (t: string) =>
		set({
			settingsTab:
				t === "routine" ? "widgets" : t === "privacy" ? "diary" : t,
		}),
	setTone: (t: string) => {
		set({ tone: t });
		save("mb_tone", t);
		syncSettings({ tone: t });
		notifySaved();
	},
	setVoiceOn: (v: boolean) => {
		set({ voiceOn: v });
		save("mb_voice", v);
		syncSettings({ voice_on: v });
		notifySaved();
	},
	setPinLockMode: (mode: string) => {
		if (!PIN_LOCK_OPTIONS.some((option) => option.id === mode)) return;
		set({ pinLockMode: mode });
		save("mb_pin_lock_mode", mode);
		syncSettings({ pin_lock_mode: mode });
		notifySaved();
	},
	setDiaryLanguage: (language: string) => {
		const normalized: string =
			language === "ko" || language === "en" || language === "app"
				? language
				: DEFAULT_DIARY_LANGUAGE;
		set({ diaryLanguage: normalized });
		save("mb_diary_language", normalized);
		notifySaved();
	},
	setClockStyle: (s: string) => {
		set({ clockStyle: s });
		save("mb_clock", s);
		syncSettings({ clock_style: s });
		notifySaved();
	},
	setIs12Hour: (v: boolean) => {
		set({ is12Hour: v });
		save("mb_is_12hour", v);
		syncSettings({ is_12hour: v });
		notifySaved();
	},
	setTempUnit: (u: string) => {
		set({ tempUnit: u });
		save("mb_temp_unit", u);
		syncSettings({ temp_unit: u });
		notifySaved();
	},
	setStockSymbols: (symbols: string[]) => {
		set({ stockSymbols: symbols });
		save("mb_stock_symbols", symbols);
		syncSettings({ stock_symbols: symbols });
		notifySaved();
	},
	setFixedIndexSymbols: (symbols: string[]) => {
		set({ fixedIndexSymbols: symbols });
		save("mb_fixed_index_symbols", symbols);
	},

	// Data Priority (REQ-US-006)
	setPriorityOrder: (order: string[]) => {
		set({ priorityOrder: order });
		save("mb_priority_order", order);
		syncSettings({ priority_order: order });
		notifySaved();
	},

	// First-Login Briefing Modal (REQ-WS-006)
	setShowFirstLoginBriefing: (v: boolean) => {
		set({ showFirstLoginBriefing: v });
		save("mb_show_first_login_briefing", v);
		syncSettings({ show_first_login_briefing: v });
		notifySaved();
	},
	setShowFirstLoginModal: (v: boolean) => set({ showFirstLoginModal: v }),
	dismissFirstLoginModal: () => {
		const today = todayStr();
		set({ showFirstLoginModal: false, lastBriefingShown: today });
		save("mb_last_briefing_shown", today);
		syncSettings({ last_briefing_shown: today });
	},

	// 개인화 관심 키워드 액션
	setFixedInterestIds: (ids: string[]) => {
		const normalized = normalizeFixedInterestIds(ids);
		set({ fixedInterestIds: normalized });
		syncSettings({ fixed_interests: normalized });
	},

	setKeywordInterests: (interests: Interest[]) => {
		set({ keywordInterests: interests });
		syncSettings({ keyword_interests: interests });
	},

	hydrateInterests: (ids: string[], keywords: Interest[]) => {
		set({
			fixedInterestIds: normalizeFixedInterestIds(ids),
			keywordInterests: keywords,
		});
	},

	resetInterests: () => {
		set({ fixedInterestIds: [], keywordInterests: [] });
	},

	addKeywordInterest: (keyword: string, category = "interest") => {
		const current = get().keywordInterests;
		if (current.some((item) => item.keyword === keyword)) return;
		const updated: Interest[] = [{ keyword, category, score: 1 }, ...current];
		set({ keywordInterests: updated });
		syncSettings({ keyword_interests: updated });
		notifySaved();
	},

	// keyword 존재하면 score += delta, 없으면 새로 추가 (알림 없음, 백그라운드)
	bumpKeyword: (keyword: string, category = "note", delta = 10) => {
		if (!keyword?.trim()) return;
		const k = keyword.trim().toLowerCase();
		const current = get().keywordInterests;
		const idx = current.findIndex((item) => item.keyword?.toLowerCase() === k);
		let updated: Interest[];
		if (idx >= 0) {
			updated = current.map((item, i) =>
				i === idx ? { ...item, score: (item.score ?? 0) + delta } : item
			);
		} else {
			updated = [{ keyword: k, category, score: delta }, ...current];
		}
		set({ keywordInterests: updated });
		syncSettings({ keyword_interests: updated });
	},

	removeKeywordInterest: (keyword: string) => {
		const updated = get().keywordInterests.filter(
			(item) => item.keyword !== keyword
		);
		set({ keywordInterests: updated });
		syncSettings({ keyword_interests: updated });
		notifySaved();
	},

	resetKeywordInterests: () => {
		set({ keywordInterests: [] });
		syncSettings({ keyword_interests: [], keyword_interests_updated: null });
		notifySaved();
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
