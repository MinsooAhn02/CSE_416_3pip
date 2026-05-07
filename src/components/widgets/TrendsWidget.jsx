import { useState } from "react";
import { TrendingUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import WidgetCard from "../common/WidgetCard";

const MAX_ITEMS = {
	small:  7,
	medium: 5,
	large:  4,
};
const MAX_EXPANDED = 12;

const TrendsWidget = () => {
	const { isDark, secondaryBgCls, borderCls, muted } = useTheme();
	const { t } = useTranslation();

	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading       = useDataStore((s) => s.loading.trends);
	const error         = useDataStore((s) => s.errors.trends);
	const fetchTrends   = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const globalFontSize = useWidgetStore((s) => s.globalFontSize);

	const fontKey = globalFontSize in MAX_ITEMS ? globalFontSize : "medium";
	const maxShow = MAX_ITEMS[fontKey];
	const fontCls = fontKey === "small" ? "text-[10px]" : fontKey === "large" ? "text-sm" : "text-xs";

	const [expanded, setExpanded] = useState(false);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const allItems     = (trendsResults || []).filter((r) => r.title && r.title.trim().length >= 5);
	const limit        = expanded ? MAX_EXPANDED : maxShow;
	const displayItems = allItems.slice(0, limit);
	const hasMore      = !expanded && allItems.length > maxShow;

	const renderContent = () => {
		if (loading) return <p className={`${fontCls} opacity-60`}>{t("widgets.trends.loading")}</p>;
		if (error)   return <p className={`${fontCls} text-red-400`}>{error}</p>;
		if (!allItems.length)
			return <p className={`${fontCls} text-red-400`}>{t("widgets.trends.no_data")}</p>;

		return (
			<div className="space-y-2">
				<div className="flex flex-wrap gap-1.5">
					{displayItems.map((item, i) => (
						<a
							key={i}
							href={item.url || "#"}
							target="_blank"
							rel="noopener noreferrer"
							onClick={(e) => !item.url && e.preventDefault()}
							className={`${fontCls} px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 ${secondaryBgCls} ${borderCls}`}
						>
							<span className={`block line-clamp-2 leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}>
								{item.title}
							</span>
						</a>
					))}
				</div>
				{hasMore && (
					<button
						onClick={() => setExpanded(true)}
						className={`${fontCls} ${muted} hover:opacity-100 transition-opacity`}
					>
						{t("common.show_more_plain")}
					</button>
				)}
			</div>
		);
	};

	return (
		<WidgetCard
			title={t("widgets.trends.title")}
			icon={TrendingUp}
			widgetId="trends"
			headerMeta={formatLastUpdated(getLastUpdatedMinutes("trends"))}
			onRefresh={() => { setExpanded(false); fetchTrends(undefined, true); }}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			{renderContent()}
		</WidgetCard>
	);
};

export default TrendsWidget;
