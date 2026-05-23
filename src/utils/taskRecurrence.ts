export interface TaskLike {
	date?: string;
	due?: string;
	occurrenceDate?: string;
	seriesStartDate?: string;
	completed?: boolean;
	[key: string]: unknown;
}

const resolveTaskDate = (task: TaskLike): string =>
	String(task?.date || task?.due || task?.occurrenceDate || task?.seriesStartDate || "")
		.trim()
		.slice(0, 10);

export const doesTaskOccurOnDate = (task: TaskLike, dateStr: string): boolean =>
	resolveTaskDate(task) === String(dateStr || "").trim();

export const isTaskCompletedOnDate = (task: TaskLike, dateStr: string): boolean =>
	doesTaskOccurOnDate(task, dateStr) ? !!task?.completed : false;

export const materializeTasksForDate = (
	tasks: TaskLike[] = [],
	dateStr = "",
): (TaskLike & { occurrenceDate: string; seriesStartDate: string; completed: boolean })[] =>
	(Array.isArray(tasks) ? tasks : [])
		.filter((task) => doesTaskOccurOnDate(task, dateStr))
		.map((task) => ({
			...task,
			occurrenceDate: resolveTaskDate(task),
			seriesStartDate: resolveTaskDate(task),
			completed: !!task?.completed,
		}));

export const getTaskDisplayDate = (task: TaskLike): string => resolveTaskDate(task);
