import { useDataStore } from "../store/useDataStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useGoogleCalendarStore } from "../store/useGoogleCalendarStore";
import { useSettingsStore } from "../store/useSettingsStore";
import i18n from "../l10n/i18n";
import { formatLocalDate, isSameLocalDate, shiftDateString } from "../utils/date";
import { materializeTasksForDate } from "../utils/taskRecurrence";
import { generateDiary } from "./aiService";
import { mergeInterestLists } from "../utils/interests";
import { handleApiError } from "../utils/errorHandler";
import type { CalEvent, WeatherData, TodoItem, Interest } from "../types/index";

interface DiaryGenerationOptions {
	overwrite?: boolean;
	wasActiveDay?: boolean;
	briefingSnapshots?: unknown[];
	previousDayDiary?: string;
	previousDayFeedback?: string;
}

interface DiaryGenerationContext {
	completedTodos: TodoItem[];
	diaryAnswers: unknown[];
	qaPairs: { question: string; answer: string }[];
	memo: string;
	weather: WeatherData | null;
	trends: string[];
	calEvents: CalEvent[];
	date: string;
	wasActiveDay: boolean;
	interests: Interest[];
	briefingSnapshots: unknown[];
	previousDayDiary: string;
	previousDayFeedback: string;
}

interface DiaryGenerationResult {
	ok: boolean;
	skipped?: boolean;
	text?: string;
	error?: string;
}

export const resolveDiaryGenerationLanguage = (): string => {
	const diaryLanguage = useSettingsStore.getState().diaryLanguage || "app";
	if (diaryLanguage === "ko" || diaryLanguage === "en") {
		return diaryLanguage;
	}
	return i18n.language === "en" ? "en" : "ko";
};

const filterEventsForDate = (events: CalEvent[] = [], dateStr: string): CalEvent[] => {
	if (!Array.isArray(events)) return [];

	return events.filter((event) => {
		if ((event as CalEvent & { date?: string })?.date === dateStr) return true;
		const start = event?.start || (event as CalEvent & { startTime?: string })?.startTime || null;
		return start ? isSameLocalDate(start, dateStr) : false;
	});
};

const fetchCalendarEventsForDate = async (dateStr: string): Promise<CalEvent[]> => {
	const calendarStore = useGoogleCalendarStore.getState();
	let events = filterEventsForDate((calendarStore.events || []) as CalEvent[], dateStr);

	if (events.length === 0 && typeof calendarStore.fetchEvents === "function") {
		try {
			await calendarStore.fetchEvents({ date: dateStr, skipLoading: true });
			events = filterEventsForDate(
				(useGoogleCalendarStore.getState().events || []) as CalEvent[],
				dateStr,
			);
		} catch (error) {
			handleApiError(error, `diary:calendar:${dateStr}`);
		}
	}

	return events;
};

const fetchCompletedTasksForDate = async (dateStr: string): Promise<TodoItem[]> => {
	let tasks = useGoogleCalendarStore.getState().tasks || [];

	if (!Array.isArray(tasks) || tasks.length === 0) {
		try {
			await useGoogleCalendarStore.getState().fetchTasks({ skipLoading: true });
			tasks = useGoogleCalendarStore.getState().tasks || [];
		} catch (error) {
			handleApiError(error, `diary:tasks:${dateStr}`);
		}
	}

	return (materializeTasksForDate(tasks as unknown as Parameters<typeof materializeTasksForDate>[0], dateStr) as unknown as TodoItem[]).filter((task) => task.completed);
};

export const buildDiaryGenerationContext = async (
	dateStr: string,
	{ wasActiveDay, briefingSnapshots, previousDayDiary, previousDayFeedback }: DiaryGenerationOptions = {},
): Promise<DiaryGenerationContext> => {
	const dataStore = useDataStore.getState();
	const diaryStore = useDiaryStore.getState();
	const existingEntry = diaryStore.getDiary(dateStr);
	const diaryAnswers = diaryStore.getAnswers(dateStr) || [];
	const qaPairs = await diaryStore.fetchQAForDate(dateStr);
	const answers = diaryAnswers.length > 0 ? diaryAnswers : qaPairs.map((p) => p.answer).filter(Boolean);

	const inferredWasActiveDay =
		diaryStore.wasActiveOn?.(dateStr) ||
		dateStr === formatLocalDate() ||
		answers.length > 0 ||
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
			?.map((f: { text?: string }) => f.text)
			.filter(Boolean)
			.join("\n") || "";
	}

	return {
		completedTodos: await fetchCompletedTasksForDate(dateStr),
		diaryAnswers: answers,
		qaPairs,
		memo: existingEntry?.notes || existingEntry?.memo || "",
		weather: dataStore.weather as WeatherData | null,
		trends: dataStore.trends as string[],
		calEvents: await fetchCalendarEventsForDate(dateStr),
		date: dateStr,
		wasActiveDay:
			typeof wasActiveDay === "boolean"
				? wasActiveDay
				: inferredWasActiveDay,
		interests: mergeInterestLists(
			settingsStore.fixedInterestIds ?? [],
			settingsStore.keywordInterests ?? []
		).slice(0, 8) as Interest[],
		briefingSnapshots: Array.isArray(briefingSnapshots) ? briefingSnapshots : [],
		previousDayDiary: prevDiary || "",
		previousDayFeedback: prevFeedback || "",
	};
};

export const generateAndSaveDiaryForDate = async (
	dateStr: string,
	{ overwrite = false, wasActiveDay, briefingSnapshots, previousDayDiary, previousDayFeedback }: DiaryGenerationOptions = {},
): Promise<DiaryGenerationResult> => {
	const diaryStore = useDiaryStore.getState();
	// 암호화 켜짐+잠김: 본문을 읽을 수 없고 저장도 불가 — AI 호출 전에 실패로 반환 (호출부는 재시도 대상으로 취급)
	if (diaryStore.encryptionStatus === "locked") {
		return { ok: false, error: "diary_locked" };
	}
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
	const diaryText = await (generateDiary as (opts: Record<string, unknown>) => Promise<string>)({
		...(payload as unknown as Record<string, unknown>),
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
