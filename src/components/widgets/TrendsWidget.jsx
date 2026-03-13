import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

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
	const rawTrends = useDataStore((s) => s.rawData.trends);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	return (
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
									isDark
										? "bg-white/5 border-white/10"
										: "bg-gray-50 border-gray-200"
								}`}
							>
								{tag}
							</span>
						))}
					</div>

					{/* 출처 목록 */}
					{trendsResults && trendsResults.length > 0 && (
						<div className="space-y-1.5">
							<p className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}>
								출처
							</p>
							{trendsResults.map((r, i) => (
								<a
									key={i}
									href={r.url}
									target="_blank"
									rel="noopener noreferrer"
									className={`flex items-start gap-1.5 p-1.5 rounded-md text-xs transition-colors ${
										isDark
											? "hover:bg-white/5"
											: "hover:bg-gray-50"
									}`}
								>
									<ExternalLink size={11} className="mt-0.5 shrink-0 opacity-40" />
									<span className={`line-clamp-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}>
										{r.title || r.url}
									</span>
								</a>
							))}
						</div>
					)}
				</div>
			)}

			<details className="mt-3">
				<summary className="text-[11px] opacity-70 cursor-pointer">
					원본 API 데이터 (tavily)
				</summary>
				<pre
					className={`mt-2 text-[10px] leading-relaxed p-2 rounded-lg overflow-auto max-h-48 ${
						isDark ? "bg-black/20" : "bg-gray-100"
					}`}
				>
					{JSON.stringify(rawTrends ?? trends, null, 2)}
				</pre>
			</details>
		</WidgetCard>
	);
};

export default TrendsWidget;
