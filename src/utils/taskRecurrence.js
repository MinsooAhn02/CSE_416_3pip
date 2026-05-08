const resolveTaskDate = (task) =>
	String(task?.date || task?.due || task?.occurrenceDate || task?.seriesStartDate || "")
		.trim()
		.slice(0, 10);

export const doesTaskOccurOnDate = (task, dateStr) =>
	resolveTaskDate(task) === String(dateStr || "").trim();

export const isTaskCompletedOnDate = (task, dateStr) =>
	doesTaskOccurOnDate(task, dateStr) ? !!task?.completed : false;

export const materializeTasksForDate = (tasks = [], dateStr = "") =>
	(Array.isArray(tasks) ? tasks : [])
		.filter((task) => doesTaskOccurOnDate(task, dateStr))
		.map((task) => ({
			...task,
			occurrenceDate: resolveTaskDate(task),
			seriesStartDate: resolveTaskDate(task),
			completed: !!task?.completed,
		}));

export const getTaskDisplayDate = (task) => resolveTaskDate(task);
