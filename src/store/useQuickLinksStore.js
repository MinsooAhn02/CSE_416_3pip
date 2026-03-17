import { create } from "zustand";
import { load, save } from "../utils/storage";

const DEFAULT_LINKS = [
	{ id: "naver", name: "네이버", url: "https://www.naver.com", icon: "N", color: "#03C75A" },
	{ id: "youtube", name: "유튜브", url: "https://www.youtube.com", icon: "YT", color: "#FF0000" },
	{ id: "instagram", name: "인스타", url: "https://www.instagram.com", icon: "IG", color: "#E1306C" },
	{ id: "google", name: "구글", url: "https://www.google.com", icon: "G", color: "#4285F4" },
];

export const useQuickLinksStore = create((set, get) => ({
	links: load("mb_quick_links", DEFAULT_LINKS),
	showEditor: false,

	setShowEditor: (v) => set({ showEditor: v }),

	addLink: (link) => {
		const newLink = { ...link, id: `link_${Date.now()}` };
		const next = [...get().links, newLink];
		save("mb_quick_links", next);
		set({ links: next });
	},

	removeLink: (id) => {
		const next = get().links.filter((l) => l.id !== id);
		save("mb_quick_links", next);
		set({ links: next });
	},

	updateLink: (id, updates) => {
		const next = get().links.map((l) => (l.id === id ? { ...l, ...updates } : l));
		save("mb_quick_links", next);
		set({ links: next });
	},

	resetLinks: () => {
		save("mb_quick_links", DEFAULT_LINKS);
		set({ links: DEFAULT_LINKS });
	},
}));
