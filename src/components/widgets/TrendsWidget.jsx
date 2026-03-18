import { useState } from "react";
import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const TrendsWidget = () => {
	const { isDark } = useTheme();
	const trends = useDataStore((s) => s.trends);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading = useDataStore((s) => s.loading.trends);
	const error = useDataStore((s) => s.errors.trends);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	/* 뉴스 모달 상태 */
	const [showNewsModal, setShowNewsModal] = useState(false);

	return (
		<>
			<WidgetCard
				title="실시간 트렌드"
				icon={TrendingUp}
				widgetId="trends"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchTrends(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
			>
				{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
				{loading ? (
					<p className="text-sm opacity-60">트렌드 데이터를 불러오는 중...</p>
				) : trends.length === 0 ? (
					<p className="text-sm opacity-60">표시할 트렌드가 없습니다.</p>
				) : (
					<div className="space-y-3">
						{/* AI 요약 */}
						{trendsAnswer && (
							<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
								{trendsAnswer}
							</p>
						)}

						{/* 해시태그 */}
						<div className="flex flex-wrap gap-2">
							{trends.map((tag, i) => (
								<span
									key={i}
									className={`text-xs px-3 py-1.5 rounded-lg border ${
										isDark ? "bg-[#333333] border-[#3a3a3a]" : "bg-gray-50 border-gray-200"
									}`}
								>
									{tag}
								</span>
							))}
						</div>

						{/* 출처 목록 — 클릭 시 뉴스 모달 열기 */}
						{trendsResults && trendsResults.length > 0 && (
							<div className="space-y-1.5">
								<p className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}>
									출처
								</p>
								{trendsResults.slice(0, 3).map((r, i) => (
									<button
										key={i}
										onClick={() => setShowNewsModal(true)}
										className={`w-full flex items-start gap-1.5 p-1.5 rounded-md text-xs transition-colors text-left ${
											isDark
												? "hover:bg-[#333333]"
												: "hover:bg-gray-50"
										}`}
									>
										<ExternalLink size={11} className="mt-0.5 shrink-0 opacity-40" />
										<span className={`line-clamp-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}>
											{r.title || r.url}
										</span>
									</button>
								))}
								{trendsResults.length > 3 && (
									<button
										onClick={() => setShowNewsModal(true)}
										className="text-[10px] text-blue-400 hover:underline mt-1"
									>
										+{trendsResults.length - 3}건 더 보기
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</WidgetCard>

			{/* 뉴스 상세 모달 */}
			{showNewsModal && (
				<NewsDetailModal
					results={trendsResults || []}
					answer={trendsAnswer || ""}
					onClose={() => setShowNewsModal(false)}
				/>
			)}
		</>
	);
};

export default TrendsWidget;
