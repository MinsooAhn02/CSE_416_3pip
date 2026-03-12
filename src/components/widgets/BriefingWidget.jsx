import { useEffect, useMemo, useState } from "react";
import { Settings, Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import { generateBriefing } from "../../services/aiService";
import WidgetCard from "../common/WidgetCard";

const BriefingWidget = () => {
	const { isDark, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);
	const bLen = useSettingsStore((s) => s.bLen);
	const setShowBriefSettings = useSettingsStore((s) => s.setShowBriefSettings);

	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const restaurants = useDataStore((s) => s.restaurants);
	const calEvents = useDataStore((s) => s.calEvents);
	const healthData = useDataStore((s) => s.healthData);
	const activeWidgetIds = useDataStore((s) => s.activeWidgetIds);
	const onboardingProfile = useDataStore((s) => s.onboardingProfile);
	const todos = useTodoStore((s) => s.todos);

	const [briefingText, setBriefingText] = useState("브리핑을 생성하는 중...");
	const [loading, setLoading] = useState(false);

	const context = useMemo(
		() => ({
			weather,
			stocks,
			trends,
			restaurants,
			calEvents,
			healthData,
			todos,
			activeWidgetIds,
			persona: onboardingProfile,
		}),
		[
			weather,
			stocks,
			trends,
			restaurants,
			calEvents,
			healthData,
			todos,
			activeWidgetIds,
			onboardingProfile,
		],
	);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			const text = await generateBriefing({
				tone,
				length: bLen,
				context,
			});
			if (cancelled) return;
			setBriefingText(text);
			setLoading(false);
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [tone, bLen, context]);

	const lines = briefingText
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return (
		<WidgetCard title="AI 브리핑" icon={Sparkles} widgetId="briefing">
			<div className="text-center">
				<p className={`text-xs uppercase tracking-widest mb-2 ${muted}`}>
					Morning Digest
				</p>
				{loading && (
					<p className={`text-xs mb-3 ${muted}`}>AI 브리핑 생성 중...</p>
				)}
				<div className="text-left space-y-1.5 mb-4">
					{lines.map((line, idx) => (
						<p
							key={`${idx}-${line}`}
							className={`text-xs leading-relaxed ${muted}`}
						>
							{line}
						</p>
					))}
				</div>
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
