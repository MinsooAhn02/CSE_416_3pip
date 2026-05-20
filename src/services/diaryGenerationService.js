import { useDataStore } from "../store/useDataStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useGoogleCalendarStore } from "../store/useGoogleCalendarStore";
import { useSettingsStore } from "../store/useSettingsStore";
import i18n from "../l10n/i18n";
import { formatLocalDate, isSameLocalDate, shiftDateString } from "../utils/date";
import { materializeTasksForDate } from "../utils/taskRecurrence";
import { generateDiary } from "./aiService";
import { mergeInterestLists } from "../utils/interests";

export const resolveDiaryGenerationLanguage = () => {
	const diaryLanguage = useSettingsStore.getState().diaryLanguage || "app";
	if (diaryLanguage === "ko" || diaryLanguage === "en") {
		return diaryLanguage;
	}
	return i18n.language === "en" ? "en" : "ko";
};

const filterEventsForDate = (events = [], dateStr) => {
	if (!Array.isArray(events)) return [];

	return events.filter((event) => {
		if (event?.date === dateStr) return true;
		const start = event?.start || event?.startTime || null;
		return start ? isSameLocalDate(start, dateStr) : false;
	});
};

const fetchCalendarEventsForDate = async (dateStr) => {
	const calendarStore = useGoogleCalendarStore.getState();
	let events = filterEventsForDate(calendarStore.events || [], dateStr);

	if (events.length === 0 && typeof calendarStore.fetchEvents === "function") {
		try {
			await calendarStore.fetchEvents({ date: dateStr, skipLoading: true });
			events = filterEventsForDate(
				useGoogleCalendarStore.getState().events || [],
				dateStr,
			);
		} catch (error) {
			console.warn(
				`[Diary] Failed to fetch calendar events for ${dateStr}:`,
				error?.message || error,
			);
		}
	}

	return events;
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
	{ wasActiveDay, briefingSnapshots, previousDayDiary, previousDayFeedback } = {},
) => {
	const dataStore = useDataStore.getState();
	const diaryStore = useDiaryStore.getState();
	const existingEntry = diaryStore.getDiary(dateStr);
	const diaryAnswers = diaryStore.getAnswers(dateStr) || [];

	const inferredWasActiveDay =
		diaryStore.wasActiveOn?.(dateStr) ||
		dateStr === formatLocalDate() ||
		diaryAnswers.length > 0 ||
		!!(existingEntry?.notes || existingEntry?.memo || "").trim() ||
		!!(existingEntry?.diary || "").trim() ||
		(Array.isArray(briefingSnapshots) && briefingSnapshots.length > 0);

	const settingsStore = useSettingsStore.getState();

	// 전날 일기 + 피드백 — 미제공 시 store에서 직접 조회
	let prevDiary = previousDayDiary;
	let prevFeedback = previousDayFeedback;
	if (prevDiary === undefined) {
		const prevDateStr = shiftDateString(dateStr, -1);
		const prevEntry = diaryStore.getDiary(prevDateStr);
		prevDiary = prevEntry?.diary || "";
		prevFeedback = prevEntry?.feedback?.history
			?.map((f) => f.text)
			.filter(Boolean)
			.join("\n") || "";
	}

	return {
		completedTodos: await fetchCompletedTasksForDate(dateStr),
		diaryAnswers,
		memo: existingEntry?.notes || existingEntry?.memo || "",
		weather: dataStore.weather,
		trends: dataStore.trends,
		calEvents: await fetchCalendarEventsForDate(dateStr),
		date: dateStr,
		wasActiveDay:
			typeof wasActiveDay === "boolean"
				? wasActiveDay
				: inferredWasActiveDay,
		interests: mergeInterestLists(
			settingsStore.fixedInterestIds ?? [],
			settingsStore.keywordInterests ?? []
		).slice(0, 8),
		briefingSnapshots: Array.isArray(briefingSnapshots) ? briefingSnapshots : [],
		previousDayDiary: prevDiary || "",
		previousDayFeedback: prevFeedback || "",
	};
};

export const generateAndSaveDiaryForDate = async (
	dateStr,
	{ overwrite = false, wasActiveDay, briefingSnapshots, previousDayDiary, previousDayFeedback } = {},
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

	const payload = await buildDiaryGenerationContext(dateStr, {
		wasActiveDay,
		briefingSnapshots,
		previousDayDiary,
		previousDayFeedback,
	});
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
