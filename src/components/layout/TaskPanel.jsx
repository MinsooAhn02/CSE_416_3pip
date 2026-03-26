import { useState, useEffect } from "react";
import { Plus, X, Trash2, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";
import { useGoogleCalendarStore } from "../../store/useGoogleCalendarStore";

/**
 * TaskPanel — Display and manage Google Calendar tasks for selected date
 * 
 * PHASE 10 REFINEMENTS:
 * - Add form converted to Modal
 * - List items are compact previews (title only, no emojis)
 * - Detail modal shows full content and edit/delete actions
 * - Completion toggle available in list for quick actions
 * - Progressive disclosure pattern for better UX
 * 
 * @param {{ selectedDate: string, onClose?: () => void }} props
 */
const TaskPanel = ({ selectedDate, onClose }) => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { tasks, loading, error, addTask, deleteTask, updateTask } = useGoogleCalendarStore();

	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		startTime: "",
		endTime: "",
	});

	/* REFINEMENT #5: Reset form state when selectedDate changes */
	useEffect(() => {
		setShowAddForm(false);
		setEditingId(null);
		setSelectedTaskForDetail(null);
		setFormData({ title: "", description: "", startTime: "", endTime: "" });
	}, [selectedDate]);

	/* Handle form submission for adding/updating task */
	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.title.trim()) return;

		try {
			const data = {
				...formData,
				date: selectedDate,
				completed: false,
			};

			if (editingId) {
				await updateTask(editingId, data);
				setEditingId(null);
				if (selectedTaskForDetail?.id === editingId) {
					setSelectedTaskForDetail({ ...selectedTaskForDetail, ...data });
				}
			} else {
				await addTask(data);
			}

			// Reset form
			setFormData({ title: "", description: "", startTime: "", endTime: "" });
			setShowAddForm(false);
		} catch (err) {
			console.error("Failed to save task:", err);
		}
	};

	/* Handle task completion toggle */
	const handleToggleComplete = async (task) => {
		try {
			await updateTask(task.id, { completed: !task.completed });
			if (selectedTaskForDetail?.id === task.id) {
				setSelectedTaskForDetail({ ...selectedTaskForDetail, completed: !task.completed });
			}
		} catch (err) {
			console.error("Failed to update task:", err);
		}
	};

	/* Handle delete */
	const handleDelete = async (taskId) => {
		if (!confirm("Delete this task?")) return;
		try {
			await deleteTask(taskId);
			setSelectedTaskForDetail(null);
		} catch (err) {
			console.error("Failed to delete task:", err);
		}
	};

	/* Start editing a task from detail modal */
	const handleEditFromDetail = (task) => {
		setFormData({
			title: task.title || "",
			description: task.description || "",
			startTime: task.startTime || "",
			endTime: task.endTime || "",
		});
		setEditingId(task.id);
		setShowAddForm(true);
		setSelectedTaskForDetail(null);
	};

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			{/* Header */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<CheckCircle2 size={16} className="text-green-500" />
					<h3 className="font-bold text-sm">Tasks</h3>
				</div>
				<button
					onClick={() => {
						setShowAddForm(!showAddForm);
						setEditingId(null);
						setSelectedTaskForDetail(null);
						if (!showAddForm) setFormData({ title: "", description: "", startTime: "", endTime: "" });
					}}
					className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
				>
					<Plus size={16} />
				</button>
			</div>

			{/* Loading State */}
			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
				</div>
			)}

			{/* Error State */}
			{error && !loading && (
				<div className={`p-3 rounded-lg text-xs ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
					{error}
				</div>
			)}

			{/* PHASE 10: Add Form Modal */}
			<AnimatePresence>
				{showAddForm && (
					<motion.div
						className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => {
							setShowAddForm(false);
							setEditingId(null);
							setFormData({ title: "", description: "", startTime: "", endTime: "" });
						}}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<motion.div
							className={`z-51 w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
								isDark
									? "bg-morning-dark-card border-morning-dark-hover"
									: "bg-morning-light-card border-morning-light-hover/50"
							}`}
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">{editingId ? "Edit Task" : "Add Task"}</h2>
								<button
									onClick={() => {
										setShowAddForm(false);
										setEditingId(null);
										setFormData({ title: "", description: "", startTime: "", endTime: "" });
									}}
									className={`p-1.5 rounded-lg ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
								>
									<X size={20} />
								</button>
							</div>
							<form onSubmit={handleSubmit} className="space-y-3">
								<input
									type="text"
									placeholder="Task title"
									value={formData.title}
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									required
									autoFocus
								/>
								<div className="space-y-1">
									<label className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-green-400" : "text-green-600"}`}>
										<Clock size={14} className="text-green-500" />
										Time <span className="text-xs font-normal opacity-70">(Optional)</span>
									</label>
									<div className="grid grid-cols-2 gap-3">
										{/* Start Time */}
										<div className="space-y-1">
											<label className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Start</label>
											<div className="flex items-center gap-2">
												<Clock size={16} className="text-gray-900 dark:text-white" />
												<input
													type="time"
													value={formData.startTime}
													onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
													className={`flex-1 px-2 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
												/>
											</div>
										</div>
										{/* End Time */}
										<div className="space-y-1">
											<label className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>End</label>
											<div className="flex items-center gap-2">
												<Clock size={16} className="text-gray-900 dark:text-white" />
												<input
													type="time"
													value={formData.endTime}
													onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
													className={`flex-1 px-2 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
												/>
											</div>
										</div>
									</div>
								</div>
								<textarea
									placeholder="Description (optional)"
									value={formData.description}
									onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									rows={3}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 resize-none ${inputCls}`}
								/>
								<div className="flex gap-2">
									<button
										type="submit"
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
									>
										{editingId ? "Save" : "Add"} Task
									</button>
									<button
										type="button"
										onClick={() => {
											setShowAddForm(false);
											setEditingId(null);
											setFormData({ title: "", description: "", startTime: "", endTime: "" });
										}}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-[#2a2a2a] hover:bg-[#353535]" : "bg-gray-100 hover:bg-gray-200"}`}
									>
										Cancel
									</button>
								</div>
							</form>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* PHASE 15: Compact Tasks List - Filter by selectedDate */}
			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{tasks && tasks.length > 0 ? (
					tasks.filter(task => task.date === selectedDate).map((task) => (
						<div
							key={task.id}
							className={`p-2 rounded-lg border-l-4 transition-colors ${
								task.completed 
									? "border-gray-400 opacity-60" 
									: "border-green-500"
							} ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
						>
							<div className="flex items-center justify-between gap-2">
								<button
									onClick={() => handleToggleComplete(task)}
									className={`flex-shrink-0 p-1 rounded transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-200"}`}
									title={task.completed ? "Mark incomplete" : "Mark complete"}
								>
									<CheckCircle2
										size={18}
										className={task.completed ? "text-green-500" : "opacity-40"}
									/>
								</button>
								<div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedTaskForDetail(task)}>
									<h4 className={`font-semibold text-xs ${task.completed ? "line-through opacity-50" : ""}`}>
										{task.title}
									</h4>
									{(task.startTime || task.endTime) && (
										<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : (task.startTime || task.endTime)}
										</p>
									)}
								</div>
								<ChevronRight size={16} className="flex-shrink-0 opacity-50" />
							</div>
						</div>
					))
				) : !loading && !error ? (
				<div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 font-medium">No tasks</div>
			) : null}
			</div>

			{/* PHASE 10: Task Detail Modal */}
			<AnimatePresence>
				{selectedTaskForDetail && (
					<motion.div
						className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => setSelectedTaskForDetail(null)}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<motion.div
							className={`z-51 w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
								isDark
									? "bg-morning-dark-card border-morning-dark-hover"
									: "bg-morning-light-card border-morning-light-hover/50"
							}`}
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<button
										onClick={() => handleToggleComplete(selectedTaskForDetail)}
										className={`p-1 rounded transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-200"}`}
									>
										<CheckCircle2
											size={20}
											className={selectedTaskForDetail.completed ? "text-green-500" : "opacity-40"}
										/>
									</button>
									<h2 className={`font-bold text-lg ${selectedTaskForDetail.completed ? "line-through opacity-50" : ""}`}>
										{selectedTaskForDetail.title}
									</h2>
								</div>
								<button
									onClick={() => setSelectedTaskForDetail(null)}
									className={`p-1.5 rounded-lg ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
								>
									<X size={20} />
								</button>
							</div>
							<div className="space-y-3 text-sm">
								{(selectedTaskForDetail.startTime || selectedTaskForDetail.endTime) && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Time</p>
										<p>
											{selectedTaskForDetail.startTime && selectedTaskForDetail.endTime 
												? `${selectedTaskForDetail.startTime} - ${selectedTaskForDetail.endTime}`
												: (selectedTaskForDetail.startTime || selectedTaskForDetail.endTime)
											}
										</p>
									</div>
								)}
								{selectedTaskForDetail.description && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Description</p>
										<p className={isDark ? "text-gray-300" : "text-gray-700"}>{selectedTaskForDetail.description}</p>
									</div>
								)}
							</div>
							<div className="flex gap-2 pt-4 border-t">
								<button
									onClick={() => handleEditFromDetail(selectedTaskForDetail)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" : "bg-blue-100 hover:bg-blue-200 text-blue-600"}`}
								>
									Edit
								</button>
								<button
									onClick={() => handleDelete(selectedTaskForDetail.id)}
									className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400"
								>
									Delete
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default TaskPanel;
