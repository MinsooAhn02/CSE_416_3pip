import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { TrendingUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useFontSize } from "../../hooks/useFontSize";
import { safeExternalUrl } from "../../utils/url";
import WidgetCard from "../common/WidgetCard";

const MAX_ITEMS = {
	small:  2,
	medium: 3,
	large:  3,
};
const MAX_EXPANDED = 6;

const TrendsWidget = () => {
	const { isDark, secondaryBgCls, borderCls, muted } = useTheme();
	const { t } = useTranslation();

	// Consolidated data-field selector — one subscription, shallow equality
	const { trendsResults, loading, error } = useDataStore(useShallow((s) => ({
		trendsResults: s.trendsResults,
		loading: s.loading.trends,
		error: s.errors.trends,
	})));
	// Actions are stable Zustand references — separate subscriptions cause no extra renders
	const fetchTrends   = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const { body: bodyStyle, key: fontKey } = useFontSize();
	const maxShow = MAX_ITEMS[fontKey as keyof typeof MAX_ITEMS] ?? MAX_ITEMS.medium;

	const [expanded, setExpanded] = useState(false);

	const formatLastUpdated = (minutes: number | null | undefined) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const allItems     = (trendsResults || []).filter((r) => r.title && r.title.trim().length >= 5);
	const limit        = expanded ? MAX_EXPANDED : maxShow;
	const displayItems = allItems.slice(0, limit);
	const hasMore      = !expanded && allItems.length > maxShow;

	const renderContent = () => {
		if (loading) return <p className="opacity-60" style={bodyStyle}>{t("widgets.trends.loading")}</p>;
		if (error)   return <p className="text-red-400" style={bodyStyle}>{error}</p>;
		if (!allItems.length)
			return <p className="text-red-400" style={bodyStyle}>{t("widgets.trends.no_data")}</p>;

		return (
			<div className="space-y-2">
				<div className="flex flex-wrap gap-1.5">
					{displayItems.map((item, i) => (
						<a
							key={i}
							href={safeExternalUrl(item.url) || undefined}
							target="_blank"
							rel="noopener noreferrer"
							className={`px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 ${secondaryBgCls} ${borderCls}`}
							style={bodyStyle}
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
						className={`${muted} hover:opacity-100 transition-opacity`}
						style={bodyStyle}
					>
						{t("common.show_more_plain")}
					</button>
				)}
				{expanded && (
					<button
						onClick={() => setExpanded(false)}
						className={`${muted} hover:opacity-100 transition-opacity`}
						style={bodyStyle}
					>
						{t("common.show_less")}
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

export default memo(TrendsWidget);
