import { create } from "zustand";
import { load, save } from "../utils/storage";
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

export const useWidgetStore = create((set, get) => ({
	vis: load("mb_vis", DEFAULT_VIS),
	layouts: initLayouts(),
	editMode: false,
	smartKeywords: load("mb_smart", ["카메라", "노트북"]),
	refreshing: {},
	showAddSmart: false,
	newKeyword: "",
	currentBreakpoint: "lg",

	toggleVis: (id) =>
		set((s) => {
			const nv = { ...s.vis, [id]: !s.vis[id] };
			save("mb_vis", nv);
			return { vis: nv };
		}),
	closeWidget: (id) =>
		set((s) => {
			const nv = { ...s.vis, [id]: false };
			save("mb_vis", nv);
			return { vis: nv };
		}),
	setVis: (updater) =>
		set((s) => {
			const nv = typeof updater === "function" ? updater(s.vis) : updater;
			save("mb_vis", nv);
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
	},
	resetLayout: () => {
		set({ layouts: DEFAULT_LAYOUTS });
		save("mb_layouts", DEFAULT_LAYOUTS);
	},
	setShowAddSmart: (v) => set({ showAddSmart: v }),
	setNewKeyword: (v) => set({ newKeyword: v }),
	addSmartWidget: () => {
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
			return {
				smartKeywords: nextKeywords,
				layouts: nextLayouts,
				newKeyword: "",
				showAddSmart: false,
			};
		});
	},
	removeSmartWidget: (kw) => {
		const removeKey = `smart_${kw}`;
		set((s) => {
			const nextKeywords = s.smartKeywords.filter((k) => k !== kw);
			save("mb_smart", nextKeywords);
			const nextLayouts = {};
			for (const bp of Object.keys(s.layouts)) {
				nextLayouts[bp] = s.layouts[bp].filter((l) => l.i !== removeKey);
			}
			save("mb_layouts", nextLayouts);
			return { smartKeywords: nextKeywords, layouts: nextLayouts };
		});
	},
	refreshSmartWidget: (kw) => {
		set((s) => ({ refreshing: { ...s.refreshing, [kw]: true } }));
		setTimeout(() => {
			set((s) => ({ refreshing: { ...s.refreshing, [kw]: false } }));
		}, 1500);
	},
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
