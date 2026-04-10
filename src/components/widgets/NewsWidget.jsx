import { useState } from "react";
import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const NewsWidget = () => {
	const { isDark, listItemBgCls } = useTheme();
	const { t } = useTranslation();
	const newsResults = useDataStore((s) => s.newsResults);
	const newsAnswer = useDataStore((s) => s.newsAnswer);
	const loading = useDataStore((s) => s.loading.news);
	const error = useDataStore((s) => s.errors.news);
	const apiStatus = useDataStore((s) => s.apiStatus.news ?? null);
	const fetchNews = useDataStore((s) => s.fetchNews);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("news"));

	const [showNewsModal, setShowNewsModal] = useState(false);

	const newsItems = newsResults || [];

	return (
		<>
			<WidgetCard
				title={t("widgets.news.title")}
				icon={Newspaper}
				widgetId="news"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchNews(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
				apiStatus={apiStatus}
				apiError={error}
			>
				{loading ? (
					<p className="text-sm opacity-60">{t("widgets.news.loading")}</p>
				) : newsItems.length > 0 ? (
					<div className="space-y-3">
						{newsAnswer && (
							<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
								{newsAnswer}
							</p>
						)}

						<div className="space-y-1.5">
							{newsItems.slice(0, 5).map((item, i) => (
								<button
									key={i}
									onClick={() => setShowNewsModal(true)}
									className={`w-full flex items-start gap-2 p-2 rounded-lg text-xs transition-colors text-left ${
										listItemBgCls
									}`}
								>
									{item.image ? (
										<img
											src={item.image}
											alt=""
											className="w-12 h-10 object-cover rounded shrink-0"
											onError={(e) => { e.currentTarget.style.display = "none"; }}
										/>
									) : (
										<ExternalLink size={12} className="mt-0.5 shrink-0 opacity-40" />
									)}
									<div className="flex-1 min-w-0">
										<span className={`line-clamp-2 font-medium ${isDark ? "text-blue-300" : "text-blue-600"}`}>
											{item.title || item.url}
										</span>
										{item.content && (
											<p className={`line-clamp-1 mt-0.5 ${isDark ? "opacity-50" : "text-slate-500"}`}>
												{item.content}
											</p>
										)}
									</div>
								</button>
							))}
							{newsItems.length > 5 && (
								<button
									onClick={() => setShowNewsModal(true)}
									className="text-[10px] text-blue-400 hover:underline mt-1 w-full text-center py-1"
								>
									{t("common.show_more", { count: newsItems.length - 5 })}
								</button>
							)}
						</div>
					</div>
				) : error ? (
					<p className="text-[11px] text-red-400">{error}</p>
				) : (
					<p className="text-[11px] text-red-400">{t("widgets.news.no_data")}</p>
				)}
			</WidgetCard>

			{showNewsModal && (
				<NewsDetailModal
					results={newsItems}
					answer={newsAnswer || ""}
					onClose={() => setShowNewsModal(false)}
				/>
			)}
		</>
	);
};

export default NewsWidget;
