import { useState } from "react";
import { Newspaper, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import WidgetCard from "../common/WidgetCard";
import { cleanContent } from "../../utils/contentUtils";

// 기본 표시 수 / 더보기 후 최대 수
const MAX_ITEMS = {
	small: { text: 5, news: 5, grid: 9 },
	medium: { text: 4, news: 4, grid: 6 },
	large: { text: 3, news: 3, grid: 3 },
};
const MAX_EXPANDED = 10;

const NewsWidget = () => {
	const { isDark, listItemBgCls, secondaryBgCls, muted } = useTheme();
	const { t } = useTranslation();

	const newsResults = useDataStore((s) => s.newsResults);
	const loading = useDataStore((s) => s.loading.news);
	const error = useDataStore((s) => s.errors.news);
	const fetchNews = useDataStore((s) => s.fetchNews);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const widgetSettings = useWidgetStore((s) => s.widgetSettings);
	const globalFontSize = useWidgetStore((s) => s.globalFontSize);

	const viewType = widgetSettings.news?.viewType ?? "news";
	const fontKey = globalFontSize in MAX_ITEMS ? globalFontSize : "medium";
	const maxShow = MAX_ITEMS[fontKey][viewType] ?? 3;
	const fontCls =
		fontKey === "small"
			? "text-[10px]"
			: fontKey === "large"
				? "text-sm"
				: "text-xs";
	const titleFontCls =
		fontKey === "small"
			? "text-xs"
			: fontKey === "large"
				? "text-base"
				: "text-sm";

	const [expanded, setExpanded] = useState(false);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const allItems = newsResults || [];
	const limit = expanded ? MAX_EXPANDED : maxShow;
	const displayItems = allItems.slice(0, limit);
	const hasMore = !expanded && allItems.length > maxShow;

	const linkProps = (item) => ({
		href: item.url || "#",
		target: "_blank",
		rel: "noopener noreferrer",
		onClick: (e) => !item.url && e.preventDefault(),
	});

	const renderContent = () => {
		if (loading)
			return (
				<p className={`${fontCls} opacity-60`}>{t("widgets.news.loading")}</p>
			);
		if (error) return <p className={`${fontCls} text-red-400`}>{error}</p>;
		if (!allItems.length)
			return (
				<p className={`${fontCls} text-red-400`}>{t("widgets.news.no_data")}</p>
			);

		// ── TEXT 뷰 ──────────────────────────────────────────────
		if (viewType === "text") {
			return (
				<div className="space-y-1.5">
					{displayItems.map((item, i) => (
						<a
							key={i}
							{...linkProps(item)}
							className={`w-full text-left flex flex-col px-3 py-2.5 rounded-xl transition-colors ${listItemBgCls}`}
						>
							<span
								className={`${titleFontCls} font-semibold leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}
							>
								{item.title || item.url}
							</span>
							{item.content && (
								<span
									className={`${fontCls} leading-relaxed line-clamp-2 mt-1.5 ${muted}`}
								>
									{cleanContent(item.content)}
								</span>
							)}
						</a>
					))}
					{hasMore && (
						<button
							onClick={() => setExpanded(true)}
							className={`${fontCls} text-blue-400 hover:underline w-full text-center pt-1`}
						>
							{t("common.show_more_plain")}
						</button>
					)}
				</div>
			);
		}

		// ── GRID 뷰 ──────────────────────────────────────────────
		if (viewType === "grid") {
			return (
				<div className="space-y-2">
					<div className="grid grid-cols-3 gap-1.5">
						{displayItems.map((item, i) => (
							<a
								key={i}
								{...linkProps(item)}
								className="overflow-hidden rounded-xl group aspect-square relative block"
							>
								{item.image ? (
									<img
										src={item.image}
										alt=""
										className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
										onError={(e) => {
											e.currentTarget.style.display = "none";
											e.currentTarget.parentElement
												.querySelector(".grid-fallback")
												?.classList.remove("hidden");
										}}
									/>
								) : null}
								<div
									className={`grid-fallback ${item.image ? "hidden" : ""} w-full h-full flex items-center justify-center ${secondaryBgCls}`}
								>
									<Newspaper size={16} className="opacity-20" />
								</div>
								{item.title && (
									<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-4">
										<p className="text-[10px] text-white font-medium line-clamp-2 leading-tight">
											{item.title}
										</p>
									</div>
								)}
							</a>
						))}
					</div>
					{hasMore && (
						<button
							onClick={() => setExpanded(true)}
							className={`${fontCls} text-blue-400 hover:underline w-full text-center`}
						>
							{t("common.show_more_plain")}
						</button>
					)}
				</div>
			);
		}

		// ── NEWS 뷰 (default) ─────────────────────────────────────
		return (
			<div className="space-y-1.5">
				{displayItems.map((item, i) => (
					<a
						key={i}
						{...linkProps(item)}
						className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors ${listItemBgCls}`}
					>
						<div className="w-16 h-14 rounded-lg shrink-0 overflow-hidden">
							{item.image ? (
								<img
									src={item.image}
									alt=""
									className="w-full h-full object-cover"
									onError={(e) => {
										e.currentTarget.style.display = "none";
										e.currentTarget.parentElement
											.querySelector(".news-fallback")
											?.classList.remove("hidden");
									}}
								/>
							) : null}
							<div
								className={`news-fallback ${item.image ? "hidden" : ""} w-full h-full flex items-center justify-center ${secondaryBgCls}`}
							>
								<Newspaper size={14} className="opacity-25" />
							</div>
						</div>
						<div className="flex-1 min-w-0 py-0.5">
							<p
								className={`${titleFontCls} font-semibold line-clamp-2 leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}
							>
								{item.title || item.url}
							</p>
							{item.content && (
								<p
									className={`${fontCls} line-clamp-2 mt-1.5 leading-relaxed ${muted}`}
								>
									{cleanContent(item.content)}
								</p>
							)}
						</div>
					</a>
				))}
				{hasMore && (
					<button
						onClick={() => setExpanded(true)}
						className={`${fontCls} text-blue-400 hover:underline w-full text-center pt-1`}
					>
						{t("common.show_more_plain")}
					</button>
				)}
			</div>
		);
	};

	return (
		<WidgetCard
			title={t("widgets.news.title")}
			icon={Newspaper}
			widgetId="news"
			headerMeta={formatLastUpdated(getLastUpdatedMinutes("news"))}
			onRefresh={() => {
				setExpanded(false);
				fetchNews(undefined, true);
			}}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			{renderContent()}
		</WidgetCard>
	);
};

export default NewsWidget;
