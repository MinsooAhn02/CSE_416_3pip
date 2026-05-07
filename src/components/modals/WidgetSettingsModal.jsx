import { X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";

const VIEW_OPTIONS = {
	news: ["text", "news", "grid"],
	// trends: text-only, no view picker
};
const VIEW_LABELS = { text: "텍스트", news: "뉴스", grid: "그리드" };
const FONT_OPTIONS = [
	{ key: "small",  label: "작게" },
	{ key: "medium", label: "기본" },
	{ key: "large",  label: "크게" },
];

const WIDGET_NAMES = {
	news: "뉴스",
	trends: "실시간 트렌드",
	weather: "날씨",
	stocks: "주식/환율",
	health: "건강",
	calendar: "캘린더",
	briefing: "AI 브리핑",
};

const WidgetSettingsModal = () => {
	const { isDark, cardCls, borderCls, muted } = useTheme();
	const activeWidgetSettings = useWidgetStore((s) => s.activeWidgetSettings);
	const widgetSettings      = useWidgetStore((s) => s.widgetSettings);
	const globalFontSize      = useWidgetStore((s) => s.globalFontSize);
	const setWidgetSetting    = useWidgetStore((s) => s.setWidgetSetting);
	const setGlobalFontSize   = useWidgetStore((s) => s.setGlobalFontSize);
	const closeWidgetSettings = useWidgetStore((s) => s.closeWidgetSettings);

	if (!activeWidgetSettings) return null;

	const widgetId   = activeWidgetSettings;
	const isSmart    = widgetId.startsWith("smart_");
	const keyword    = isSmart ? widgetId.replace("smart_", "") : null;
	const settings   = widgetSettings[widgetId] || {};

	const viewOptions    = isSmart ? ["text", "news"] : VIEW_OPTIONS[widgetId] ?? null;
	const defaultView    = widgetId === "news" ? "news" : "text";
	const currentView    = settings.viewType ?? defaultView;
	const interestsOn    = settings.interestsEnabled ?? true;

	const displayName = isSmart ? `스마트: ${keyword}` : (WIDGET_NAMES[widgetId] ?? widgetId);

	const btnBase = `flex-1 py-1.5 rounded-lg text-xs border transition-colors`;
	const btnActive = "bg-blue-500 text-white border-blue-500";
	const btnInactive = isDark
		? "border-white/20 opacity-50 hover:opacity-100"
		: "border-gray-200 text-gray-500 hover:opacity-100";

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
						<p className={`text-[10px] ${muted} mb-0.5`}>위젯 설정</p>
						<h3 className="font-semibold text-sm">{displayName}</h3>
					</div>
					<button
						onClick={closeWidgetSettings}
						className={`p-1.5 rounded-lg transition-opacity opacity-50 hover:opacity-100 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
					>
						<X size={15} />
					</button>
				</div>

				{/* 글자 크기 (전체 적용) */}
				<div className="mb-4">
					<p className={`text-[11px] font-medium ${muted} mb-2`}>글자 크기 <span className="opacity-60">(전체 위젯 적용)</span></p>
					<div className="flex gap-2">
						{FONT_OPTIONS.map(({ key, label }) => (
							<button
								key={key}
								onClick={() => setGlobalFontSize(key)}
								className={`${btnBase} ${globalFontSize === key ? btnActive : btnInactive}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				{/* 보기 방식 (해당 위젯만) */}
				{viewOptions && (
					<div className="mb-4">
						<p className={`text-[11px] font-medium ${muted} mb-2`}>보기 방식</p>
						<div className="flex gap-2">
							{viewOptions.map((type) => (
								<button
									key={type}
									onClick={() => setWidgetSetting(widgetId, "viewType", type)}
									className={`${btnBase} ${currentView === type ? btnActive : btnInactive}`}
								>
									{VIEW_LABELS[type]}
								</button>
							))}
						</div>
					</div>
				)}

				{/* 관심사 반영 (스마트 위젯 전용) */}
				{isSmart && (
					<div className={`flex items-center justify-between pt-3 border-t ${borderCls}`}>
						<div>
							<p className="text-xs font-medium">관심사 반영</p>
							<p className={`text-[10px] ${muted}`}>내 관심 키워드를 검색에 활용</p>
						</div>
						<button
							onClick={() => setWidgetSetting(widgetId, "interestsEnabled", !interestsOn)}
							className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
								interestsOn ? "bg-blue-500" : isDark ? "bg-white/20" : "bg-gray-300"
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
			</div>
		</div>
	);
};

export default WidgetSettingsModal;
