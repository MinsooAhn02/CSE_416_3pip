import { CheckCircle2, X, Plus } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useTodoStore } from "../../store/useTodoStore";
import WidgetCard from "../common/WidgetCard";

const TodoWidget = () => {
	const { isDark, muted, inputCls } = useTheme();
	const {
		todos,
		newTodoText,
		showAddTodo,
		toggleTodo,
		addTodo,
		deleteTodo,
		setNewTodoText,
		setShowAddTodo,
	} = useTodoStore();

	return (
		<WidgetCard title="오늘의 할 일" icon={CheckCircle2} widgetId="todo">
			<div className="space-y-3">
				{todos.map((t) => (
					<div key={t.id} className="flex items-center gap-3 group">
						<button
							onClick={() => toggleTodo(t.id)}
							className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
								t.completed
									? "bg-blue-500 border-blue-500"
									: isDark
										? "border-white/30 hover:border-blue-400"
										: "border-gray-300 hover:border-blue-400"
							}`}
						>
							{t.completed && <CheckCircle2 size={12} className="text-white" />}
						</button>
						<span
							className={`text-sm flex-grow ${t.completed ? "line-through opacity-40" : ""}`}
						>
							{t.text}
						</span>
						<button
							onClick={() => deleteTodo(t.id)}
							className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
						>
							<X size={14} />
						</button>
					</div>
				))}
				{showAddTodo ? (
					<div className="flex items-center gap-2 mt-2">
						<input
							type="text"
							value={newTodoText}
							onChange={(e) => setNewTodoText(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && addTodo()}
							placeholder="할 일 입력..."
							autoFocus
							className={`flex-grow rounded-lg px-3 py-1.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
						/>
						<button
							onClick={addTodo}
							className="text-blue-400 text-sm font-medium"
						>
							추가
						</button>
						<button
							onClick={() => {
								setShowAddTodo(false);
								setNewTodoText("");
							}}
						>
							<X size={16} className={muted} />
						</button>
					</div>
				) : (
					<button
						onClick={() => setShowAddTodo(true)}
						className="flex items-center gap-2 text-xs text-blue-400 mt-3 hover:underline"
					>
						<Plus size={14} /> 새 할 일 추가
					</button>
				)}
			</div>
		</WidgetCard>
	);
};

export default TodoWidget;
