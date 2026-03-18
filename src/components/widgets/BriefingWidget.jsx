import { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { generateBriefing } from "../../services/aiService";
import { mockBriefings } from "../../mock/data";

const BriefingWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);
	const length = useSettingsStore((s) => s.briefingLength) || "medium";
	const activeWidgetIds = useSettingsStore((s) => s.activeWidgetIds) || [];

	// 데이터 스토어에서 컨텍스트 수집
	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const calEvents = useDataStore((s) => s.calEvents);
	const todos = useTodoStore((s) => s.todos);

	// 전날 메모 가져오기
	const getDiary = useDiaryStore((s) => s.getDiary);
	const yesterdayMemo = useMemo(() => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dateStr = yesterday.toISOString().slice(0, 10);
		return getDiary(dateStr)?.memo || "";
	}, [getDiary]);

	const [briefingText, setBriefingText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [lastGenerated, setLastGenerated] = useState(null);

	// AI 브리핑 생성
	const generateNewBriefing = async () => {
		setIsLoading(true);
		try {
			const context = {
				weather,
				stocks,
				trends,
				calEvents,
				todos,
				activeWidgetIds,
				yesterdayMemo, // 전날 메모 반영
			};
			const result = await generateBriefing({ context, tone, length });
			if (result) {
				setBriefingText(result);
				setLastGenerated(new Date());
			}
		} catch (e) {
			console.warn("Briefing generation failed:", e?.message);
		} finally {
			setIsLoading(false);
		}
	};

	// 초기 로드 시 또는 tone 변경 시 브리핑 생성 (최초 1회)
	useEffect(() => {
		if (!briefingText && !isLoading) {
			generateNewBriefing();
		}
	}, [tone]);

	// 폴백: AI 생성 실패 시 mock 데이터 사용
	const displayBriefing = useMemo(() => {
		if (briefingText) {
			return {
				summary: "오늘의 AI 브리핑",
				detail: briefingText,
			};
		}
		return mockBriefings[tone] || mockBriefings.friendly;
	}, [briefingText, tone]);

	const lines = displayBriefing.detail
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return (
		<div
			className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 ${cardCls}`}
		>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Sparkles size={18} className="text-blue-500" />
					<h2 className="font-bold text-sm">AI 브리핑</h2>
				</div>
				<button
					onClick={generateNewBriefing}
					disabled={isLoading}
					className={`p-1.5 rounded-full transition-colors ${
						isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
					} ${isLoading ? "opacity-50" : ""}`}
					title="브리핑 새로고침"
				>
					<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
				</button>
			</div>

			<p className={`text-xs uppercase tracking-widest mb-3 ${muted}`}>
				Morning Digest
			</p>

			<p className="text-sm font-medium mb-3">{displayBriefing.summary}</p>

			<div className="space-y-2">
				{lines.map((line, idx) => (
					<p key={idx} className={`text-xs leading-relaxed ${muted}`}>
						{line}
					</p>
				))}
			</div>

			{/* 전날 메모 반영 표시 */}
			{yesterdayMemo && (
				<p className={`mt-3 text-[10px] ${muted}`}>
					✨ 어제 메모가 브리핑에 반영되었습니다
				</p>
			)}
		</div>
	);
};

export default BriefingWidget;
