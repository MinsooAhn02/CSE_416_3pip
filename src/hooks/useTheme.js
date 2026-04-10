import { useSettingsStore } from "../store/useSettingsStore";

export const useTheme = () => {
	const theme = useSettingsStore((s) => s.theme);
	const isDark = theme === "dark";

	return {
		isDark,
		// Morning Theme color classes (REQ-TS-001)
		pageCls: isDark ? "bg-morning-dark-page" : "bg-morning-light-page",
		cardShadowCls: isDark
			? "shadow-[0_1px_6px_rgba(0,0,0,0.24)]"
			: "shadow-[0_1px_6px_rgba(0,0,0,0.10)]",
		cardCls: isDark
			? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text",
		cardSecondaryCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-cardSecondary border-morning-light-hover/40 text-morning-light-text",
		hoverCls: isDark
			? "hover:bg-morning-dark-hover"
			: "hover:bg-morning-light-hover/30",
		muted: isDark ? "text-morning-dark-muted" : "text-morning-light-muted",
		inputCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover placeholder:text-morning-dark-muted text-morning-dark-text"
			: "bg-morning-light-card border-morning-light-hover/40 placeholder:text-morning-light-muted text-morning-light-text",
		// Secondary background only — for inline cards / tags / stat boxes within widgets
		secondaryBgCls: isDark
			? "bg-morning-dark-cardSecondary"
			: "bg-morning-light-cardSecondary",
		// Deepest background — for raw data / code blocks / scrollable pre areas
		deepBgCls: isDark ? "bg-morning-dark-page" : "bg-morning-light-hover/40",
		// Border only — for dividers and container outlines
		borderCls: isDark
			? "border-morning-dark-hover"
			: "border-morning-light-hover/40",
		// Circle nav buttons (TopNav, QuickLinks)
		navBtnCls: isDark
			? "bg-morning-dark-card hover:bg-morning-dark-hover border-morning-dark-hover"
			: "bg-white/50 hover:bg-white/80 border-morning-light-hover/50",
		// List item rows — base bg + hover (NewsWidget, DiaryPanel, etc.)
		listItemBgCls: isDark
			? "bg-morning-dark-card hover:bg-morning-dark-cardSecondary"
			: "bg-morning-light-cardSecondary hover:bg-morning-light-hover/30",
	};
};
