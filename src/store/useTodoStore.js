import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { mockTodos } from "../mock/data";

const TODAY_KEY = "mb_todo_last_reset";

const todayStamp = () => new Date().toISOString().slice(0, 10);

const normalizeTodo = (row) => ({
	id: row.id,
	text: row.text,
	completed: row.completed ?? row.done ?? false,
	isFixed: row.is_fixed ?? row.is_recurring ?? false,
});

const applyLocalDailyReset = (todos) =>
	todos.filter((t) => t.isFixed).map((t) => ({ ...t, completed: false }));

export const useTodoStore = create((set, get) => ({
	todos: load("mb_todos", mockTodos).map((t) => ({
		id: t.id,
		text: t.text,
		completed: !!t.completed,
		isFixed: !!t.isFixed,
	})),
	newTodoText: "",
	newRoutineText: "",
	showAddTodo: false,

	ensureDailyReset: async () => {
		const lastReset = load(TODAY_KEY, "");
		const today = todayStamp();
		if (lastReset === today) return;

		if (!supabase) {
			const next = applyLocalDailyReset(get().todos);
			set({ todos: next });
			save("mb_todos", next);
			save(TODAY_KEY, today);
			return;
		}

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			// 일반 TODO는 하루 시작 시 초기화(삭제)합니다.
			await supabase
				.from("todos")
				.delete()
				.eq("user_id", user.id)
				.or("is_fixed.is.null,is_fixed.eq.false");

			// 고정 TODO는 다시 나타나도록 완료 상태만 리셋합니다.
			await supabase
				.from("todos")
				.update({ completed: false, done: false })
				.eq("user_id", user.id)
				.eq("is_fixed", true);

			save(TODAY_KEY, today);
		} catch (e) {
			console.warn("Daily todo reset failed:", e.message);
		}
	},

	/* DB에서 Todo 불러오기 */
	hydrateFromDB: async () => {
		await get().ensureDailyReset();
		if (!supabase) return;
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		const { data } = await supabase
			.from("todos")
			.select("*")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true });
		const todos = (data || []).map(normalizeTodo);
		set({ todos });
		save("mb_todos", todos);
	},

	toggleTodo: (id) =>
		set((s) => {
			const todos = s.todos.map((t) =>
				t.id === id ? { ...t, completed: !t.completed } : t,
			);
			save("mb_todos", todos);
			const toggled = todos.find((t) => t.id === id);
			if (supabase && toggled) {
				supabase
					.from("todos")
					.update({ completed: toggled.completed, done: toggled.completed })
					.eq("id", id)
					.then();
			}
			return { todos };
		}),

	addTodo: async (opts = {}) => {
		const safeOpts =
			opts && typeof opts === "object" && !("nativeEvent" in opts) ? opts : {};
		const { newTodoText } = get();
		const txt = (safeOpts.text ?? newTodoText).trim();
		if (!txt) return;
		const isFixed = !!safeOpts.isFixed;

		const tempId = Date.now();

		// Optimistic update: 로컬 상태를 먼저 반영
		set((s) => {
			const todos = [
				...s.todos,
				{ id: tempId, text: txt, completed: false, isFixed },
			];
			save("mb_todos", todos);
			return {
				todos,
				newTodoText: safeOpts.text ? s.newTodoText : "",
				newRoutineText: safeOpts.isFixed ? "" : s.newRoutineText,
				showAddTodo: safeOpts.text ? s.showAddTodo : false,
			};
		});

		// Supabase DB 동기화 (백그라운드)
		if (supabase) {
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					const { data, error } = await supabase
						.from("todos")
						.insert({
							user_id: user.id,
							text: txt,
							completed: false,
							done: false,
							is_fixed: isFixed,
						})
						.select("id")
						.single();
					if (!error && data) {
						// 임시 ID를 실제 UUID로 교체
						set((s) => {
							const todos = s.todos.map((t) =>
								t.id === tempId ? { ...t, id: data.id } : t,
							);
							save("mb_todos", todos);
							return { todos };
						});
					} else if (error) {
						console.warn("Todo insert failed:", error.message);
					}
				}
			} catch (e) {
				console.warn("Todo insert failed:", e?.message || e);
			}
		}
	},

	addRecurringTodo: async () => {
		const { newRoutineText, addTodo } = get();
		await addTodo({ text: newRoutineText, isFixed: true });
	},

	deleteTodo: (id) =>
		set((s) => {
			const todos = s.todos.filter((t) => t.id !== id);
			save("mb_todos", todos);
			if (supabase) {
				supabase.from("todos").delete().eq("id", id).then();
			}
			return { todos };
		}),

	archiveCompletedNonFixed: async () => {
		if (!supabase) return;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;
			await supabase
				.from("todos")
				.delete()
				.eq("user_id", user.id)
				.eq("completed", true)
				.or("is_fixed.is.null,is_fixed.eq.false");
		} catch (e) {
			console.warn("Archive completed todos failed:", e.message);
		}
	},

	setNewTodoText: (v) => set({ newTodoText: v }),
	setNewRoutineText: (v) => set({ newRoutineText: v }),
	setShowAddTodo: (v) => set({ showAddTodo: v }),

	/**
	 * AI 추천 Todo 일괄 추가
	 * @param {Array} aiTodos - [{ text: string }] 형식
	 * TODO: 추후 실시간 업데이트 예정 - 일정 변경 시 자동 재생성
	 */
	addAiTodos: async (aiTodos = []) => {
		if (!aiTodos.length) return;
		const { todos } = get();
		const existingTexts = new Set(todos.map((t) => t.text.toLowerCase()));

		for (const item of aiTodos) {
			const txt = (item.text || item).trim();
			if (!txt || existingTexts.has(txt.toLowerCase())) continue;
			await get().addTodo({ text: txt, isFixed: false });
			existingTexts.add(txt.toLowerCase());
		}
	},
}));
