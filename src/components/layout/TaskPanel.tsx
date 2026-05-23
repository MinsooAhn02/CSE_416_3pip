import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
	CheckCircle2,
	ChevronRight,
	FolderOpen,
	Plus,
	RefreshCw,
	X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import {
	ALL_TASK_LIST_FILTER_ID,
	GOOGLE_SYNC_AUTH_ERROR,
	filterTasksByTaskList,
	useGoogleCalendarStore,
} from "../../store/useGoogleCalendarStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
	getTaskDisplayDate,
	materializeTasksForDate,
	type TaskLike,
} from "../../utils/taskRecurrence";
import ConfirmDialog from "../common/ConfirmDialog";
import type { Task } from "../../store/useGoogleCalendarStore";

interface TaskPanelProps {
	selectedDate: string;
}

interface TaskList {
	id: string;
	title: string;
}

interface FormData {
	title: string;
	description: string;
	taskListId: string;
}

const FALLBACK_DISPLAY_LIST_ID = "@default";

const EMPTY_FORM: FormData = {
	title: "",
	description: "",
	taskListId: FALLBACK_DISPLAY_LIST_ID,
};

const getLocaleTag = (language: string) => (language === "ko" ? "ko-KR" : "en-US");

const formatDisplayDate = (dateStr: string, language: string, options: Intl.DateTimeFormatOptions = {}) => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	if (Number.isNaN(date.getTime())) return dateStr;
	return date.toLocaleDateString(getLocaleTag(language), {
		year: "numeric",
		month: "long",
		day: "numeric",
		...options,
	});
};

interface TaskTitleProps {
	title: string;
	noTitleLabel: string;
}

const TaskTitle = ({ title, noTitleLabel }: TaskTitleProps) =>
	!title || title === "(no title)" ? (
		<span className="opacity-40 italic">{noTitleLabel}</span>
	) : (
		<>{title}</>
	);

const formDataFromTask = (task: Task): FormData => ({
	title: task.title === "(no title)" ? "" : task.title || "",
	description: task.description || "",
	taskListId: task.taskListId || FALLBACK_DISPLAY_LIST_ID,
});

const TaskPanel = ({ selectedDate }: TaskPanelProps) => {
	const { t, i18n } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls } = useTheme();
	const {
		tasks,
		taskLists,
		selectedTaskListFilter,
		loading,
		error,
		addTask,
		createTaskList,
		deleteTask,
		updateTask,
		fetchTaskLists,
		setSelectedTaskListFilter,
	} = useGoogleCalendarStore();
	const reconnectGoogle = useAuthStore((s) => s.reconnectGoogle);

	const modalCardCls = isDark
		? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-card border-morning-light-hover/50 text-morning-light-text";
	const modalSecondaryBtnCls = isDark
		? "bg-morning-dark-cardSecondary hover:bg-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-cardSecondary hover:bg-morning-light-hover/70 text-morning-light-text";
	const secondarySurfaceCls = isDark
		? "bg-morning-dark-cardSecondary border-morning-dark-hover text-gray-200"
		: "bg-morning-light-cardSecondary border-morning-light-hover/60 text-gray-700";

	const [showAddForm, setShowAddForm] = useState<boolean>(false);
	const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTaskDate, setEditingTaskDate] = useState<string>("");
	const [createTaskListTarget, setCreateTaskListTarget] = useState<string | null>(null);
	const [newTaskListTitle, setNewTaskListTitle] = useState<string>("");
	const [isCreatingTaskList, setIsCreatingTaskList] = useState<boolean>(false);
	const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
	const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

	const showReconnectGoogle = error === GOOGLE_SYNC_AUTH_ERROR;
	const fallbackDisplayList: TaskList = {
		id: FALLBACK_DISPLAY_LIST_ID,
		title: t("tasks.default_list"),
	};
	const displayLists: TaskList[] = taskLists?.length > 0 ? taskLists : [fallbackDisplayList];
	const hasRealTaskLists =
		Array.isArray(taskLists) &&
		taskLists.length > 0 &&
		taskLists.some((list: TaskList) => list?.id && list.id !== "@default");
	const defaultDisplayList =
		displayLists.find((list: TaskList) => list?.id && list.id !== "@default") ||
		displayLists[0] ||
		fallbackDisplayList;
	const filteredTasks = useMemo(
		() => filterTasksByTaskList(tasks, selectedTaskListFilter),
		[tasks, selectedTaskListFilter],
	);
	const selectedTasks = useMemo(
		() =>
			([...materializeTasksForDate(filteredTasks as unknown as TaskLike[], selectedDate)].sort((left, right) => {
				if (Number(left.completed) !== Number(right.completed)) {
					return Number(left.completed) - Number(right.completed);
				}
				return String(left.title || left.text || "").localeCompare(
					String(right.title || right.text || ""),
				);
			})) as unknown as Task[],
		[filteredTasks, selectedDate],
	);
	const taskListFilterOptions = useMemo(
		() => [
			{
				id: ALL_TASK_LIST_FILTER_ID,
				title: t("tasks.all_tasks"),
			},
			...displayLists,
		],
		[displayLists, t],
	);
	const resolvedSelectedTaskListFilter = taskListFilterOptions.some(
		(list: TaskList) => list.id === selectedTaskListFilter,
	)
		? selectedTaskListFilter
		: ALL_TASK_LIST_FILTER_ID;
	const resolvedFormTaskListId =
		hasRealTaskLists &&
		formData.taskListId === "@default" &&
		selectedTaskListFilter !== ALL_TASK_LIST_FILTER_ID
			? selectedTaskListFilter
			: hasRealTaskLists && formData.taskListId === "@default"
				? defaultDisplayList.id
				: formData.taskListId || defaultDisplayList.id || "@default";

	const getEmptyForm = (): FormData => ({
		...EMPTY_FORM,
		taskListId:
			hasRealTaskLists && selectedTaskListFilter !== ALL_TASK_LIST_FILTER_ID
				? selectedTaskListFilter
				: defaultDisplayList.id || "@default",
	});

	const resetForm = () => {
		setFormData(getEmptyForm());
		setEditingId(null);
		setEditingTaskDate("");
		setCreateTaskListTarget(null);
		setNewTaskListTitle("");
		setIsCreatingTaskList(false);
	};

	const getTaskListTitle = (taskListId: string) => {
		const normalizedId = String(taskListId || "").trim();
		if (!normalizedId || normalizedId === "@default") {
			return defaultDisplayList.title || fallbackDisplayList.title;
		}
		return displayLists.find((list: TaskList) => list.id === normalizedId)?.title || normalizedId;
	};

	const openCreateTaskListModal = (target = "form") => {
		setCreateTaskListTarget(target);
		setNewTaskListTitle("");
	};

	const handleCreateTaskList = async () => {
		const trimmedTitle = String(newTaskListTitle || "").trim();
		if (!trimmedTitle) return;

		try {
			setIsCreatingTaskList(true);
			const createdList = await createTaskList(trimmedTitle);
			if (!createdList?.id) return;

			setFormData((prev) => ({ ...prev, taskListId: createdList.id }));
			setCreateTaskListTarget(null);
			setNewTaskListTitle("");
		} catch (err: unknown) {
			console.error("Failed to create task list:", (err as Error).message);
		} finally {
			setIsCreatingTaskList(false);
		}
	};

	const handleReconnectGoogle = async () => {
		setIsReconnecting(true);
		try {
			await reconnectGoogle();
		} catch (err: unknown) {
			console.error("Failed to reconnect Google:", (err as Error).message);
		} finally {
			setIsReconnecting(false);
		}
	};

	useEffect(() => {
		fetchTaskLists();
	}, []);

	useEffect(() => {
		setShowAddForm(false);
		setSelectedTaskForDetail(null);
		resetForm();
	}, [selectedDate]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const data = {
				title: formData.title.trim() || "(no title)",
				description: formData.description,
				date: editingTaskDate || selectedDate,
				taskListId: resolvedFormTaskListId || "@default",
			};

			if (editingId) {
				await updateTask(editingId, data);
				setEditingId(null);
				if (selectedTaskForDetail?.id === editingId) {
					setSelectedTaskForDetail({ ...selectedTaskForDetail, ...data });
				}
			} else {
				await addTask({ ...data, completed: false });
			}

			resetForm();
			setShowAddForm(false);
		} catch (err: unknown) {
			console.error("Failed to save task:", (err as Error).message);
		}
	};

	const handleToggleComplete = async (task: Task) => {
		try {
			await updateTask(task.id!, {
				completed: !task.completed,
			});
			if (selectedTaskForDetail?.id === task.id) {
				setSelectedTaskForDetail({ ...selectedTaskForDetail, completed: !task.completed } as Task);
			}
		} catch (err: unknown) {
			console.error("Failed to update task:", (err as Error).message);
		}
	};

	const handleDelete = (taskId: string) => setConfirmDelete(taskId);

	const handleConfirmDelete = async () => {
		try {
			await deleteTask(confirmDelete!);
			setSelectedTaskForDetail(null);
		} catch (err: unknown) {
			console.error("Failed to delete task:", (err as Error).message);
		} finally {
			setConfirmDelete(null);
		}
	};

	const handleEditFromDetail = (task: Task) => {
		setFormData(formDataFromTask(task));
		setEditingTaskDate(getTaskDisplayDate(task as unknown as TaskLike) || selectedDate);
		setEditingId(task.id!);
		setShowAddForm(true);
		setSelectedTaskForDetail(null);
	};

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<CheckCircle2 size={16} className="text-green-500" />
					<h3 className="font-bold text-sm">{t("tasks.title")}</h3>
				</div>
				<button
					onClick={() => {
						const nextOpen = !showAddForm;
						setShowAddForm(nextOpen);
						setSelectedTaskForDetail(null);
						if (!nextOpen) resetForm();
						else if (!editingId) setFormData(getEmptyForm());
					}}
					className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
				>
					<Plus size={16} />
				</button>
			</div>

			<div className="space-y-1">
				<div className="flex items-center gap-2 pr-3">
					<FolderOpen size={12} className={isDark ? "text-gray-400" : "text-gray-500"} />
					<select
						value={resolvedSelectedTaskListFilter}
						onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTaskListFilter(e.target.value)}
						className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
					>
						{taskListFilterOptions.map((list: TaskList) => (
							<option key={list.id} value={list.id}>
								{list.title}
							</option>
						))}
					</select>
				</div>
			</div>

			{loading && (
				<div className="flex items-center justify-center py-6">
					<div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
				</div>
			)}

			{error && !loading && (
				<div
					className={`p-3 rounded-lg text-xs space-y-2 ${
						isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
					}`}
				>
					<p>{error}</p>
					{showReconnectGoogle && (
						<button
							type="button"
							onClick={handleReconnectGoogle}
							disabled={isReconnecting}
							className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
								isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-red-700 hover:bg-red-100"
							}`}
						>
							<RefreshCw size={12} className={isReconnecting ? "animate-spin" : ""} />
							{isReconnecting ? t("common.reconnecting") : t("common.reconnect_google")}
						</button>
					)}
				</div>
			)}

			{showAddForm &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => {
							setShowAddForm(false);
							resetForm();
						}}
					>
						<div
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto ${modalCardCls}`}
							onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">
									{editingId ? t("tasks.edit_task") : t("tasks.add_task")}
								</h2>
								<button
									onClick={() => {
										setShowAddForm(false);
										resetForm();
									}}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-3">
								<input
									type="text"
									placeholder={t("tasks.task_title_optional")}
									value={formData.title}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									autoFocus
								/>

								<div className="space-y-1">
									<label
										className={`text-xs font-medium ${
											isDark ? "text-green-400" : "text-green-600"
										}`}
									>
										{t("common.date")}
									</label>
									<div className={`w-full rounded-lg border px-3 py-2 text-sm ${secondarySurfaceCls}`}>
										{editingTaskDate || selectedDate}
									</div>
								</div>

								<div className="space-y-1">
									<label
										className={`text-xs font-medium ${
											isDark ? "text-green-400" : "text-green-600"
										}`}
									>
										{t("common.description")}
									</label>
									<textarea
										placeholder={t("tasks.details_optional")}
										value={formData.description}
										onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
											setFormData({ ...formData, description: e.target.value })
										}
										rows={4}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 resize-none ${inputCls}`}
									/>
								</div>

								<div className="space-y-1 pr-3">
									<div className="flex items-center justify-between gap-3">
										<label
											className={`text-xs font-medium flex items-center gap-1 ${
												isDark ? "text-green-400" : "text-green-600"
											}`}
										>
											<FolderOpen size={12} />
											{t("common.list")}
										</label>
										<button
											type="button"
											onClick={() => openCreateTaskListModal("form")}
											className={`text-xs font-medium transition-colors ${
												isDark ? "text-green-300 hover:text-green-200" : "text-green-700 hover:text-green-800"
											}`}
										>
											{t("tasks.create_new_list")}
										</button>
									</div>
									<select
										value={resolvedFormTaskListId}
										onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
											setFormData({ ...formData, taskListId: e.target.value })
										}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									>
										{displayLists.map((list: TaskList) => (
											<option key={list.id} value={list.id}>
												{list.title}
											</option>
										))}
									</select>
								</div>

								<div className="flex gap-2">
									<button
										type="submit"
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
									>
										{editingId ? t("common.save") : t("tasks.add_task")}
									</button>
									<button
										type="button"
										onClick={() => {
											setShowAddForm(false);
											resetForm();
										}}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modalSecondaryBtnCls}`}
									>
										{t("common.cancel")}
									</button>
								</div>
							</form>
						</div>
					</div>,
					document.body,
				)}

			{createTaskListTarget &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[23000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
						onClick={() => {
							if (isCreatingTaskList) return;
							setCreateTaskListTarget(null);
							setNewTaskListTitle("");
						}}
					>
						<div
							className={`z-[23010] w-full max-w-xs rounded-2xl border-2 shadow-2xl p-5 space-y-4 ${modalCardCls}`}
							onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between gap-3">
								<h2 className="font-bold text-base">{t("tasks.create_list")}</h2>
								<button
									type="button"
									onClick={() => {
										if (isCreatingTaskList) return;
										setCreateTaskListTarget(null);
										setNewTaskListTitle("");
									}}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={18} />
								</button>
							</div>
							<form
								className="space-y-3"
								onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
									e.preventDefault();
									void handleCreateTaskList();
								}}
							>
								<input
									type="text"
									value={newTaskListTitle}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskListTitle(e.target.value)}
									placeholder={t("tasks.list_name")}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									autoFocus
								/>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={isCreatingTaskList || !newTaskListTitle.trim()}
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-60"
									>
										{isCreatingTaskList ? t("tasks.creating") : t("common.create")}
									</button>
									<button
										type="button"
										disabled={isCreatingTaskList}
										onClick={() => {
											setCreateTaskListTarget(null);
											setNewTaskListTitle("");
										}}
										className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${modalSecondaryBtnCls}`}
									>
										{t("common.cancel")}
									</button>
								</div>
							</form>
						</div>
					</div>,
					document.body,
				)}

			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{selectedTasks.length > 0 ? (
					selectedTasks.map((task) => (
						<div
							key={task.id}
							className={`p-2 rounded-lg border-l-4 transition-colors ${
								task.completed ? "border-gray-400 opacity-60" : "border-green-500"
							} ${hoverCls}`}
						>
							<div className="flex items-center justify-between gap-2">
								<button
									onClick={() => handleToggleComplete(task)}
									className={`flex-shrink-0 p-1 rounded transition-colors ${hoverCls}`}
									title={task.completed ? t("tasks.mark_incomplete") : t("tasks.mark_complete")}
								>
									<CheckCircle2
										size={18}
										className={task.completed ? "text-green-500" : "opacity-40"}
									/>
								</button>
								<div
									className="flex-1 min-w-0 cursor-pointer"
									onClick={() => setSelectedTaskForDetail(task)}
								>
									<h4
										className={`font-semibold text-xs ${
											task.completed ? "line-through opacity-50" : ""
										}`}
									>
										<TaskTitle title={task.title} noTitleLabel={t("common.no_title")} />
									</h4>
									{task.description && (
										<p className={`text-xs truncate ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{task.description}
										</p>
									)}
								</div>
								<ChevronRight size={16} className="flex-shrink-0 opacity-50" />
							</div>
						</div>
					))
				) : !loading && !error ? (
					<div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 font-medium">
						{t("tasks.no_tasks")}
					</div>
				) : null}
			</div>

			{selectedTaskForDetail &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[22000] bg-black/60 backdrop-blur-md flex items-center justify-center"
						onClick={() => setSelectedTaskForDetail(null)}
					>
						<div
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${modalCardCls}`}
							onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<button
										onClick={() => handleToggleComplete(selectedTaskForDetail)}
										className={`p-1 rounded transition-colors ${hoverCls}`}
									>
										<CheckCircle2
											size={20}
											className={selectedTaskForDetail.completed ? "text-green-500" : "opacity-40"}
										/>
									</button>
									<h2
										className={`font-bold text-lg ${
											selectedTaskForDetail.completed ? "line-through opacity-50" : ""
										}`}
									>
										<TaskTitle
											title={selectedTaskForDetail.title}
											noTitleLabel={t("common.no_title")}
										/>
									</h2>
								</div>
								<button
									onClick={() => setSelectedTaskForDetail(null)}
									className={`p-1.5 rounded-lg ${hoverCls}`}
								>
									<X size={20} />
								</button>
							</div>

							<div className="space-y-3 text-sm">
								<div>
									<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
										{t("common.date")}
									</p>
									<p>
										{formatDisplayDate(getTaskDisplayDate(selectedTaskForDetail as unknown as TaskLike), i18n.language, {
											weekday: "short",
										})}
									</p>
								</div>

								{selectedTaskForDetail.taskListId && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{t("common.list")}
										</p>
										<p>{getTaskListTitle(selectedTaskForDetail.taskListId)}</p>
									</div>
								)}

								{selectedTaskForDetail.description && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{t("common.description")}
										</p>
										<p className={isDark ? "text-gray-300" : "text-gray-700"}>
											{selectedTaskForDetail.description}
										</p>
									</div>
								)}
							</div>

							<div className="flex gap-2 pt-4 border-t">
								<button
									onClick={() => handleEditFromDetail(selectedTaskForDetail)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
										isDark ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" : "bg-blue-100 hover:bg-blue-200 text-blue-600"
									}`}
								>
									{t("common.edit")}
								</button>
								<button
									onClick={() => handleDelete(selectedTaskForDetail.id!)}
									className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400"
								>
									{t("common.delete")}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{confirmDelete && (
				<ConfirmDialog
					title={t("tasks.delete_task")}
					message={t("tasks.delete_task_confirm")}
					confirmLabel={t("common.delete")}
					cancelLabel={t("common.cancel")}
					onConfirm={handleConfirmDelete}
					onCancel={() => setConfirmDelete(null)}
				/>
			)}
		</div>
	);
};

export default TaskPanel;
