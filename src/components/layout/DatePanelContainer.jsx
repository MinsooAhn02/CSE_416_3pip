import { X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
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
const DatePanelContainer = ({ selectedDate, onClose }) => {
	const { isDark } = useTheme();
	const getDiary = useDiaryStore((s) => s.getDiary);

	if (!selectedDate) return null;

	/* Check if diary entry exists for selected date */
	const diaryEntry = getDiary(selectedDate);
	const hasDiary = !!diaryEntry && (diaryEntry.diary || diaryEntry.memo);

	/* Format date for display */
	const formatDate = (dateStr) => {
		const d = new Date(dateStr + "T00:00:00");
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]})`;
	};

	return (
		<div className={`mt-6 p-6 pb-20 rounded-xl border h-auto w-full ${isDark ? "bg-[#1e1e1e] border-[#3a3a3a]" : "bg-white border-gray-200"}`}>
			{/* Header with Date and Close Button */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="font-bold text-lg">Date Details</h2>
					<p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
						{formatDate(selectedDate)}
					</p>
				</div>
				<button
					onClick={onClose}
					className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
				>
					<X size={20} />
				</button>
			</div>

			{/* 
				PHASE 9: RESTRUCTURED STACKED LAYOUT
				- Top Row: Events and Tasks in 2-column layout (grid-cols-2), each taking 50% width
				- Bottom Row: Diary panel below, taking 100% width (spans full container width)
				- Diary only renders if entry exists for selected date
				- This addresses ergonomic issues with narrow 3-column layout
				- Diary now has more horizontal space for reading/writing content
			*/}
			<div className="w-full max-w-none space-y-4">
				{/* Top Row: Events and Tasks (2-column, 50/50 split) */}
				<div className="w-full max-w-none grid grid-cols-1 md:grid-cols-2 gap-4">
					<EventPanel selectedDate={selectedDate} onClose={onClose} />
					<TaskPanel selectedDate={selectedDate} onClose={onClose} />
				</div>
				
				{/* Bottom Row: Diary (100% width, only if diary exists) */}
				{hasDiary && (
					<div className="w-full max-w-none">
						<DiaryPanel selectedDate={selectedDate} onClose={onClose} />
					</div>
				)}
			</div>
		</div>
	);
};

export default DatePanelContainer;
