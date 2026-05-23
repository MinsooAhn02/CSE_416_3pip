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

const todayStamp = (): string => formatLocalDate();

export interface NormalizedTodo {
	id: string;
	text: string;
	title: string;
	completed: boolean;
	date: string;
	description: string;
	taskListId: string;
}

interface RawTask {
	id?: string;
	title?: string;
	text?: string;
	completed?: boolean;
	occurrenceDate?: string;
	date?: string;
	description?: string;
	taskListId?: string;
}

interface AddTodoOptions {
	text?: string;
	date?: string;
	description?: string;
}

export interface TodoState {
	todos: NormalizedTodo[];
	newTodoText: string;
	showAddTodo: boolean;
	ensureDailyReset: () => Promise<void>;
	hydrateFromDB: () => Promise<NormalizedTodo[]>;
	toggleTodo: (id: string) => Promise<void>;
	addTodo: (opts?: AddTodoOptions | unknown) => Promise<void>;
	deleteTodo: (id: string) => Promise<void>;
	setNewTodoText: (v: string) => void;
	setShowAddTodo: (v: boolean) => void;
}

const normalizeTaskAsTodo = (task: RawTask): NormalizedTodo => ({
	id: task.id ?? "",
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

const getCurrentTodos = (): NormalizedTodo[] => {
	const calendarState = getCalendarStoreState();
	if (!calendarState) return [];
	return materializeTasksForDate(
		(filterTasksByTaskList(
			calendarState.tasks || [],
			calendarState.selectedTaskListFilter ?? ALL_TASK_LIST_FILTER_ID,
		) as unknown) as Parameters<typeof materializeTasksForDate>[0],
		todayStamp(),
	).map(normalizeTaskAsTodo);
};

export const syncTodosFromCalendarStore = (tasksArg?: unknown[]): NormalizedTodo[] => {
	const calendarState = getCalendarStoreState();
	const tasks = (tasksArg ?? calendarState?.tasks ?? []) as RawTask[];
	const filteredTasks = filterTasksByTaskList(
		(tasks as unknown) as Parameters<typeof filterTasksByTaskList>[0],
		calendarState?.selectedTaskListFilter ?? ALL_TASK_LIST_FILTER_ID,
	);
	const todos = materializeTasksForDate(
		(filteredTasks as unknown) as Parameters<typeof materializeTasksForDate>[0],
		todayStamp(),
	).map(normalizeTaskAsTodo);
	save(TODO_CACHE_KEY, todos);
	useTodoStore.setState({ todos });
	return todos;
};

export const useTodoStore = create<TodoState>()((set, get) => ({
	todos: (load("mb_todos", []) as Array<{ id?: string; text?: string; completed?: boolean }>).map((t) => ({
		id: t.id ?? "",
		text: t.text ?? "",
		title: t.text ?? "",
		completed: !!t.completed,
		date: "",
		description: "",
		taskListId: "@default",
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
			const err = error as { message?: string };
			console.warn("Daily task sync failed:", err?.message || error);
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
			const err = error as { message?: string };
			console.warn("Task hydrate failed:", err?.message || error);
			return get().todos;
		}
	},

	toggleTodo: async (id: string) => {
		const currentTodo = get().todos.find((todo) => todo.id === id);
		if (!currentTodo) return;
		const calendarState = getCalendarStoreState();
		if (!calendarState?.updateTask) return;

		await calendarState.updateTask(id, {
			completed: !currentTodo.completed,
		});
		syncTodosFromCalendarStore();
	},

	addTodo: async (opts: AddTodoOptions | unknown = {}) => {
		const safeOpts: AddTodoOptions =
			opts && typeof opts === "object" && !("nativeEvent" in (opts as object))
				? (opts as AddTodoOptions)
				: {};
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

	deleteTodo: async (id: string) => {
		const calendarState = getCalendarStoreState();
		if (!calendarState?.deleteTask) return;
		await calendarState.deleteTask(id);
		syncTodosFromCalendarStore();
	},

	setNewTodoText: (value: string) => set({ newTodoText: value }),
	setShowAddTodo: (value: boolean) => set({ showAddTodo: value }),

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
