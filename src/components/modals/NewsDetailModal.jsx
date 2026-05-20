import { createPortal } from "react-dom";
import { X, ExternalLink, Newspaper } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import { cleanContent } from "../../utils/contentUtils";

const NewsDetailModal = ({
	results = [],
	answer = "",
	onClose,
	hostElement = null,
	skipCount = 0,
	viewType = "news",
}) => {
	const { isDark, cardCls, borderCls, hoverCls, muted } = useTheme();
	const { t } = useTranslation();
	const globalFontSize = useWidgetStore((s) => s.globalFontSize);
	const fontCls =
		globalFontSize === "small"
			? "text-[10px]"
			: globalFontSize === "large"
				? "text-sm"
				: "text-xs";
	const titleFontCls =
		globalFontSize === "small"
			? "text-xs"
			: globalFontSize === "large"
				? "text-base"
				: "text-sm";
	const metaCls =
		globalFontSize === "small"
			? "text-[9px]"
			: globalFontSize === "large"
				? "text-xs"
				: "text-[11px]";

	if (typeof document === "undefined") return null;

	const remaining = results.slice(skipCount);
	const items = remaining.length > 0 ? remaining : results;

	const sectionFillMode = !!hostElement;
	const portalTarget = hostElement || document.body;

	const hostname = (url) => {
		try {
			return new URL(url).hostname.replace("www.", "");
		} catch {
			return "";
		}
	};

	// ── 텍스트 뷰 아이템 ────────────────────────────────────────
	const renderTextItem = (r, idx) => (
		<a
			key={idx}
			href={r.url || "#"}
			target="_blank"
			rel="noopener noreferrer"
			className={`flex flex-col px-4 py-3 border-b last:border-b-0 transition-colors ${borderCls} ${hoverCls}`}
			onClick={(e) => !r.url && e.preventDefault()}
		>
			<p
				className={`${titleFontCls} font-semibold leading-snug ${isDark ? "text-slate-100" : "text-slate-800"}`}
			>
				{r.title || t("widgets.news.no_results")}
			</p>
			{r.content && (
				<p
					className={`${fontCls} line-clamp-3 leading-relaxed mt-1.5 ${muted}`}
				>
					{cleanContent(r.content)}
				</p>
			)}
			{r.url && (
				<span
					className={`${metaCls} flex items-center gap-0.5 mt-1.5 ${isDark ? "text-blue-400/60" : "text-blue-500/60"}`}
				>
					<ExternalLink size={9} />
					{hostname(r.url)}
				</span>
			)}
		</a>
	);

	// ── 뉴스 뷰 아이템 ────────────────────────────────────────
	const renderNewsItem = (r, idx) => (
		<a
			key={idx}
			href={r.url || "#"}
			target="_blank"
			rel="noopener noreferrer"
			className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors ${borderCls} ${hoverCls}`}
			onClick={(e) => !r.url && e.preventDefault()}
		>
			{r.image ? (
				<img
					src={r.image}
					alt=""
					className="w-14 h-10 object-cover rounded-lg shrink-0"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			) : (
				<div
					className={`w-14 h-10 rounded-lg shrink-0 flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}
				>
					<Newspaper size={12} className="opacity-25" />
				</div>
			)}
			<div className="flex-1 min-w-0">
				<p
					className={`${titleFontCls} font-semibold line-clamp-2 leading-snug ${isDark ? "text-blue-300" : "text-blue-700"}`}
				>
					{r.title || t("widgets.news.no_results")}
				</p>
				{r.content && (
					<p
						className={`${fontCls} line-clamp-2 mt-1.5 leading-relaxed ${muted}`}
					>
						{cleanContent(r.content)}
					</p>
				)}
				{r.url && (
					<span
						className={`${metaCls} mt-1.5 flex items-center gap-0.5 ${isDark ? "text-blue-400/60" : "text-blue-500/60"}`}
					>
						<ExternalLink size={9} />
						{hostname(r.url)}
					</span>
				)}
			</div>
		</a>
	);

	// ── 그리드 뷰 아이템 ─────────────────────────────────────
	const renderGridItems = (list) => (
		<div className="grid grid-cols-3 gap-1.5 p-3">
			{list.map((r, idx) => (
				<a
					key={idx}
					href={r.url || "#"}
					target="_blank"
					rel="noopener noreferrer"
					className="overflow-hidden rounded-xl aspect-square relative block"
					onClick={(e) => !r.url && e.preventDefault()}
				>
					{r.image ? (
						<img
							src={r.image}
							alt=""
							className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
						/>
					) : (
						<div
							className={`w-full h-full flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}
						>
							<Newspaper size={12} className="opacity-25" />
						</div>
					)}
					{r.title && (
						<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-4">
							<p className="text-[10px] text-white font-medium line-clamp-2 leading-tight">
								{r.title}
							</p>
						</div>
					)}
				</a>
			))}
		</div>
	);

	return createPortal(
		<div
			className={
				sectionFillMode
					? "absolute inset-0 z-[120] p-3"
					: "fixed inset-0 z-[60] flex items-center justify-center p-6"
			}
			onClick={onClose}
		>
			{/* 배경 */}
			<div
				className={
					sectionFillMode
						? `absolute inset-3 rounded-2xl ${isDark ? "bg-black/20 backdrop-blur-sm" : "bg-slate-900/8 backdrop-blur-sm"}`
						: "absolute inset-0 bg-black/50 backdrop-blur-sm"
				}
			/>

			{/* 모달 본체 */}
			<div
				className={`z-10 rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardCls} ${
					sectionFillMode
						? "relative h-full w-full max-h-full"
						: "relative w-full max-w-sm max-h-[70vh]"
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* 헤더 */}
				<div
					className={`flex items-center justify-between px-4 py-3 border-b ${borderCls}`}
				>
					<div className="flex items-center gap-2">
						<Newspaper size={15} className="text-blue-500" />
						<h3 className="font-semibold text-sm">
							{t("widgets.news.detail_title")}
						</h3>
						{items.length > 0 && (
							<span className={`${metaCls} ${muted}`}>{t("widgets.news.item_count", { count: items.length })}</span>
						)}
					</div>
					<button
						onClick={onClose}
						className={`p-1 rounded-lg transition-colors ${hoverCls}`}
					>
						<X size={15} />
					</button>
				</div>

				{/* 아이템 목록 */}
				<div className="flex-1 overflow-y-auto">
					{items.length === 0 ? (
						<p className={`${fontCls} p-4 ${muted}`}>
							{t("widgets.news.no_results")}
						</p>
					) : viewType === "grid" ? (
						renderGridItems(items)
					) : viewType === "text" ? (
						items.map((r, idx) => renderTextItem(r, idx))
					) : (
						items.map((r, idx) => renderNewsItem(r, idx))
					)}
				</div>
			</div>
		</div>,
		portalTarget,
	);
};

export default NewsDetailModal;
