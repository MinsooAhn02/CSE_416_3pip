import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useBriefingContext } from "../../hooks/useBriefingContext";
import { generateDetailedBriefing, getTimeGreeting } from "../../services/aiService";
import { BriefingResult } from "../../types";
import BriefingSectionsView from "../widgets/BriefingSectionsView";

/**
 * First-Login Daily Briefing Modal (REQ-WS-006)
 *
 * Auto-popup behavior:
 * - Triggers on first tab open after 00:00 each day
 * - Respects showFirstLoginBriefing toggle in Settings
 * - Tracked via lastBriefingShown timestamp (idempotency)
 */
const FirstLoginBriefingModal = () => {
	const { i18n } = useTranslation();
	const { isDark, cardCls, muted } = useTheme();
	const showFirstLoginModal = useSettingsStore((s) => s.showFirstLoginModal);
	const dismissFirstLoginModal = useSettingsStore(
		(s) => s.dismissFirstLoginModal,
	);
	const BRIEFING_LENGTH = "medium";

	const {
		tone,
		fetchTodayQA,
		buildContext,
		weather,
		calEvents,
		stocks,
		trends,
		activeWidgetIds,
	} = useBriefingContext();

	// State
	const [briefing, setBriefing] = useState<BriefingResult | null>(null);
	const lastGeneratedRef = useRef<Date | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [dismissCountdown, setDismissCountdown] = useState(10); // 10-second block (REQ-AJ-004)
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = isKo
		? {
				close: "닫기",
				title: "오늘의 AI 브리핑",
				subtitle: "좋은 아침 브리핑",
				refresh: "브리핑 새로고침",
				loading: "브리핑을 불러오는 중입니다...",
				countdown: (seconds: number) => `${seconds}초 후 시작하기`,
				start: "오늘 하루 시작하기",
			}
		: {
				close: "Close",
				title: "Today's AI Briefing",
				subtitle: "Good Morning Briefing",
				refresh: "Refresh briefing",
				loading: "Loading your briefing...",
				countdown: (seconds: number) => `Start in ${seconds}s`,
				start: "Start the day",
			};

	// Time-based greeting
	const greeting = useMemo(() => getTimeGreeting(), []);

	// Load today's Q&A on mount so briefing has access to it
	useEffect(() => {
		fetchTodayQA();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Generate briefing when modal opens
	useEffect(() => {
		if (!showFirstLoginModal) return;

		const generateBriefing = async () => {
			setIsLoading(true);
			try {
				const result = await generateDetailedBriefing({
					context: buildContext(),
					tone,
					length: BRIEFING_LENGTH,
				});
				if (result) {
					setBriefing(result);
					lastGeneratedRef.current = new Date();
				}
			} catch (e: unknown) {
				console.warn("First-login briefing generation failed:", (e as Error)?.message);
			} finally {
				setIsLoading(false);
			}
		};

		generateBriefing();
	}, [showFirstLoginModal, weather, calEvents, stocks, trends, activeWidgetIds, tone]); // eslint-disable-line react-hooks/exhaustive-deps

	// Countdown timer for dismiss button (REQ-AJ-004: block dismissal for 10 seconds)
	useEffect(() => {
		if (!showFirstLoginModal || dismissCountdown <= 0) return;

		const timer = setInterval(() => {
			setDismissCountdown((prev) => Math.max(0, prev - 1));
		}, 1000);

		return () => clearInterval(timer);
	}, [showFirstLoginModal, dismissCountdown]);

	// Reset countdown when modal reopens
	useEffect(() => {
		if (showFirstLoginModal) {
			setDismissCountdown(10);
		}
	}, [showFirstLoginModal]);

	// Lock body scroll when modal is open
	useEffect(() => {
		if (showFirstLoginModal) {
			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = "";
			document.body.style.paddingRight = "";
		};
	}, [showFirstLoginModal]);

	const handleDismiss = () => {
		if (dismissCountdown > 0) return;
		dismissFirstLoginModal();
	};

	const handleRefresh = async () => {
		setIsLoading(true);
		try {
			const result = await generateDetailedBriefing({
				context: buildContext(),
				tone,
				length: BRIEFING_LENGTH,
			});
			if (result) {
				setBriefing(result);
				lastGeneratedRef.current = new Date();
			}
		} catch (e: unknown) {
			console.warn("Briefing refresh failed:", (e as Error)?.message);
		} finally {
			setIsLoading(false);
		}
	};

	const displayBriefing = useMemo(() => {
		if (briefing) {
			return {
				summary: briefing.summary || copy.title,
				detail: briefing.detail || "",
				sections: Array.isArray(briefing.sections) ? briefing.sections : [],
			};
		}
		return { summary: "", detail: "", sections: [] };
	}, [briefing, copy.title]);

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

	if (!showFirstLoginModal) return null;

	return (
		<AnimatePresence>
			{/* PHASE 10: Centered briefing overlay with flex centering */}
			<motion.div
				className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center"
				onClick={dismissCountdown <= 0 ? handleDismiss : undefined}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.3 }}
			>
				{/* Modal Content - Fixed height with internal scrolling */}
				<motion.div
					className={`relative z-[71] w-full max-w-2xl h-[600px] max-h-[80vh] rounded-3xl border-2 shadow-2xl flex flex-col overflow-hidden ${
						isDark
							? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
							: "bg-morning-light-card border-morning-light-hover/50 text-morning-light-text"
					}`}
					initial={{ opacity: 0, scale: 0.8, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.8, y: 20 }}
					transition={{ type: "spring", damping: 25, stiffness: 300 }}
					onClick={(e) => e.stopPropagation()}
				>
					{/* PHASE 21: Close button - BYPASSES countdown, closes immediately */}
					<button
						onClick={() => dismissFirstLoginModal()}
						className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full z-10 hover:bg-gray-200/10 dark:hover:bg-gray-700/10"
						title={copy.close}
					>
						<X size={20} />
					</button>

					{/* Header */}
					<div
						className={`flex items-center justify-between p-6 border-b ${
							isDark
								? "border-morning-dark-hover"
								: "border-morning-light-hover/30"
						}`}
					>
						<div className="flex items-center gap-3">
							<div
								className={`p-2 rounded-xl ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}
							>
								<Sparkles size={24} className="text-blue-500" />
							</div>
							<div>
								<h2 className="font-bold text-lg">{copy.title}</h2>
								<p className={`text-xs ${muted}`}>{copy.subtitle}</p>
							</div>
						</div>
						{/* PHASE 23: Repositioned Refresh button to avoid overlap with X close button */}
						<button
							onClick={handleRefresh}
							disabled={isLoading}
							className={`absolute top-4 right-14 p-2 rounded-full transition-colors ${
								isDark
									? "hover:bg-morning-dark-hover"
									: "hover:bg-morning-light-hover/20"
							} ${isLoading ? "opacity-50" : ""}`}
							title={copy.refresh}
						>
							<RefreshCw
								size={18}
								className={isLoading ? "animate-spin" : ""}
							/>
						</button>
					</div>

					{/* Greeting Banner */}
					<div
						className={`px-6 py-4 ${
							isDark ? "bg-morning-dark-cardSecondary" : "bg-blue-50/50"
						}`}
					>
						<p
							className={`text-sm leading-relaxed ${isDark ? "text-blue-300" : "text-blue-700"}`}
						>
							{greeting}
						</p>
					</div>

					{/* Briefing Content — shared renderer identical to BriefingWidget detailed modal */}
					<BriefingSectionsView
						displayBriefing={displayBriefing}
						detailLines={detailLines}
						isLoading={isLoading}
						lastGenerated={lastGeneratedRef.current}
					/>

					{/* Footer */}
					<div
						className={`p-4 border-t ${
							isDark
								? "border-morning-dark-hover"
								: "border-morning-light-hover/30"
						}`}
					>
						<button
							onClick={handleDismiss}
							disabled={dismissCountdown > 0}
							className={`w-full py-3 rounded-xl font-medium transition-colors ${
								dismissCountdown > 0
									? "opacity-50 cursor-not-allowed bg-gray-400 text-white"
									: "bg-blue-500 hover:bg-blue-600 text-white"
							}`}
						>
							{dismissCountdown > 0
								? copy.countdown(dismissCountdown)
								: copy.start}
						</button>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
};

export default FirstLoginBriefingModal;
