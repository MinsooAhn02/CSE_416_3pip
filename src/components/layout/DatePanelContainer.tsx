import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useDataStore } from "../../store/useDataStore";
import { useGoogleCalendarStore } from "../../store/useGoogleCalendarStore";
import EventPanel from "./EventPanel";
import TaskPanel from "./TaskPanel";
import DiaryPanel from "./DiaryPanel";

/**
 * DatePanelContainer — Display Event, Task, and Diary panels for selected date
 *
 * BUG FIX #1: Global Window Scrolling & Layout Clipping
 * - Removed max-h and overflow-y-auto constraints
 * - Changed to h-auto to allow natural content expansion
 * - Let browser window handle scrolling instead of internal container scroll
 * - All content visible without clipping
 *
 * REFINEMENT #2: Conditional Diary Panel (2-col vs 3-col layout)
 * - If no diary entry exists for the selected date, Diary panel is removed
 * - Layout automatically switches to 2-column grid (50/50 split) for Events and Tasks
 * - If diary exists, remains a 3-column grid
 *
 * @param {{ selectedDate: string | null, onClose: () => void }} props
 */
const DatePanelContainer = ({ selectedDate, onClose }: { selectedDate: string | null; onClose: () => void }) => {
	const { t, i18n } = useTranslation();
	const { isDark, cardSecondaryCls, hoverCls, borderCls, secondaryBgCls } =
		useTheme();
	const getDiary = useDiaryStore((s) => s.getDiary);
	const [showDiaryModal, setShowDiaryModal] = useState(false);
	const [activePanel, setActivePanel] = useState("events");
	const calEnabled = useOnboardingStore((s) => s.perms.cal);
	const savePerm = useOnboardingStore((s) => s.savePerm);
	const fetchCalendar = useDataStore((s) => s.fetchCalendar);
	const fetchTomorrowCalendar = useDataStore((s) => s.fetchTomorrowCalendar);

	const handleEnableCal = async () => {
		await savePerm("cal", true);
		// EventPanel은 자체 fetch 없이 useGoogleCalendarStore 읽기만 함 → 직접 트리거
		useGoogleCalendarStore
			.getState()
			.fetchEventsAndTasks?.({ date: selectedDate ?? undefined, force: true })
			.catch(() => {});
		fetchCalendar(undefined, true);
		fetchTomorrowCalendar(undefined, true);
	};

	if (!selectedDate) return null;

	const hasDiary = !!getDiary(selectedDate)?.diary?.trim();

	/* Format date for display */
	const formatDate = (dateStr: string) => {
		const d = new Date(dateStr + "T00:00:00");
		return d.toLocaleDateString(i18n.language === "ko" ? "ko-KR" : "en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		});
	};

	const isFutureDate = (() => {
		const selected = new Date(selectedDate + "T00:00:00");
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return selected > today;
	})();

	useEffect(() => {
		if (isFutureDate && showDiaryModal) {
			setShowDiaryModal(false);
		}
	}, [isFutureDate, showDiaryModal]);

	return (
		<div
			className={`mt-3 p-4 pb-6 rounded-xl border h-auto w-full shadow-sm ${cardSecondaryCls}`}
		>
			{/* Header with Date and Close Button */}
			<div className="flex items-center justify-between mb-3">
				<div>
					<h2 className="font-bold text-base">{t("calendar.date_details")}</h2>
					<p
						className={`mt-0.5 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
					>
						{formatDate(selectedDate)}
					</p>
				</div>
				<div className="flex items-center gap-1">
					{!isFutureDate && (
						<button
							type="button"
							onClick={() => setShowDiaryModal(true)}
							className={`p-2 rounded-lg transition-colors ${hoverCls}`}
							title={t("calendar.open_diary_for_date")}
						>
							<BookOpen
								size={20}
								className={
									hasDiary
										? "text-blue-500"
										: isDark
											? "text-gray-500"
											: "text-gray-400"
								}
							/>
						</button>
					)}
					<button
						onClick={onClose}
						className={`p-2 rounded-lg transition-colors ${hoverCls}`}
					>
						<X size={20} />
					</button>
				</div>
			</div>

			<div className="relative">
				<div className={!calEnabled ? "blur-sm pointer-events-none select-none opacity-60" : ""}>
					<div
						className={`mb-3 inline-flex rounded-xl border p-1 ${
							isDark ? "bg-morning-dark-card border-morning-dark-hover" : "bg-white/70"
						} ${borderCls}`}
					>
						<button
							type="button"
							onClick={() => setActivePanel("events")}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								activePanel === "events"
									? "bg-orange-500 text-white"
									: `${secondaryBgCls} ${hoverCls}`
							}`}
						>
							{t("events.title")}
						</button>
						<button
							type="button"
							onClick={() => setActivePanel("tasks")}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								activePanel === "tasks"
									? "bg-green-500 text-white"
									: `${secondaryBgCls} ${hoverCls}`
							}`}
						>
							{t("tasks.title")}
						</button>
					</div>

					<div className="w-full max-w-none space-y-3">
						<div className="w-full max-w-none">
							{activePanel === "events" ? (
							<EventPanel selectedDate={selectedDate} onClose={onClose} />
							) : (
							<TaskPanel selectedDate={selectedDate} />
							)}
						</div>
					</div>
				</div>

				{!calEnabled && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
						<CalendarDays size={28} className="text-orange-400" />
						<p className={`text-sm text-center px-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
							{t("onboarding.enable_cal_desc")}
						</p>
						<button
							type="button"
							onClick={handleEnableCal}
							className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
						>
							{t("onboarding.enable_cal")}
						</button>
					</div>
				)}
			</div>

			{showDiaryModal &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
						onClick={() => setShowDiaryModal(false)}
					>
						<div
							className="w-full max-w-4xl max-h-[86vh] overflow-y-auto custom-scrollbar"
							onClick={(e) => e.stopPropagation()}
						>
							<DiaryPanel
								selectedDate={selectedDate}
								onClose={() => setShowDiaryModal(false)}
							/>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

export default DatePanelContainer;
