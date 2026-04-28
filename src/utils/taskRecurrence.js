import { parseDateString } from "./date";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_CODES = new Set(["MO", "TU", "WE", "TH", "FR"]);

const toDayStamp = (date) =>
	Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const safeParseDate = (dateStr) => {
	if (!dateStr) return null;
	const parsed = parseDateString(dateStr);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffInDays = (from, to) =>
	Math.round((toDayStamp(to) - toDayStamp(from)) / DAY_MS);

const diffInMonths = (from, to) =>
	(to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const getWeekOrdinal = (date) => Math.ceil(date.getDate() / 7);

const getIsoWeekStart = (date) => {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayOffset = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - dayOffset);
	return start;
};

const diffInWeeks = (from, to) =>
	Math.floor(diffInDays(getIsoWeekStart(from), getIsoWeekStart(to)) / 7);

const getDayCode = (date) => DAY_CODES[date.getDay()];

const normalizeInterval = (value) => {
	const parsed = Number(value || 1);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

const matchesMonthlyNthWeekday = (anchor, target, interval = 1) => {
	const monthDiff = diffInMonths(anchor, target);
	if (monthDiff < 0 || monthDiff % interval !== 0) return false;
	return (
		target.getDay() === anchor.getDay() &&
		getWeekOrdinal(target) === getWeekOrdinal(anchor)
	);
};

const matchesCustomWeekly = (anchor, target, repeat) => {
	const dayDiff = diffInDays(anchor, target);
	if (dayDiff < 0) return false;

	const interval = normalizeInterval(repeat?.interval);
	const weekDiff = diffInWeeks(anchor, target);
	if (weekDiff < 0 || weekDiff % interval !== 0) return false;

	const daysOfWeek =
		Array.isArray(repeat?.daysOfWeek) && repeat.daysOfWeek.length > 0
			? repeat.daysOfWeek
			: [getDayCode(anchor)];

	return daysOfWeek.includes(getDayCode(target));
};

export const doesTaskOccurOnDate = (task, dateStr) => {
	const anchorDate = safeParseDate(task?.date);
	const targetDate = safeParseDate(dateStr);
	if (!anchorDate || !targetDate) return false;

	const repeat = task?.repeat;
	if (!repeat?.type || repeat.type === "none") {
		return task?.date === dateStr;
	}

	const dayDiff = diffInDays(anchorDate, targetDate);
	if (dayDiff < 0) return false;

	switch (repeat.type) {
		case "daily":
			return dayDiff % 1 === 0;
		case "weekly":
			return dayDiff % 7 === 0;
		case "monthly":
			return matchesMonthlyNthWeekday(anchorDate, targetDate);
		case "yearly":
			return (
				targetDate.getMonth() === anchorDate.getMonth() &&
				targetDate.getDate() === anchorDate.getDate()
			);
		case "weekdays":
			return WEEKDAY_CODES.has(getDayCode(targetDate));
		case "custom": {
			const frequency = repeat.frequency || "weekly";
			const interval = normalizeInterval(repeat.interval);

			switch (frequency) {
				case "daily":
					return dayDiff % interval === 0;
				case "weekly":
					return matchesCustomWeekly(anchorDate, targetDate, repeat);
				case "monthly": {
					const monthDiff = diffInMonths(anchorDate, targetDate);
					return (
						monthDiff >= 0 &&
						monthDiff % interval === 0 &&
						targetDate.getDate() === anchorDate.getDate()
					);
				}
				case "yearly": {
					const yearDiff = targetDate.getFullYear() - anchorDate.getFullYear();
					return (
						yearDiff >= 0 &&
						yearDiff % interval === 0 &&
						targetDate.getMonth() === anchorDate.getMonth() &&
						targetDate.getDate() === anchorDate.getDate()
					);
				}
				default:
					return task?.date === dateStr;
			}
		}
		default:
			return task?.date === dateStr;
	}
};

export const isTaskCompletedOnDate = (task, dateStr) => {
	const repeat = task?.repeat;
	if (!repeat?.type || repeat.type === "none") {
		return !!task?.completed;
	}

	return Array.isArray(task?.completedDates)
		? task.completedDates.includes(dateStr)
		: false;
};

export const materializeTasksForDate = (tasks = [], dateStr = "") =>
	(Array.isArray(tasks) ? tasks : [])
		.filter((task) => doesTaskOccurOnDate(task, dateStr))
		.map((task) => ({
			...task,
			occurrenceDate: dateStr,
			seriesStartDate: task?.date || "",
			completed: isTaskCompletedOnDate(task, dateStr),
		}));

export const getTaskDisplayDate = (task) =>
	task?.occurrenceDate || task?.date || task?.seriesStartDate || "";
