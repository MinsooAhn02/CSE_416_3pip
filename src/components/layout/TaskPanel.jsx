import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, X, CheckCircle2, ChevronRight, RefreshCw, Repeat, Calendar, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import {
	ALL_TASK_LIST_FILTER_ID,
	GOOGLE_SYNC_AUTH_ERROR,
	filterTasksByTaskList,
	useGoogleCalendarStore,
} from "../../store/useGoogleCalendarStore";
import { useAuthStore } from "../../store/useAuthStore";
import { getTaskDisplayDate, materializeTasksForDate } from "../../utils/taskRecurrence";
import ConfirmDialog from "../common/ConfirmDialog";
import TimeInput from "../common/TimeInput";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const getTaskRepeatLocale = (language = "en") =>
	language === "ko"
		? {
				dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
				monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
				ordinals: ["첫째", "둘째", "셋째", "넷째", "다섯째"],
				weekDaysShort: [
					{ code: "MO", label: "월" },
					{ code: "TU", label: "화" },
					{ code: "WE", label: "수" },
					{ code: "TH", label: "목" },
					{ code: "FR", label: "금" },
					{ code: "SA", label: "토" },
					{ code: "SU", label: "일" },
				],
				repeatNone: "반복 안 함",
				repeatDaily: "매일",
				repeatWeekly: (dayName) => `매주 ${dayName}`,
				repeatMonthly: (ordinal, dayName) => `매월 ${ordinal} ${dayName}`,
				repeatYearly: (monthName, dayOfMonth) => `매년 ${monthName} ${dayOfMonth}일`,
				repeatWeekdays: "매주 평일",
				repeatCustom: "사용자 지정...",
				every: "매",
				on: "요일",
				customIntervalLabel: (freq, interval) => {
					if (freq === "daily") return interval === 1 ? "매일" : `매 ${interval}일`;
					if (freq === "weekly") return interval === 1 ? "매주" : `매 ${interval}주`;
					if (freq === "monthly") return interval === 1 ? "매월" : `매 ${interval}개월`;
					return interval === 1 ? "매년" : `매 ${interval}년`;
				},
		}
		: {
				dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
				monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
				ordinals: ["first", "second", "third", "fourth", "fifth"],
				weekDaysShort: [
					{ code: "MO", label: "Mon" },
					{ code: "TU", label: "Tue" },
					{ code: "WE", label: "Wed" },
					{ code: "TH", label: "Thu" },
					{ code: "FR", label: "Fri" },
					{ code: "SA", label: "Sat" },
					{ code: "SU", label: "Sun" },
				],
				repeatNone: "Does not repeat",
				repeatDaily: "Daily",
				repeatWeekly: (dayName) => `Weekly on ${dayName}`,
				repeatMonthly: (ordinal, dayName) => `Monthly on the ${ordinal} ${dayName}`,
				repeatYearly: (monthName, dayOfMonth) => `Annually on ${monthName} ${dayOfMonth}`,
				repeatWeekdays: "Every weekday (Monday to Friday)",
				repeatCustom: "Custom...",
				every: "Every",
				on: "On",
				customIntervalLabel: (freq, interval) => {
					const unit =
						freq === "daily"
							? "day"
							: freq === "weekly"
								? "week"
								: freq === "monthly"
									? "month"
									: "year";
					return `Every ${interval > 1 ? `${interval} ${unit}s` : unit}`;
				},
		};

const getRepeatOptions = (dateStr, language = "en") => {
	const locale = getTaskRepeatLocale(language);
	const fallback = [{ value: "none", label: locale.repeatNone }];
	if (!dateStr) return fallback;

	const date = new Date(`${dateStr}T00:00:00`);
	if (isNaN(date.getTime())) return fallback;

	const dayName = locale.dayNames[date.getDay()];
	const monthName = locale.monthNames[date.getMonth()];
	const dayOfMonth = date.getDate();
	const weekOfMonth = Math.ceil(dayOfMonth / 7);
	const ordinal = locale.ordinals[Math.min(weekOfMonth - 1, 4)];

	return [
		{ value: "none", label: locale.repeatNone },
		{ value: "daily", label: locale.repeatDaily },
		{ value: "weekly", label: locale.repeatWeekly(dayName) },
		{ value: "monthly", label: locale.repeatMonthly(ordinal, dayName) },
		{ value: "yearly", label: locale.repeatYearly(monthName, dayOfMonth) },
		{ value: "weekdays", label: locale.repeatWeekdays },
		{ value: "custom", label: locale.repeatCustom },
	];
};

const getRepeatLabel = (task, dateStr, language = "en") => {
	const locale = getTaskRepeatLocale(language);
	const repeat = task?.repeat;
	if (!repeat || !repeat.type || repeat.type === "none") return "";

	if (repeat.type === "custom") {
		const freq = repeat.frequency || "weekly";
		const interval = Number(repeat.interval || 1);
		const days = Array.isArray(repeat.daysOfWeek) ? repeat.daysOfWeek : [];
		if (freq === "weekly" && days.length > 0) {
			const dayLabels = days.map((code) => {
				const idx = DAY_CODES.indexOf(code);
				return idx >= 0 ? locale.weekDaysShort.find((day) => day.code === code)?.label || code : code;
			});
			return language === "ko"
				? `${interval === 1 ? "매주" : `매 ${interval}주`} ${dayLabels.join(", ")}`
				: `Every ${interval > 1 ? `${interval} weeks` : "week"} on ${dayLabels.join(", ")}`;
		}
		return locale.customIntervalLabel(freq, interval);
	}

	const options = getRepeatOptions(dateStr, language);
	return options.find((o) => o.value === repeat.type)?.label || "";
};

const FALLBACK_DISPLAY_LIST_ID = "@default";

const EMPTY_FORM = {
	title: "",
	description: "",
	time: "",
	allDay: false,
	deadline: "",
	taskListId: FALLBACK_DISPLAY_LIST_ID,
	repeatType: "none",
	customFreq: "weekly",
	customInterval: "1",
	customDays: [],
};

const getRoundedDefaultTaskTime = (baseDate = new Date()) => {
	const rounded = new Date(baseDate);
	rounded.setSeconds(0, 0);
	const roundedMinutes = Math.ceil(rounded.getMinutes() / 30) * 30;
	if (roundedMinutes === 60) {
		rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
	} else {
		rounded.setMinutes(roundedMinutes, 0, 0);
	}
	return `${String(rounded.getHours()).padStart(2, "0")}:${String(
		rounded.getMinutes(),
	).padStart(2, "0")}`;
};

const buildRepeatObject = (formData) => {
	if (formData.repeatType === "none") return null;
	if (formData.repeatType !== "custom") return { type: formData.repeatType };
	return {
		type: "custom",
		frequency: formData.customFreq,
		interval: Number(formData.customInterval) || 1,
		daysOfWeek: formData.customDays,
	};
};

const formDataFromTask = (task) => {
	const repeat = task?.repeat || null;
	let repeatType = "none";
	let customFreq = "weekly";
	let customInterval = "1";
	let customDays = [];

	if (repeat && repeat.type) {
		repeatType = repeat.type;
		if (repeat.type === "custom") {
			customFreq = repeat.frequency || "weekly";
			customInterval = String(repeat.interval || 1);
			customDays = repeat.daysOfWeek || [];
		}
	}

	return {
		title: task.title === "(no title)" ? "" : task.title || "",
		description: task.description || "",
		time: task.startTime || task.endTime || "",
		allDay: !(task.startTime || task.endTime),
		deadline: task.dueDate || "",
		taskListId: task.taskListId || FALLBACK_DISPLAY_LIST_ID,
		repeatType,
		customFreq,
		customInterval,
		customDays,
	};
};

const formatTimeLabel = (timeStr, language = "en") => {
	if (!timeStr) return "";
	const [hoursRaw, minutesRaw] = String(timeStr).split(":");
	const hours = Number(hoursRaw);
	if (Number.isNaN(hours)) return timeStr;
	const minutes = Number(minutesRaw || 0);
	if (Number.isNaN(minutes)) return timeStr;
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date.toLocaleTimeString(getLocaleTag(language), {
		hour: "numeric",
		minute: "2-digit",
	});
};

const getLocaleTag = (language) => (language === "ko" ? "ko-KR" : "en-US");

const getDisplayTaskTime = (task, language = "en") =>
	formatTimeLabel(task?.startTime || task?.endTime || "", language);

const formatDisplayDate = (dateStr, language, options = {}) => {
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

const TaskTitle = ({ title, noTitleLabel }) =>
	!title || title === "(no title)"
		? <span className="opacity-40 italic">{noTitleLabel}</span>
		: title;

const TaskPanel = ({ selectedDate, onClose }) => {
	const { t, i18n } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
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

	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [editingTaskDate, setEditingTaskDate] = useState("");
	const [createTaskListTarget, setCreateTaskListTarget] = useState(null);
	const [newTaskListTitle, setNewTaskListTitle] = useState("");
	const [isCreatingTaskList, setIsCreatingTaskList] = useState(false);
	const [isReconnecting, setIsReconnecting] = useState(false);
	const [formData, setFormData] = useState(EMPTY_FORM);

	const showReconnectGoogle = error === GOOGLE_SYNC_AUTH_ERROR;
	const repeatReferenceDate = editingTaskDate || selectedDate;
	const repeatOptions = getRepeatOptions(repeatReferenceDate, i18n.language);
	const repeatLocale = getTaskRepeatLocale(i18n.language);
	const weekDaysShort = repeatLocale.weekDaysShort;
	const fallbackDisplayList = {
		id: FALLBACK_DISPLAY_LIST_ID,
		title: t("tasks.default_list"),
	};
	const displayLists = taskLists?.length > 0 ? taskLists : [fallbackDisplayList];
	const hasRealTaskLists =
		Array.isArray(taskLists) &&
		taskLists.length > 0 &&
		taskLists.some((list) => list?.id && list.id !== "@default");
	const defaultDisplayList =
		displayLists.find((list) => list?.id && list.id !== "@default") ||
		displayLists[0] ||
		fallbackDisplayList;
	const filteredTasks = useMemo(
		() => filterTasksByTaskList(tasks, selectedTaskListFilter),
		[tasks, selectedTaskListFilter],
	);
	const selectedTasks = useMemo(
		() =>
			[...materializeTasksForDate(filteredTasks, selectedDate)].sort(
				(left, right) => Number(left.completed) - Number(right.completed),
			),
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
		(list) => list.id === selectedTaskListFilter,
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
	const createTaskListLabel =
		t("tasks.create_new_list");

	const getEmptyForm = () => ({
		...EMPTY_FORM,
		time: getRoundedDefaultTaskTime(),
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

	const getTaskListTitle = (taskListId) => {
		const normalizedId = String(taskListId || "").trim();
		if (!normalizedId || normalizedId === "@default") {
			return defaultDisplayList.title || fallbackDisplayList.title;
		}
		return displayLists.find((list) => list.id === normalizedId)?.title || normalizedId;
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

			if (createTaskListTarget === "filter") {
				setSelectedTaskListFilter(createdList.id);
			}
			setFormData((prev) => ({ ...prev, taskListId: createdList.id }));
			setCreateTaskListTarget(null);
			setNewTaskListTitle("");
		} catch (err) {
			console.error("Failed to create task list:", err);
		} finally {
			setIsCreatingTaskList(false);
		}
	};

	const handleReconnectGoogle = async () => {
		setIsReconnecting(true);
		try {
			await reconnectGoogle();
		} catch (err) {
			console.error("Failed to reconnect Google:", err);
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

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const repeat = buildRepeatObject(formData);
			const data = {
				title: formData.title.trim() || "(no title)",
				description: formData.description,
				date: editingTaskDate || selectedDate,
				startTime: formData.allDay ? "" : formData.time,
				endTime: "",
				repeat,
				dueDate: formData.deadline,
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
		} catch (err) {
			console.error("Failed to save task:", err);
		}
	};

	const handleToggleComplete = async (task) => {
		try {
			await updateTask(task.id, {
				completed: !task.completed,
				occurrenceDate: task.occurrenceDate || selectedDate,
			});
			if (selectedTaskForDetail?.id === task.id) {
				setSelectedTaskForDetail({ ...selectedTaskForDetail, completed: !task.completed });
			}
		} catch (err) {
			console.error("Failed to update task:", err);
		}
	};

	const handleDelete = (taskId) => setConfirmDelete(taskId);

	const handleConfirmDelete = async () => {
		try {
			await deleteTask(confirmDelete);
			setSelectedTaskForDetail(null);
		} catch (err) {
			console.error("Failed to delete task:", err);
		} finally {
			setConfirmDelete(null);
		}
	};

	const handleEditFromDetail = (task) => {
		setFormData(formDataFromTask(task));
		setEditingTaskDate(task.seriesStartDate || task.date || selectedDate);
		setEditingId(task.id);
		setShowAddForm(true);
		setSelectedTaskForDetail(null);
	};

	const toggleCustomDay = (code) => {
		setFormData((prev) => ({
			...prev,
			customDays: prev.customDays.includes(code)
				? prev.customDays.filter((d) => d !== code)
				: [...prev.customDays, code],
		}));
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
						onChange={(e) => setSelectedTaskListFilter(e.target.value)}
						className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
					>
						{taskListFilterOptions.map((list) => (
							<option key={list.id} value={list.id}>{list.title}</option>
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
				<div className={`p-3 rounded-lg text-xs space-y-2 ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
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
						onClick={() => { setShowAddForm(false); resetForm(); }}
					>
						<div
							className={`z-[22010] w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto ${modalCardCls}`}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-bold text-lg">{editingId ? t("tasks.edit_task") : t("tasks.add_task")}</h2>
								<button
									onClick={() => { setShowAddForm(false); resetForm(); }}
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
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									autoFocus
								/>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1">
										<label className={`text-xs font-medium ${isDark ? "text-green-400" : "text-green-600"}`}>
											{t("common.date")}
										</label>
										<div className={`w-full rounded-lg border px-3 py-2 text-sm ${secondaryBgCls} ${isDark ? "border-morning-dark-hover text-gray-200" : "border-morning-light-hover/60 text-gray-700"}`}>
											{repeatReferenceDate}
										</div>
									</div>

									<div className="space-y-1">
										<div className="flex items-center justify-between gap-3">
											<label className={`text-xs font-medium ${isDark ? "text-green-400" : "text-green-600"}`}>
												{t("common.time")}
											</label>
											<label
												className={`flex items-center gap-2 text-xs font-medium ${
													isDark ? "text-gray-300" : "text-gray-700"
												}`}
											>
												<input
													type="checkbox"
													checked={formData.allDay}
													onChange={(e) => {
														const checked = e.target.checked;
														setFormData((prev) => ({
															...prev,
															allDay: checked,
															time:
																checked
																	? ""
																	: prev.time || getRoundedDefaultTaskTime(),
														}));
													}}
													className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500/30"
												/>
												{t("common.all_day")}
											</label>
										</div>
										{formData.allDay ? (
											<div
												className={`w-full rounded-lg border px-3 py-2 text-sm ${
													secondaryBgCls
												} ${
													isDark
														? "border-morning-dark-hover text-gray-400"
														: "border-morning-light-hover/60 text-gray-500"
												}`}
											>
												{t("common.no_time")}
											</div>
										) : (
											<TimeInput
												value={formData.time}
												onChange={(value) => setFormData({ ...formData, time: value })}
												required
												showFormatToggle={false}
												force12Hour
											/>
										)}
									</div>
								</div>

								{/* Repeat */}
								<div className="space-y-1">
									<label className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-green-400" : "text-green-600"}`}>
										<Repeat size={12} />
										{t("common.repeat")}
									</label>
									<select
										value={formData.repeatType}
										onChange={(e) => setFormData({ ...formData, repeatType: e.target.value })}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									>
										{repeatOptions.map((opt) => (
											<option key={opt.value} value={opt.value}>{opt.label}</option>
										))}
									</select>
								</div>

								{/* Custom repeat options */}
								{formData.repeatType === "custom" && (
									<div className={`p-3 rounded-lg space-y-3 ${isDark ? "bg-morning-dark-cardSecondary" : "bg-morning-light-cardSecondary"}`}>
										<div className="flex items-center gap-2">
											<span className={`text-xs flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{repeatLocale.every}</span>
											<input
												type="number"
												min="1"
												max="99"
												value={formData.customInterval}
												onChange={(e) => setFormData({ ...formData, customInterval: e.target.value })}
												className={`w-16 px-2 py-1.5 rounded-lg text-sm outline-none border text-center transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
											/>
											<select
												value={formData.customFreq}
												onChange={(e) => setFormData({ ...formData, customFreq: e.target.value, customDays: [] })}
												className={`flex-1 px-2 py-1.5 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
											>
												<option value="daily">{i18n.language === "ko" ? "일" : `day${Number(formData.customInterval) !== 1 ? "s" : ""}`}</option>
												<option value="weekly">{i18n.language === "ko" ? "주" : `week${Number(formData.customInterval) !== 1 ? "s" : ""}`}</option>
												<option value="monthly">{i18n.language === "ko" ? "개월" : `month${Number(formData.customInterval) !== 1 ? "s" : ""}`}</option>
												<option value="yearly">{i18n.language === "ko" ? "년" : `year${Number(formData.customInterval) !== 1 ? "s" : ""}`}</option>
											</select>
										</div>
										{formData.customFreq === "weekly" && (
											<div>
												<p className={`text-xs mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{repeatLocale.on}</p>
												<div className="flex flex-wrap gap-1.5">
													{weekDaysShort.map(({ code, label }) => (
														<button
															key={code}
															type="button"
															onClick={() => toggleCustomDay(code)}
															className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
																formData.customDays.includes(code)
																	? "bg-green-500 text-white"
																	: isDark
																	? "bg-morning-dark-hover text-gray-300 hover:bg-morning-dark-hover/70"
																	: "bg-morning-light-hover/40 text-gray-600 hover:bg-morning-light-hover/70"
															}`}
														>
															{label}
														</button>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{/* Deadline */}
								<div className="space-y-1">
									<label className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-green-400" : "text-green-600"}`}>
										<Calendar size={12} />
										{t("common.deadline")}
										<span className="text-xs font-normal opacity-70">({t("common.optional")})</span>
									</label>
									<input
										type="date"
										value={formData.deadline}
										onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
									/>
									{formData.deadline && (
										<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{formatDisplayDate(formData.deadline, i18n.language)}
										</p>
									)}
								</div>

								<div className="space-y-1">
									<label className={`text-xs font-medium ${isDark ? "text-green-400" : "text-green-600"}`}>
										{t("common.description")}
									</label>
									<textarea
										placeholder={t("tasks.details_optional")}
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={3}
										className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 resize-none ${inputCls}`}
									/>
								</div>

								{hasRealTaskLists && (
									<div className="space-y-1 pr-3">
										<label className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-green-400" : "text-green-600"}`}>
											<FolderOpen size={12} />
											{t("common.list")}
										</label>
										<select
											value={resolvedFormTaskListId}
											onChange={(e) => setFormData({ ...formData, taskListId: e.target.value })}
											className={`w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 ${inputCls}`}
										>
											{displayLists.map((list) => (
												<option key={list.id} value={list.id}>{list.title}</option>
											))}
										</select>
										<button
											type="button"
											onClick={() => openCreateTaskListModal("form")}
										className={`text-left text-xs font-medium transition-colors ${isDark ? "text-green-300 hover:text-green-200" : "text-green-700 hover:text-green-800"}`}
									>
										{createTaskListLabel}
										</button>
									</div>
								)}

								<div className="flex gap-2">
									<button
										type="submit"
										className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
									>
										{editingId ? t("common.save") : t("tasks.add_task")}
									</button>
									<button
										type="button"
										onClick={() => { setShowAddForm(false); resetForm(); }}
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
							onClick={(e) => e.stopPropagation()}
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
								onSubmit={(e) => {
									e.preventDefault();
									void handleCreateTaskList();
								}}
							>
								<input
									type="text"
									value={newTaskListTitle}
									onChange={(e) => setNewTaskListTitle(e.target.value)}
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
										{isCreatingTaskList
											? t("tasks.creating")
											: t("common.create")}
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
									<h4 className={`font-semibold text-xs ${task.completed ? "line-through opacity-50" : ""}`}>
										<TaskTitle title={task.title} noTitleLabel={t("common.no_title")} />
									</h4>
									{getDisplayTaskTime(task, i18n.language) && (
										<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{getDisplayTaskTime(task, i18n.language)}
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
							onClick={(e) => e.stopPropagation()}
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
									<h2 className={`font-bold text-lg ${selectedTaskForDetail.completed ? "line-through opacity-50" : ""}`}>
										<TaskTitle title={selectedTaskForDetail.title} noTitleLabel={t("common.no_title")} />
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
									<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.date")}</p>
									<p>
										{formatDisplayDate(
											getTaskDisplayDate(selectedTaskForDetail),
											i18n.language,
											{ weekday: "short" },
										)}
									</p>
								</div>

								{getDisplayTaskTime(selectedTaskForDetail, i18n.language) && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.time")}</p>
										<p>{getDisplayTaskTime(selectedTaskForDetail, i18n.language)}</p>
									</div>
								)}

								{selectedTaskForDetail.dueDate && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.deadline")}</p>
										<p>{formatDisplayDate(selectedTaskForDetail.dueDate, i18n.language)}</p>
									</div>
								)}

								{getRepeatLabel(
									selectedTaskForDetail,
									selectedTaskForDetail.seriesStartDate || selectedTaskForDetail.date,
									i18n.language,
								) && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.repeat")}</p>
										<p>
											{getRepeatLabel(
												selectedTaskForDetail,
												selectedTaskForDetail.seriesStartDate || selectedTaskForDetail.date,
												i18n.language,
											)}
										</p>
									</div>
								)}

								{selectedTaskForDetail.taskListId && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.list")}</p>
										<p>{getTaskListTitle(selectedTaskForDetail.taskListId)}</p>
									</div>
								)}

								{selectedTaskForDetail.description && (
									<div>
										<p className={`text-xs font-semibold mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{t("common.description")}</p>
										<p className={isDark ? "text-gray-300" : "text-gray-700"}>
											{selectedTaskForDetail.description}
										</p>
									</div>
								)}
							</div>

							<div className="flex gap-2 pt-4 border-t">
								<button
									onClick={() => handleEditFromDetail(selectedTaskForDetail)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" : "bg-blue-100 hover:bg-blue-200 text-blue-600"}`}
								>
									{t("common.edit")}
								</button>
								<button
									onClick={() => handleDelete(selectedTaskForDetail.id)}
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
