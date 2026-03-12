import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { generateSmartWidgetData } from "../services/aiService";
import { useAuthStore } from "./useAuthStore";
import { useDataStore } from "./useDataStore";
import { DEFAULT_VIS, DEFAULT_LAYOUTS, WIDGET_LIST } from "../constants";

const LAYOUT_VERSION = 13;
const BUILTIN_IDS = new Set(WIDGET_LIST.map((w) => w.id));

const initLayouts = () => {
	const savedVer = load("mb_layout_ver", 0);
	if (savedVer < LAYOUT_VERSION) {
		save("mb_layout_ver", LAYOUT_VERSION);
		save("mb_layouts", DEFAULT_LAYOUTS);
		return DEFAULT_LAYOUTS;
	}
	return load("mb_layouts", DEFAULT_LAYOUTS);
};

/* Supabase DB에 위젯 상태 동기화 (백그라운드) */
const syncWidgetDB = async (fields) => {
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
		console.warn("Widget sync failed:", e.message);
	}
};

const syncKeywords = async (keywords) => {
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
		console.warn("Keywords sync failed:", e.message);
	}
};

export const useWidgetStore = create((set, get) => ({
	vis: load("mb_vis", DEFAULT_VIS),
	layouts: initLayouts(),
	editMode: false,
	smartKeywords: load("mb_smart", ["카메라", "노트북"]),
	smartWidgetData: load("mb_smart_data", {}),
	smartWidgetErrors: {},
	refreshing: {},
	showAddSmart: false,
	newKeyword: "",
	currentBreakpoint: "lg",

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
			const mergedVis = { ...DEFAULT_VIS, ...settings.vis };
			set({ vis: mergedVis });
			save("mb_vis", mergedVis);
		}

		// 레이아웃
		const { data: layoutData } = await supabase
			.from("widget_layouts")
			.select("layouts")
			.eq("id", user.id)
			.single();
		const hasValidBreakpointLayout =
			layoutData?.layouts &&
			typeof layoutData.layouts === "object" &&
			Object.keys(layoutData.layouts).some((bp) =>
				Array.isArray(layoutData.layouts[bp]),
			);
		if (hasValidBreakpointLayout) {
			set({ layouts: layoutData.layouts });
			save("mb_layouts", layoutData.layouts);
		}

		// 스마트 키워드
		const { data: kwData } = await supabase
			.from("smart_keywords")
			.select("keyword")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true });
		if (kwData && kwData.length > 0) {
			const keywords = kwData.map((r) => r.keyword);
			set({ smartKeywords: keywords });
			save("mb_smart", keywords);
		}
	},
	loadSmartWidget: async (kw, force = false) => {
		const existing = get().smartWidgetData?.[kw];
		if (existing && !force) return existing;

		set((s) => ({
			refreshing: { ...s.refreshing, [kw]: true },
			smartWidgetErrors: { ...s.smartWidgetErrors, [kw]: null },
		}));

		try {
			const authState = useAuthStore.getState();
			const dataState = useDataStore.getState();
			const providerToken = await authState.ensureProviderToken?.();
			const data = await generateSmartWidgetData(kw, {
				persona: {
					persona:
						authState.persona ?? dataState.onboardingProfile?.persona ?? null,
					age: dataState.onboardingProfile?.age ?? null,
					interests:
						dataState.onboardingProfile?.interests ?? authState.selCats ?? [],
					job: null,
				},
				token: providerToken ?? authState.providerToken ?? null,
			});
			if (!data) throw new Error("No smart widget data returned");

			const nextData = { ...get().smartWidgetData, [kw]: data };
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
					[kw]: error.message || "스마트 위젯 데이터를 불러오지 못했습니다.",
				},
			}));
			return null;
		}
	},

	toggleVis: (id) =>
		set((s) => {
			const nv = { ...s.vis, [id]: !s.vis[id] };
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),
	closeWidget: (id) =>
		set((s) => {
			const nv = { ...s.vis, [id]: false };
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),
	setVis: (updater) =>
		set((s) => {
			const nv = typeof updater === "function" ? updater(s.vis) : updater;
			save("mb_vis", nv);
			syncWidgetDB({ vis: nv });
			return { vis: nv };
		}),
	setEditMode: (v) =>
		set((s) => ({
			editMode: typeof v === "function" ? v(s.editMode) : v,
		})),
	handleLayoutChange: (_currentLayout, _allLayouts) => {
		/* Only save on user drag — triggered via onDragStop */
	},
	saveDraggedLayout: (layout) => {
		const { layouts: currentLayouts, currentBreakpoint: bp } = get();
		const incoming = layout.map(({ static: _s, ...rest }) => rest);
		const incomingIds = new Set(incoming.map((l) => l.i));
		const preserved = (currentLayouts[bp] || [])
			.filter((l) => !incomingIds.has(l.i))
			.map(({ static: _s, ...rest }) => rest);
		const merged = { ...currentLayouts, [bp]: [...incoming, ...preserved] };
		set({ layouts: merged });
		save("mb_layouts", merged);
		syncWidgetDB({ layouts: merged });
	},
	resetLayout: () => {
		set({ layouts: DEFAULT_LAYOUTS });
		save("mb_layouts", DEFAULT_LAYOUTS);
		syncWidgetDB({ layouts: DEFAULT_LAYOUTS });
	},
	setShowAddSmart: (v) => set({ showAddSmart: v }),
	setNewKeyword: (v) => set({ newKeyword: v }),
	addSmartWidget: async () => {
		const { newKeyword, smartKeywords } = get();
		const kw = newKeyword.trim();
		if (!kw || smartKeywords.includes(kw)) return;
		if (kw.startsWith("smart_") || BUILTIN_IDS.has(kw)) return;
		const newKey = `smart_${kw}`;
		set((s) => {
			const nextKeywords = [...s.smartKeywords, kw];
			save("mb_smart", nextKeywords);
			const nextLayouts = {};
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
		await get().loadSmartWidget(kw, true);
	},
	removeSmartWidget: (kw) => {
		const removeKey = `smart_${kw}`;
		set((s) => {
			const nextKeywords = s.smartKeywords.filter((k) => k !== kw);
			const nextData = { ...s.smartWidgetData };
			const nextErrors = { ...s.smartWidgetErrors };
			delete nextData[kw];
			delete nextErrors[kw];
			save("mb_smart", nextKeywords);
			save("mb_smart_data", nextData);
			const nextLayouts = {};
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
			};
		});
	},
	refreshSmartWidget: async (kw) => get().loadSmartWidget(kw, true),
	setCurrentBreakpoint: (bp) => set({ currentBreakpoint: bp }),
	updateWidgetHeight: (widgetKey, newH) => {
		const { layouts, currentBreakpoint: bp } = get();
		const bpLayout = layouts[bp];
		if (!bpLayout) return;
		const item = bpLayout.find((l) => l.i === widgetKey);
		if (!item || item.h === newH) return;
		const next = {
			...layouts,
			[bp]: bpLayout.map((l) => (l.i === widgetKey ? { ...l, h: newH } : l)),
		};
		set({ layouts: next });
		save("mb_layouts", next);
	},
}));
