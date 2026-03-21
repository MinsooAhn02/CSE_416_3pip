import { useSettingsStore } from "../store/useSettingsStore";

export const useTheme = () => {
	const theme = useSettingsStore((s) => s.theme);
	const isDark = theme === "dark";

	return {
		isDark,
		// Morning Theme color classes (REQ-TS-001)
		pageCls: isDark ? "bg-morning-dark-page" : "bg-morning-light-page",
		cardCls: isDark
			? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text",
		cardSecondaryCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-card/80 border-morning-light-hover/20 text-morning-light-text",
		hoverCls: isDark
			? "hover:bg-morning-dark-hover"
			: "hover:bg-morning-light-hover/20",
		muted: isDark ? "text-morning-dark-muted" : "text-morning-light-muted",
		inputCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover placeholder:text-morning-dark-muted text-morning-dark-text"
			: "bg-white/60 border-morning-light-hover/30 placeholder:text-morning-light-muted text-morning-light-text",
		// Legacy compatibility (gradual migration)
		legacyCardCls: isDark
			? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
			: "bg-white/80 border-gray-200 text-slate-800",
	};
};
