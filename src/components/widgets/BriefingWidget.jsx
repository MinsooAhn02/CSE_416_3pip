import { Settings, Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { mockBriefings } from "../../mock/data";
import WidgetCard from "../common/WidgetCard";

const BriefingWidget = () => {
	const { isDark, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);
	const bLen = useSettingsStore((s) => s.bLen);
	const setShowBriefSettings = useSettingsStore((s) => s.setShowBriefSettings);

	const brief = mockBriefings[tone] || mockBriefings.friendly;

	return (
		<WidgetCard title="AI 브리핑" icon={Sparkles} widgetId="briefing">
			<div className="text-center">
				<p className={`text-xs uppercase tracking-widest mb-2 ${muted}`}>
					Morning Digest
				</p>
				<h2 className="text-lg font-bold mb-2">{brief.summary}</h2>
				<p className={`text-xs mb-4 leading-relaxed ${muted}`}>
					{bLen === "short" ? brief.detail.split(".")[0] + "." : brief.detail}
				</p>
				<button
					onClick={() => setShowBriefSettings(true)}
					className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isDark ? "bg-white/20 hover:bg-white/30" : "bg-blue-200 hover:bg-blue-300"}`}
				>
					<Settings size={14} className="inline mr-1" />
					브리핑 설정
				</button>
			</div>
		</WidgetCard>
	);
};

export default BriefingWidget;
