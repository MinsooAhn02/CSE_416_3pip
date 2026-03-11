import { create } from "zustand";
import { load, save } from "../utils/storage";
import { mockTodos } from "../mock/data";

export const useTodoStore = create((set, get) => ({
	todos: load("mb_todos", mockTodos),
	newTodoText: "",
	showAddTodo: false,

	toggleTodo: (id) =>
		set((s) => {
			const todos = s.todos.map((t) =>
				t.id === id ? { ...t, completed: !t.completed } : t,
			);
			save("mb_todos", todos);
			return { todos };
		}),
	addTodo: () => {
		const { newTodoText } = get();
		const txt = newTodoText.trim();
		if (!txt) return;
		set((s) => {
			const todos = [
				...s.todos,
				{ id: Date.now(), text: txt, completed: false },
			];
			save("mb_todos", todos);
			return { todos, newTodoText: "", showAddTodo: false };
		});
	},
	deleteTodo: (id) =>
		set((s) => {
			const todos = s.todos.filter((t) => t.id !== id);
			save("mb_todos", todos);
			return { todos };
		}),
	setNewTodoText: (v) => set({ newTodoText: v }),
	setShowAddTodo: (v) => set({ showAddTodo: v }),
}));
