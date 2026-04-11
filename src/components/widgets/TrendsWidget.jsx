import { useRef, useState } from "react";
import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const TrendsWidget = () => {
	const { isDark, hoverCls, secondaryBgCls, borderCls } = useTheme();
	const { t } = useTranslation();
	const trends = useDataStore((s) => s.trends);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading = useDataStore((s) => s.loading.trends);
	const error = useDataStore((s) => s.errors.trends);
	const apiStatus = useDataStore((s) => s.apiStatus.trends ?? null);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	const [showNewsModal, setShowNewsModal] = useState(false);
	const [modalHostElement, setModalHostElement] = useState(null);
	const widgetAnchorRef = useRef(null);

	const openNewsModal = () => {
		const host =
			widgetAnchorRef.current?.closest('[data-widget-overlay-host="true"]') ??
			null;
		setModalHostElement(host);
		setShowNewsModal(true);
	};

	return (
		<>
			<div ref={widgetAnchorRef}>
				<WidgetCard
					title={t("widgets.trends.title")}
					icon={TrendingUp}
					widgetId="trends"
					headerMeta={lastUpdatedText}
					onRefresh={() => fetchTrends(undefined, true)}
					refreshing={!!loading}
					refreshIcon={RefreshCw}
					apiStatus={apiStatus}
					apiError={error}
				>
					{loading ? (
						<p className="text-sm opacity-60">{t("widgets.trends.loading")}</p>
					) : trends.length > 0 ? (
						<div className="space-y-3">
							{trendsAnswer && (
								<p
									className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}
								>
									{trendsAnswer}
								</p>
							)}

							<div className="flex flex-wrap gap-2">
								{trends.map((tag, i) => (
									<span
										key={i}
										className={`text-xs px-3 py-1.5 rounded-lg border ${`${secondaryBgCls} ${borderCls}`}`}
									>
										{tag}
									</span>
								))}
							</div>

							{trendsResults && trendsResults.length > 0 && (
								<div className="space-y-1.5">
									<p
										className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}
									>
										{t("widgets.trends.sources")}
									</p>
									{trendsResults.slice(0, 3).map((r, i) => (
										<button
											key={i}
											onClick={openNewsModal}
											className={`w-full flex items-start gap-1.5 p-1.5 rounded-md text-xs transition-colors text-left ${
												hoverCls
											}`}
										>
											<ExternalLink
												size={11}
												className="mt-0.5 shrink-0 opacity-40"
											/>
											<span
												className={`line-clamp-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}
											>
												{r.title || r.url}
											</span>
										</button>
									))}
									{trendsResults.length > 3 && (
										<button
											onClick={openNewsModal}
											className="text-[10px] text-blue-400 hover:underline mt-1"
										>
											{t("common.show_more", {
												count: trendsResults.length - 3,
											})}
										</button>
									)}
								</div>
							)}
						</div>
					) : error ? (
						<p className="text-[11px] text-red-400">{error}</p>
					) : (
						<p className="text-[11px] text-red-400">
							{t("widgets.trends.no_data")}
						</p>
					)}
				</WidgetCard>
			</div>

			{showNewsModal && (
				<NewsDetailModal
					results={trendsResults || []}
					answer={trendsAnswer || ""}
					hostElement={modalHostElement}
					onClose={() => {
						setShowNewsModal(false);
						setModalHostElement(null);
					}}
				/>
			)}
		</>
	);
};

export default TrendsWidget;
