import { supabase } from "../lib/supabase";
import { useDataStore } from "../store/useDataStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useGoogleCalendarStore } from "../store/useGoogleCalendarStore";
import { useSettingsStore } from "../store/useSettingsStore";
import i18n from "../l10n/i18n";
import { formatLocalDate, isSameLocalDate } from "../utils/date";
import { materializeTasksForDate } from "../utils/taskRecurrence";
import { generateDiary } from "./aiService";

const resolveDiaryGenerationLanguage = () => {
	const diaryLanguage = useSettingsStore.getState().diaryLanguage || "app";
	if (diaryLanguage === "ko" || diaryLanguage === "en") {
		return diaryLanguage;
	}
	return i18n.language === "en" ? "en" : "ko";
};

const filterEventsForDate = (events = [], dateStr) => {
	if (!Array.isArray(events)) return [];

	return events.filter((event) => {
		const start = event?.start || event?.date || null;
		if (!start) return false;
		return isSameLocalDate(start, dateStr);
	});
};

const fetchCalendarEventsForDate = async (dateStr) => {
	const cachedEvents = filterEventsForDate(
		useDataStore.getState().calEvents || [],
		dateStr,
	);

	if (cachedEvents.length > 0 || !supabase) {
		return cachedEvents;
	}

	try {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		const token = session?.provider_token;

		if (!token) {
			return cachedEvents;
		}

		const { data, error } = await supabase.functions.invoke("events", {
			body: {
				token,
				date: dateStr,
			},
		});

		if (error) {
			throw error;
		}

		return filterEventsForDate(data || [], dateStr);
	} catch (error) {
		console.warn(
			`[Diary] Failed to fetch calendar events for ${dateStr}:`,
			error?.message || error,
		);
		return cachedEvents;
	}
};

const fetchCompletedTasksForDate = async (dateStr) => {
	let tasks = useGoogleCalendarStore.getState().tasks || [];

	if (!Array.isArray(tasks) || tasks.length === 0) {
		try {
			await useGoogleCalendarStore.getState().fetchTasks({ skipLoading: true });
			tasks = useGoogleCalendarStore.getState().tasks || [];
		} catch (error) {
			console.warn(
				`[Diary] Failed to fetch tasks for ${dateStr}:`,
				error?.message || error,
			);
		}
	}

	return materializeTasksForDate(tasks, dateStr).filter((task) => task.completed);
};

export const buildDiaryGenerationContext = async (
	dateStr,
	{ wasActiveDay } = {},
) => {
	const dataStore = useDataStore.getState();
	const diaryStore = useDiaryStore.getState();
	const existingEntry = diaryStore.getDiary(dateStr);
	const diaryAnswers = diaryStore.getAnswers(dateStr) || [];

	const inferredWasActiveDay =
		diaryStore.wasActiveOn?.(dateStr) ||
		dateStr === formatLocalDate() ||
		diaryAnswers.length > 0 ||
		!!(existingEntry?.notes || existingEntry?.memo || "").trim();

	return {
		completedTodos: await fetchCompletedTasksForDate(dateStr),
		diaryAnswers,
		memo: existingEntry?.notes || existingEntry?.memo || "",
		weather: dataStore.weather,
		stocks: dataStore.stocks,
		trends: dataStore.trends,
		calEvents: await fetchCalendarEventsForDate(dateStr),
		date: dateStr,
		wasActiveDay:
			typeof wasActiveDay === "boolean"
				? wasActiveDay
				: inferredWasActiveDay,
	};
};

export const generateAndSaveDiaryForDate = async (
	dateStr,
	{ overwrite = false, wasActiveDay } = {},
) => {
	const diaryStore = useDiaryStore.getState();
	const existingEntry = diaryStore.getDiary(dateStr);

	if (!overwrite && existingEntry?.diary?.trim()) {
		return {
			ok: true,
			skipped: true,
			text: existingEntry.diary,
		};
	}

	const payload = await buildDiaryGenerationContext(dateStr, { wasActiveDay });
	const diaryText = await generateDiary({
		...payload,
		language: resolveDiaryGenerationLanguage(),
	});

	if (!diaryText?.trim()) {
		return {
			ok: false,
			error: "Diary generation returned empty text.",
		};
	}

	await diaryStore.saveGeneratedDiary(dateStr, diaryText.trim());

	return {
		ok: true,
		skipped: false,
		text: diaryText.trim(),
	};
};
