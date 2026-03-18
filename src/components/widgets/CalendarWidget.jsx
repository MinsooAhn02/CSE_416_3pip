import { useState, useEffect, useRef, useMemo } from "react";
import {
	Calendar,
	MoreVertical,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	X,
	Plus,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import DiaryModal from "../modals/DiaryModal";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const CalendarWidget = () => {
	const { isDark, cardCls, muted, inputCls } = useTheme();
	const [calView, setCalView] = useState("month");
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentDate, setCurrentDate] = useState(new Date());
	const [diaryDateStr, setDiaryDateStr] = useState(null); // 선택된 날짜 (DiaryModal용)
	const menuRef = useRef(null);

	/* ── 외부 스토어 연결 ── */
	const calEvents = useDataStore((s) => s.calEvents) || [];
	const getDiaryDates = useDiaryStore((s) => s.getDiaryDates);
	const diaryDates = useMemo(() => new Set(getDiaryDates()), [getDiaryDates]);
	const {
		todos,
		newTodoText,
		showAddTodo,
		toggleTodo,
		addTodo,
		deleteTodo,
		ensureDailyReset,
		setNewTodoText,
		setShowAddTodo,
	} = useTodoStore();

	const now = new Date();
	const today = now.getDate();
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	/* 초기 로드 시 일일 리셋 확인 */
	useEffect(() => {
		ensureDailyReset?.();
	}, [ensureDailyReset]);

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
					{cells.map((day, i) => {
						if (day === null) {
							return <div key={i} className="invisible py-2" />;
						}
						const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
						const hasDiary = diaryDates.has(dateStr);
						const isToday = day === today && isCurrentMonth;

						return (
							<div
								key={i}
								onClick={() => setDiaryDateStr(dateStr)}
								className={`relative text-center py-2 text-sm rounded-full cursor-pointer transition-colors ${
									isToday
										? "bg-blue-500 text-white font-bold"
										: isDark
											? "hover:bg-[#353535]"
											: "hover:bg-gray-100"
								}`}
							>
								{day}
								{/* 일기 있는 날짜에 점 표시 */}
								{hasDiary && (
									<span
										className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
											isToday ? "bg-white" : "bg-blue-500"
										}`}
									/>
								)}
							</div>
						);
					})}
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

			{/* ── 하단 5:5 분할: 오늘의 일정 + AI Todo ── */}
			<div className={`mt-4 pt-4 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
				<div className="flex gap-4">
					{/* 왼쪽: 오늘의 일정 */}
					<div className="flex-1 min-w-0">
						<p className={`text-xs font-medium mb-2 ${muted}`}>오늘 일정</p>
						<div className="space-y-2">
							{calEvents.length === 0 ? (
								<p className={`text-xs ${muted}`}>오늘 일정이 없습니다.</p>
							) : (
								calEvents.map((ev, i) => (
									<div key={i} className="flex items-center gap-3">
										<div
											className="w-1 h-8 rounded-full flex-shrink-0"
											style={{ backgroundColor: ev.color || "#4f46e5" }}
										/>
										<div className="flex-grow min-w-0">
											<p className="text-xs font-medium truncate">
												{ev.title || ev.summary}
											</p>
											<p className={`text-[10px] truncate ${muted}`}>
												{ev.time || ""} {ev.location ? `· ${ev.location}` : ""}
											</p>
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* 오른쪽: AI Todo (기존 TodoWidget 로직 인라인) */}
					<div className="flex-1 min-w-0">
						<p className={`text-xs font-medium mb-2 ${muted}`}>AI Todo</p>
						<div className="space-y-2">
							{todos.map((t) => (
								<div key={t.id} className="flex items-center gap-2 group">
									<button
										onClick={() => toggleTodo(t.id)}
										className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
											t.completed
												? "bg-blue-500 border-blue-500"
												: isDark
													? "border-white/30 hover:border-blue-400"
													: "border-gray-300 hover:border-blue-400"
										}`}
									>
										{t.completed && (
											<CheckCircle2 size={10} className="text-white" />
										)}
									</button>
									<span
										className={`text-xs flex-grow truncate ${
											t.completed ? "line-through opacity-40" : ""
										}`}
									>
										{t.text}
									</span>
									{t.isFixed && (
										<span
											className={`text-[9px] px-1 py-0.5 rounded ${
												isDark
													? "bg-emerald-500/20 text-emerald-300"
													: "bg-emerald-100 text-emerald-700"
											}`}
										>
											루틴
										</span>
									)}
									<button
										onClick={() => deleteTodo(t.id)}
										className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
									>
										<X size={12} />
									</button>
								</div>
							))}

							{/* Todo 추가 UI */}
							{showAddTodo ? (
								<div className="flex items-center gap-1 mt-1">
									<input
										type="text"
										value={newTodoText}
										onChange={(e) => setNewTodoText(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												void addTodo();
											}
										}}
										placeholder="할 일 입력..."
										autoFocus
										className={`flex-grow rounded-lg px-2 py-1 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={() => void addTodo()}
										className="text-blue-400 text-xs font-medium"
									>
										추가
									</button>
									<button
										onClick={() => {
											setShowAddTodo(false);
											setNewTodoText("");
										}}
									>
										<X size={14} className={muted} />
									</button>
								</div>
							) : (
								<button
									onClick={() => setShowAddTodo(true)}
									className="flex items-center gap-1 text-[10px] text-blue-400 mt-1 hover:underline"
								>
									<Plus size={12} /> 새 할 일
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* DiaryModal — 날짜 클릭 시 표시 */}
			{diaryDateStr && (
				<DiaryModal
					dateStr={diaryDateStr}
					onClose={() => setDiaryDateStr(null)}
				/>
			)}
		</div>
	);
};

export default CalendarWidget;
