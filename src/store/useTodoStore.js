import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { formatLocalDate } from "../utils/date";
import { materializeTasksForDate } from "../utils/taskRecurrence";
import {
	useGoogleCalendarStore,
	filterTasksByTaskList,
	ALL_TASK_LIST_FILTER_ID,
} from "./useGoogleCalendarStore";

const TODAY_KEY = "mb_task_last_reset";
const TODO_CACHE_KEY = "mb_todos";

const todayStamp = () => formatLocalDate();

const normalizeTaskAsTodo = (task) => ({
	id: task.id,
	text: task.title || task.text || "",
	title: task.title || task.text || "",
	completed: !!task.completed,
	date: task.occurrenceDate || task.date || "",
	description: task.description || "",
	taskListId: task.taskListId || "@default",
});

const getCalendarStoreState = () => {
	if (
		typeof useGoogleCalendarStore === "undefined" ||
		typeof useGoogleCalendarStore?.getState !== "function"
	) {
		return null;
	}
	return useGoogleCalendarStore.getState();
};

const getCurrentTodos = () => {
	const calendarState = getCalendarStoreState();
	if (!calendarState) return [];
	return materializeTasksForDate(
		filterTasksByTaskList(
			calendarState.tasks || [],
			calendarState.selectedTaskListFilter ?? ALL_TASK_LIST_FILTER_ID,
		),
		todayStamp(),
	).map(normalizeTaskAsTodo);
};

const syncTodosFromCalendarStore = (tasksArg) => {
	const calendarState = getCalendarStoreState();
	const tasks = tasksArg ?? calendarState?.tasks ?? [];
	const filteredTasks = filterTasksByTaskList(
		tasks || [],
		calendarState?.selectedTaskListFilter ?? ALL_TASK_LIST_FILTER_ID,
	);
	const todos = materializeTasksForDate(filteredTasks, todayStamp()).map(normalizeTaskAsTodo);
	save(TODO_CACHE_KEY, todos);
	useTodoStore.setState({ todos });
	return todos;
};

export const useTodoStore = create((set, get) => ({
	todos: load("mb_todos", []).map((t) => ({
		id: t.id,
		text: t.text,
		completed: !!t.completed,
	})),
	newTodoText: "",
	showAddTodo: false,

	ensureDailyReset: async () => {
		try {
			const lastReset = load(TODAY_KEY, "");
			const today = todayStamp();
			if (lastReset === today) return;

			const calendarState = getCalendarStoreState();
			if (calendarState && (calendarState.tasks || []).length === 0) {
				await calendarState.fetchTasks?.({ skipLoading: true });
			}

			save(TODAY_KEY, today);
			syncTodosFromCalendarStore();
		} catch (error) {
			console.warn("Daily task sync failed:", error?.message || error);
		}
	},

	hydrateFromDB: async () => {
		try {
			const calendarState = getCalendarStoreState();
			await calendarState?.fetchTasks?.({ skipLoading: true });
			syncTodosFromCalendarStore();
			await get().ensureDailyReset();
			return get().todos;
		} catch (error) {
			console.warn("Task hydrate failed:", error?.message || error);
			return get().todos;
		}
	},

	toggleTodo: async (id) => {
		const currentTodo = get().todos.find((todo) => todo.id === id);
		if (!currentTodo) return;
		const calendarState = getCalendarStoreState();
		if (!calendarState?.updateTask) return;

		await calendarState.updateTask(id, {
			completed: !currentTodo.completed,
		});
		syncTodosFromCalendarStore();
	},

	addTodo: async (opts = {}) => {
		const safeOpts =
			opts && typeof opts === "object" && !("nativeEvent" in opts) ? opts : {};
		const { newTodoText } = get();
		const text = (safeOpts.text ?? newTodoText).trim();
		if (!text) return;

		const date = safeOpts.date || todayStamp();
		const calendarState = getCalendarStoreState();
		if (!calendarState?.addTask) return;

		await calendarState.addTask({
			title: text,
			description: safeOpts.description || "",
			date,
			completed: false,
			taskListId:
				calendarState.selectedTaskListFilter !== ALL_TASK_LIST_FILTER_ID
					? calendarState.selectedTaskListFilter
					: undefined,
		});

		syncTodosFromCalendarStore();
		set((state) => ({
			newTodoText: safeOpts.text ? state.newTodoText : "",
			showAddTodo: safeOpts.text ? state.showAddTodo : false,
		}));
	},

	deleteTodo: async (id) => {
		const calendarState = getCalendarStoreState();
		if (!calendarState?.deleteTask) return;
		await calendarState.deleteTask(id);
		syncTodosFromCalendarStore();
	},

	setNewTodoText: (value) => set({ newTodoText: value }),
	setShowAddTodo: (value) => set({ showAddTodo: value }),

}));

if (
	typeof useGoogleCalendarStore !== "undefined" &&
	typeof useGoogleCalendarStore?.subscribe === "function"
) {
	useGoogleCalendarStore.subscribe((state, previousState) => {
		if (
			state.tasks !== previousState.tasks ||
			state.selectedTaskListFilter !== previousState.selectedTaskListFilter
		) {
			syncTodosFromCalendarStore(state.tasks);
		}
	});
}
