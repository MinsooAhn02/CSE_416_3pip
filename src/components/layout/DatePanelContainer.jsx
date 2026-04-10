import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
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
	const { isDark, cardSecondaryCls, hoverCls } = useTheme();
	const [showDiaryModal, setShowDiaryModal] = useState(false);

	if (!selectedDate) return null;

	/* Format date for display */
	const formatDate = (dateStr) => {
		const d = new Date(dateStr + "T00:00:00");
		const days = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]})`;
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
					<h2 className="font-bold text-base">Date Details</h2>
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
							title="Open diary for this date"
						>
							<BookOpen size={20} className="text-blue-500" />
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

			{/* 
				PHASE 9: RESTRUCTURED STACKED LAYOUT
				- Top Row: Events and Tasks in 2-column layout (grid-cols-2), each taking 50% width
				- Bottom Row: Diary panel below, taking 100% width (spans full container width)
				- Diary only renders if entry exists for selected date
				- This addresses ergonomic issues with narrow 3-column layout
				- Diary now has more horizontal space for reading/writing content
			*/}
			<div className="w-full max-w-none space-y-3">
				{/* Top Row: Events and Tasks (2-column, 50/50 split) */}
				<div className="w-full max-w-none grid grid-cols-1 md:grid-cols-2 gap-3">
					<EventPanel selectedDate={selectedDate} onClose={onClose} />
					<TaskPanel selectedDate={selectedDate} onClose={onClose} />
				</div>
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
