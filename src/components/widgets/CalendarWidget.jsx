import { useMemo } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const normalizeCalendarEvent = (ev, idx) => {
	const title = ev.title || "(제목 없음)";
	const location = ev.location || "위치 없음";
	if (ev.start) {
		const startDate = new Date(ev.start);
		if (Number.isNaN(startDate.getTime())) return null;
		const time = ev.allDay
			? "하루 종일"
			: startDate.toLocaleTimeString("ko-KR", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
		return {
			id: ev.id || `${title}-${idx}`,
			title,
			location,
			time,
			date: startDate,
			color: "#60a5fa",
		};
	}

	const date = new Date();
	const [hh = "00", mm = "00"] = String(ev.time || "00:00").split(":");
	date.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
	return {
		id: ev.id || `${title}-${idx}`,
		title,
		location,
		time: ev.time || "시간 미정",
		date,
		color: ev.color || "#60a5fa",
	};
};

const CalendarWidget = () => {
	const { muted } = useTheme();
	const calEvents = useDataStore((s) => s.calEvents);
	const loading = useDataStore((s) => s.loading.calendar);
	const fetchCalendar = useDataStore((s) => s.fetchCalendar);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("calendar"));
	const todayEvents = useMemo(() => {
		const today = new Date();
		return (calEvents || [])
			.map(normalizeCalendarEvent)
			.filter(Boolean)
			.filter((ev) => sameDay(ev.date, today))
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}, [calEvents]);

	return (
		<WidgetCard
			title="오늘 일정 (Google Calendar)"
			icon={Calendar}
			widgetId="calendar"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchCalendar(undefined, true)}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			<div className="space-y-2">
				{todayEvents.map((ev) => (
					<div key={ev.id} className="flex items-center gap-3">
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
				{todayEvents.length === 0 && (
					<p className={`text-xs ${muted}`}>오늘 일정이 없습니다.</p>
				)}
				<p className={`text-[10px] text-center mt-1 ${muted}`}>
					⚠️ Google Calendar 연동 시 실제 일정으로 대체됩니다
				</p>
			</div>
		</WidgetCard>
	);
};

export default CalendarWidget;
