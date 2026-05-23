import { useSettingsStore } from "../store/useSettingsStore";

interface ThemeClasses {
	isDark: boolean;
	pageCls: string;
	cardShadowCls: string;
	cardCls: string;
	cardSecondaryCls: string;
	hoverCls: string;
	muted: string;
	inputCls: string;
	secondaryBgCls: string;
	deepBgCls: string;
	borderCls: string;
	navBtnCls: string;
	listItemBgCls: string;
}

export const useTheme = (): ThemeClasses => {
	const theme = useSettingsStore((s) => s.theme);
	const isDark = theme === "dark";

	return {
		isDark,
		pageCls: isDark ? "bg-morning-dark-page" : "bg-morning-light-page",
		cardShadowCls: isDark
			? "shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
			: "shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
		cardCls: isDark
			? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-card border-morning-light-hover text-morning-light-text",
		cardSecondaryCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover text-morning-dark-text"
			: "bg-morning-light-cardSecondary border-morning-light-hover text-morning-light-text",
		hoverCls: isDark
			? "hover:bg-morning-dark-hover"
			: "hover:bg-morning-light-hover",
		muted: isDark ? "text-morning-dark-muted" : "text-morning-light-muted",
		inputCls: isDark
			? "bg-morning-dark-cardSecondary border-morning-dark-hover placeholder:text-morning-dark-muted text-morning-dark-text"
			: "bg-morning-light-cardSecondary border-morning-light-hover placeholder:text-morning-light-muted text-morning-light-text",
		secondaryBgCls: isDark
			? "bg-morning-dark-cardSecondary"
			: "bg-morning-light-cardSecondary",
		deepBgCls: isDark ? "bg-morning-dark-page" : "bg-morning-light-hover",
		borderCls: isDark
			? "border-morning-dark-hover"
			: "border-morning-light-hover",
		navBtnCls: isDark
			? "bg-morning-dark-card hover:bg-morning-dark-hover border-morning-dark-hover text-morning-dark-text"
			: "bg-white hover:bg-morning-light-cardSecondary border-morning-light-hover text-morning-light-text",
		listItemBgCls: isDark
			? "bg-morning-dark-card hover:bg-morning-dark-cardSecondary"
			: "bg-morning-light-cardSecondary hover:bg-morning-light-hover",
	};
};
