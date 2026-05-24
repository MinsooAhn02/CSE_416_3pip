import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";

const VIEW_OPTIONS = {
	news: ["text", "news", "grid"],
	// trends: text-only, no view picker
};

const WidgetSettingsModal = () => {
	const { t } = useTranslation();
	const { isDark, cardCls, borderCls, muted } = useTheme();
	const activeWidgetSettings = useWidgetStore((s) => s.activeWidgetSettings);
	const widgetSettings = useWidgetStore((s) => s.widgetSettings);
	const setWidgetSetting = useWidgetStore((s) => s.setWidgetSetting);
	const closeWidgetSettings = useWidgetStore((s) => s.closeWidgetSettings);
	const setShowSettings = useSettingsStore((s) => s.setShowSettings);
	const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
	const viewLabels: Record<string, string> = {
		text: t("widget_settings.view_text"),
		news: t("widget_settings.view_news"),
		grid: t("widget_settings.view_grid"),
	};

	if (!activeWidgetSettings) return null;

	const widgetId = activeWidgetSettings;
	const isSmart = widgetId.startsWith("smart_");
	const keyword = isSmart ? widgetId.replace("smart_", "") : null;
	const settings = widgetSettings[widgetId] || {};

	const viewOptions = isSmart
		? ["text", "news"]
		: ((VIEW_OPTIONS as Record<string, string[]>)[widgetId] ?? null);
	const defaultView = widgetId === "news" ? "news" : "text";
	const currentView = settings.viewType ?? defaultView;
	const interestsOn = settings.interestsEnabled ?? true;
	const hasWidgetSpecificSettings = Boolean(viewOptions) || isSmart;

	const displayName = isSmart
		? `${t("widget_settings.smart_prefix")}: ${keyword}`
		: (t(`widget_settings.widget_names.${widgetId}`, { defaultValue: widgetId }));

	const btnBase = `flex-1 py-1.5 rounded-lg text-xs border transition-colors`;
	const btnActive = "bg-blue-500 text-white border-blue-500";
	const btnInactive = isDark
		? "border-white/20 opacity-50 hover:opacity-100"
		: "border-gray-200 text-gray-500 hover:opacity-100";
	const openGlobalWidgetSettings = () => {
		closeWidgetSettings();
		setSettingsTab("widgets");
		setShowSettings(true);
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
			onClick={closeWidgetSettings}
		>
			<div
				className={`relative w-76 rounded-2xl p-5 shadow-2xl ${cardCls}`}
				style={{ width: "300px" }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* 헤더 */}
				<div className="flex items-center justify-between mb-5">
					<div>
						<p className={`text-[10px] ${muted} mb-0.5`}>{t("widget_settings.title")}</p>
						<h3 className="font-semibold text-sm">{displayName}</h3>
					</div>
					<button
						onClick={closeWidgetSettings}
						className={`p-1.5 rounded-lg transition-opacity opacity-50 hover:opacity-100 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
					>
						<X size={15} />
					</button>
				</div>

				{/* 보기 방식 (해당 위젯만) */}
				{viewOptions && (
					<div className="mb-4">
						<p className={`text-[11px] font-medium ${muted} mb-2`}>
							{t("widget_settings.view_mode")}
						</p>
						<div className="flex gap-2">
							{viewOptions.map((type: string) => (
								<button
									key={type}
									onClick={() => setWidgetSetting(widgetId, "viewType", type)}
									className={`${btnBase} ${currentView === type ? btnActive : btnInactive}`}
								>
									{viewLabels[type]}
								</button>
							))}
						</div>
					</div>
				)}

				{/* 관심사 반영 (스마트 위젯 전용) */}
				{isSmart && (
					<div
						className={`flex items-center justify-between pt-3 border-t ${borderCls}`}
					>
						<div>
							<p className="text-xs font-medium">{t("widget_settings.interest_title")}</p>
							<p className={`text-[10px] ${muted}`}>{t("widget_settings.interest_desc")}</p>
						</div>
						<button
							onClick={() =>
								setWidgetSetting(widgetId, "interestsEnabled", !interestsOn)
							}
							className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
								interestsOn
									? "bg-blue-500"
									: isDark
										? "bg-white/20"
										: "bg-gray-300"
							}`}
						>
							<span
								className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
									interestsOn ? "translate-x-5" : "translate-x-0.5"
								}`}
							/>
						</button>
					</div>
				)}

				{!hasWidgetSpecificSettings && (
					<div
						className={`rounded-xl border p-3 text-xs leading-relaxed ${
							isDark
								? "border-white/10 bg-white/5"
								: "border-gray-200 bg-gray-50"
						}`}
					>
						<p className="font-medium mb-1">{t("widget_settings.no_settings_title")}</p>
						<p className={muted}>{t("widget_settings.no_settings_desc")}</p>
						<button
							onClick={openGlobalWidgetSettings}
							className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
						>
							{t("widget_settings.open_widget_settings")}
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default WidgetSettingsModal;
