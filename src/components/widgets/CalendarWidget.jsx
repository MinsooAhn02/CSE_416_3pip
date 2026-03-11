import { Calendar } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const CalendarWidget = () => {
	const { muted } = useTheme();
	const calEvents = useDataStore((s) => s.calEvents);

	return (
		<WidgetCard
			title="오늘 일정 (Google Calendar)"
			icon={Calendar}
			widgetId="calendar"
		>
			<div className="space-y-2">
				{calEvents.map((ev, i) => (
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
				<p className={`text-[10px] text-center mt-1 ${muted}`}>
					⚠️ Google Calendar 연동 시 실제 일정으로 대체됩니다
				</p>
			</div>
		</WidgetCard>
	);
};

export default CalendarWidget;
