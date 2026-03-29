import { useState } from "react";
import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const TrendsWidget = () => {
	const { isDark } = useTheme();
	const { t } = useTranslation();
	const trends = useDataStore((s) => s.trends);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading = useDataStore((s) => s.loading.trends);
	const error = useDataStore((s) => s.errors.trends);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	const [showNewsModal, setShowNewsModal] = useState(false);

	return (
		<>
			<WidgetCard
				title={t("widgets.trends.title")}
				icon={TrendingUp}
				widgetId="trends"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchTrends(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
			>
				{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
				{loading ? (
					<p className="text-sm opacity-60">{t("widgets.trends.loading")}</p>
				) : trends.length === 0 ? (
					<p className="text-sm opacity-60">{t("widgets.trends.no_data")}</p>
				) : (
					<div className="space-y-3">
						{trendsAnswer && (
							<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
								{trendsAnswer}
							</p>
						)}

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

						{trendsResults && trendsResults.length > 0 && (
							<div className="space-y-1.5">
								<p className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}>
									{t("widgets.trends.sources")}
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
										{t("common.show_more", { count: trendsResults.length - 3 })}
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</WidgetCard>

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
