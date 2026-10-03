/// <reference types="vite/client" />
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import { load, save } from "../utils/storage";
import { formatLocalDate } from "../utils/date";
import { buildEventRecurrence, parseEventRepeat, EventRepeat } from "../utils/eventRepeat";
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
const FALLBACK_TASK_LISTS: TaskList[] = [{ id: "@default", title: "My Tasks" }];

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface Attendee {
	email: string;
	displayName: string;
	responseStatus: string;
	optional: boolean;
}

export interface ReminderOverride {
	method: "popup" | "email";
	minutes: number;
}

export type { EventRepeat };

export interface CalendarEvent {
	id?: string;
	title: string;
	date: string;
	startTime: string;
	endTime: string;
	start: string | null;
	end: string | null;
	allDay: boolean;
	location: string;
	description: string;
	attendees: Attendee[];
	visibility: string;
	availability: "free" | "busy";
	meetLink: string;
	addGoogleMeet: boolean;
	conferenceStatus: string | null;
	remindersUseDefault: boolean;
	reminderOverrides: ReminderOverride[];
	sendUpdates: boolean;
	recurrence: string[];
	repeat: EventRepeat | null;
	recurringEventId: string | null;
	originalStartTime: string | null;
	seriesEventId: string | null;
}

export interface Task {
	id?: string;
	taskListId: string;
	title: string;
	text: string;
	date: string;
	due: string | null;
	description: string;
	completed: boolean;
	completedAt: string;
	notes: string;
	updated: string | null;
	occurrenceDate?: string;
	recurrence?: string | null;
}

export interface TaskList {
	id: string;
	title: string;
	updated?: string;
}

interface FetchEventsOptions {
	date?: string;
	force?: boolean;
	skipLoading?: boolean;
}

interface FetchTasksOptions {
	skipLoading?: boolean;
}

interface FetchEventsAndTasksOptions {
	date?: string;
	force?: boolean;
}

interface AddTaskData {
	title?: string;
	text?: string;
	description?: string;
	date?: string;
	completed?: boolean;
	taskListId?: string;
	due?: string;
	notes?: string;
	updated?: string | null;
	completedAt?: string;
}

interface UpdateTaskData {
	title?: string;
	text?: string;
	description?: string;
	date?: string;
	completed?: boolean;
	taskListId?: string;
	due?: string;
	notes?: string;
	updated?: string | null;
	completedAt?: string;
}

interface AddEventData {
	id?: string;
	title?: string;
	summary?: string;
	date?: string;
	startTime?: string;
	endTime?: string;
	start?: string | null;
	end?: string | null;
	allDay?: boolean;
	location?: string;
	description?: string;
	attendees?: unknown[];
	visibility?: string;
	availability?: string;
	transparency?: string;
	meetLink?: string;
	hangoutLink?: string;
	addGoogleMeet?: boolean;
	conferenceStatus?: string | null;
	conferenceData?: { createRequest?: { status?: { statusCode?: string } } };
	remindersUseDefault?: boolean;
	reminderOverrides?: unknown[];
	reminders?: { useDefault?: boolean; overrides?: unknown[] };
	sendUpdates?: boolean;
	recurrence?: string[];
	repeat?: EventRepeat | null;
	recurringEventId?: string;
	originalStartTime?: string;
	originalStart?: { dateTime?: string; date?: string };
	seriesEventId?: string;
}

interface UpdateEventData extends AddEventData {
	repeat?: EventRepeat | null;
}

export interface GoogleCalendarState {
	events: CalendarEvent[];
	tasks: Task[];
	taskLists: TaskList[];
	taskListsLoaded: boolean;
	selectedTaskListFilter: string;
	selectedDate: string | null;
	loadedMonthKey: string | null;
	tasksLoaded: boolean;
	loading: boolean;
	error: string | null;
	pinAuthenticated: boolean;
	setSelectedDate: (dateStr: string | null) => void;
	setSelectedTaskListFilter: (taskListFilterId: string) => void;
	fetchEvents: (options?: FetchEventsOptions) => Promise<CalendarEvent[]>;
	fetchTasks: (options?: FetchTasksOptions) => Promise<Task[]>;
	fetchTaskLists: () => Promise<TaskList[]>;
	createTaskList: (title: string) => Promise<TaskList>;
	fetchEventsAndTasks: (options?: FetchEventsAndTasksOptions) => Promise<{ events: CalendarEvent[]; tasks: Task[] }>;
	readEvent: (eventId: string) => Promise<CalendarEvent | null>;
	addEvent: (eventData: AddEventData) => Promise<CalendarEvent>;
	updateEvent: (eventId: string, updates: UpdateEventData) => Promise<CalendarEvent>;
	deleteEvent: (eventId: string) => Promise<void>;
	addTask: (taskData: AddTaskData) => Promise<Task>;
	updateTask: (taskId: string, updates: UpdateTaskData) => Promise<Task>;
	deleteTask: (taskId: string) => Promise<void>;
	clearData: () => void;
	setPinAuthenticated: (isAuthenticated: boolean) => void;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const readLocalEvents = (): unknown[] => load(LOCAL_EVENTS_KEY, []);
const writeLocalEvents = (events: CalendarEvent[]): void => save(LOCAL_EVENTS_KEY, events);
const readLocalTasks = (): unknown[] => load(LOCAL_TASKS_KEY, []);
const writeLocalTasks = (tasks: Task[]): void => save(LOCAL_TASKS_KEY, tasks);
const normalizeTaskListFilterId = (value: unknown): string =>
	String(value || ALL_TASK_LIST_FILTER_ID).trim() || ALL_TASK_LIST_FILTER_ID;
const readTaskListFilter = (): string => load(TASK_LIST_FILTER_KEY, ALL_TASK_LIST_FILTER_ID);
const writeTaskListFilter = (value: string): void =>
	save(TASK_LIST_FILTER_KEY, normalizeTaskListFilterId(value));
const getLocalTimeZone = (): string =>
	Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const pad2 = (value: number | string): string => String(value).padStart(2, "0");
const hasRealTaskLists = (lists: TaskList[] = []): boolean =>
	Array.isArray(lists) && lists.some((list) => list?.id && list.id !== "@default");

const normalizeTaskListsPayload = (payload: unknown): TaskList[] => {
	if (!Array.isArray(payload)) return FALLBACK_TASK_LISTS;

	const looksLikeTaskLists = payload.every((item) => {
		if (!item || typeof item !== "object") return false;
		const record = item as Record<string, unknown>;
		const hasId = typeof record.id === "string" && (record.id as string).trim().length > 0;
		const hasTitle = typeof record.title === "string";
		const looksLikeTask =
			"taskListId" in record || "status" in record || "completed" in record || "notes" in record;
		return hasId && hasTitle && !looksLikeTask;
	});

	if (!looksLikeTaskLists) return FALLBACK_TASK_LISTS;

	return payload.length > 0 ? (payload as TaskList[]) : FALLBACK_TASK_LISTS;
};

const resolveTaskListFilterId = (filterId: string, lists: TaskList[] = FALLBACK_TASK_LISTS): string => {
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

export const filterTasksByTaskList = (tasks: Task[] = [], filterId: string = ALL_TASK_LIST_FILTER_ID): Task[] => {
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

const formatLocalTime = (input: unknown): string => {
	if (!input) return "";
	if (typeof input === "string" && /^\d{2}:\d{2}$/.test(input)) return input;
	if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return "";

	const date = input instanceof Date ? new Date(input) : new Date(input as string);
	if (Number.isNaN(date.getTime())) return "";

	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const extractDateString = (input: unknown): string => {
	if (!input) return "";
	if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
	return formatLocalDate(input as Date | string);
};

const extractTaskDateString = (input: unknown): string => {
	if (!input) return "";
	if (typeof input === "string") {
		const match = input.match(/^(\d{4}-\d{2}-\d{2})/);
		if (match) return match[1];
	}
	return extractDateString(input);
};

const getMonthWindow = (anchor: Date | string = new Date()): { monthKey: string; timeMin: string; timeMax: string } => {
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

const stripLegacyTaskMetadata = (notes = ""): string => {
	const raw = String(notes || "");
	const match = raw.match(
		new RegExp(
			`${TASK_META_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?${TASK_META_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
			"s",
		),
	);
	return match ? raw.replace(match[0], "").trim() : raw.trim();
};

const buildTaskNotes = (description = ""): string | undefined => {
	const cleanDescription = String(description || "").trim();
	return cleanDescription || undefined;
};

const toLocalDateTimeIso = (dateStr: string, timeStr = "00:00"): string | undefined => {
	if (!dateStr) return undefined;
	const [hours = "00", minutes = "00"] = String(timeStr || "00:00").split(":");
	const localDate = new Date(`${dateStr}T00:00:00`);
	localDate.setHours(Number(hours), Number(minutes), 0, 0);
	return localDate.toISOString();
};

const toTaskDueIso = (dateStr: string | null | undefined): string | undefined => {
	if (!dateStr) return undefined;
	return `${dateStr}T00:00:00.000Z`;
};

const toTaskCompletedIso = (input: Date | string = new Date()): string => {
	const date = input instanceof Date ? input : new Date(input);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeAttendees = (attendees: unknown[] = []): Attendee[] =>
	(Array.isArray(attendees) ? attendees : [])
		.map((attendee) => {
			if (!attendee) return null;
			const a = attendee as Record<string, unknown>;
			const email = String(a.email || "").trim();
			if (!email) return null;
			return {
				email,
				displayName: String(a.displayName || "").trim() || "",
				responseStatus:
					String(a.responseStatus || "needsAction").trim() ||
					"needsAction",
				optional: !!(a.optional),
			} satisfies Attendee;
		})
		.filter((x): x is Attendee => x !== null);

const normalizeReminderOverrides = (overrides: unknown[] = []): ReminderOverride[] =>
	(Array.isArray(overrides) ? overrides : [])
		.map((override) => {
			if (!override) return null;
			const o = override as Record<string, unknown>;
			const minutes = Number(o.minutes ?? NaN);
			if (!Number.isFinite(minutes) || minutes < 0) return null;
			return {
				method: String(o.method || "popup").trim() === "email" ? "email" : "popup",
				minutes,
			} satisfies ReminderOverride;
		})
		.filter((x): x is ReminderOverride => x !== null);

const normalizeEvent = (event: AddEventData | CalendarEvent | Record<string, unknown>): CalendarEvent => {
	const e = event as Record<string, unknown>;
	const start = (e?.start ?? e?.startTime ?? null) as string | null;
	const end = (e?.end ?? e?.endTime ?? null) as string | null;
	const allDay =
		(e?.allDay as boolean | undefined) ??
		(typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start));
	const attendees = normalizeAttendees((e?.attendees as unknown[]) || []);
	const reminderOverrides = normalizeReminderOverrides(
		((e?.reminderOverrides as unknown[]) ||
			((e?.reminders as Record<string, unknown>)?.overrides as unknown[]) ||
			[]),
	);
	const remindersUseDefault =
		(e?.remindersUseDefault as boolean | undefined) ??
		((e?.reminders as Record<string, unknown>)?.useDefault as boolean | undefined) ??
		true;
	const meetLink = String(e?.meetLink || e?.hangoutLink || "").trim() || "";
	const conferenceData = e?.conferenceData as Record<string, unknown> | undefined;
	const conferenceStatus =
		String(e?.conferenceStatus || "").trim() ||
		(conferenceData?.createRequest as Record<string, unknown> | undefined)
			?.status as string | undefined &&
		((conferenceData?.createRequest as Record<string, unknown>)?.status as Record<string, unknown>)
			?.statusCode as string ||
		null;

	return {
		id: e?.id as string | undefined,
		title:
			typeof e?.title === "string"
				? e.title
				: typeof e?.summary === "string"
					? e.summary
					: "",
		date: (e?.date as string | undefined) || extractDateString(start || end || new Date()),
		startTime: allDay ? "" : formatLocalTime(start),
		endTime: allDay ? "" : formatLocalTime(end),
		start: start || null,
		end: end || null,
		allDay: !!allDay,
		location: (e?.location as string | undefined) || "",
		description: (e?.description as string | undefined) || "",
		attendees,
		visibility: (e?.visibility as string | undefined) || "default",
		availability:
			String((e?.availability as string | undefined) || "").trim() === "free" ||
			e?.transparency === "transparent"
				? "free"
				: "busy",
		meetLink,
		addGoogleMeet:
			(e?.addGoogleMeet as boolean | undefined) ?? !!(meetLink || conferenceStatus),
		conferenceStatus: (conferenceStatus as string | null | undefined) ?? null,
		remindersUseDefault: remindersUseDefault !== false,
		reminderOverrides,
		sendUpdates: (e?.sendUpdates as boolean | undefined) ?? true,
		recurrence: Array.isArray(e?.recurrence) ? (e.recurrence as string[]) : [],
		repeat:
			(e?.repeat as EventRepeat | null | undefined) ||
			parseEventRepeat(
				Array.isArray(e?.recurrence) ? (e.recurrence as string[]) : [],
				(e?.date as string | undefined) || extractDateString(start || end || new Date()),
			),
		recurringEventId: String(e?.recurringEventId || "").trim() || null,
		originalStartTime:
			(e?.originalStartTime as string | undefined) ||
			((e?.originalStart as Record<string, unknown>)?.dateTime as string | undefined) ||
			((e?.originalStart as Record<string, unknown>)?.date as string | undefined) ||
			null,
		seriesEventId:
			String(e?.seriesEventId || e?.recurringEventId || e?.id || "").trim() ||
			null,
	};
};

const normalizeTask = (task: unknown): Task => {
	const t = task as Record<string, unknown> | null | undefined;
	const description = stripLegacyTaskMetadata(
		String((t?.description ?? t?.notes ?? "") as string),
	);
	const date =
		(t?.date as string | undefined) ||
		extractTaskDateString((t?.due as string | undefined) || "") ||
		extractDateString((t?.updated as string | undefined) || "");
	const completed =
		typeof t?.completed === "boolean"
			? t.completed
			: String((t?.status as string | undefined) || "").toLowerCase() === "completed";
	const completedAt =
		typeof t?.completedAt === "string" && (t.completedAt as string).trim()
			? (t.completedAt as string).trim()
			: typeof t?.completed === "string" && (t.completed as string).trim()
				? (t.completed as string).trim()
				: "";

	return {
		id: t?.id as string | undefined,
		taskListId: (t?.taskListId as string | undefined) || "@default",
		title: (t?.title as string | undefined) || (t?.text as string | undefined) || "",
		text: (t?.title as string | undefined) || (t?.text as string | undefined) || "",
		date,
		due: (t?.due as string | undefined) || (date ? toTaskDueIso(date) ?? null : null),
		description,
		completed,
		completedAt,
		notes: description,
		updated: (t?.updated as string | undefined) || null,
	};
};

const getProviderToken = async (): Promise<string | null | undefined> =>
	useAuthStore.getState().ensureProviderToken?.();

const isGoogleAuthErrorMessage = (message = ""): boolean => {
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

const getGoogleSyncErrorMessage = (error: unknown, fallbackMessage: string): string => {
	const message = (error as { message?: string })?.message || fallbackMessage;
	return isGoogleAuthErrorMessage(message)
		? GOOGLE_SYNC_AUTH_ERROR
		: message;
};

const parseEdgeResponse = async (response: Response): Promise<unknown> => {
	const text = await response.text().catch(() => "");
	if (!text) return null;

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

const invokeGoogleFunction = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
	if (!supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY || isGuest()) return null;

	const { data: { session } } = await supabase.auth.getSession();
	const bearerToken = session?.access_token ?? SUPABASE_ANON_KEY;

	const controller = new AbortController();
	const timerId = window.setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
	try {
		const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${bearerToken}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		const payload = await parseEdgeResponse(response);
		if (!response.ok) {
			const p = payload as Record<string, unknown> | string | null;
			const detail =
				typeof p === "string"
					? p
					: (p as Record<string, unknown> | null)?.error ||
					  (p as Record<string, unknown> | null)?.message ||
					  JSON.stringify(p || {});
			throw new Error(`HTTP ${response.status}: ${detail}`);
		}

		return payload;
	} catch (error) {
		if ((error as { name?: string })?.name === "AbortError") {
			throw new Error(`Edge function timeout after ${EDGE_TIMEOUT_MS}ms`);
		}
		throw error;
	} finally {
		window.clearTimeout(timerId);
	}
};

// Google edge 호출 + 인증 실패(401/403) 시 토큰 강제 갱신 후 1회 자동 재시도.
// 세션 복원으로 provider_token이 만료된 경우 재로그인 없이 복구한다.
const invokeGoogleWithAuth = async (
	name: string,
	body: Record<string, unknown>,
	token: string,
): Promise<unknown> => {
	try {
		return await invokeGoogleFunction(name, { ...body, token });
	} catch (err) {
		if (!isGoogleAuthErrorMessage((err as { message?: string })?.message ?? "")) throw err;
		const fresh = await useAuthStore.getState().ensureProviderToken?.(true);
		if (!fresh || fresh === token) throw err; // 새 토큰을 못 받으면 원래 에러 전파
		return invokeGoogleFunction(name, { ...body, token: fresh });
	}
};

const eventMatchesMonth = (event: CalendarEvent, monthKey: string): boolean => {
	if (!monthKey) return true;
	return String(event?.date || "").slice(0, 7) === monthKey;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGoogleCalendarStore = create<GoogleCalendarState>()((set, get) => ({
	events: (readLocalEvents() as unknown[]).map((e) => normalizeEvent(e as Record<string, unknown>)),
	tasks: (readLocalTasks() as unknown[]).map(normalizeTask),
	taskLists: [],
	taskListsLoaded: false,
	selectedTaskListFilter: normalizeTaskListFilterId(readTaskListFilter()),
	selectedDate: null,
	loadedMonthKey: null,
	tasksLoaded: false,
	loading: false,
	error: null,
	pinAuthenticated: false,

	setSelectedDate: (dateStr: string | null) => {
		set({ selectedDate: dateStr });
	},

	setSelectedTaskListFilter: (taskListFilterId: string) => {
		const resolvedFilterId = resolveTaskListFilterId(
			taskListFilterId,
			get().taskLists.length > 0 ? get().taskLists : FALLBACK_TASK_LISTS,
		);
		writeTaskListFilter(resolvedFilterId);
		set({ selectedTaskListFilter: resolvedFilterId });
	},

	fetchEvents: async (options: FetchEventsOptions = {}) => {
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
				const localEvents = (readLocalEvents() as unknown[])
					.map((e) => normalizeEvent(e as Record<string, unknown>))
					.filter((event) => eventMatchesMonth(event, monthKey));
				set({ events: localEvents, loadedMonthKey: monthKey, error: null });
				return localEvents;
			}
			const token = await getProviderToken();
			if (!token) {
				const cachedEvents = (readLocalEvents() as unknown[])
					.map((e) => normalizeEvent(e as Record<string, unknown>))
					.filter((event) => eventMatchesMonth(event, monthKey));
				if (skipLoading) {
					set({ events: cachedEvents, loadedMonthKey: monthKey });
					return cachedEvents;
				}
				throw new Error(GOOGLE_SYNC_AUTH_ERROR);
			}

			const data = await invokeGoogleWithAuth("events", {
				action: "list",
				timeMin,
				timeMax,
			}, token);

			const events = Array.isArray(data)
				? (data as unknown[]).map((e) => normalizeEvent(e as Record<string, unknown>))
				: [];
			set({ events, loadedMonthKey: monthKey, error: null });
			writeLocalEvents(events);
			return events;
		} catch (err) {
			const message = getGoogleSyncErrorMessage(
				err,
				"Failed to load calendar events.",
			);
			const cachedEvents = (readLocalEvents() as unknown[])
				.map((e) => normalizeEvent(e as Record<string, unknown>))
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

	fetchTasks: async (options: FetchTasksOptions = {}) => {
		const { skipLoading = false } = options;
		if (!skipLoading) {
			set({ loading: true, error: null });
		}

		try {
			if (!supabase) {
				const localTasks = (readLocalTasks() as unknown[]).map(normalizeTask);
				set({ tasks: localTasks, tasksLoaded: true, error: null });
				return localTasks;
			}
			const token = await getProviderToken();
			if (!token) {
				const cachedTasks = (readLocalTasks() as unknown[]).map(normalizeTask);
				if (skipLoading) {
					set({ tasks: cachedTasks, tasksLoaded: true });
					return cachedTasks;
				}
				throw new Error(GOOGLE_SYNC_AUTH_ERROR);
			}

			const [listsData, data] = await Promise.all([
				get().taskListsLoaded && hasRealTaskLists(get().taskLists)
					? Promise.resolve(get().taskLists)
					: invokeGoogleWithAuth("tasks", {
						action: "listTaskLists",
					}, token).catch((err) => {
						console.warn("[gcal] listTaskLists failed, using fallback:", err);
						return FALLBACK_TASK_LISTS;
					}),
				invokeGoogleWithAuth("tasks", {
					action: "list",
					showCompleted: true,
					showHidden: true,
					allTaskLists: true,
				}, token),
			]);

			const tasks = Array.isArray(data) ? (data as unknown[]).map(normalizeTask) : [];
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
			const cachedTasks = (readLocalTasks() as unknown[]).map(normalizeTask);
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
			const data = await invokeGoogleWithAuth("tasks", {
				action: "listTaskLists",
			}, token);
			const lists = normalizeTaskListsPayload(data);
			const selectedTaskListFilter = resolveTaskListFilterId(
				get().selectedTaskListFilter,
				lists,
			);
			writeTaskListFilter(selectedTaskListFilter);
			set({ taskLists: lists, taskListsLoaded: true, selectedTaskListFilter });
			return lists;
		} catch (err) {
			console.warn("[gcal] fetchTaskLists failed, using fallback:", err);
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

	createTaskList: async (title: string) => {
		const trimmedTitle = String(title || "").trim();
		if (!trimmedTitle) {
			throw new Error("Task list title is required.");
		}

		set({ loading: true, error: null });
		try {
			let created: TaskList = {
				id: `list_${Date.now()}`,
				title: trimmedTitle,
				updated: new Date().toISOString(),
			};

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleWithAuth("tasks", {
					action: "createTaskList",
					title: trimmedTitle,
				}, token) as Record<string, unknown> | null;
				created = {
					id: String(data?.id || created.id).trim() || created.id,
					title: String(data?.title || trimmedTitle).trim() || trimmedTitle,
					updated: (data?.updated as string | undefined) || created.updated,
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

	fetchEventsAndTasks: async (options: FetchEventsAndTasksOptions = {}) => {
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
			set({ error: (err as { message?: string })?.message || "Failed to load calendar data." });
			throw err;
		} finally {
			set({ loading: false });
		}
	},

	readEvent: async (eventId: string) => {
		if (!eventId) return null;

		try {
			if (!supabase) {
				const localEvent = (readLocalEvents() as unknown[])
					.map((e) => normalizeEvent(e as Record<string, unknown>))
					.find((event) => event.id === eventId);
				return localEvent || null;
			}

			const token = await getProviderToken();
			if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);

			const data = await invokeGoogleWithAuth("events", {
				action: "read",
				eventId,
			}, token);
			return data ? normalizeEvent(data as Record<string, unknown>) : null;
		} catch (err) {
			set({
				error: getGoogleSyncErrorMessage(err, "Failed to load event details."),
			});
			throw err;
		}
	},

	addEvent: async (eventData: AddEventData) => {
		set({ loading: true, error: null });
		try {
			const normalizedEvent = normalizeEvent({
				...(eventData as Record<string, unknown>),
				recurrence:
					eventData?.recurrence ||
					buildEventRecurrence(eventData?.repeat, eventData?.date),
			});

			let created = normalizedEvent;
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleWithAuth("events", {
					action: "create",
					...(normalizedEvent as unknown as Record<string, unknown>),
					timeZone: getLocalTimeZone(),
				}, token);
				created = normalizeEvent(data as Record<string, unknown>);
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
							? toLocalDateTimeIso(normalizedEvent.date, normalizedEvent.startTime) ?? null
							: normalizedEvent.date),
					end:
						normalizedEvent.end ||
						(normalizedEvent.date && normalizedEvent.endTime
							? toLocalDateTimeIso(normalizedEvent.date, normalizedEvent.endTime) ?? null
							: normalizedEvent.date),
				};
			}

			if (!supabase) {
				const allLocalEvents = [
					...(readLocalEvents() as unknown[])
						.map((e) => normalizeEvent(e as Record<string, unknown>))
						.filter((event) => event.id !== created.id),
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

	updateEvent: async (eventId: string, updates: UpdateEventData) => {
		set({ loading: true, error: null });
		try {
			const current = get().events.find((event) => event.id === eventId);
			const merged = normalizeEvent({
				...(current as unknown as Record<string, unknown> || {}),
				...(updates as unknown as Record<string, unknown> || {}),
				// Null out the stale ISO start/end so normalizeEvent picks up
				// the new HH:MM startTime/endTime from updates instead.
				start: null,
				end: null,
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
				const data = await invokeGoogleWithAuth("events", {
					action: "update",
					eventId,
					...(merged as unknown as Record<string, unknown>),
					timeZone: getLocalTimeZone(),
				}, token);
				updated = normalizeEvent(data as Record<string, unknown>);
				await get().fetchEvents({
					date: merged.date || get().selectedDate || formatLocalDate(),
					force: true,
					skipLoading: true,
				});
			}

			if (!supabase) {
				const allLocalEvents = (readLocalEvents() as unknown[])
					.map((e) => normalizeEvent(e as Record<string, unknown>))
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

	deleteEvent: async (eventId: string) => {
		set({ loading: true, error: null });
		try {
			const current = get().events.find((event) => event.id === eventId);
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				await invokeGoogleWithAuth("events", {
					action: "delete",
					eventId,
				}, token);
				await get().fetchEvents({
					date: current?.date || get().selectedDate || formatLocalDate(),
					force: true,
					skipLoading: true,
				});
			}

			if (!supabase) {
				const nextLocalEvents = (readLocalEvents() as unknown[])
					.map((e) => normalizeEvent(e as Record<string, unknown>))
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

	addTask: async (taskData: AddTaskData) => {
		set({ loading: true, error: null });
		try {
			const normalizedTask = normalizeTask(taskData);
			const taskListId = (taskData as Record<string, unknown>).taskListId as string | undefined
				|| normalizedTask.taskListId
				|| "@default";
			const payload: Record<string, unknown> = {
				title: normalizedTask.title,
				notes: buildTaskNotes(normalizedTask.description),
				due: toTaskDueIso(normalizedTask.date || formatLocalDate()),
				status: normalizedTask.completed ? "completed" : "needsAction",
				completed:
					normalizedTask.completed
						? normalizedTask.completedAt || toTaskCompletedIso()
						: null,
			};

			let created: Task = {
				...normalizedTask,
				id: `task_${Date.now()}`,
				due: payload.due as string | null,
				taskListId,
			};

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				const data = await invokeGoogleWithAuth("tasks", {
					action: "create",
					taskListId,
					...payload,
				}, token) as Record<string, unknown> | null;
				created = normalizeTask({
					...normalizedTask,
					...(data || {}),
					taskListId,
					notes: data?.notes ?? payload.notes,
					due: data?.due ?? payload.due,
					status: data?.status ?? payload.status,
					completedAt: data?.completedAt ?? data?.completed ?? payload.completed,
				});
			}

			const nextTasks = [
				...(readLocalTasks() as unknown[]).map(normalizeTask).filter((task) => task.id !== created.id),
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

	updateTask: async (taskId: string, updates: UpdateTaskData) => {
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
			const taskListId =
				(updates as Record<string, unknown>)?.taskListId as string | undefined
				|| current?.taskListId
				|| merged.taskListId
				|| "@default";
			const currentTaskListId =
				current?.taskListId || merged.taskListId || "@default";
			const payload: Record<string, unknown> = {
				title: merged.title,
				notes: buildTaskNotes(merged.description),
				due: toTaskDueIso(merged.date || formatLocalDate()),
				status: merged.completed ? "completed" : "needsAction",
				completed:
					merged.completed
						? merged.completedAt || toTaskCompletedIso()
						: null,
			};

			let updated: Task = { ...merged, due: payload.due as string | null, taskListId };
			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				if (currentTaskListId !== taskListId) {
					await invokeGoogleWithAuth("tasks", {
						action: "move",
						taskId,
						sourceTaskListId: currentTaskListId,
						destinationTaskListId: taskListId,
					}, token);
				}
				const data = await invokeGoogleWithAuth("tasks", {
					action: "update",
					taskId,
					taskListId,
					...payload,
				}, token) as Record<string, unknown> | null;
				updated = normalizeTask({
					...merged,
					...(data || {}),
					taskListId,
					notes: data?.notes ?? payload.notes,
					due: data?.due ?? payload.due,
					status: data?.status ?? payload.status,
					completedAt: data?.completedAt ?? data?.completed ?? payload.completed,
				});
			}

			const nextLocalTasks = (readLocalTasks() as unknown[])
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

	deleteTask: async (taskId: string) => {
		set({ loading: true, error: null });
		try {
			const current = get().tasks.find((task) => task.id === taskId);

			if (supabase) {
				const token = await getProviderToken();
				if (!token) throw new Error(GOOGLE_SYNC_AUTH_ERROR);
				await invokeGoogleWithAuth("tasks", {
					action: "delete",
					taskId,
					taskListId: current?.taskListId || "@default",
				}, token);
			}

			const nextLocalTasks = (readLocalTasks() as unknown[])
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

	setPinAuthenticated: (isAuthenticated: boolean) => {
		set({ pinAuthenticated: isAuthenticated });
	},
}));
