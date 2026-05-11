import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { mergeInterestLists } from "../../utils/interests";
import {
	generateDetailedBriefing,
	generateDiary,
	getTimeGreeting,
} from "../../services/aiService";
import { resolveDiaryGenerationLanguage } from "../../services/diaryGenerationService";

/** 스켈레톤 라인 컴포넌트 */
const SkeletonLine = ({ width = "100%" }) => (
	<div
		className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
		style={{ width }}
	/>
);

/** 스켈레톤 UI - 상세 브리핑 로딩 시 표시 */
const BriefingSkeleton = () => (
	<motion.div
		className="space-y-3"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<SkeletonLine width="90%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="85%" />
		<div className="h-2" />
		<SkeletonLine width="95%" />
		<SkeletonLine width="80%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="70%" />
		<div className="h-2" />
		<SkeletonLine width="88%" />
		<SkeletonLine width="92%" />
		<SkeletonLine width="75%" />
	</motion.div>
);

const BriefingWidget = () => {
	const { isDark, cardCls, cardShadowCls, muted } = useTheme();
	const { t, i18n } = useTranslation();
	const BRIEFING_LENGTH = "medium";
	const tone = useSettingsStore((s) => s.tone);
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || [];
	const fixedInterestIds = useSettingsStore((s) => s.fixedInterestIds) || [];
	const keywordInterests = useSettingsStore((s) => s.keywordInterests) || [];
	const persona = useAuthStore((s) => s.persona);

	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const calEvents = useDataStore((s) => s.calEvents);
	const newsResults = useDataStore((s) => s.newsResults);
	const newsAnswer = useDataStore((s) => s.newsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const healthData = useDataStore((s) => s.healthData);
	// activeWidgetIds는 useDataStore에서 세팅됨 (fetchAll → set activeWidgetIds)
	const activeWidgetIds = useDataStore((s) => s.activeWidgetIds) || [];
	const todos = useTodoStore((s) => s.todos);

	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const smartWidgetData = useWidgetStore((s) => s.smartWidgetData);

	const todayQA = useDiaryStore((s) => s.todayQA);
	const fetchTodayQA = useDiaryStore((s) => s.fetchTodayQA);
	const diaryEntries = useDiaryStore((s) => s.entries);
	const saveDiary = useDiaryStore((s) => s.saveDiary);

	const yesterdayDateStr = useMemo(() => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return yesterday.toISOString().slice(0, 10);
	}, []);

	const yesterdayEntry = diaryEntries?.[yesterdayDateStr] || null;
	const yesterdayMemo = yesterdayEntry?.memo || "";
	const yesterdayDiary = yesterdayEntry?.diary || "";
	const effectiveInterests = useMemo(
		() => mergeInterestLists(fixedInterestIds, keywordInterests),
		[fixedInterestIds, keywordInterests],
	);

	// Store briefings for all lengths: { short: {...}, medium: {...}, long: {...} }
	const [briefingVersions, setBriefingVersions] = useState({
		short: null,
		medium: null,
		long: null,
	});
	const [isLoading, setIsLoading] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [lastGenerated, setLastGenerated] = useState(null);
	const autoDiaryStatusRef = useRef({ date: null, generated: false, attempted: false });
	const detailPreviewContainerRef = useRef(null);
	const detailPreviewRef = useRef(null);
	const [dashboardDetailPreview, setDashboardDetailPreview] = useState("");

	// 마운트 시 오늘의 Q&A 답변 로드
	useEffect(() => { fetchTodayQA(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (isExpanded) {
			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = "";
			document.body.style.paddingRight = "";
		};
	}, [isExpanded]);

	// 스마트 위젯 요약 빌더 (상위 3개 키워드, 각 3개 bullet)
	const buildSmartSummaries = (keywords, data) =>
		(keywords ?? [])
			.filter((kw) => data?.[kw])
			.slice(0, 3)
			.map((kw) => ({
				keyword: kw,
				bullets: data[kw]?.sections
					?.flatMap((s) => s.bullets ?? [])
					.slice(0, 3) ?? [],
			}));

	const ensureYesterdayDiaryForMorning = async () => {
		const isMorning = new Date().getHours() < 12;
		if (!isMorning || yesterdayDiary) {
			return { diaryText: yesterdayDiary || "", autoGenerated: false };
		}

		const status = autoDiaryStatusRef.current;
		if (status.date === yesterdayDateStr && status.attempted) {
			return { diaryText: yesterdayDiary || "", autoGenerated: status.generated };
		}

		autoDiaryStatusRef.current = {
			date: yesterdayDateStr,
			attempted: true,
			generated: false,
		};

		try {
			const generatedDiary = await generateDiary({
				weather,
				stocks,
				trends,
				calEvents,
				date: yesterdayDateStr,
				wasActiveDay: false,
				language: resolveDiaryGenerationLanguage(),
				interests: effectiveInterests,
			});
			const normalized = String(generatedDiary || "").trim();
			if (normalized) {
				await saveDiary(yesterdayDateStr, normalized);
				autoDiaryStatusRef.current.generated = true;
				return { diaryText: normalized, autoGenerated: true };
			}
		} catch (e) {
			console.warn("Auto diary synthesis for briefing failed:", e?.message);
		}

		return { diaryText: yesterdayDiary || "", autoGenerated: false };
	};

	const generateBriefingVersion = async (targetLength, forceRefresh = false) => {
		if (!forceRefresh && briefingVersions[targetLength]) return;
		setIsLoading(true);
		try {
			const { diaryText, autoGenerated } = await ensureYesterdayDiaryForMorning();
			const context = {
				weather,
				stocks,
				trends,
				calEvents,
				todos,
				activeWidgetIds,
				yesterdayMemo,
				keywordInterests: effectiveInterests,
				persona,
				newsResults: (newsResults ?? []).slice(0, 5),
				newsAnswer: newsAnswer ?? "",
				trendsResults: (trendsResults ?? []).slice(0, 5),
				trendsAnswer: trendsAnswer ?? "",
				todayQA: todayQA ?? [],
				smartSummaries: buildSmartSummaries(smartKeywords, smartWidgetData),
				healthData: healthData ?? null,
				yesterdayDiary: diaryText || yesterdayDiary,
				yesterdayDiaryAutoGenerated: autoGenerated,
			};
			const result = await generateDetailedBriefing({
				context,
				tone,
				length: targetLength,
				priorityOrder,
			});
			setBriefingVersions((prev) => ({
				...prev,
				[targetLength]: result,
			}));
			setLastGenerated(new Date());
		} catch (e) {
			console.warn("Briefing generation failed:", e?.message);
		} finally {
			setIsLoading(false);
		}
	};

	// Check if any briefing version exists
	const hasBriefings =
		briefingVersions.short || briefingVersions.medium || briefingVersions.long;

	// 초기 1회 생성 플래그 — 위젯 데이터가 최소 한 종류 로드된 뒤 브리핑을 만들기 위해
	const initialGenDoneRef = useRef(false);

	// 데이터가 준비되면 초기 브리핑을 1회 생성
	useEffect(() => {
		if (initialGenDoneRef.current) return;
		if (isLoading) return;
		const dataReady =
			!!weather ||
			(Array.isArray(calEvents) && calEvents.length > 0) ||
			(Array.isArray(stocks) && stocks.length > 0) ||
			(Array.isArray(trends) && trends.length > 0) ||
			activeWidgetIds.length > 0;
		if (!dataReady) return;
		initialGenDoneRef.current = true;
		generateBriefingVersion(BRIEFING_LENGTH, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [weather, calEvents, stocks, trends, activeWidgetIds]);

	// 톤이 변경되면 즉시 재생성 (초기 생성이 끝난 뒤에만)
	useEffect(() => {
		if (!initialGenDoneRef.current) return;
		if (isLoading) return;
		generateBriefingVersion(BRIEFING_LENGTH, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tone]);

	// Get the current briefing based on selected length
	const currentBriefing = briefingVersions[BRIEFING_LENGTH];

	const displayBriefing = useMemo(() => {
		if (currentBriefing) {
			return {
				summary: currentBriefing.summary || t("briefing.today_briefing"),
				detail: currentBriefing.detail || "",
			};
		}
		return {
			summary: t("briefing.loading_detail"),
			detail: "",
		};
	}, [currentBriefing, t]);

	const detailLines = (displayBriefing.detail || "")
		.split("\n")
		.map((line) => line.trim().replace(/^[*#`]+|[*#`]+$/g, "").trim())
		.filter((line) => line && !line.startsWith("{") && !line.startsWith("}") && !line.startsWith('"'));
	const dashboardDetailText = useMemo(() => {
		const detailText = detailLines.join(" ").trim();
		const fallback = displayBriefing.summary || t("briefing.loading_detail");
		return (detailText || fallback).replace(/\s+/g, " ").trim();
	}, [detailLines, displayBriefing.summary, t]);

	const greeting = useMemo(() => getTimeGreeting(), [i18n.language]);

	const handleRefresh = (e) => {
		e.stopPropagation();
		generateBriefingVersion(BRIEFING_LENGTH, true);
	};

	const handleWidgetClick = () => {
		if (!isLoading) {
			setIsExpanded(true);
		}
	};

	const handleClose = () => {
		setIsExpanded(false);
	};

	const fitDashboardDetailPreview = useCallback(() => {
		const el = detailPreviewRef.current;
		const containerEl = detailPreviewContainerRef.current;
		if (!el || !containerEl) return;

		const fullText = dashboardDetailText;
		if (!fullText) {
			setDashboardDetailPreview((prev) => (prev === "" ? prev : ""));
			return;
		}

		const availableHeight = containerEl.clientHeight;
		if (availableHeight <= 0) return;
		el.style.height = `${availableHeight}px`;
		el.style.maxHeight = `${availableHeight}px`;

		el.textContent = fullText;
		if (el.scrollHeight <= el.clientHeight) {
			setDashboardDetailPreview((prev) => (prev === fullText ? prev : fullText));
			return;
		}

		let low = 0;
		let high = fullText.length;
		let bestFit = "...";

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			const candidate = `${fullText.slice(0, mid).trimEnd()}...`;
			el.textContent = candidate;
			if (el.scrollHeight <= el.clientHeight) {
				bestFit = candidate;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		setDashboardDetailPreview((prev) => (prev === bestFit ? prev : bestFit));
	}, [dashboardDetailText]);

	useEffect(() => {
		fitDashboardDetailPreview();
	}, [fitDashboardDetailPreview]);

	useEffect(() => {
		const containerEl = detailPreviewContainerRef.current;
		if (!containerEl || typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(() => fitDashboardDetailPreview());
		observer.observe(containerEl);
		return () => observer.disconnect();
	}, [fitDashboardDetailPreview]);

	return (
		<>
			<div
				onClick={handleWidgetClick}
				className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 cursor-pointer hover:shadow-sm flex flex-col overflow-hidden h-full min-h-0 ${cardCls}`}
			>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Sparkles size={18} className="text-blue-500" />
						<h2 className="font-bold text-sm">{t("briefing.title")}</h2>
					</div>
					<div className="flex items-center gap-1">
						<button
							onClick={handleRefresh}
							disabled={isLoading}
							className={`p-1.5 rounded-full transition-colors ${
								isDark
									? "hover:bg-morning-dark-hover"
									: "hover:bg-morning-light-hover/30"
							} ${isLoading ? "opacity-50" : ""}`}
							title={t("briefing.refresh")}
						>
							<RefreshCw
								size={14}
								className={isLoading ? "animate-spin" : ""}
							/>
						</button>
					</div>
				</div>

				<p className={`text-xs uppercase tracking-widest mb-3 ${muted}`}>
					{t("briefing.subtitle")}
				</p>

				<p className="text-sm font-medium mb-3">
					{t("briefing.today_briefing")}
				</p>

				<div ref={detailPreviewContainerRef} className="space-y-2 flex-1 min-h-0 pr-1">
					{isLoading && !hasBriefings ? (
						<div className="space-y-2">
							<SkeletonLine width="90%" />
							<SkeletonLine width="100%" />
							<SkeletonLine width="85%" />
						</div>
					) : (
						<p
							ref={detailPreviewRef}
							className={`text-xs leading-relaxed ${muted} h-full overflow-hidden break-words`}
						>
							{dashboardDetailPreview}
						</p>
					)}
				</div>

				<p className={`mt-4 text-[10px] ${muted} text-center`}>
					{t("briefing.click_for_detail")}
				</p>
			</div>

			{createPortal(
				<AnimatePresence>
					{isExpanded && (
						<>
							<motion.div
								className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
								onClick={handleClose}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>

							<motion.div
								className={`fixed top-1/2 left-1/2 z-[10000] w-full max-w-2xl max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
									isDark
										? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
										: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text"
								}`}
								style={{ x: "-50%", y: "-50%" }}
								initial={{ opacity: 0, scale: 0.5 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.5 }}
								transition={{ type: "spring", damping: 25, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div
									className={`flex items-center justify-between p-5 border-b ${
										isDark
											? "border-morning-dark-hover"
											: "border-morning-light-hover/30"
									}`}
								>
									<div className="flex items-center gap-3">
										<Sparkles size={22} className="text-blue-500" />
										<h3 className="font-bold text-base">
											{t("briefing.detailed_briefing")}
										</h3>
									</div>
									<div className="flex items-center gap-2">
										<button
											onClick={handleRefresh}
											disabled={isLoading}
											className={`p-2 rounded-full transition-colors ${
												isDark
													? "hover:bg-morning-dark-hover"
													: "hover:bg-morning-light-hover/30"
											} ${isLoading ? "opacity-50" : ""}`}
											title={t("briefing.refresh")}
										>
											<RefreshCw
												size={16}
												className={isLoading ? "animate-spin" : ""}
											/>
										</button>
										<button
											onClick={handleClose}
											className={`p-2 rounded-full transition-colors ${
												isDark
													? "hover:bg-morning-dark-hover"
													: "hover:bg-morning-light-hover/30"
											}`}
										>
											<X size={18} />
										</button>
									</div>
								</div>

								<div
									className={`px-5 py-4 border-b ${
										isDark
											? "border-morning-dark-hover bg-morning-dark-cardSecondary"
											: "border-morning-light-hover/30 bg-blue-50/30"
									}`}
								>
									<p
										className={`text-sm leading-relaxed ${
											isDark ? "text-blue-300" : "text-blue-700"
										}`}
									>
										{greeting}
									</p>
								</div>

								<div className="flex-1 overflow-y-auto p-5 space-y-4">
									<AnimatePresence mode="wait">
										{isLoading ? (
											<BriefingSkeleton key="skeleton" />
										) : (
											<motion.div
												key="content"
												className="space-y-3"
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												transition={{ duration: 0.3 }}
											>
												{detailLines.length > 0 ? (
													detailLines.map((line, idx) => (
														<p
															key={idx}
															className={`text-sm leading-relaxed ${muted}`}
														>
															{line}
														</p>
													))
												) : (
													<p className={`text-sm ${muted}`}>
														{t("briefing.loading_detail")}
													</p>
												)}
											</motion.div>
										)}
									</AnimatePresence>

									{lastGenerated && (
										<p className={`text-[10px] ${muted} text-right`}>
											{t("briefing.last_updated")}:{" "}
											{lastGenerated.toLocaleTimeString(
												i18n.language === "ko" ? "ko-KR" : "en-US",
												{
													hour: "2-digit",
													minute: "2-digit",
												},
											)}
										</p>
									)}
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

export default BriefingWidget;
