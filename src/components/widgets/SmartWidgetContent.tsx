import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, RefreshCw, Pencil, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { getSmartWidgetCacheKey, useWidgetStore } from "../../store/useWidgetStore";
import { useFontSize } from "../../hooks/useFontSize";
import DragHandle from "../common/DragHandle";
import { SMART_WIDGET_CATEGORY_OPTIONS } from "../../services/aiService";

interface SmartWidgetContentProps {
	keyword: string;
}

const SmartWidgetContent = ({ keyword }: SmartWidgetContentProps) => {
	const { isDark, cardCls, muted, hoverCls, secondaryBgCls } = useTheme();
	const { body: bodyStyle, title: titleStyle } = useFontSize();
	const { i18n } = useTranslation();
	const isKo = i18n.language?.startsWith("ko");

	const removeSmartWidget = useWidgetStore((s) => s.removeSmartWidget);
	const renameSmartWidget = useWidgetStore((s) => s.renameSmartWidget);
	const refreshSmartWidget = useWidgetStore((s) => s.refreshSmartWidget);
	const loadSmartWidget = useWidgetStore((s) => s.loadSmartWidget);
	const setSmartWidgetCategory = useWidgetStore((s) => s.setSmartWidgetCategory);
	const isRefreshing = useWidgetStore((s) => s.refreshing[keyword]);
	const error = useWidgetStore((s) => s.smartWidgetErrors[keyword]);

	const lang = isKo ? "ko" : "en";
	const cacheKey = getSmartWidgetCacheKey(keyword, lang);
	const generatedData = useWidgetStore((s) => s.smartWidgetData[cacheKey]);

	const data = generatedData;
	const [editingKeyword, setEditingKeyword] = useState(false);
	const [keywordDraft, setKeywordDraft] = useState(keyword);
	const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
	const [categoryMenuPosition, setCategoryMenuPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
	const [nowMs, setNowMs] = useState(() => Date.now());

	/* Guard: reset when keyword OR language changes to allow re-fetch */
	const fetchedRef = useRef(false);
	const categoryButtonRef = useRef<HTMLButtonElement>(null);
	const categoryMenuRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		fetchedRef.current = false;
		setEditingKeyword(false);
		setKeywordDraft(keyword);
		setCategoryMenuOpen(false);
		setCategoryMenuPosition(null);
	}, [keyword, lang]);
	useEffect(() => {
		if (!generatedData && !isRefreshing && !error && !fetchedRef.current) {
			fetchedRef.current = true;
			loadSmartWidget(keyword);
		}
	}, [generatedData, isRefreshing, error, keyword, loadSmartWidget]);
	useEffect(() => {
		setNowMs(Date.now());
		const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, [data?.lastUpdatedAt, data?.lastUpdated]);

	const loadingMsg = isKo
		? `'${keyword}' 검색 중...`
		: `Searching '${keyword}'...`;
	const hasHangulKeyword = /[가-힣]/.test(keyword);
	const hasLatinKeyword = /[A-Za-z]/.test(keyword);
	const languageMismatch = isKo
		? hasLatinKeyword && !hasHangulKeyword
		: hasHangulKeyword;
	const languageHint = isKo
		? "더 좋은 한국어 결과를 위해 키워드를 한국어로 바꿔보세요."
		: "For better English results, try changing this keyword to English.";
	const editPlaceholder = isKo ? "키워드 수정" : "Edit keyword";
	const categoryOptions = SMART_WIDGET_CATEGORY_OPTIONS.map((option) => {
		const labelObj = option.label as unknown as Record<string, string>;
		return {
			value: option.id,
			label: labelObj?.[lang] ?? labelObj?.["en"] ?? option.id,
			emoji: option.emoji || "🔍",
		};
	});
	const getUpdatedLabel = () => {
		const fallback = data?.lastUpdated ?? "";
		const updatedAt = new Date(data?.lastUpdatedAt ?? "").getTime();
		if (!Number.isFinite(updatedAt)) return fallback;
		const minutes = Math.max(0, Math.floor((nowMs - updatedAt) / 60000));
		if (minutes < 1) return isKo ? "방금 전" : "Just now";
		if (minutes < 60) return isKo ? `${minutes}분 전` : `${minutes}m ago`;
		return fallback;
	};
	const updatedLabel = getUpdatedLabel();

	const updateCategoryMenuPosition = () => {
		const rect = categoryButtonRef.current?.getBoundingClientRect();
		if (!rect || typeof window === "undefined") return;
		const width = 188;
		const margin = 8;
		const top = rect.bottom + 6;
		const left = Math.min(
			Math.max(rect.left, margin),
			window.innerWidth - width - margin,
		);
		setCategoryMenuPosition({
			left,
			top,
			width,
			maxHeight: Math.max(140, window.innerHeight - top - margin),
		});
	};

	useEffect(() => {
		if (!categoryMenuOpen) return;
		updateCategoryMenuPosition();

		const closeIfOutside = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (
				categoryButtonRef.current?.contains(target) ||
				categoryMenuRef.current?.contains(target)
			) {
				return;
			}
			setCategoryMenuOpen(false);
		};

		window.addEventListener("resize", updateCategoryMenuPosition);
		window.addEventListener("scroll", updateCategoryMenuPosition, true);
		document.addEventListener("mousedown", closeIfOutside);
		return () => {
			window.removeEventListener("resize", updateCategoryMenuPosition);
			window.removeEventListener("scroll", updateCategoryMenuPosition, true);
			document.removeEventListener("mousedown", closeIfOutside);
		};
	}, [categoryMenuOpen]);

	const submitKeywordEdit = async () => {
		const next = keywordDraft.trim();
		if (!next || next === keyword) {
			setEditingKeyword(false);
			setKeywordDraft(keyword);
			return;
		}
		const renamed = await renameSmartWidget(keyword, next);
		if (!renamed) setKeywordDraft(keyword);
		setEditingKeyword(false);
	};

	const getLocalizedSectionTitle = (section: { type?: string; title?: string }) => {
		if (section?.type === "summary") {
			return isKo ? "맞춤 검색" : "Personalized Search";
		}
		if (section?.type === "news") {
			return isKo ? "관련 정보" : "Related Info";
		}
		return section?.title || "";
	};

	const getSectionIcon = (type: string | undefined): string => {
		const icons: Record<string, string> = {
			summary: "🔎",
			overview: "🔎",
			profile: "👤",
			updates: "⚡",
			news: "📰",
			collab: "🤝",
			release: "📅",
			video: "▶️",
			blog: "✍️",
			community: "▶️",
			chains: "🏬",
			brand_info: "🏷️",
			local_spots: "📍",
			comparison: "⚖️",
			deals: "🏷️",
			gear: "📷",
			products: "✨",
			nutrition: "🥗",
			recipe: "🍳",
			tips: "💡",
			model_tips: "🎛️",
			reviews: "🧪",
			guide: "🧭",
			related: "➕",
		};
		return (type !== undefined ? icons[type] : undefined) || "•";
	};

	const shorten = (text: unknown, max = 72) => {
		const value = String(text || "").trim();
		if (value.length <= max) return value;
		return `${value.slice(0, max).trim()}...`;
	};

	const renderCategoryMenu = () => {
		if (
			!categoryMenuOpen ||
			!data ||
			!categoryMenuPosition ||
			typeof document === "undefined"
		) {
			return null;
		}

		return createPortal(
			<div
				ref={categoryMenuRef}
				style={categoryMenuPosition}
				className={`fixed z-[10000] overflow-y-auto rounded-xl border shadow-2xl ${
					isDark
						? "border-white/15 bg-slate-900 text-white"
						: "border-gray-200 bg-white text-slate-800"
				}`}
			>
				{categoryOptions.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => {
							setCategoryMenuOpen(false);
							setSmartWidgetCategory(keyword, option.value);
						}}
						disabled={isRefreshing || option.value === data.category}
						className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
							option.value === data.category
								? isDark
									? "bg-white/15"
									: "bg-blue-50 text-blue-700"
								: hoverCls
						}`}
					>
						<span>{option.emoji}</span>
						<span>{option.label}</span>
					</button>
				))}
			</div>,
			document.body,
		);
	};

	const renderKeywordTitle = () =>
		editingKeyword ? (
			<form
				className="flex items-center gap-1"
				onSubmit={(e) => {
					e.preventDefault();
					submitKeywordEdit();
				}}
			>
				<input
					value={keywordDraft}
					onChange={(e) => setKeywordDraft(e.target.value)}
					placeholder={editPlaceholder}
					autoFocus
					className={`w-28 rounded-lg border px-2 py-1 text-xs outline-none ${
						isDark
							? "bg-white/10 border-white/15 text-white"
							: "bg-white border-gray-200 text-slate-800"
					}`}
				/>
				<button
					type="submit"
					className={`p-1 rounded-lg ${hoverCls}`}
					title={isKo ? "저장" : "Save"}
				>
					<Check size={12} className={muted} />
				</button>
			</form>
		) : (
			<div className="flex items-center gap-1 min-w-0">
				{data && (
					<>
						<button
							ref={categoryButtonRef}
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setCategoryMenuOpen((open) => {
									const next = !open;
									if (next) requestAnimationFrame(updateCategoryMenuPosition);
									return next;
								});
							}}
							aria-expanded={categoryMenuOpen}
							className={`-ml-1 h-6 w-8 rounded-lg border flex items-center justify-center gap-0.5 shrink-0 transition-colors ${
								isDark
									? "border-white/15 bg-white/10"
									: "border-slate-200 bg-white shadow-sm"
							} ${hoverCls}`}
							title={isKo ? "카테고리 변경" : "Change category"}
						>
							<span aria-hidden="true" className="text-[14px] leading-none">
								{data.emoji || "🔍"}
							</span>
							<span
								aria-hidden="true"
								className={`text-[8px] leading-none ${isDark ? "text-slate-200" : "text-slate-500"}`}
							>
								▾
							</span>
						</button>
						{renderCategoryMenu()}
					</>
				)}
				<h3 className={`font-semibold text-sm truncate ${data ? "ml-1" : ""}`}>
					{keyword}
				</h3>
				<button
					onClick={() => setEditingKeyword(true)}
					className={`p-1 rounded-lg ${hoverCls}`}
					title={isKo ? "키워드 수정" : "Edit keyword"}
				>
					<Pencil size={11} className={muted} />
				</button>
			</div>
		);

	const renderLanguageHint = () =>
		languageMismatch ? (
			<div
				className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
					isDark
						? "border-amber-300/20 bg-amber-300/10 text-amber-100"
						: "border-amber-200 bg-amber-50 text-amber-800"
				}`}
			>
				{languageHint}
			</div>
		) : null;

	if (!data) {
		return (
			<div
				className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl overflow-hidden ${cardCls} h-full`}
			>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<DragHandle />
						<Search
							size={16}
							className={`${isDark ? "text-blue-300" : "text-blue-600"} -ml-1.5`}
						/>
						{renderKeywordTitle()}
					</div>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${hoverCls}`}
					>
						<X size={14} />
					</button>
				</div>
				{renderLanguageHint()}
				<div
					className={`text-center py-8 rounded-xl flex flex-col items-center justify-center ${secondaryBgCls}`}
				>
					<div className="text-3xl mb-3 animate-pulse">🔍</div>
					<p className={`font-medium mb-1 ${muted}`} style={bodyStyle}>{loadingMsg}</p>
					{error && <p className="text-red-400 mt-2" style={bodyStyle}>{error}</p>}
				</div>
			</div>
		);
	}

	const sections = Array.isArray(data.sections) ? data.sections : [];
	const hasVisibleSections = sections.some((section) => {
		const bullets = Array.isArray(section.bullets) ? section.bullets : [];
		const items = Array.isArray(section.items) ? section.items : [];
		const tags = Array.isArray(section.tags) ? section.tags : [];
		return (section.type === "summary" && bullets.length > 0) ||
			items.length > 0 ||
			tags.length > 0;
	});
	const renderSection = (section: import("../../types").SmartSection, i: number) => {
		const bullets: string[] = Array.isArray(section.bullets) ? section.bullets : [];
		type SectionItem = { url?: string; title?: string; source?: string; image?: string };
		const items: SectionItem[] = Array.isArray(section.items) ? (section.items as SectionItem[]) : [];
		const tags: string[] = Array.isArray(section.tags) ? section.tags : [];
		const sectionKey = `${section.type ?? "section"}_${i}`;
		const isSummarySection = section.type === "summary";
		if (isSummarySection && bullets.length === 0) {
			return null;
		}
		if (!isSummarySection && items.length === 0 && tags.length === 0) {
			return null;
		}

		return (
			<div key={sectionKey} className="mb-3 last:mb-0">
				<p
					className={`font-bold uppercase tracking-wider mb-2 ${muted}`}
					style={titleStyle}
				>
					<span className="mr-1">{getSectionIcon(section.type)}</span>
					{getLocalizedSectionTitle(section)}
				</p>
				{isSummarySection && (
					<div className={`rounded-xl px-3 py-2.5 ${secondaryBgCls} space-y-1.5`}>
						{bullets.map((bullet, j) => (
							<p
								key={j}
								className="leading-relaxed flex gap-1.5"
								style={bodyStyle}
							>
								<span className={`${muted} shrink-0`}>•</span>
								<span>{bullet}</span>
							</p>
						))}
					</div>
				)}
				{tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5 mt-2">
						{tags.map((tag) => (
							<span
								key={tag}
								className={`px-2 py-1 rounded-full text-[11px] ${secondaryBgCls}`}
							>
								{tag}
							</span>
						))}
					</div>
				)}

				{items.length > 0 && (
					<div className={`${tags.length > 0 ? "mt-2" : ""} grid gap-1.5`}>
						{items.map((item, j) => (
							<div
								key={`${item.url || item.title || j}_${j}`}
								className={`p-2 rounded-xl transition-colors flex gap-2 ${
									item.url
										? `cursor-pointer ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"}`
										: "cursor-default"
								}`}
								onClick={() =>
									item.url &&
									window.open(item.url, "_blank", "noopener,noreferrer")
								}
							>
								{item.image && (
									<img
										src={item.image}
										alt=""
										loading="lazy"
										className="w-12 h-12 rounded-lg object-cover shrink-0"
										referrerPolicy="no-referrer"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
								)}
								<div className="min-w-0 flex-1">
									<p style={bodyStyle}>{shorten(item.title)}</p>
									{item.source && (
										<p className={muted} style={bodyStyle}>
											{item.source}
										</p>
									)}
								</div>
								{item.url && (
									<p className={`text-[11px] shrink-0 self-center ${muted}`}>
										{isKo ? "열기" : "Open"}
									</p>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl overflow-hidden ${cardCls} h-full flex flex-col`}
		>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<DragHandle />
					<Search
						size={16}
						className={`${isDark ? "text-blue-300" : "text-blue-600"} -ml-1.5`}
					/>
					<div>
						{renderKeywordTitle()}
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<span className={`text-[10px] ${muted}`}>{updatedLabel}</span>
					<button
						onClick={() => refreshSmartWidget(keyword)}
						className={`p-1 rounded-lg transition-all ${hoverCls} ${isRefreshing ? "animate-spin" : ""}`}
						title={isKo ? "새로고침" : "Refresh"}
					>
						<RefreshCw size={12} className={muted} />
					</button>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`p-1 rounded-lg ${hoverCls} ${muted} hover:opacity-100`}
						title={isKo ? "위젯 삭제" : "Remove widget"}
					>
						<X size={14} />
					</button>
				</div>
			</div>
			{renderLanguageHint()}
			<div className="flex-1 min-h-0 overflow-y-auto pr-1">
				{isRefreshing ? (
					<div className={`text-center py-6 rounded-xl ${secondaryBgCls}`}>
						<RefreshCw
							size={24}
							className="animate-spin mx-auto mb-2 text-blue-400"
						/>
						<p className={`text-xs ${muted}`}>
							{isKo ? "데이터 갱신 중..." : "Updating..."}
						</p>
					</div>
				) : (
					<>
						{hasVisibleSections ? (
							sections.map(renderSection)
						) : (
							<div className={`text-center py-6 rounded-xl ${secondaryBgCls}`}>
								<p className={`text-xs ${muted}`}>
									{isKo
										? "표시할 스마트 위젯 데이터가 아직 없어요. 새로고침해보세요."
										: "No smart widget data to show yet. Try refreshing."}
								</p>
							</div>
						)}
						{error && (
							<p className="text-center mt-2 text-red-400" style={bodyStyle}>
								{error}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default SmartWidgetContent;
