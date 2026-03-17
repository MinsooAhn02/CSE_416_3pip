import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { mockCalendarEvents } from "../../mock/data";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const CalendarWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const [calView, setCalView] = useState("month");
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentDate, setCurrentDate] = useState(new Date());
	const menuRef = useRef(null);

	const now = new Date();
	const today = now.getDate();
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	/* Close menu on outside click */
	useEffect(() => {
		if (!menuOpen) return;
		const handler = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target))
				setMenuOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [menuOpen]);

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
			className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 ${cardCls}`}
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

					{/* Kebab menu */}
					<div ref={menuRef} className="relative">
						<button
							onClick={() => setMenuOpen(!menuOpen)}
							className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
						>
							<MoreVertical size={18} />
						</button>
						{menuOpen && (
							<div
								className={`absolute right-0 mt-2 rounded-lg shadow-lg py-1 z-10 min-w-[80px] border ${
									isDark
										? "bg-[#2a2a2a] border-[#3a3a3a]"
										: "bg-white border-gray-200"
								}`}
							>
								{[
									{ key: "day", label: "일" },
									{ key: "week", label: "주" },
									{ key: "month", label: "월" },
								].map((v) => (
									<button
										key={v.key}
										onClick={() => {
											setCalView(v.key);
											setMenuOpen(false);
										}}
										className={`w-full text-left px-4 py-2 text-sm transition-colors ${
											calView === v.key
												? "text-blue-500 font-medium"
												: isDark
													? "hover:bg-[#353535]"
													: "hover:bg-gray-100"
										}`}
									>
										{v.label}
									</button>
								))}
							</div>
						)}
					</div>
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
					{cells.map((day, i) => (
						<div
							key={i}
							className={`text-center py-2 text-sm rounded-full cursor-default ${
								day === null ? "invisible" : ""
							} ${
								day === today && isCurrentMonth
									? "bg-blue-500 text-white font-bold"
									: isDark
										? "hover:bg-[#353535]"
										: "hover:bg-gray-100"
							}`}
						>
							{day}
						</div>
					))}
				</div>
			)}

			{/* Week View */}
			{calView === "week" && (
				<div className="grid grid-cols-7 gap-2">
					{weekDays.map((d, i) => (
						<div
							key={i}
							className={`text-center p-4 rounded-lg border transition-colors ${
								sameDay(d, now)
									? "bg-blue-500 text-white border-blue-500"
									: isDark
										? "border-[#3a3a3a] hover:bg-[#353535]"
										: "border-gray-200 hover:bg-gray-50"
							}`}
						>
							<p className="text-xs">{DAYS[d.getDay()]}</p>
							<p className="text-lg font-bold">{d.getDate()}</p>
						</div>
					))}
				</div>
			)}

			{/* Day View */}
			{calView === "day" && (
				<div className="flex items-center justify-center py-6">
					<div className="w-40 h-40 rounded-2xl bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg">
						<p className="text-xs uppercase">{DAYS[now.getDay()]}요일</p>
						<p className="text-6xl font-bold">{now.getDate()}</p>
						<p className="text-sm">
							{now.toLocaleDateString("ko-KR", { month: "long" })}
						</p>
					</div>
				</div>
			)}

			{/* Today's events */}
			<div className={`mt-4 pt-4 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
				<p className={`text-xs font-medium mb-2 ${muted}`}>오늘 일정</p>
				<div className="space-y-2">
					{mockCalendarEvents.map((ev, i) => (
						<div key={i} className="flex items-center gap-3">
							<div
								className="w-1 h-8 rounded-full flex-shrink-0"
								style={{ backgroundColor: ev.color }}
							/>
							<div className="flex-grow">
								<p className="text-xs font-medium">{ev.title}</p>
								<p className={`text-[10px] ${muted}`}>
									{ev.time} · {ev.location}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default CalendarWidget;
