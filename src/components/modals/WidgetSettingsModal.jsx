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
	const { i18n } = useTranslation();
	const { isDark, cardCls, borderCls, muted } = useTheme();
	const activeWidgetSettings = useWidgetStore((s) => s.activeWidgetSettings);
	const widgetSettings = useWidgetStore((s) => s.widgetSettings);
	const setWidgetSetting = useWidgetStore((s) => s.setWidgetSetting);
	const closeWidgetSettings = useWidgetStore((s) => s.closeWidgetSettings);
	const setShowSettings = useSettingsStore((s) => s.setShowSettings);
	const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = isKo
		? {
				title: "위젯 설정",
				viewMode: "보기 방식",
				viewLabels: { text: "텍스트", news: "뉴스", grid: "그리드" },
				smartPrefix: "스마트",
				interestTitle: "관심사 반영",
				interestDesc: "내 관심 키워드를 검색에 활용",
				noSettingsTitle: "이 위젯에는 개별 설정이 없습니다.",
				noSettingsDesc:
					"글자 크기 같은 전역 옵션은 설정의 `위젯 관리` 탭에서 조절할 수 있습니다.",
				openWidgetSettings: "위젯 관리 열기",
				widgetNames: {
					news: "뉴스",
					trends: "실시간 트렌드",
					weather: "날씨",
					stocks: "주식/환율",
					health: "건강",
					calendar: "캘린더",
					briefing: "AI 브리핑",
				},
			}
		: {
				title: "Widget Settings",
				viewMode: "View mode",
				viewLabels: { text: "Text", news: "News", grid: "Grid" },
				smartPrefix: "Smart",
				interestTitle: "Use interests",
				interestDesc: "Include my interest keywords in searches",
				noSettingsTitle: "This widget has no individual settings.",
				noSettingsDesc:
					"Global options like font size can be adjusted in Settings > Widget Management.",
				openWidgetSettings: "Open widget settings",
				widgetNames: {
					news: "News",
					trends: "Live Trends",
					weather: "Weather",
					stocks: "Stocks/Exchange",
					health: "Health",
					calendar: "Calendar",
					briefing: "AI Briefing",
				},
			};

	if (!activeWidgetSettings) return null;

	const widgetId = activeWidgetSettings;
	const isSmart = widgetId.startsWith("smart_");
	const keyword = isSmart ? widgetId.replace("smart_", "") : null;
	const settings = widgetSettings[widgetId] || {};

	const viewOptions = isSmart
		? ["text", "news"]
		: (VIEW_OPTIONS[widgetId] ?? null);
	const defaultView = widgetId === "news" ? "news" : "text";
	const currentView = settings.viewType ?? defaultView;
	const interestsOn = settings.interestsEnabled ?? true;
	const hasWidgetSpecificSettings = Boolean(viewOptions) || isSmart;

	const displayName = isSmart
		? `${copy.smartPrefix}: ${keyword}`
		: (copy.widgetNames[widgetId] ?? widgetId);

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
						<p className={`text-[10px] ${muted} mb-0.5`}>{copy.title}</p>
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
							{copy.viewMode}
						</p>
						<div className="flex gap-2">
							{viewOptions.map((type) => (
								<button
									key={type}
									onClick={() => setWidgetSetting(widgetId, "viewType", type)}
									className={`${btnBase} ${currentView === type ? btnActive : btnInactive}`}
								>
									{copy.viewLabels[type]}
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
							<p className="text-xs font-medium">{copy.interestTitle}</p>
							<p className={`text-[10px] ${muted}`}>{copy.interestDesc}</p>
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
						<p className="font-medium mb-1">{copy.noSettingsTitle}</p>
						<p className={muted}>{copy.noSettingsDesc}</p>
						<button
							onClick={openGlobalWidgetSettings}
							className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
						>
							{copy.openWidgetSettings}
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default WidgetSettingsModal;
