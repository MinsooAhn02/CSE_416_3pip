import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useGoogleCalendarStore } from "../../store/useGoogleCalendarStore";
import { useTodoStore } from "../../store/useTodoStore";
import DatePanelContainer from "../layout/DatePanelContainer";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const CalendarWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const [calView, setCalView] = useState("month");
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedDateForPanels, setSelectedDateForPanels] = useState(null);

	/* ── 외부 스토어 연결 ── */
	const getDiaryDates = useDiaryStore((s) => s.getDiaryDates);
	const diaryDates = useMemo(() => new Set(getDiaryDates()), [getDiaryDates]);
	const setSelectedDate = useGoogleCalendarStore((s) => s.setSelectedDate);
	const { events = [], tasks = [] } = useGoogleCalendarStore();

	/* PHASE 13: Helper to check if date has events (all dates, not just future) */
	const hasEventsOnDate = (dateStr) => {
		return events?.some(e => e.date === dateStr) || false;
	};

	/* PHASE 15: Helper to check if date has INCOMPLETE tasks (green dot shows only for incomplete) */
	const hasTasksOnDate = (dateStr) => {
		return tasks?.some(t => t.date === dateStr && !t.completed) || false;
	};

	const now = new Date();
	const today = now.getDate();
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	/* PHASE 14: Initialize calendar with all events/tasks on mount */
	useEffect(() => {
		useTodoStore.getState().ensureDailyReset?.();
		useGoogleCalendarStore.getState().fetchEventsAndTasks?.();
	}, []);

	/* PHASE 16: Cycle through calendar views on button click */
	const handleCycleView = () => {
		const views = ["month", "week", "day"];
		const currentIndex = views.indexOf(calView);
		const nextIndex = (currentIndex + 1) % views.length;
		setCalView(views[nextIndex]);
	};

	/* Month navigation */
	const goToPrev = () => {
		setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
	};
	const goToNext = () => {
		setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
	};

	/* Month view cells */
	const cells = useMemo(() => {
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
		const arr = [];
		for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(d);
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	}, [viewYear, viewMonth]);

	/* Week view days */
	const weekDays = useMemo(() => {
		const start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}, [now.toDateString()]);

	const isCurrentMonth =
		viewYear === now.getFullYear() && viewMonth === now.getMonth();

	const monthLabel = currentDate.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
	});

	return (
		<div
			className={`rounded-2xl border p-5 shadow-sm transition-colors duration-300 flex flex-col ${cardCls}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Calendar size={18} className="text-blue-500" />
					<h2 className="font-bold text-sm">캘린더</h2>
				</div>

				<div className="flex items-center gap-2">
					{/* Month navigation */}
					{calView === "month" && (
						<>
							<button
								onClick={goToPrev}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronLeft size={16} />
							</button>
							<span className="text-sm font-medium min-w-[100px] text-center">
								{monthLabel}
							</span>
							<button
								onClick={goToNext}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronRight size={16} />
							</button>
						</>
					)}

					{/* PHASE 16: View cycle button - cycles Month -> Week -> Day -> Month */}
					<button
						onClick={handleCycleView}
						className={`p-1 rounded-full transition-colors title="Cycle view (Month → Week → Day)" ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
					>
						<ArrowLeftRight size={18} />
					</button>
				</div>
			</div>

			{/* Month View */}
			{calView === "month" && (
				<div className="grid grid-cols-7 gap-1">
					{DAYS.map((d) => (
						<div
							key={d}
							className={`text-center text-xs font-medium py-2 ${muted}`}
						>
							{d}
						</div>
					))}
					{cells.map((day, i) => {
						if (day === null) {
							return <div key={i} className="invisible py-2" />;
						}
						const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
						const hasDiary = diaryDates.has(dateStr);
						const isToday = day === today && isCurrentMonth;
						const isSelected = selectedDateForPanels === dateStr;

						return (
							<div
								key={i}
								onClick={() => {
									setSelectedDateForPanels(dateStr);
									setSelectedDate(dateStr); // Set in Google Calendar store
								}}
								className={`relative text-center py-2 text-sm rounded-full cursor-pointer transition-all ${
									isToday
										? "bg-blue-500 text-white font-bold"
										: isDark
											? "hover:bg-[#353535]"
											: "hover:bg-gray-100"
								} ${
									isSelected && !isToday
										? "border-2 border-blue-500"
										: ""
								} ${
									isSelected && isToday
										? "border-2 border-blue-300"
										: ""
								}`}
							>
								{day}
								{/* PHASE 11: Multiple indicator dots - Diary (blue), Events (orange), Tasks (green) */}
								<div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
									{hasDiary && (
										<span
											className={`w-1 h-1 rounded-full ${
												isToday ? "bg-white" : "bg-blue-500"
											}`}
											title="Diary"
										/>
									)}
									{hasEventsOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												isToday ? "bg-white" : "bg-orange-500"
											}`}
											title="Events"
										/>
									)}
									{hasTasksOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												isToday ? "bg-white" : "bg-green-500"
											}`}
											title="Tasks"
										/>
									)}
								</div>
							</div>
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
						const hasDiary = diaryDates.has(dateStr);
						
						return (
							<div
								key={i}
								onClick={() => {
									setSelectedDateForPanels(dateStr);
									setSelectedDate(dateStr);
								}}
								className={`relative text-center p-4 rounded-lg border transition-colors cursor-pointer ${
									sameDay(d, now)
										? "bg-blue-500 text-white border-blue-500"
										: isSelected
										? isDark ? "bg-blue-500/30 border-blue-500" : "bg-blue-100 border-blue-500"
										: isDark
											? "border-[#3a3a3a] hover:bg-[#353535]"
											: "border-gray-200 hover:bg-gray-50"
								}`}
							>
								<p className="text-xs">{DAYS[d.getDay()]}</p>
								<p className="text-lg font-bold">{d.getDate()}</p>
								{/* PHASE 17: Dot indicators for Week view */}
								<div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
									{hasDiary && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-blue-500"
											}`}
											title="Diary"
										/>
									)}
									{hasEventsOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-orange-500"
											}`}
											title="Events"
										/>
									)}
									{hasTasksOnDate(dateStr) && (
										<span
											className={`w-1 h-1 rounded-full ${
												sameDay(d, now) ? "bg-white" : "bg-green-500"
											}`}
											title="Tasks"
										/>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Day View */}
			{calView === "day" && (
				<div className="flex justify-center items-start py-6">
					<div 
						onClick={() => {
							const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
							setSelectedDateForPanels(dateStr);
							setSelectedDate(dateStr);
						}}
						className="w-40 h-40 rounded-2xl bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer hover:bg-blue-600 transition-colors"
					>
						<p className="text-xs uppercase">{DAYS[now.getDay()]}요일</p>
						<p className="text-6xl font-bold">{now.getDate()}</p>
						<p className="text-sm">
							{now.toLocaleDateString("ko-KR", { month: "long" })}
						</p>
					</div>
				</div>
			)}

			{/*
				CRITICAL FIX: Three-panel layout (Events, Tasks, Diary)
				- Events and Tasks are IMMEDIATELY VISIBLE (no PIN block)
				- Diary panel has its own internal PIN protection
				- Diary List button is in TopNav (also PIN protected)
				- Legacy UI section completely removed
			*/}
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
