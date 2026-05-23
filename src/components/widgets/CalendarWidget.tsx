import { useState, useEffect, useMemo } from "react";
import {
	Calendar,
	ArrowLeftRight,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useTheme } from "../../hooks/useTheme";
import {
	filterTasksByTaskList,
	useGoogleCalendarStore,
	GOOGLE_SYNC_AUTH_ERROR,
} from "../../store/useGoogleCalendarStore";
import { useTodoStore } from "../../store/useTodoStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { formatLocalDate } from "../../utils/date";
import {
	doesTaskOccurOnDate,
	isTaskCompletedOnDate,
} from "../../utils/taskRecurrence";
import DatePanelContainer from "../layout/DatePanelContainer";
import { useFontSize } from "../../hooks/useFontSize";

// ── Helper ────────────────────────────────────────────────────────────────────

type CalView = "month" | "week" | "day";
type HeaderView = "month" | "year" | "decade";

const sameDay = (a: Date, b: Date): boolean =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

// ── Component ─────────────────────────────────────────────────────────────────

const CalendarWidget = () => {
	const { isDark, cardCls, cardShadowCls, muted, hoverCls, borderCls } =
		useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t, i18n } = useTranslation();
	const [calView, setCalView] = useState<CalView>("month");
	const [currentDate, setCurrentDate] = useState<Date>(new Date());
	const [selectedDateForPanels, setSelectedDateForPanels] = useState<string | null>(null);
	const [headerView, setHeaderView] = useState<HeaderView>("month");
	const [decadeStart, setDecadeStart] = useState<number>(
		() => Math.floor(new Date().getFullYear() / 10) * 10,
	);

	const DAYS = t("calendar.days", { returnObjects: true }) as string[];

	/* ── 외부 스토어 연결 ── */
	const setSelectedDate = useGoogleCalendarStore((s) => s.setSelectedDate);
	const selectedTaskListFilter = useGoogleCalendarStore(
		(s) => s.selectedTaskListFilter,
	);
	const { events = [], tasks = [] } = useGoogleCalendarStore();
	const filteredTasks = useMemo(
		() => filterTasksByTaskList(tasks, selectedTaskListFilter),
		[tasks, selectedTaskListFilter],
	);

	const diaryEntries = useDiaryStore((s) => s.entries);
	const diaryDateSet = useMemo(
		() =>
			new Set(
				Object.keys(diaryEntries || {}).filter((d) => diaryEntries[d]?.diary),
			),
		[diaryEntries],
	);
	const hasDiaryOnDate = (dateStr: string): boolean => diaryDateSet.has(dateStr);

	const hasEventsOnDate = (dateStr: string): boolean => {
		return events?.some((e) => e.date === dateStr) || false;
	};

	const hasTasksOnDate = (dateStr: string): boolean => {
		type TaskLike = Parameters<typeof doesTaskOccurOnDate>[0];
		return (
			filteredTasks?.some(
				(task) =>
					doesTaskOccurOnDate(task as unknown as TaskLike, dateStr) &&
					!isTaskCompletedOnDate(task as unknown as TaskLike, dateStr),
			) || false
		);
	};

	const now = new Date();
	const today = now.getDate();
	const todayStr = formatLocalDate(now);
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	useEffect(() => {
		useTodoStore.getState().ensureDailyReset?.();
	}, []);

	useEffect(() => {
		useGoogleCalendarStore
			.getState()
			.fetchEventsAndTasks?.({ date: formatLocalDate(currentDate) })
			.catch((err: unknown) => {
				console.warn("[gcal] calendar sync failed:", err);
				const errMsg = (err as Error)?.message;
				if (errMsg && errMsg !== GOOGLE_SYNC_AUTH_ERROR) {
					toast.error(t("toast.calendar_sync_failed"), { id: "calendar-sync-failed" });
				}
			});
	}, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleCycleView = () => {
		const views: CalView[] = ["month", "week", "day"];
		const currentIndex = views.indexOf(calView);
		const nextIndex = (currentIndex + 1) % views.length;
		setSelectedDateForPanels(null);
		setSelectedDate(null);
		setCalView(views[nextIndex]);
		setHeaderView("month");
	};

	const selectDate = (dateStr: string) => {
		setSelectedDateForPanels(dateStr);
		setSelectedDate(dateStr);
	};

	const goToPrev = () => {
		if (headerView === "decade") setDecadeStart((s) => s - 10);
		else if (headerView === "year") setCurrentDate(new Date(viewYear - 1, viewMonth, 1));
		else setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
	};
	const goToNext = () => {
		if (headerView === "decade") setDecadeStart((s) => s + 10);
		else if (headerView === "year") setCurrentDate(new Date(viewYear + 1, viewMonth, 1));
		else setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
	};
	const goToToday = () => {
		const nextDate = new Date();
		const nextTodayStr = formatLocalDate(nextDate);
		setCurrentDate(nextDate);
		setHeaderView("month");
		setSelectedDate(nextTodayStr);
		if (selectedDateForPanels) {
			setSelectedDateForPanels(nextTodayStr);
		}
	};

	const cells = useMemo<(number | null)[]>(() => {
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
		const arr: (number | null)[] = [];
		for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(d);
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	}, [viewYear, viewMonth]);

	const weekDays = useMemo<Date[]>(() => {
		const start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}, [now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

	const isCurrentMonth =
		viewYear === now.getFullYear() && viewMonth === now.getMonth();
	const isTodayButtonDisabled =
		isCurrentMonth &&
		(!selectedDateForPanels || selectedDateForPanels === todayStr);

	const monthLabel = currentDate.toLocaleDateString(
		i18n.language === "ko" ? "ko-KR" : "en-US",
		{
			year: "numeric",
			month: "long",
		},
	);

	const locale = i18n.language === "ko" ? "ko-KR" : "en-US";

	const shortMonths = useMemo<string[]>(
		() =>
			Array.from({ length: 12 }, (_, i) =>
				new Date(viewYear, i, 1).toLocaleDateString(locale, { month: "short" }),
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[viewYear, locale],
	);

	const decadeYears = useMemo<number[]>(
		() => Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i),
		[decadeStart],
	);

	const dayFullNames = t("calendar.days_full", { returnObjects: true }) as string[];

	return (
		<div
			className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 flex flex-col ${cardCls}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Calendar size={18} className="text-blue-500" />
					<h2 className="font-bold text-sm">{t("calendar.title")}</h2>
				</div>

				<div className="flex items-center gap-2">
					{/* Month/Year/Decade navigation */}
					{calView === "month" && (
						<>
							<button
								onClick={goToPrev}
								className={`p-1 rounded-full transition-colors ${hoverCls}`}
							>
								<ChevronLeft size={16} />
							</button>

							{headerView === "month" && (
								<button
									type="button"
									onClick={() => setHeaderView("year")}
									className={`text-sm font-medium min-w-[100px] text-center px-1 rounded-md transition-colors ${hoverCls}`}
								>
									{monthLabel} ▾
								</button>
							)}
							{headerView === "year" && (
								<button
									type="button"
									onClick={() => { setDecadeStart(Math.floor(viewYear / 10) * 10); setHeaderView("decade"); }}
									className={`text-sm font-medium min-w-[100px] text-center px-1 rounded-md transition-colors ${hoverCls}`}
								>
									{viewYear} ▾
								</button>
							)}
							{headerView === "decade" && (
								<span className="text-sm font-medium min-w-[100px] text-center">
									{decadeStart}–{decadeStart + 9}
								</span>
							)}

							<button
								onClick={goToNext}
								className={`p-1 rounded-full transition-colors ${hoverCls}`}
							>
								<ChevronRight size={16} />
							</button>

							{headerView === "month" && (
								<button
									type="button"
									onClick={goToToday}
									disabled={isTodayButtonDisabled}
									className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
										isTodayButtonDisabled
											? isDark
												? "cursor-default border-slate-700 text-slate-500"
												: "cursor-default border-slate-200 text-slate-400"
											: `${borderCls} ${hoverCls}`
									}`}
									title={t("calendar.go_to_today")}
								>
									{t("calendar.today")}
								</button>
							)}
						</>
					)}

					<button
						onClick={handleCycleView}
						className={`p-1 rounded-full transition-colors ${hoverCls}`}
						title={t("calendar.cycle_view")}
					>
						<ArrowLeftRight size={18} />
					</button>
				</div>
			</div>

			{/* Year picker (12 months grid) */}
			{calView === "month" && headerView === "year" && (
				<div className="grid grid-cols-3 gap-2 mt-1">
					{shortMonths.map((m, idx) => (
						<button
							key={idx}
							type="button"
							onClick={() => {
								setCurrentDate(new Date(viewYear, idx, 1));
								setHeaderView("month");
							}}
							className={`py-3 rounded-xl text-sm font-medium transition-colors ${
								viewMonth === idx && viewYear === currentDate.getFullYear()
									? "bg-blue-500 text-white"
									: hoverCls
							}`}
						>
							{m}
						</button>
					))}
				</div>
			)}

			{/* Decade picker (12 years grid) */}
			{calView === "month" && headerView === "decade" && (
				<div className="grid grid-cols-3 gap-2 mt-1">
					{decadeYears.map((yr) => {
						const inDecade = yr >= decadeStart && yr <= decadeStart + 9;
						return (
							<button
								key={yr}
								type="button"
								onClick={() => {
									setCurrentDate(new Date(yr, viewMonth, 1));
									setDecadeStart(Math.floor(yr / 10) * 10);
									setHeaderView("year");
								}}
								className={`py-3 rounded-xl text-sm font-medium transition-colors ${
									yr === viewYear
										? "bg-blue-500 text-white"
										: inDecade
											? hoverCls
											: `${hoverCls} opacity-30`
								}`}
							>
								{yr}
							</button>
						);
					})}
				</div>
			)}

			{/* Month View */}
			{calView === "month" && headerView === "month" && (
				<div className="grid grid-cols-7 gap-1">
					{DAYS.map((d) => (
						<div
							key={d}
							className={`text-center font-medium py-2 ${muted}`}
							style={bodyStyle}
						>
							{d}
						</div>
					))}
					{cells.map((day, i) => {
						if (day === null) {
							return <div key={i} className="invisible h-9 w-9 mx-auto" />;
						}
						const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
						const isToday = day === today && isCurrentMonth;
						const isSelected = selectedDateForPanels === dateStr;

						return (
							<button
								key={i}
								type="button"
								onClick={() => selectDate(dateStr)}
								className={`relative mx-auto flex h-9 w-9 items-center justify-center text-sm rounded-full transition-colors ${
									isToday ? "bg-blue-500 text-white font-bold" : hoverCls
								} ${isSelected && !isToday ? "ring-2 ring-blue-500" : ""} ${
									isSelected && isToday ? "ring-2 ring-blue-300" : ""
								}`}
							>
								{day}
								<div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
									{hasEventsOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												isToday ? "bg-white" : "bg-orange-500"
											}`}
											title={t("events.title")}
										/>
									)}
									{hasTasksOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												isToday ? "bg-white" : "bg-green-500"
											}`}
											title={t("tasks.title")}
										/>
									)}
									{hasDiaryOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${isToday ? "bg-white" : "bg-blue-500"}`}
											title={t("diary.title")}
										/>
									)}
								</div>
							</button>
						);
					})}
				</div>
			)}

			{/* Week View */}
			{calView === "week" && (
				<div className="grid grid-cols-7 gap-2">
					{weekDays.map((d, i) => {
						const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
						const isSelected = selectedDateForPanels === dateStr;

						return (
							<button
								key={i}
								type="button"
								onClick={() => selectDate(dateStr)}
								className={`relative text-center p-4 rounded-lg border transition-colors ${
									sameDay(d, now)
										? "bg-blue-500 text-white border-blue-500"
										: isSelected
											? isDark
												? "bg-blue-500/30 border-blue-500"
												: "bg-blue-100 border-blue-500"
											: `${borderCls} ${hoverCls}`
								}`}
							>
								<p style={bodyStyle}>{DAYS[d.getDay()]}</p>
								<p className="text-lg font-bold">{d.getDate()}</p>
								<div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
									{hasEventsOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-orange-500"
											}`}
											title={t("events.title")}
										/>
									)}
									{hasTasksOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-green-500"
											}`}
											title={t("tasks.title")}
										/>
									)}
									{hasDiaryOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-blue-500"
											}`}
											title={t("diary.title")}
										/>
									)}
								</div>
							</button>
						);
					})}
				</div>
			)}

			{/* Day View */}
			{calView === "day" && (
				<div className="flex justify-center items-start py-6">
					<button
						type="button"
						onClick={() => selectDate(todayStr)}
						className="w-40 h-40 rounded-2xl bg-blue-500 text-white flex flex-col items-center justify-center shadow-sm hover:bg-blue-600 transition-colors"
					>
						<p className="text-xs uppercase">{dayFullNames[now.getDay()]}</p>
						<p className="text-6xl font-bold">{now.getDate()}</p>
						<p className="text-sm">
							{now.toLocaleDateString(
								i18n.language === "ko" ? "ko-KR" : "en-US",
								{ month: "long" },
							)}
						</p>
					</button>
				</div>
			)}

			{selectedDateForPanels && (
				<DatePanelContainer
					selectedDate={selectedDateForPanels}
					onClose={() => setSelectedDateForPanels(null)}
				/>
			)}
		</div>
	);
};

export default CalendarWidget;
