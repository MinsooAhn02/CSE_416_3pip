import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import {
	generateDetailedBriefing,
	getTimeGreeting,
} from "../../services/aiService";
import { buildPersonaContext } from "../../utils/personaContext";

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
	const dismissFirstLoginModal = useSettingsStore((s) => s.dismissFirstLoginModal);
	const tone = useSettingsStore((s) => s.tone);
	const length = useSettingsStore((s) => s.bLen) || "medium";
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || [];

	// Data context
	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const calEvents = useDataStore((s) => s.calEvents);
	const todos = useTodoStore((s) => s.todos);

	// State
	const [briefing, setBriefing] = useState(null);
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
				countdown: (seconds) => `${seconds}초 후 시작하기`,
				start: "오늘 하루 시작하기",
		  }
		: {
				close: "Close",
				title: "Today's AI Briefing",
				subtitle: "Good Morning Briefing",
				refresh: "Refresh briefing",
				loading: "Loading your briefing...",
				countdown: (seconds) => `Start in ${seconds}s`,
				start: "Start the day",
		  };

	// Time-based greeting
	const greeting = useMemo(() => getTimeGreeting(), []);

	// Generate briefing when modal opens
	useEffect(() => {
		if (!showFirstLoginModal) return;

		const generateBriefing = async () => {
			setIsLoading(true);
			try {
				const context = {
					weather,
					stocks,
					trends,
					calEvents,
					todos,
					persona: buildPersonaContext({ includeMemo: false }),
				};
				const result = await generateDetailedBriefing({ 
					context, 
					tone, 
					length,
					priorityOrder,  // REQ-US-006: Pass priority order to AI
				});
				if (result) {
					setBriefing(result);
				}
			} catch (e) {
				console.warn("First-login briefing generation failed:", e?.message);
			} finally {
				setIsLoading(false);
			}
		};

		generateBriefing();
	}, [showFirstLoginModal, weather, stocks, trends, calEvents, todos, tone, length]);

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
			const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
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
			const context = {
				weather,
				stocks,
				trends,
				calEvents,
				todos,
				persona: buildPersonaContext({ includeMemo: false }),
			};
			const result = await generateDetailedBriefing({ 
				context, 
				tone, 
				length,
				priorityOrder,  // REQ-US-006: Pass priority order to AI
			});
			if (result) {
				setBriefing(result);
			}
		} catch (e) {
			console.warn("Briefing refresh failed:", e?.message);
		} finally {
			setIsLoading(false);
		}
	};

	// Parse briefing detail into lines
	const detailLines = (briefing?.detail || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

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
				<div className={`flex items-center justify-between p-6 border-b ${
					isDark ? "border-morning-dark-hover" : "border-morning-light-hover/30"
				}`}>
					<div className="flex items-center gap-3">
						<div className={`p-2 rounded-xl ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}>
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
						isDark ? "hover:bg-morning-dark-hover" : "hover:bg-morning-light-hover/20"
					} ${isLoading ? "opacity-50" : ""}`}
					title={copy.refresh}
				>
					<RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
				</button>
				</div>

				{/* Greeting Banner */}
				<div className={`px-6 py-4 ${
					isDark ? "bg-morning-dark-cardSecondary" : "bg-blue-50/50"
				}`}>
					<p className={`text-sm leading-relaxed ${isDark ? "text-blue-300" : "text-blue-700"}`}>
						{greeting}
					</p>
				</div>

				{/* Briefing Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-4">
					{isLoading ? (
						<div className="space-y-3 animate-pulse">
							{[...Array(8)].map((_, i) => (
								<div
									key={i}
									className={`h-4 rounded ${isDark ? "bg-morning-dark-hover" : "bg-morning-light-hover/30"}`}
									style={{ width: `${75 + Math.random() * 25}%` }}
								/>
							))}
						</div>
					) : detailLines.length > 0 ? (
						<div className="space-y-3">
							{detailLines.map((line, idx) => (
								<p
									key={idx}
									className={`text-sm leading-relaxed ${
										isDark ? "text-morning-dark-muted" : "text-morning-light-muted"
									}`}
								>
									{line}
								</p>
							))}
						</div>
					) : (
						<p className={`text-sm ${muted}`}>
							{copy.loading}
						</p>
					)}

				</div>

				{/* Footer */}
				<div className={`p-4 border-t ${
					isDark ? "border-morning-dark-hover" : "border-morning-light-hover/30"
				}`}>
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
