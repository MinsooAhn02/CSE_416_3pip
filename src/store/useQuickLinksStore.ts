import { create } from "zustand";
import { load, save } from "../utils/storage";

export interface QuickLink {
	id: string;
	name: string;
	url: string;
	icon: string;
	color: string;
}

interface QuickLinksState {
	links: QuickLink[];
	showEditor: boolean;
	setShowEditor: (v: boolean) => void;
	addLink: (link: Omit<QuickLink, "id">) => void;
	removeLink: (id: string) => void;
	updateLink: (id: string, updates: Partial<Omit<QuickLink, "id">>) => void;
	resetLinks: () => void;
}

const DEFAULT_LINKS: QuickLink[] = [
	{ id: "naver", name: "Naver", url: "https://www.naver.com", icon: "N", color: "#03C75A" },
	{ id: "youtube", name: "YouTube", url: "https://www.youtube.com", icon: "YT", color: "#FF0000" },
	{ id: "instagram", name: "Instagram", url: "https://www.instagram.com", icon: "IG", color: "#E1306C" },
	{ id: "google", name: "Google", url: "https://www.google.com", icon: "G", color: "#4285F4" },
];

export const useQuickLinksStore = create<QuickLinksState>()((set, get) => ({
	links: load("mb_quick_links", DEFAULT_LINKS),
	showEditor: false,

	setShowEditor: (v: boolean) => set({ showEditor: v }),

	addLink: (link: Omit<QuickLink, "id">) => {
		const newLink: QuickLink = { ...link, id: `link_${Date.now()}` };
		const next = [...get().links, newLink];
		save("mb_quick_links", next);
		set({ links: next });
	},

	removeLink: (id: string) => {
		const next = get().links.filter((l) => l.id !== id);
		save("mb_quick_links", next);
		set({ links: next });
	},

	updateLink: (id: string, updates: Partial<Omit<QuickLink, "id">>) => {
		const next = get().links.map((l) => (l.id === id ? { ...l, ...updates } : l));
		save("mb_quick_links", next);
		set({ links: next });
	},

	resetLinks: () => {
		save("mb_quick_links", DEFAULT_LINKS);
		set({ links: DEFAULT_LINKS });
	},
}));
