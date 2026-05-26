import React, { memo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore, type ArticleItem } from "../../store/useDataStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useFontSize } from "../../hooks/useFontSize";
import WidgetCard from "../common/WidgetCard";
import { cleanContent } from "../../utils/contentUtils";

const MAX_ITEMS = {
	small: { text: 5, news: 5, grid: 9 },
	medium: { text: 4, news: 4, grid: 6 },
	large: { text: 3, news: 3, grid: 3 },
};

const NewsWidget = () => {
	const { isDark, listItemBgCls, secondaryBgCls, muted } = useTheme();
	const { t } = useTranslation();

	// Consolidated data-field selector — one subscription, shallow equality
	const { newsResults, loading, error } = useDataStore(useShallow((s) => ({
		newsResults: s.newsResults,
		loading: s.loading.news,
		error: s.errors.news,
	})));
	// Actions are stable Zustand references — separate subscriptions cause no extra renders
	const fetchNews = useDataStore((s) => s.fetchNews);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const widgetSettings = useWidgetStore((s) => s.widgetSettings);

	const { body: bodyStyle, title: titleStyle, key: fontKey } = useFontSize();
	const viewType = widgetSettings.news?.viewType ?? "news";
	const maxShow = MAX_ITEMS[fontKey as keyof typeof MAX_ITEMS]?.[viewType as keyof (typeof MAX_ITEMS)[keyof typeof MAX_ITEMS]] ?? 3;

	const [showAllModal, setShowAllModal] = useState(false);
	const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
	const [modalImgErrors, setModalImgErrors] = useState<Record<number, boolean>>({});

	const formatLastUpdated = (minutes: number | null | undefined) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const allItems = newsResults || [];
	const displayItems = allItems.slice(0, maxShow);
	const hasMore = allItems.length > maxShow;

	const linkProps = (item: ArticleItem) => ({
		href: item.url || "#",
		target: "_blank",
		rel: "noopener noreferrer",
		onClick: (e: React.MouseEvent) => !item.url && e.preventDefault(),
	});

	const modalCls = isDark
		? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text";
	const dividerCls = isDark ? "border-morning-dark-hover" : "border-morning-light-hover/30";
	const hoverBtnCls = isDark ? "hover:bg-morning-dark-hover" : "hover:bg-morning-light-hover/30";

	const renderContent = () => {
		if (loading)
			return (
				<p className="opacity-60" style={bodyStyle}>{t("widgets.news.loading")}</p>
			);
		if (error) return <p className="text-red-400" style={bodyStyle}>{error}</p>;
		if (!allItems.length)
			return (
				<p className="text-red-400" style={bodyStyle}>{t("widgets.news.no_data")}</p>
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
								className={`font-semibold leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}
							style={titleStyle}
							>
								{item.title || item.url}
							</span>
							{item.content && (
								<span
									className={`leading-relaxed line-clamp-2 mt-1.5 ${muted}`}
									style={bodyStyle}
								>
									{cleanContent(item.content)}
								</span>
							)}
						</a>
					))}
					{hasMore && (
						<button
							onClick={() => setShowAllModal(true)}
							className="text-blue-400 hover:underline w-full text-center pt-1"
							style={bodyStyle}
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
								{item.image && !imgErrors[i] ? (
									<img
										src={item.image}
										alt=""
										className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
										onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
									/>
								) : (
									<div className={`w-full h-full flex items-center justify-center ${secondaryBgCls}`}>
										<Newspaper size={16} className="opacity-20" />
									</div>
								)}
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
							onClick={() => setShowAllModal(true)}
							className="text-blue-400 hover:underline w-full text-center"
							style={bodyStyle}
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
							{item.image && !imgErrors[i] ? (
								<img
									src={item.image}
									alt=""
									className="w-full h-full object-cover"
									onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
								/>
							) : (
								<div className={`w-full h-full flex items-center justify-center ${secondaryBgCls}`}>
									<Newspaper size={14} className="opacity-25" />
								</div>
							)}
						</div>
						<div className="flex-1 min-w-0 py-0.5">
							<p
								className={`font-semibold line-clamp-2 leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}
								style={titleStyle}
							>
								{item.title || item.url}
							</p>
							{item.content && (
								<p
									className={`line-clamp-2 mt-1.5 leading-relaxed ${muted}`}
									style={bodyStyle}
								>
									{cleanContent(item.content)}
								</p>
							)}
						</div>
					</a>
				))}
				{hasMore && (
					<button
						onClick={() => setShowAllModal(true)}
						className="text-blue-400 hover:underline w-full text-center pt-1"
						style={bodyStyle}
					>
						{t("common.show_more_plain")}
					</button>
				)}
			</div>
		);
	};

	return (
		<>
			<WidgetCard
				title={t("widgets.news.title")}
				icon={Newspaper}
				widgetId="news"
				headerMeta={formatLastUpdated(getLastUpdatedMinutes("news"))}
				onRefresh={() => fetchNews(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
			>
				{renderContent()}
			</WidgetCard>

			{createPortal(
				<AnimatePresence>
					{showAllModal && (
						<>
							<motion.div
								className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
								onClick={() => setShowAllModal(false)}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
							<motion.div
								className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							>
								<div
									className={`w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${modalCls}`}
									onClick={(e) => e.stopPropagation()}
								>
									<div className={`flex-shrink-0 flex items-center justify-between p-4 border-b ${dividerCls}`}>
										<div className="flex items-center gap-3">
											<Newspaper size={18} className="text-blue-500" />
											<h3 className="font-bold text-base">{t("widgets.news.title")}</h3>
										</div>
										<button
											onClick={() => setShowAllModal(false)}
											className={`p-2 rounded-full transition-colors ${hoverBtnCls}`}
										>
											<X size={18} />
										</button>
									</div>
									<div className="flex-1 overflow-y-auto">
										<div className={`flex flex-col divide-y ${dividerCls}`}>
											{allItems.slice(0, 10).map((item, i) => (
												<a
													key={i}
													{...linkProps(item)}
													className={`flex gap-3 px-4 py-3 transition-colors ${hoverBtnCls}`}
												>
													<div className={`w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden ${secondaryBgCls}`}>
														{item.image && !modalImgErrors[i] ? (
															<img
																src={item.image}
																alt=""
																className="w-full h-full object-cover"
																loading="lazy"
																onError={() => setModalImgErrors(prev => ({ ...prev, [i]: true }))}
															/>
														) : (
															<div className="w-full h-full flex items-center justify-center">
																<Newspaper size={16} className="opacity-20" />
															</div>
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium line-clamp-2 leading-snug">
															{item.title}
														</p>
														{item.source && (
															<p className={`text-[11px] mt-1 ${isDark ? "text-gray-500" : "text-slate-400"}`}>
																{item.source}
															</p>
														)}
													</div>
												</a>
											))}
										</div>
									</div>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
};

export default memo(NewsWidget);
