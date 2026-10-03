import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useFontSize } from "../../hooks/useFontSize";
import { useDataStore } from "../../store/useDataStore";
import { useBriefingHistoryStore } from "../../store/useBriefingHistoryStore";
import { useBriefingContext } from "../../hooks/useBriefingContext";
import { generateDetailedBriefing, getTimeGreeting } from "../../services/aiService";
import BriefingSectionsView, { SkeletonLine } from "./BriefingSectionsView";
import type { BriefingResult, BriefingSection, SmartSectionLineOrString } from "../../types";

// ── Local types ───────────────────────────────────────────────────────────────

type BriefingLength = "short" | "medium" | "long";

type BriefingVersions = Record<BriefingLength, BriefingResult | null>;

interface DisplayBriefing {
	summary: string;
	detail: string;
	sections: BriefingSection[];
}

// ── Component ─────────────────────────────────────────────────────────────────

const BRIEFING_LENGTH: BriefingLength = "medium";

const BriefingWidget = () => {
	const { isDark, cardCls, cardShadowCls, muted } = useTheme();
	const { body: bodyStyle, title: titleStyle } = useFontSize();
	const { body: sectionTitleStyle } = useFontSize(0.75);
	const { body: contentLineStyle } = useFontSize(0.92);
	const { body: footerHintStyle } = useFontSize(0.83);
	const { t, i18n } = useTranslation();

	const {
		tone,
		fetchTodayQA,
		buildContext,
	} = useBriefingContext();
	const initialFetchDone = useDataStore((s) => s.initialFetchDone);

	const addSnapshot = useBriefingHistoryStore((s) => s.addSnapshot);
	const shouldSave = useBriefingHistoryStore((s) => s.shouldSave);

	const [briefingVersions, setBriefingVersions] = useState<BriefingVersions>({
		short: null,
		medium: null,
		long: null,
	});
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

	const detailPreviewContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchTodayQA();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

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

	const generateBriefingVersion = async (
		targetLength: BriefingLength,
		forceRefresh = false,
		snapshotSource: "auto" | "refresh" = "auto",
	) => {
		if (!forceRefresh && briefingVersions[targetLength]) return;
		setIsLoading(true);
		try {
			const context = buildContext();
			const result = await generateDetailedBriefing({
				context: context as Parameters<typeof generateDetailedBriefing>[0]["context"],
				tone,
				length: targetLength,
			});
			setBriefingVersions((prev) => ({
				...prev,
				[targetLength]: result,
			}));
			setLastGenerated(new Date());

			if (result && shouldSave(snapshotSource)) {
				addSnapshot({
					source: snapshotSource,
					text: result.detail ?? "",
					summary: result.summary ?? "",
					sections: result.sections ?? [],
				});
			}
		} catch (e: unknown) {
			console.warn("Briefing generation failed:", (e as Error)?.message);
		} finally {
			setIsLoading(false);
		}
	};

	const hasBriefings =
		briefingVersions.short || briefingVersions.medium || briefingVersions.long;

	const [initialGenDone, setInitialGenDone] = useState<boolean>(false);

	useEffect(() => {
		if (initialGenDone) return;
		if (isLoading) return;
		// 첫 fetchAll이 끝날 때까지 대기 — 일부 데이터만 도착한 시점에 생성하면
		// 날씨/뉴스/트렌드가 "데이터 없음"으로 고정됨 (initialGenDone 가드 때문에 재생성 안 됨)
		if (!initialFetchDone) return;
		setInitialGenDone(true);
		generateBriefingVersion(BRIEFING_LENGTH, true);
		// activeWidgetIds는 의존성에서 제외 — 스마트위젯 추가 시 cascade 재생성 방지
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFetchDone, initialGenDone]);

	useEffect(() => {
		if (!initialGenDone) return;
		const interval = setInterval(() => {
			generateBriefingVersion(BRIEFING_LENGTH, true, "auto");
		}, 3 * 60 * 60 * 1000);
		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialGenDone]);

	useEffect(() => {
		if (!initialGenDone) return;
		if (isLoading) return;
		generateBriefingVersion(BRIEFING_LENGTH, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tone]);

	useEffect(() => {
		if (!initialGenDone) return;
		setBriefingVersions({ short: null, medium: null, long: null });
		generateBriefingVersion(BRIEFING_LENGTH, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [i18n.language]);

	const currentBriefing = briefingVersions[BRIEFING_LENGTH];

	const displayBriefing = useMemo<DisplayBriefing>(() => {
		if (currentBriefing) {
			return {
				summary: currentBriefing.summary || t("briefing.today_briefing"),
				detail: currentBriefing.detail || "",
				sections: Array.isArray(currentBriefing.sections)
					? currentBriefing.sections
					: [],
			};
		}
		return {
			summary: t("briefing.loading_detail"),
			detail: "",
			sections: [],
		};
	}, [currentBriefing, t]);

	const detailLines = (displayBriefing.detail || "")
		.split("\n")
		.map((line) =>
			line
				.trim()
				.replace(/^[*#`]+|[*#`]+$/g, "")
				.trim(),
		)
		.filter(
			(line) =>
				line &&
				!line.startsWith("{") &&
				!line.startsWith("}") &&
				!line.startsWith('"'),
		);

	const greeting = useMemo(() => getTimeGreeting(), [i18n.language]);

	const handleRefresh = (e: React.MouseEvent) => {
		e.stopPropagation();
		generateBriefingVersion(BRIEFING_LENGTH, true, "refresh");
	};

	const handleWidgetClick = () => {
		if (!isLoading) {
			setIsExpanded(true);
		}
	};

	const handleClose = () => {
		setIsExpanded(false);
	};

	return (
		<>
			<div
				onClick={handleWidgetClick}
				className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 cursor-pointer hover:shadow-sm flex flex-col overflow-hidden h-full min-h-0 ${cardCls}`}
			>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Sparkles size={18} className="text-blue-500" />
						<h2 className="font-bold" style={titleStyle}>{t("briefing.title")}</h2>
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

				<p className={`uppercase tracking-widest mb-3 ${muted}`} style={bodyStyle}>
					{t("briefing.subtitle")}
				</p>

				<p className="font-medium mb-3" style={titleStyle}>
					{t("briefing.today_briefing")}
				</p>

				<div
					ref={detailPreviewContainerRef}
					className={`flex-1 min-h-0 overflow-hidden divide-y ${isDark ? "divide-morning-dark-hover/40" : "divide-morning-light-hover/30"}`}
				>
					{isLoading && !hasBriefings ? (
						<div className="space-y-2 pt-1">
							<SkeletonLine width="90%" />
							<SkeletonLine width="100%" />
							<SkeletonLine width="85%" />
						</div>
					) : displayBriefing.sections.length > 0 ? (
						displayBriefing.sections.map((section) => (
							<div key={section.id} className="py-1.5 first:pt-0 last:pb-0">
								<p className={`font-bold uppercase tracking-wider mb-0.5 ${isDark ? "text-blue-400/70" : "text-blue-600/70"}`} style={sectionTitleStyle}>
									{section.title}
								</p>
								<p
									className={`leading-snug ${muted} overflow-hidden`}
									style={{
										...contentLineStyle,
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
									}}
								>
									{(Array.isArray(section.subBlocks) && section.subBlocks.length > 0
										? section.subBlocks.flatMap((sb) => sb.lines ?? [])
										: section.lines ?? []
									).map((l: SmartSectionLineOrString) => typeof l === "object" ? `${l.title}${l.source ? ` — ${l.source}` : ""}` : l).join(" · ")}
								</p>
							</div>
						))
					) : detailLines.length > 0 ? (
						<p
							className={`leading-snug ${muted} overflow-hidden pt-1`}
							style={{
								...contentLineStyle,
								display: "-webkit-box",
								WebkitLineClamp: 6,
								WebkitBoxOrient: "vertical",
							}}
						>
							{detailLines.join(" · ")}
						</p>
					) : null}
				</div>

				<p className={`mt-4 ${muted} text-center`} style={footerHintStyle}>
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
								onClick={(e: React.MouseEvent) => e.stopPropagation()}
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

								<BriefingSectionsView
									displayBriefing={displayBriefing}
									detailLines={detailLines}
									isLoading={isLoading}
									lastGenerated={lastGenerated}
								/>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
};

export default memo(BriefingWidget);
