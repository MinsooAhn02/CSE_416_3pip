import { create } from "zustand";
import toast from "react-hot-toast";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import {
	generateSmartWidgetData,
	SMART_WIDGET_CATEGORY_OPTIONS,
} from "../services/aiService";
import { useAuthStore } from "./useAuthStore";
import { DEFAULT_VIS, DEFAULT_LAYOUTS, WIDGET_LIST } from "../constants";
import i18n, { getCurrentLanguage } from "../l10n/i18n";
import { buildPersonaContext } from "../utils/personaContext";
import type {
	LayoutItem,
	Layouts,
	VisMap,
	WidgetSettings,
	SmartWidgetData,
} from "../types";

const resolveSmartLang = () =>
	String(getCurrentLanguage() || "en").toLowerCase().startsWith("ko") ? "ko" : "en";

const SMART_WIDGET_DATA_VERSION = "v55";
export const getSmartWidgetCacheKey = (kw: string, lang = resolveSmartLang()) =>
	`${kw}_${lang}_${SMART_WIDGET_DATA_VERSION}`;

const SMART_WIDGET_CATEGORY_IDS = new Set(
	SMART_WIDGET_CATEGORY_OPTIONS.map((option) => option.id),
);

const LAYOUT_VERSION = 14;
const BUILTIN_IDS = new Set(WIDGET_LIST.map((w) => w.id));

const initLayouts = (): Layouts => {
	save("mb_layout_ver", LAYOUT_VERSION);
	return load("mb_layouts", DEFAULT_LAYOUTS) as Layouts;
};

/* Supabase DB에 위젯 상태 동기화 (백그라운드) */
const syncWidgetDB = async (fields: { vis?: VisMap; layouts?: Layouts }): Promise<void> => {
	if (!supabase) return;
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		if (fields.layouts || fields.vis) {
			if (fields.vis) {
				await supabase
					.from("user_settings")
					.upsert({ id: user.id, vis: fields.vis });
			}
			if (fields.layouts) {
				await supabase
					.from("widget_layouts")
					.upsert({ id: user.id, layouts: fields.layouts });
			}
		}
	} catch (e) {
		console.warn("Widget sync failed:", (e as Error).message);
	}
};

const syncKeywords = async (keywords: string[]): Promise<void> => {
	if (!supabase) return;
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		// 기존 키워드 전체 삭제 후 삽입
		await supabase.from("smart_keywords").delete().eq("user_id", user.id);
		if (keywords.length > 0) {
			await supabase
				.from("smart_keywords")
				.insert(keywords.map((kw) => ({ user_id: user.id, keyword: kw })));
		}
	} catch (e) {
		console.warn("Keywords sync failed:", (e as Error).message);
	}
};

interface WidgetState {
	vis: VisMap;
	layouts: Layouts;
	editMode: boolean;
	smartKeywords: string[];
	smartWidgetData: Record<string, SmartWidgetData>;
	smartWidgetErrors: Record<string, string | null>;
	smartWidgetCategoryOverrides: Record<string, string>;
	refreshing: Record<string, boolean>;
	showAddSmart: boolean;
	newKeyword: string;
	currentBreakpoint: string;
	widgetSettings: WidgetSettings;
	globalFontSize: string;
	activeWidgetSettings: string | null;
	setWidgetSetting: (widgetId: string, key: string, value: unknown) => void;
	setGlobalFontSize: (size: string) => void;
	openWidgetSettings: (widgetId: string) => void;
	closeWidgetSettings: () => void;
	hydrateFromDB: () => Promise<void>;
	loadSmartWidget: (kw: string, force?: boolean) => Promise<SmartWidgetData | null>;
	toggleVis: (id: string) => void;
	closeWidget: (id: string) => void;
	setVis: (updater: VisMap | ((prev: VisMap) => VisMap)) => void;
	setEditMode: (v: boolean | ((prev: boolean) => boolean)) => void;
	handleLayoutChange: (currentLayout: LayoutItem[]) => void;
	saveDraggedLayout: (layout: LayoutItem[]) => void;
	resetLayout: () => void;
	setShowAddSmart: (v: boolean) => void;
	setNewKeyword: (v: string) => void;
	addSmartWidget: () => Promise<void>;
	removeSmartWidget: (kw: string) => void;
	renameSmartWidget: (oldKw: string, nextKwRaw: unknown) => Promise<boolean>;
	setSmartWidgetCategory: (kw: string, category: string) => Promise<void>;
	refreshSmartWidget: (kw: string) => Promise<SmartWidgetData | null>;
	reloadAllSmartWidgets: () => void;
	setCurrentBreakpoint: (bp: string) => void;
	updateWidgetHeight: (widgetKey: string, newH: number) => void;
}

export const useWidgetStore = create<WidgetState>()((set, get) => ({
	vis: load("mb_vis", DEFAULT_VIS) as VisMap,
	layouts: initLayouts(),
	editMode: false,
	smartKeywords: load("mb_smart", []) as string[],
	smartWidgetData: load("mb_smart_data", {}) as Record<string, SmartWidgetData>,
	smartWidgetErrors: {},
	smartWidgetCategoryOverrides: load("mb_smart_categories", {}) as Record<string, string>,
	refreshing: {},
	showAddSmart: false,
	newKeyword: "",
	currentBreakpoint: "lg",

	// 위젯 설정
	widgetSettings: load("mb_widget_settings", {}) as WidgetSettings,  // { [widgetId]: { viewType, interestsEnabled } }
	globalFontSize: load("mb_font_size", "medium") as string,           // "small" | "medium" | "large"
	activeWidgetSettings: null,                                          // 현재 설정 모달이 열린 widgetId

	setWidgetSetting: (widgetId: string, key: string, value: unknown) =>
		set((s) => {
			const next: WidgetSettings = {
				...s.widgetSettings,
				[widgetId]: { ...s.widgetSettings[widgetId], [key]: value },
			};
			save("mb_widget_settings", next);
			return { widgetSettings: next };
		}),

	setGlobalFontSize: (size: string) => {
		save("mb_font_size", size);
		set({ globalFontSize: size });
	},

	openWidgetSettings: (widgetId: string) => set({ activeWidgetSettings: widgetId }),
	closeWidgetSettings: () => set({ activeWidgetSettings: null }),

	/* DB에서 위젯 상태 불러오기 */
	hydrateFromDB: async () => {
		if (!supabase) return;
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		// 위젯 가시성
		const { data: settings } = await supabase
			.from("user_settings")
			.select("vis")
			.eq("id", user.id)
			.single();
		if (settings?.vis && typeof settings.vis === "object") {
			const mergedVis: VisMap = { ...DEFAULT_VIS, ...(settings.vis as VisMap) };
			set({ vis: mergedVis });
			save("mb_vis", mergedVis);
		}

		// 레이아웃
		const { data: layoutData } = await supabase
			.from("widget_layouts")
			.select("layouts")
			.eq("id", user.id)
			.single();
		const rawLayouts = layoutData?.layouts as Layouts | undefined;
		const hasValidBreakpointLayout =
			rawLayouts &&
			typeof rawLayouts === "object" &&
			Object.keys(rawLayouts).some((bp) =>
				Array.isArray(rawLayouts[bp]),
			);
		if (hasValidBreakpointLayout && rawLayouts) {
			set({ layouts: rawLayouts });
			save("mb_layouts", rawLayouts);
		}

		// 스마트 키워드
		const { data: kwData } = await supabase
			.from("smart_keywords")
			.select("keyword")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true });
		if (kwData && kwData.length > 0) {
			const keywords = kwData.map((r: { keyword: string }) => r.keyword);
			set({ smartKeywords: keywords });
			save("mb_smart", keywords);
		}
	},

	loadSmartWidget: async (kw: string, force = false): Promise<SmartWidgetData | null> => {
		const lang = resolveSmartLang();
		const cacheKey = getSmartWidgetCacheKey(kw, lang);
		const existing = get().smartWidgetData?.[cacheKey];
		if (existing && !force) return existing;
		const categoryOverride = get().smartWidgetCategoryOverrides?.[kw] ?? null;

		set((s) => ({
			refreshing: { ...s.refreshing, [kw]: true },
			smartWidgetErrors: { ...s.smartWidgetErrors, [kw]: null },
		}));

		try {
			const authState = useAuthStore.getState();
			const providerToken = await authState.ensureProviderToken?.();
			const data = await generateSmartWidgetData(kw, {
				persona: buildPersonaContext(),
				token: providerToken ?? authState.providerToken ?? null,
				categoryOverride,
			});
			if (!data) throw new Error("No smart widget data returned");

			const nextData = { ...get().smartWidgetData, [cacheKey]: data };
			save("mb_smart_data", nextData);
			set((s) => ({
				smartWidgetData: nextData,
				refreshing: { ...s.refreshing, [kw]: false },
				smartWidgetErrors: { ...s.smartWidgetErrors, [kw]: null },
			}));
			return data;
		} catch (error) {
			set((s) => ({
				refreshing: { ...s.refreshing, [kw]: false },
				smartWidgetErrors: {
					...s.smartWidgetErrors,
					[kw]: (error as Error).message || "스마트 위젯 데이터를 불러오지 못했습니다.",
				},
			}));
			return null;
		}
	},

	toggleVis: (id: string) =>
		set((s) => {
			const nv: VisMap = { ...s.vis, [id]: !s.vis[id] };
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),

	closeWidget: (id: string) =>
		set((s) => {
			const nv: VisMap = { ...s.vis, [id]: false };
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),

	setVis: (updater: VisMap | ((prev: VisMap) => VisMap)) =>
		set((s) => {
			const nv = typeof updater === "function" ? updater(s.vis) : updater;
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),

	setEditMode: (v: boolean | ((prev: boolean) => boolean)) =>
		set((s) => ({
			editMode: typeof v === "function" ? v(s.editMode) : v,
		})),

	handleLayoutChange: (currentLayout: LayoutItem[]) => {
		const { currentBreakpoint: bp, layouts: currentLayouts } = get();
		const bpLayout = currentLayouts[bp];
		if (!bpLayout) return;
		const compacted = new Map(
			currentLayout.map((l) => [l.i, { y: l.y, h: l.h }]),
		);
		let changed = false;
		for (const item of bpLayout) {
			const c = compacted.get(item.i);
			if (c && (item.y !== c.y || item.h !== c.h)) {
				changed = true;
				break;
			}
		}
		if (!changed) return;
		const next: Layouts = {
			...currentLayouts,
			[bp]: bpLayout.map((l) => {
				const c = compacted.get(l.i);
				return c ? { ...l, y: c.y, h: c.h } : l;
			}),
		};
		set({ layouts: next });
		save("mb_layouts", next);
	},

	saveDraggedLayout: (layout: LayoutItem[]) => {
		const { layouts: currentLayouts, currentBreakpoint: bp } = get();
		const incoming = layout.map(({ static: _s, ...rest }) => rest);
		const incomingIds = new Set(incoming.map((l) => l.i));
		const preserved = (currentLayouts[bp] || [])
			.filter((l) => !incomingIds.has(l.i))
			.map(({ static: _s, ...rest }) => rest);
		const merged: Layouts = { ...currentLayouts, [bp]: [...incoming, ...preserved] };
		set({ layouts: merged });
		save("mb_layouts", merged);
		syncWidgetDB({ layouts: merged });
	},

	resetLayout: () => {
		set({ layouts: DEFAULT_LAYOUTS });
		save("mb_layouts", DEFAULT_LAYOUTS);
		syncWidgetDB({ layouts: DEFAULT_LAYOUTS });
	},

	setShowAddSmart: (v: boolean) => set({ showAddSmart: v }),
	setNewKeyword: (v: string) => set({ newKeyword: v }),

	addSmartWidget: async () => {
		const { newKeyword, smartKeywords } = get();
		const kw = newKeyword.trim();
		if (!kw) {
			toast.error(i18n.t("toast.widget_invalid"), { id: "widget-invalid" });
			return;
		}
		if (smartKeywords.includes(kw)) {
			toast.error(i18n.t("toast.widget_exists"), { id: "widget-exists" });
			return;
		}
		if (kw.startsWith("smart_") || BUILTIN_IDS.has(kw)) {
			toast.error(i18n.t("toast.widget_invalid"), { id: "widget-invalid" });
			return;
		}
		const newKey = `smart_${kw}`;
		set((s) => {
			const nextKeywords = [...s.smartKeywords, kw];
			save("mb_smart", nextKeywords);
			const nextLayouts: Layouts = {};
			for (const bp of Object.keys(s.layouts)) {
				const arr = [...s.layouts[bp]];
				const maxY = arr.reduce((m, l) => Math.max(m, l.y + l.h), 0);
				arr.push({
					i: newKey,
					x: 0,
					y: maxY,
					w: 3,
					h: 10,
					minW: 2,
					minH: 6,
				});
				nextLayouts[bp] = arr;
			}
			save("mb_layouts", nextLayouts);
			syncKeywords(nextKeywords);
			syncWidgetDB({ layouts: nextLayouts });
			return {
				smartKeywords: nextKeywords,
				layouts: nextLayouts,
				newKeyword: "",
				showAddSmart: false,
			};
		});
		toast.success(i18n.t("toast.widget_added"), { id: "widget-added" });
		await get().loadSmartWidget(kw, true);
	},

	removeSmartWidget: (kw: string) => {
		const removeKey = `smart_${kw}`;
		set((s) => {
			const nextKeywords = s.smartKeywords.filter((k) => k !== kw);
			const nextData = { ...s.smartWidgetData };
			const nextErrors = { ...s.smartWidgetErrors };
			const nextCategoryOverrides = { ...s.smartWidgetCategoryOverrides };
			Object.keys(nextData).forEach((key) => {
				if (key === kw || key.startsWith(`${kw}_`)) delete nextData[key];
			});
			delete nextErrors[kw];
			delete nextCategoryOverrides[kw];
			save("mb_smart", nextKeywords);
			save("mb_smart_data", nextData);
			save("mb_smart_categories", nextCategoryOverrides);
			const nextLayouts: Layouts = {};
			for (const bp of Object.keys(s.layouts)) {
				nextLayouts[bp] = s.layouts[bp].filter((l) => l.i !== removeKey);
			}
			save("mb_layouts", nextLayouts);
			syncKeywords(nextKeywords);
			syncWidgetDB({ layouts: nextLayouts });
			return {
				smartKeywords: nextKeywords,
				layouts: nextLayouts,
				smartWidgetData: nextData,
				smartWidgetErrors: nextErrors,
				smartWidgetCategoryOverrides: nextCategoryOverrides,
			};
		});
	},

	renameSmartWidget: async (oldKw: string, nextKwRaw: unknown): Promise<boolean> => {
		const nextKw = String(nextKwRaw || "").trim();
		if (!nextKw) {
			toast.error(i18n.t("toast.widget_invalid"), { id: "widget-invalid" });
			return false;
		}
		if (nextKw === oldKw) return true;
		const { smartKeywords } = get();
		if (smartKeywords.includes(nextKw)) {
			toast.error(i18n.t("toast.widget_exists"), { id: "widget-exists" });
			return false;
		}
		if (nextKw.startsWith("smart_") || BUILTIN_IDS.has(nextKw)) {
			toast.error(i18n.t("toast.widget_invalid"), { id: "widget-invalid" });
			return false;
		}

		const oldKey = `smart_${oldKw}`;
		const nextKey = `smart_${nextKw}`;
		set((s) => {
			const nextKeywords = s.smartKeywords.map((kw) =>
				kw === oldKw ? nextKw : kw,
			);
			const nextData = { ...s.smartWidgetData };
			const nextErrors = { ...s.smartWidgetErrors };
			const nextRefreshing = { ...s.refreshing };
			const nextCategoryOverrides = { ...s.smartWidgetCategoryOverrides };
			Object.keys(nextData).forEach((key) => {
				if (key === oldKw || key.startsWith(`${oldKw}_`)) delete nextData[key];
			});
			delete nextErrors[oldKw];
			delete nextRefreshing[oldKw];
			if (Object.prototype.hasOwnProperty.call(nextCategoryOverrides, oldKw)) {
				nextCategoryOverrides[nextKw] = nextCategoryOverrides[oldKw];
				delete nextCategoryOverrides[oldKw];
			}
			const nextLayouts: Layouts = {};
			for (const bp of Object.keys(s.layouts)) {
				nextLayouts[bp] = s.layouts[bp].map((layout) =>
					layout.i === oldKey ? { ...layout, i: nextKey } : layout,
				);
			}
			save("mb_smart", nextKeywords);
			save("mb_smart_data", nextData);
			save("mb_smart_categories", nextCategoryOverrides);
			save("mb_layouts", nextLayouts);
			syncKeywords(nextKeywords);
			syncWidgetDB({ layouts: nextLayouts });
			return {
				smartKeywords: nextKeywords,
				layouts: nextLayouts,
				smartWidgetData: nextData,
				smartWidgetErrors: nextErrors,
				refreshing: nextRefreshing,
				smartWidgetCategoryOverrides: nextCategoryOverrides,
			};
		});
		await get().loadSmartWidget(nextKw, true);
		return true;
	},

	setSmartWidgetCategory: async (kw: string, category: string): Promise<void> => {
		const nextCategory = SMART_WIDGET_CATEGORY_IDS.has(category)
			? category
			: "general";
		set((s) => {
			const nextCategoryOverrides: Record<string, string> = {
				...s.smartWidgetCategoryOverrides,
				[kw]: nextCategory,
			};
			const nextData = { ...s.smartWidgetData };
			Object.keys(nextData).forEach((key) => {
				if (key === kw || key.startsWith(`${kw}_`)) delete nextData[key];
			});
			save("mb_smart_categories", nextCategoryOverrides);
			save("mb_smart_data", nextData);
			return {
				smartWidgetCategoryOverrides: nextCategoryOverrides,
				smartWidgetData: nextData,
			};
		});
		await get().loadSmartWidget(kw, true);
	},

	refreshSmartWidget: async (kw: string): Promise<SmartWidgetData | null> =>
		get().loadSmartWidget(kw, true),

	reloadAllSmartWidgets: () => {
		const { smartKeywords, loadSmartWidget } = useWidgetStore.getState();
		for (const kw of smartKeywords) {
			loadSmartWidget(kw, false);
		}
	},

	setCurrentBreakpoint: (bp: string) => set({ currentBreakpoint: bp }),

	updateWidgetHeight: (widgetKey: string, newH: number) => {
		const { layouts, currentBreakpoint: bp } = get();
		const bpLayout = layouts[bp];
		if (!bpLayout) return;
		const item = bpLayout.find((l) => l.i === widgetKey);
		if (!item || item.h === newH) return;
		const next: Layouts = {
			...layouts,
			[bp]: bpLayout.map((l) => (l.i === widgetKey ? { ...l, h: newH } : l)),
		};
		set({ layouts: next });
		save("mb_layouts", next);
	},
}));

// 언어 변경 시 Smart Widget 자동 재로드 (news/trends 패턴과 동일)
i18n.on("languageChanged", () => {
	const { smartKeywords, loadSmartWidget } = useWidgetStore.getState();
	for (const kw of smartKeywords) {
		loadSmartWidget(kw, false);
	}
});
