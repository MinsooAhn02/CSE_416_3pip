import { useSettingsStore } from "../store/useSettingsStore";

export const useTheme = () => {
	const theme = useSettingsStore((s) => s.theme);
	const isDark = theme === "dark";

	return {
		isDark,
		cardCls: isDark
			? "bg-white/10 border-white/20 text-white"
			: "bg-white/80 border-gray-200 text-slate-800",
		muted: isDark ? "opacity-60" : "text-slate-500",
		inputCls: isDark
			? "bg-white/10 border-white/20 placeholder:text-white/30 text-white"
			: "bg-white/60 border-gray-300 placeholder:text-gray-400 text-slate-800",
	};
};
