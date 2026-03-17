import { useSettingsStore } from "../store/useSettingsStore";

export const useTheme = () => {
	const theme = useSettingsStore((s) => s.theme);
	const isDark = theme === "dark";

	return {
		isDark,
		cardCls: isDark
			? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
			: "bg-white/80 border-gray-200 text-slate-800",
		muted: isDark ? "text-neutral-400" : "text-slate-500",
		inputCls: isDark
			? "bg-[#333333] border-[#444444] placeholder:text-neutral-500 text-white"
			: "bg-white/60 border-gray-300 placeholder:text-gray-400 text-slate-800",
	};
};
