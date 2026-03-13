import { TrendingUp, RefreshCw } from "lucide-react";
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
			onRefresh={() => fetchTrends()}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
			{loading ? (
				<p className="text-sm opacity-60">트렌드 데이터를 불러오는 중...</p>
			) : trends.length === 0 ? (
				<p className="text-sm opacity-60">표시할 트렌드가 없습니다.</p>
			) : (
				<div className="flex flex-wrap gap-2">
					{trends.map((tag, i) => (
						<span
							key={i}
							className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${
								isDark
									? "bg-white/5 border-white/10 hover:bg-white/15"
									: "bg-gray-50 border-gray-200 hover:bg-gray-100"
							}`}
						>
							{tag}
						</span>
					))}
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
