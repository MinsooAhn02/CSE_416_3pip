import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { formatLocalDate } from "../utils/date";
import { buildEventRecurrence, parseEventRepeat } from "../utils/eventRepeat";
import { useAuthStore } from "./useAuthStore";

const EDGE_TIMEOUT_MS = 25000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_EVENTS_KEY = "mb_calendar_events";
const LOCAL_TASKS_KEY = "mb_google_tasks";
const TASK_LIST_FILTER_KEY = "mb_task_list_filter";
const TASK_META_OPEN = "[MB_META]";
const TASK_META_CLOSE = "[/MB_META]";
export const GOOGLE_SYNC_AUTH_ERROR =
	"Google connection expired. Reconnect Google to sync Events and Tasks again.";
export const ALL_TASK_LIST_FILTER_ID = "@all";
const FALLBACK_TASK_LISTS = [{ id: "@default", title: "My Tasks" }];

const readLocalEvents = () => load(LOCAL_EVENTS_KEY, []);
const writeLocalEvents = (events) => save(LOCAL_EVENTS_KEY, events);
const readLocalTasks = () => load(LOCAL_TASKS_KEY, []);
const writeLocalTasks = (tasks) => save(LOCAL_TASKS_KEY, tasks);
const normalizeTaskListFilterId = (value) =>
	String(value || ALL_TASK_LIST_FILTER_ID).trim() || ALL_TASK_LIST_FILTER_ID;
const readTaskListFilter = () => load(TASK_LIST_FILTER_KEY, ALL_TASK_LIST_FILTER_ID);
const writeTaskListFilter = (value) =>
	save(TASK_LIST_FILTER_KEY, normalizeTaskListFilterId(value));
const getLocalTimeZone = () =>
	Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const pad2 = (value) => String(value).padStart(2, "0");
const hasRealTaskLists = (lists = []) =>
	Array.isArray(lists) && lists.some((list) => list?.id && list.id !== "@default");

const normalizeTaskListsPayload = (payload) => {
	if (!Array.isArray(payload)) return FALLBACK_TASK_LISTS;

	const looksLikeTaskLists = payload.every((item) => {
		if (!item || typeof item !== "object") return false;
		const hasId = typeof item.id === "string" && item.id.trim().length > 0;
		const hasTitle = typeof item.title === "string";
		const looksLikeTask =
			"taskListId" in item || "status" in item || "completed" in item || "notes" in item;
		return hasId && hasTitle && !looksLikeTask;
	});

	if (!looksLikeTaskLists) return FALLBACK_TASK_LISTS;

	return payload.length > 0 ? payload : FALLBACK_TASK_LISTS;
};

const resolveTaskListFilterId = (filterId, lists = FALLBACK_TASK_LISTS) => {
	const normalizedFilterId = normalizeTaskListFilterId(filterId);
	if (normalizedFilterId === ALL_TASK_LIST_FILTER_ID) return normalizedFilterId;
	const availableIds = new Set(
		(Array.isArray(lists) ? lists : [])
			.map((list) => String(list?.id || "").trim())
			.filter(Boolean),
	);
	return availableIds.has(normalizedFilterId)
		? normalizedFilterId
		: ALL_TASK_LIST_FILTER_ID;
};

export const filterTasksByTaskList = (tasks = [], filterId = ALL_TASK_LIST_FILTER_ID) => {
	const normalizedFilterId = normalizeTaskListFilterId(filterId);
	if (normalizedFilterId === ALL_TASK_LIST_FILTER_ID) {
		return Array.isArray(tasks) ? tasks : [];
	}

	return (Array.isArray(tasks) ? tasks : []).filter(
		(task) =>
			String(task?.taskListId || FALLBACK_TASK_LISTS[0]?.id || "@default").trim() ===
			normalizedFilterId,
	);
};

const formatLocalTime = (input) => {
	if (!input) return "";
	if (typeof input === "string" && /^\d{2}:\d{2}$/.test(input)) return input;
	if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return "";

	const date = input instanceof Date ? new Date(input) : new Date(input);
	if (Number.isNaN(date.getTime())) return "";

	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const extractDateString = (input) => {
	if (!input) return "";
	if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
	return formatLocalDate(input);
};

const extractTaskDateString = (input) => {
	if (!input) return "";
	if (typeof input === "string") {
		const match = input.match(/^(\d{4}-\d{2}-\d{2})/);
		if (match) return match[1];
	}
	return extractDateString(input);
};

const getMonthWindow = (anchor = new Date()) => {
	const date = anchor instanceof Date ? new Date(anchor) : new Date(anchor);
	const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
	const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
	const monthKey = `${monthStart.getFullYear()}-${pad2(monthStart.getMonth() + 1)}`;

	return {
		monthKey,
		timeMin: monthStart.toISOString(),
		timeMax: monthEnd.toISOString(),
	};
};

const stripLegacyTaskMetadata = (notes = "") => {
	const raw = String(notes || "");
	const match = raw.match(
		new RegExp(
			`${TASK_META_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?${TASK_META_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
			"s",
		),
	);
	return match ? raw.replace(match[0], "").trim() : raw.trim();
};

const buildTaskNotes = (description = "") => {
	const cleanDescription = String(description || "").trim();
	return cleanDescription || undefined;
};

const toLocalDateTimeIso = (dateStr, timeStr = "00:00") => {
	if (!dateStr) return undefined;
	const [hours = "00", minutes = "00"] = String(timeStr || "00:00").split(":");
	const localDate = new Date(`${dateStr}T00:00:00`);
	localDate.setHours(Number(hours), Number(minutes), 0, 0);
	return localDate.toISOString();
};

const toTaskDueIso = (dateStr) => {
	if (!dateStr) return undefined;
	return `${dateStr}T00:00:00.000Z`;
};

const toTaskCompletedIso = (input = new Date()) => {
	const date = input instanceof Date ? input : new Date(input);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeAttendees = (attendees = []) =>
	(Array.isArray(attendees) ? attendees : [])
		.map((attendee) => {
			if (!attendee) return null;
			const email = String(attendee.email || "").trim();
			if (!email) return null;
			return {
				email,
				displayName: String(attendee.displayName || "").trim() || "",
				responseStatus:
					String(attendee.responseStatus || "needsAction").trim() ||
					"needsAction",
				optional: !!attendee.optional,
			};
		})
		.filter(Boolean);

const normalizeReminderOverrides = (overrides = []) =>
	(Array.isArray(overrides) ? overrides : [])
		.map((override) => {
			if (!override) return null;
			const minutes = Number(override.minutes ?? NaN);
			if (!Number.isFinite(minutes) || minutes < 0) return null;
			return {
				method: String(override.method || "popup").trim() === "email" ? "email" : "popup",
				minutes,
			};
		})
		.filter(Boolean);

const normalizeEvent = (event) => {
	const start = event?.start ?? event?.startTime ?? null;
	const end = event?.end ?? event?.endTime ?? null;
	const allDay =
		event?.allDay ?? (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start));
	const attendees = normalizeAttendees(event?.attendees);
	const reminderOverrides = normalizeReminderOverrides(
		event?.reminderOverrides || event?.reminders?.overrides || [],
	);
	const remindersUseDefault =
		event?.remindersUseDefault ?? event?.reminders?.useDefault ?? true;
	const meetLink = String(event?.meetLink || event?.hangoutLink || "").trim() || "";
	const conferenceStatus =
		String(event?.conferenceStatus || "").trim() ||
		event?.conferenceData?.createRequest?.status?.statusCode ||
		null;

	return {
		id: event?.id,
		title:
			typeof event?.title === "string"
				? event.title
				: typeof event?.summary === "string"
					? event.summary
					: "",
		date: event?.date || extractDateString(start || end || new Date()),
		startTime: allDay ? "" : formatLocalTime(start),
		endTime: allDay ? "" : formatLocalTime(end),
		start: start || null,
		end: end || null,
		allDay: !!allDay,
		location: event?.location || "",
		description: event?.description || "",
		attendees,
		visibility: event?.visibility || "default",
		availability:
			String(event?.availability || "").trim() === "free" ||
			event?.transparency === "transparent"
				? "free"
				: "busy",
		meetLink,
		addGoogleMeet:
			event?.addGoogleMeet ?? !!(meetLink || conferenceStatus),
		conferenceStatus,
		remindersUseDefault: remindersUseDefault !== false,
		reminderOverrides,
		sendUpdates: event?.sendUpdates ?? true,
		recurrence: Array.isArray(event?.recurrence) ? event.recurrence : [],
		repeat:
			event?.repeat ||
			parseEventRepeat(
				Array.isArray(event?.recurrence) ? event.recurrence : [],
				event?.date || extractDateString(start || end || new Date()),
			),
		recurringEventId: String(event?.recurringEventId || "").trim() || null,
		originalStartTime:
			event?.originalStartTime ||
			event?.originalStart?.dateTime ||
			event?.originalStart?.date ||
			null,
		seriesEventId:
			String(event?.seriesEventId || event?.recurringEventId || event?.id || "").trim() ||
			null,
	};
};

const normalizeTask = (task) => {
	const description = stripLegacyTaskMetadata(
		task?.description ?? task?.notes ?? "",
	);
	const date =
		task?.date ||
		extractTaskDateString(task?.due || "") ||
		extractDateString(task?.updated || "");
	const completed =
		typeof task?.completed === "boolean"
			? task.completed
			: String(task?.status || "").toLowerCase() === "completed";
	const completedAt =
		typeof task?.completedAt === "string" && task.completedAt.trim()
			? task.completedAt.trim()
			: typeof task?.completed === "string" && task.completed.trim()
				? task.completed.trim()
				: "";

	return {
		id: task?.id,
		taskListId: task?.taskListId || "@default",
		title: task?.title || task?.text || "",
		text: task?.title || task?.text || "",
		date,
		due: task?.due || (date ? toTaskDueIso(date) : null),
		description,
		completed,
		completedAt,
		notes: description,
		updated: task?.updated || null,
	};
};

const getProviderToken = async () =>
	useAuthStore.getState().ensureProviderToken?.();

const isGoogleAuthErrorMessage = (message = "") => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("google oauth token required") ||
		normalized.includes("insufficient") ||
		normalized.includes("permission") ||
		normalized.includes("autherror") ||
		normalized.includes("unauthorized") ||
		normalized.includes("access token") ||
		normalized.includes("403") ||
		normalized.includes("401")
	);
};

const getGoogleSyncErrorMessage = (error, fallbackMessage) => {
	const message = error?.message || fallbackMessage;
	return isGoogleAuthErrorMessage(message)
		? GOOGLE_SYNC_AUTH_ERROR
		: message;
};

const parseEdgeResponse = async (response) => {
	const text = await response.text().catch(() => "");
	if (!text) return null;

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

const invokeGoogleFunction = async (name, body) => {
	if (!supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

	const controller = new AbortController();
	const timerId = window.setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
	try {
		const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		const payload = await parseEdgeResponse(response);
		if (!response.ok) {
			const detail =
				typeof payload === "string"
					? payload
					: payload?.error || payload?.message || JSON.stringify(payload || {});
			throw new Error(`HTTP ${response.status}: ${detail}`);
		}

		return payload;
	} catch (error) {
		if (error?.name === "AbortError") {
			throw new Error(`Edge function timeout after ${EDGE_TIMEOUT_MS}ms`);
		}
		throw error;
	} finally {
		window.clearTimeout(timerId);
	}
};

const eventMatchesMonth = (event, monthKey) => {
	if (!monthKey) return true;
	return String(event?.date || "").slice(0, 7) === monthKey;
};

export const useGoogleCalendarStore = create((set, get) => ({
	events: readLocalEvents().map(normalizeEvent),
	tasks: readLocalTasks().map(normalizeTask),
	taskLists: [],
	taskListsLoaded: false,
	selectedTaskListFilter: normalizeTaskListFilterId(readTaskListFilter()),
	selectedDate: null,
	loadedMonthKey: null,
	tasksLoaded: false,
	loading: false,
	error: null,
	pinAuthenticated: false,

	setSelectedDate: (dateStr) => {
		set({ selectedDate: dateStr });
	},

	setSelectedTaskListFilter: (taskListFilterId) => {
		const resolvedFilterId = resolveTaskListFilterId(
			taskListFilterId,
			get().taskLists.length > 0 ? get().taskLists : FALLBACK_TASK_LISTS,
		);
		writeTaskListFilter(resolvedFilterId);
		set({ selectedTaskListFilter: resolvedFilterId });
	},

	fetchEvents: async (options = {}) => {
		const { date = get().selectedDate || formatLocalDate(), force = false, skipLoading = false } =
			options;
		const { monthKey, timeMin, timeMax } = getMonthWindow(`${date}T00:00:00`);

		if (!skipLoading) {
			if (!force && get().loadedMonthKey === monthKey && get().events.length > 0) {
				return get().events;
			}
			set({ loading: true, error: null });
		}

		try {
			if (!supabase) {
				const localEvents = readLocalEvents()
					.map(normalizeEvent)
					.filter((event) => eventMatchesMonth(event, monthKey));
				set({ events: localEvents, loadedMonthKey: monthKey, error: null });
				return localEvents;
			}
			const token = await getProviderToken();
			if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);

			const data = await invokeGoogleFunction("events", {
				token,
				action: "list",
				timeMin,
				timeMax,
			});

			const events = Array.isArray(data) ? data.map(normalizeEvent) : [];
			set({ events, loadedMonthKey: monthKey, error: null });
			writeLocalEvents(events);
			return events;
		} catch (err) {
			const message = getGoogleSyncErrorMessage(
				err,
				"Failed to load calendar events.",
			);
			const cachedEvents = readLocalEvents()
				.map(normalizeEvent)
				.filter((event) => eventMatchesMonth(event, monthKey));
			set({
				events: cachedEvents,
				loadedMonthKey: monthKey,
				error: message,
			});
			throw err;
		} finally {
			if (!skipLoading) {
				set({ loading: false });
			}
		}
	},

	fetchTasks: async (options = {}) => {
		const { skipLoading = false } = options;
		if (!skipLoading) {
			set({ loading: true, error: null });
		}

		try {
			if (!supabase) {
				const localTasks = readLocalTasks().map(normalizeTask);
				set({ tasks: localTasks, tasksLoaded: true, error: null });
				return localTasks;
			}
			const token = await getProviderToken();
			if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);

			const [listsData, data] = await Promise.all([
				get().taskListsLoaded && hasRealTaskLists(get().taskLists)
					? Promise.resolve(get().taskLists)
					: invokeGoogleFunction("tasks", {
						token,
						action: "listTaskLists",
					}).catch(() => FALLBACK_TASK_LISTS),
				invokeGoogleFunction("tasks", {
					token,
					action: "list",
					showCompleted: true,
					showHidden: true,
					allTaskLists: true,
				}),
			]);

			const tasks = Array.isArray(data) ? data.map(normalizeTask) : [];
			const taskLists = normalizeTaskListsPayload(listsData);
			const selectedTaskListFilter = resolveTaskListFilterId(
				get().selectedTaskListFilter,
				taskLists,
			);
			writeTaskListFilter(selectedTaskListFilter);
			set({
				tasks,
				tasksLoaded: true,
				taskLists,
				taskListsLoaded: true,
				selectedTaskListFilter,
				error: null,
			});
			writeLocalTasks(tasks);
			return tasks;
		} catch (err) {
			const message = getGoogleSyncErrorMessage(
				err,
				"Failed to load Google Tasks.",
			);
			const cachedTasks = readLocalTasks().map(normalizeTask);
			set({ tasks: cachedTasks, tasksLoaded: true, error: message });
			throw err;
		} finally {
			if (!skipLoading) {
				set({ loading: false });
			}
		}
	},

	fetchTaskLists: async () => {
		if (get().taskListsLoaded && hasRealTaskLists(get().taskLists)) {
			return get().taskLists;
		}
		try {
			if (!supabase) {
				const selectedTaskListFilter = resolveTaskListFilterId(
					get().selectedTaskListFilter,
					FALLBACK_TASK_LISTS,
				);
				writeTaskListFilter(selectedTaskListFilter);
				set({
					taskLists: FALLBACK_TASK_LISTS,
					taskListsLoaded: true,
					selectedTaskListFilter,
				});
				return FALLBACK_TASK_LISTS;
			}
			const token = await getProviderToken();
			if (!token) {
				const selectedTaskListFilter = resolveTaskListFilterId(
					get().selectedTaskListFilter,
					FALLBACK_TASK_LISTS,
				);
				writeTaskListFilter(selectedTaskListFilter);
				set({
					taskLists: FALLBACK_TASK_LISTS,
					taskListsLoaded: true,
					selectedTaskListFilter,
				});
				return FALLBACK_TASK_LISTS;
			}
			const data = await invokeGoogleFunction("tasks", {
				token,
				action: "listTaskLists",
			});
			const lists = normalizeTaskListsPayload(data);
			const selectedTaskListFilter = resolveTaskListFilterId(
				get().selectedTaskListFilter,
				lists,
			);
			writeTaskListFilter(selectedTaskListFilter);
			set({ taskLists: lists, taskListsLoaded: true, selectedTaskListFilter });
			return lists;
		} catch {
			const selectedTaskListFilter = resolveTaskListFilterId(
				get().selectedTaskListFilter,
				FALLBACK_TASK_LISTS,
			);
			writeTaskListFilter(selectedTaskListFilter);
			set({
				taskLists: FALLBACK_TASK_LISTS,
				taskListsLoaded: true,
				selectedTaskListFilter,
			});
			return FALLBACK_TASK_LISTS;
		}
	},

	createTaskList: async (title) => {
		const trimmedTitle = String(title || "").trim();
		if (!trimmedTitle) {
			throw new Error("Task list title is required.");
		}

		set({ loading: true, error: null });
		try {
			let created = {
				id: `list_${Date.now()}`,
				title: trimmedTitle,
				updated: new Date().toISOString(),
			};

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleFunction("tasks", {
					token,
					action: "createTaskList",
					title: trimmedTitle,
				});
				created = {
					id: String(data?.id || created.id).trim() || created.id,
					title: String(data?.title || trimmedTitle).trim() || trimmedTitle,
					updated: data?.updated || created.updated,
				};
			}

			const existingTaskLists = Array.isArray(get().taskLists)
				? get().taskLists.filter((list) => list?.id && list.id !== created.id)
				: [];
			const taskLists = [...existingTaskLists, created];
			set({
				taskLists,
				taskListsLoaded: true,
			});
			return created;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to create task list."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	fetchEventsAndTasks: async (options = {}) => {
		const { date = get().selectedDate || formatLocalDate(), force = false } = options;
		const { monthKey } = getMonthWindow(`${date}T00:00:00`);

		if (!force && get().loadedMonthKey === monthKey && get().tasksLoaded) {
			return { events: get().events, tasks: get().tasks };
		}

		set({ loading: true, error: null });
		try {
			const [events, tasks] = await Promise.all([
				get().fetchEvents({ date, force, skipLoading: true }),
				get().fetchTasks({ skipLoading: true }),
			]);
			return { events, tasks };
		} catch (err) {
			set({ error: err?.message || "Failed to load calendar data." });
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	readEvent: async (eventId) => {
		if (!eventId) return null;

		try {
			if (!supabase) {
				const localEvent = readLocalEvents()
					.map(normalizeEvent)
					.find((event) => event.id === eventId);
				return localEvent || null;
			}

			const token = await getProviderToken();
			if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);

			const data = await invokeGoogleFunction("events", {
				token,
				action: "read",
				eventId,
			});
			return data ? normalizeEvent(data) : null;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to load event details."),
			});
			throw err;
		}
	},

	addEvent: async (eventData) => {
		set({ loading: true, error: null });
		try {
			const normalizedEvent = normalizeEvent({
				...eventData,
				recurrence:
					eventData?.recurrence ||
					buildEventRecurrence(eventData?.repeat, eventData?.date),
			});

			let created = normalizedEvent;
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleFunction("events", {
					token,
					action: "create",
					...normalizedEvent,
					timeZone: getLocalTimeZone(),
				});
				created = normalizeEvent(data);
				await get().fetchEvents({
					date: normalizedEvent.date || get().selectedDate || formatLocalDate(),
					force: true,
					skipLoading: true,
				});
			} else {
				created = {
					...normalizedEvent,
					id: `evt_${Date.now()}`,
					start:
						normalizedEvent.start ||
						(normalizedEvent.date && normalizedEvent.startTime
							? toLocalDateTimeIso(normalizedEvent.date, normalizedEvent.startTime)
							: normalizedEvent.date),
					end:
						normalizedEvent.end ||
						(normalizedEvent.date && normalizedEvent.endTime
							? toLocalDateTimeIso(normalizedEvent.date, normalizedEvent.endTime)
							: normalizedEvent.date),
				};
			}

			if (!supabase) {
				const allLocalEvents = [
					...readLocalEvents().filter((event) => event.id !== created.id),
					created,
				];
				writeLocalEvents(allLocalEvents);
				set((state) => ({
					events: [...state.events.filter((event) => event.id !== created.id), created],
				}));
			}
			return created;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to create event."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	updateEvent: async (eventId, updates) => {
		set({ loading: true, error: null });
		try {
			const current = get().events.find((event) => event.id === eventId);
			const merged = normalizeEvent({
				...(current || {}),
				...(updates || {}),
				id: eventId,
				recurrence:
					updates?.recurrence ||
					buildEventRecurrence(
						updates?.repeat !== undefined ? updates.repeat : current?.repeat,
						updates?.date || current?.date,
					),
			});

			let updated = merged;
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleFunction("events", {
					token,
					action: "update",
					eventId,
					...merged,
					timeZone: getLocalTimeZone(),
				});
				updated = normalizeEvent(data);
				await get().fetchEvents({
					date: merged.date || get().selectedDate || formatLocalDate(),
					force: true,
					skipLoading: true,
				});
			}

			if (!supabase) {
				const allLocalEvents = readLocalEvents()
					.map(normalizeEvent)
					.filter((event) => event.id !== eventId)
					.concat(updated);
				writeLocalEvents(allLocalEvents);
				set((state) => ({
					events: state.events.map((event) =>
						event.id === eventId ? updated : event,
					),
				}));
			}
			return updated;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to update event."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	deleteEvent: async (eventId) => {
		set({ loading: true, error: null });
		try {
			const current = get().events.find((event) => event.id === eventId);
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				await invokeGoogleFunction("events", {
					token,
					action: "delete",
					eventId,
				});
				await get().fetchEvents({
					date: current?.date || get().selectedDate || formatLocalDate(),
					force: true,
					skipLoading: true,
				});
			}

			if (!supabase) {
				const nextLocalEvents = readLocalEvents()
					.map(normalizeEvent)
					.filter((event) => event.id !== eventId);
				writeLocalEvents(nextLocalEvents);
				set((state) => ({
					events: state.events.filter((event) => event.id !== eventId),
				}));
			}
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to delete event."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	addTask: async (taskData) => {
		set({ loading: true, error: null });
		try {
			const normalizedTask = normalizeTask(taskData);
			const taskListId = taskData.taskListId || normalizedTask.taskListId || "@default";
			const payload = {
				title: normalizedTask.title,
				notes: buildTaskNotes(normalizedTask.description),
				due: toTaskDueIso(normalizedTask.date || formatLocalDate()),
				status: normalizedTask.completed ? "completed" : "needsAction",
				completed:
					normalizedTask.completed
						? normalizedTask.completedAt || toTaskCompletedIso()
						: null,
			};

			let created = {
				...normalizedTask,
				id: `task_${Date.now()}`,
				due: payload.due,
				taskListId,
			};

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleFunction("tasks", {
					token,
					action: "create",
					taskListId,
					...payload,
				});
				created = normalizeTask({
					...normalizedTask,
					...data,
					taskListId,
					notes: data?.notes ?? payload.notes,
					due: data?.due ?? payload.due,
					status: data?.status ?? payload.status,
					completedAt: data?.completedAt ?? data?.completed ?? payload.completed,
				});
			}

			const nextTasks = [
				...readLocalTasks().map(normalizeTask).filter((task) => task.id !== created.id),
				created,
			];
			writeLocalTasks(nextTasks);
			set((state) => ({
				tasks: [...state.tasks.filter((task) => task.id !== created.id), created],
			}));
			return created;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to create task."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	updateTask: async (taskId, updates) => {
		set({ loading: true, error: null });
		try {
			const current = get().tasks.find((task) => task.id === taskId);
			const merged = normalizeTask({
				...(current || {}),
				...(updates || {}),
				id: taskId,
				completed:
					updates?.completed !== undefined
						? updates.completed
						: current?.completed ?? false,
				completedAt:
					updates?.completed !== undefined
						? updates.completed
							? current?.completedAt || toTaskCompletedIso()
							: ""
						: current?.completedAt || "",
			});
			const taskListId = updates?.taskListId || current?.taskListId || merged.taskListId || "@default";
			const currentTaskListId =
				current?.taskListId || merged.taskListId || "@default";
			const payload = {
				title: merged.title,
				notes: buildTaskNotes(merged.description),
				due: toTaskDueIso(merged.date || formatLocalDate()),
				status: merged.completed ? "completed" : "needsAction",
				completed:
					merged.completed
						? merged.completedAt || toTaskCompletedIso()
						: null,
			};

			let updated = { ...merged, due: payload.due, taskListId };
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				if (currentTaskListId !== taskListId) {
					await invokeGoogleFunction("tasks", {
						token,
						action: "move",
						taskId,
						sourceTaskListId: currentTaskListId,
						destinationTaskListId: taskListId,
					});
				}
				const data = await invokeGoogleFunction("tasks", {
					token,
					action: "update",
					taskId,
					taskListId,
					...payload,
				});
				updated = normalizeTask({
					...merged,
					...data,
					taskListId,
					notes: data?.notes ?? payload.notes,
					due: data?.due ?? payload.due,
					status: data?.status ?? payload.status,
					completedAt: data?.completedAt ?? data?.completed ?? payload.completed,
				});
			}

			const nextLocalTasks = readLocalTasks()
				.map(normalizeTask)
				.filter((task) => task.id !== taskId)
				.concat(updated);
			writeLocalTasks(nextLocalTasks);
			set((state) => ({
				tasks: state.tasks.map((task) => (task.id === taskId ? updated : task)),
			}));
			return updated;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to update task."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	deleteTask: async (taskId) => {
		set({ loading: true, error: null });
		try {
			const current = get().tasks.find((task) => task.id === taskId);

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				await invokeGoogleFunction("tasks", {
					token,
					action: "delete",
					taskId,
					taskListId: current?.taskListId || "@default",
				});
			}

			const nextLocalTasks = readLocalTasks()
				.map(normalizeTask)
				.filter((task) => task.id !== taskId);
			writeLocalTasks(nextLocalTasks);
			set((state) => ({
				tasks: state.tasks.filter((task) => task.id !== taskId),
			}));
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to delete task."),
			});
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	clearData: () => {
		writeLocalEvents([]);
		writeLocalTasks([]);
		set({
			events: [],
			tasks: [],
			taskLists: [],
			selectedTaskListFilter: ALL_TASK_LIST_FILTER_ID,
			selectedDate: null,
			loadedMonthKey: null,
			tasksLoaded: false,
			taskListsLoaded: false,
			error: null,
		});
		writeTaskListFilter(ALL_TASK_LIST_FILTER_ID);
	},

	setPinAuthenticated: (isAuthenticated) => {
		set({ pinAuthenticated: isAuthenticated });
	},
}));
