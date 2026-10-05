import { handleApiError } from "../../utils/errorHandler";
import type {
	WeatherData,
	CalEvent,
} from "../../types/index";
import { invokeFunction } from "./client";

const normalizeDiaryLineText = (value: unknown, fallback = "") => {
	const text = String(value || "").trim();
	if (!text || text === "(no title)") return fallback;
	return text.replace(/\s+/g, " ");
};

const extractTimeLabel = (value: unknown) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	if (/^\d{2}:\d{2}$/.test(raw)) return raw;
	const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
	if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
	return "";
};

const buildWeatherSummary = (weather: (WeatherData & Record<string, unknown>) | null | undefined) => {
	if (!weather || typeof weather !== "object") return "";
	const temp =
		weather?.temp ?? weather?.temperature ?? weather?.currentTemp ?? null;
	const condition = normalizeDiaryLineText(
		weather?.condition ||
			weather?.description ||
			weather?.summary ||
			weather?.main,
	);
	return [temp !== null && temp !== undefined ? `${temp}°C` : "", condition]
		.filter(Boolean)
		.join(" ");
};

const DIARY_DATE_FORMATTERS_V2 = {
	ko: new Intl.DateTimeFormat("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}),
	en: new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}),
};

const resolveDiaryLanguage = (language = "ko") =>
	language === "en" ? "en" : "ko";

const getDiaryCopy = (language = "ko") =>
	resolveDiaryLanguage(language) === "en"
		? {
				targetLanguageName: "English",
				untitledEvent: "Untitled event",
				untitledTask: "Untitled task",
				allDay: "All day",
				titleLabel: "Title",
				dateLabel: "Date",
				scheduleHeading: "Schedule",
				completedHeading: "Completed",
				notesHeading: "Notes",
				noSchedule: "No scheduled items",
				noCompleted: "Nothing marked complete",
				fallbackTitleBoth: "A day of plans and checkmarks",
				fallbackTitleCompleted: "A day of completions",
				fallbackTitleScheduled: "A day shaped by plans",
				fallbackTitleActive: "A day with notes",
				fallbackTitleQuiet: "A quiet day",
				scheduleSentence: (formattedDate: string, scheduleLines: string[]) =>
					`${formattedDate} included ${scheduleLines.join(", ")}.`,
				noScheduleSentence: (formattedDate: string) =>
					`${formattedDate} had no recorded schedule.`,
				completedSentence: (completedLines: string[]) =>
					`Completed items included ${completedLines.join(", ")}.`,
				noCompletedSentence: "No tasks were marked complete.",
				weatherSentence: (weatherSummary: string) =>
					`The weather note for the day was ${weatherSummary}.`,
				answerSentence: (answer: string) =>
					`The daily question response was "${answer}".`,
				memoSentence: (memoText: string) =>
					`The memo for the day said "${memoText}".`,
				inactiveSentence:
					"There was no app activity record, so this entry uses only automatically collected data.",
		}
		: {
				targetLanguageName: "Korean",
				untitledEvent: "제목 없는 일정",
				untitledTask: "제목 없는 작업",
				allDay: "종일",
				titleLabel: "제목",
				dateLabel: "날짜",
				scheduleHeading: "일정",
				completedHeading: "완료한 일",
				notesHeading: "기록",
				noSchedule: "일정 없음",
				noCompleted: "완료한 일 없음",
				fallbackTitleBoth: "일정과 완료가 겹친 날",
				fallbackTitleCompleted: "완료가 쌓인 하루",
				fallbackTitleScheduled: "일정이 이어진 하루",
				fallbackTitleActive: "기록이 남은 하루",
				fallbackTitleQuiet: "조용한 하루",
				scheduleSentence: (formattedDate: string, scheduleLines: string[]) =>
					`${formattedDate}에는 ${scheduleLines.join(", ")} 일정이 있었다.`,
				noScheduleSentence: (formattedDate: string) =>
					`${formattedDate}에는 기록된 일정이 없었다.`,
				completedSentence: (completedLines: string[]) =>
					`완료한 일로는 ${completedLines.join(", ")}가 있었다.`,
				noCompletedSentence: "완료로 표시한 일은 없었다.",
				weatherSentence: (weatherSummary: string) =>
					`날씨 기록은 ${weatherSummary}였다.`,
				answerSentence: (answer: string) =>
					`하루 질문 답변에는 "${answer}"가 남아 있었다.`,
				memoSentence: (memoText: string) =>
					`Memo에는 "${memoText}"가 남아 있었다.`,
				inactiveSentence:
					"앱 접속 기록이 없어 자동 수집된 데이터만 정리했다.",
		};

const formatDiaryDateLabelForLanguage = (dateStr: string | null | undefined, language = "ko") => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime())
		? dateStr
		: (DIARY_DATE_FORMATTERS_V2 as Record<string, Intl.DateTimeFormat>)[resolveDiaryLanguage(language)].format(date);
};

const buildDiaryEventLinesForLanguage = (events: { title?: string; summary?: string; startTime?: string; start?: string; endTime?: string; end?: string }[] = [], language = "ko") => {
	const copy = getDiaryCopy(language);
	return (Array.isArray(events) ? events : [])
		.map((event) => {
			const title = normalizeDiaryLineText(
				event?.title || event?.summary,
				copy.untitledEvent,
			);
			const start = extractTimeLabel(event?.startTime || event?.start);
			const end = extractTimeLabel(event?.endTime || event?.end);
			const timeLabel = start && end ? `${start}-${end}` : start || end || copy.allDay;
			return {
				sortKey: start || end || "00:00",
				line: `${timeLabel} ${title}`,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);
};

const buildDiaryCompletedTaskLinesForLanguage = (
	todos: { title?: string; text?: string; startTime?: string; endTime?: string }[] = [],
	language = "ko",
) => {
	const copy = getDiaryCopy(language);
	return (Array.isArray(todos) ? todos : [])
		.map((todo) => {
			const title = normalizeDiaryLineText(
				todo?.title || todo?.text,
				copy.untitledTask,
			);
			const timeLabel = extractTimeLabel(todo?.startTime || todo?.endTime);
			return {
				sortKey: timeLabel || "99:99",
				line: timeLabel ? `${timeLabel} ${title}` : title,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);
};

const buildDiaryFallbackTitleForLanguage = ({
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	wasActiveDay = false,
	language = "ko",
}: { scheduleLines?: string[]; completedLines?: string[]; wasActiveDay?: boolean; language?: string } = {}) => {
	const copy = getDiaryCopy(language);
	if (completedLines.length > 0 && scheduleLines.length > 0) {
		return copy.fallbackTitleBoth;
	}
	if (completedLines.length > 0) {
		return copy.fallbackTitleCompleted;
	}
	if (scheduleLines.length > 0) {
		return copy.fallbackTitleScheduled;
	}
	return wasActiveDay ? copy.fallbackTitleActive : copy.fallbackTitleQuiet;
};

const buildDiaryFallbackSummaryForLanguage = ({
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	weather,
	memo = "",
	diaryAnswers = [] as unknown[],
	wasActiveDay = false,
	language = "ko",
}: { formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; weather?: (WeatherData & Record<string, unknown>) | null; memo?: string; diaryAnswers?: unknown[]; wasActiveDay?: boolean; language?: string }) => {
	const copy = getDiaryCopy(language);
	const sentences = [];

	if (scheduleLines.length > 0) {
		sentences.push(copy.scheduleSentence(formattedDate, scheduleLines));
	} else {
		sentences.push(copy.noScheduleSentence(formattedDate));
	}

	if (completedLines.length > 0) {
		sentences.push(copy.completedSentence(completedLines));
	} else if (wasActiveDay) {
		sentences.push(copy.noCompletedSentence);
	}

	const weatherSummary = buildWeatherSummary(weather).replace("째C", "C");
	if (weatherSummary) {
		sentences.push(copy.weatherSentence(weatherSummary));
	}

	const firstAnswer = normalizeDiaryLineText(diaryAnswers?.[0] || "");
	if (firstAnswer) {
		sentences.push(copy.answerSentence(firstAnswer));
	}

	const memoText = normalizeDiaryLineText(memo);
	if (memoText) {
		sentences.push(copy.memoSentence(memoText));
	}

	if (!wasActiveDay) {
		sentences.push(copy.inactiveSentence);
	}

	return sentences.slice(0, 4).join(" ");
};

const buildDiaryTextForLanguage = ({
	title,
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	summary,
	language = "ko",
}: { title: string; formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; summary: string; language?: string }) => {
	const copy = getDiaryCopy(language);
	return [
		`${copy.titleLabel}: ${title}`,
		`${copy.dateLabel}: ${formattedDate}`,
		"",
		copy.scheduleHeading,
		...(scheduleLines.length > 0
			? scheduleLines.map((line) => `- ${line}`)
			: [`- ${copy.noSchedule}`]),
		"",
		copy.completedHeading,
		...(completedLines.length > 0
			? completedLines.map((line) => `- ${line}`)
			: [`- ${copy.noCompleted}`]),
		"",
		copy.notesHeading,
		summary,
	].join("\n");
};

/**
 * AI 일기 자동 생성
 * @param {Object} params
 * @param {string} params.briefingText - 당일 AI 브리핑
 * @param {Array} params.completedTodos - 완료된 Todo 리스트
 * @param {Object} params.weather - 날씨 데이터
 * @param {Array} params.trends - 뉴스/트렌드 요약
 * @param {Array} params.stocks - 증시/환율 데이터
 * @param {Array} params.calEvents - 캘린더 일정
 * @param {Array} params.diaryAnswers - DiaryCard 질문 답변
 * @param {string} params.date - 대상 날짜 (YYYY-MM-DD)
 * @param {boolean} params.wasActiveDay - true=접속했음(A), false=비접속(B)
 * @returns {string} 일기 텍스트
 */
export async function generateDiary({
	briefingText = "",
	completedTodos = [] as { title?: string; text?: string; startTime?: string; endTime?: string }[],
	weather = null as (WeatherData & Record<string, unknown>) | null,
	trends = [] as string[],
	calEvents = [] as CalEvent[],
	diaryAnswers = [] as unknown[],
	qaPairs = [] as { question: string; answer: string }[],
	memo = "",
	date = "",
	wasActiveDay = false,
	language = "ko",
	interests = [] as string[],
	briefingSnapshots = [] as { capturedAt?: string; text?: string; summary?: string; sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }[],
	previousDayDiary = "",
	previousDayFeedback = "",
}: {
	briefingText?: string;
	completedTodos?: { title?: string; text?: string; startTime?: string; endTime?: string }[];
	weather?: (WeatherData & Record<string, unknown>) | null;
	trends?: string[];
	calEvents?: CalEvent[];
	diaryAnswers?: unknown[];
	qaPairs?: { question: string; answer: string }[];
	memo?: string;
	date?: string;
	wasActiveDay?: boolean;
	language?: string;
	interests?: string[];
	briefingSnapshots?: { capturedAt?: string; text?: string; summary?: string; sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }[];
	previousDayDiary?: string;
	previousDayFeedback?: string;
} = {}) {
	const resolvedLanguage = resolveDiaryLanguage(language);
	const formattedDate =
		formatDiaryDateLabelForLanguage(date, resolvedLanguage) || date;
	const scheduleLines = buildDiaryEventLinesForLanguage(
		calEvents,
		resolvedLanguage,
	);
	const completedLines = buildDiaryCompletedTaskLinesForLanguage(
		completedTodos,
		resolvedLanguage,
	);

	const fallbackTitle = buildDiaryFallbackTitleForLanguage({
		scheduleLines,
		completedLines,
		wasActiveDay,
		language: resolvedLanguage,
	});
	const fallbackSummary = buildDiaryFallbackSummaryForLanguage({
		formattedDate,
		scheduleLines,
		completedLines,
		weather,
		memo,
		diaryAnswers,
		wasActiveDay,
		language: resolvedLanguage,
	});

	// 브리핑 스냅샷에서 뉴스/트렌드/스마트 키워드 헤드라인 추출
	const extractHeadlinesFromSnapshot = (snapshot: { sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }) => {
		const latestInfo = (snapshot.sections ?? []).find((sec) => sec.id === "latest_info");
		if (!latestInfo) return "";
		const allLines = [
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_news")?.lines ?? []),
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_trends")?.lines ?? []),
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_smart")?.lines ?? []),
		];
		const titles = allLines
			.filter((l) => typeof l === "object" && l?.title)
			.map((l) => `- ${l.title}`)
			.slice(0, 8);
		return titles.join("\n");
	};

	// 시간대별 브리핑 스냅샷 요약 (최대 6개, 텍스트 앞 200자 + 헤드라인)
	const snapshotLines = Array.isArray(briefingSnapshots)
		? briefingSnapshots.slice(0, 6).map((s) => {
				const time = s.capturedAt
					? new Date(s.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
					: "";
				const text = (s.text || s.summary || "").slice(0, 200);
				const headlines = extractHeadlinesFromSnapshot(s);
				const body = headlines ? `${text}\n[Headlines]\n${headlines}` : text;
				return time ? `[${time}] ${body}` : body;
			})
		: [];

	const promptContext = {
		date: formattedDate,
		wasActiveDay,
		scheduleLines,
		completedLines,
		weather,
		trends: Array.isArray(trends) ? trends.slice(0, 5) : [],
		diaryAnswers: Array.isArray(diaryAnswers) ? diaryAnswers.slice(0, 3) : [],
		qaPairs: Array.isArray(qaPairs) ? qaPairs.slice(0, 3).map((p) => ({ question: p.question, answer: p.answer })) : [],
		memo: normalizeDiaryLineText(memo),
		briefingText: snapshotLines.length > 0
			? snapshotLines.join("\n")
			: normalizeDiaryLineText(briefingText),
		previousDayDiary: normalizeDiaryLineText(previousDayDiary).slice(0, 400),
		previousDayFeedback: normalizeDiaryLineText(previousDayFeedback).slice(0, 200),
		interests: Array.isArray(interests)
			? interests.map((i) => (typeof i === "string" ? i : (i as { keyword?: string })?.keyword)).filter(Boolean).slice(0, 8)
			: [],
	};

	const isKoTarget = resolvedLanguage === "ko";

	const systemPromptV2 = isKoTarget
		? [
				"당신은 사용자의 하루를 정리하는 일기 보조 AI입니다.",
				"반드시 한국어(한글)로만 모든 텍스트를 작성하세요.",
				"일본어, 중국어, 러시아어, 아랍어 등 다른 언어/문자는 절대 사용하지 마세요.",
				'날짜는 "5월 15일"처럼 숫자+한글 형식으로 표기하세요 ("五月十五日" 같은 한자 단독 표기 금지).',
				"반드시 JSON 객체 하나만 반환하세요.",
				"summary는 사실 기반으로만 쓰고, 추측이나 감정 과장은 금지합니다.",
			].join("\n")
		: [
				"You are a diary assistant that summarizes a user's day from structured facts.",
				"Write ALL output strictly in English. Do not use Korean Hangul, Japanese kana, Chinese characters, Cyrillic, Arabic, or any other script.",
				'Use plain Latin letters for dates (e.g. "May 15"). Never use CJK or other non-Latin date formats.',
				"Return exactly one JSON object and nothing else.",
				"Summary must be factual only. Do not invent events, emotions, or conclusions not supported by the input.",
			].join("\n");

	const promptV2 = isKoTarget
		? [
				`${formattedDate}의 일기 제목과 요약을 한국어로 작성하세요.`,
				"반드시 한국어(한글)만 사용하고 다른 언어 문자는 절대 사용하지 마세요.",
				'반드시 아래 형식의 JSON만 반환하세요: {"title":"...","summary":"..."}',
				"",
				"규칙:",
				"- title: 3~10자 내외의 짧은 상징 문구 (한국어)",
				"- summary: 한국어 2~4문장, 사실 기반",
				"- 일정 목록과 완료 목록은 앱에서 따로 보여주므로 summary는 흐름 정리에 집중",
				"- memo가 있으면 사실 기반으로 자연스럽게 반영",
				"- 앱 미접속일이면 summary에 그 사실을 자연스럽게 포함",
				"- briefingText에 시간대별 브리핑 스냅샷이 있으면 이를 그날의 주요 내용으로 활용",
				"- previousDayDiary는 문체·톤·스타일 참고용입니다. 전날 사건이나 내용은 오늘 일기에 절대 포함하지 마세요.",
				"- 오늘 내용은 오직 입력 데이터(briefingText, completedLines, scheduleLines, diaryAnswers, qaPairs)에서만 가져오세요.",
				"- qaPairs는 사용자가 오늘 직접 답한 질문/답변입니다. 답변 내용을 그날의 개인적 사실로 자연스럽게 반영하되, 질문 문구를 그대로 옮겨 적지는 마세요.",
				"- previousDayFeedback이 있으면 해당 선호도(포함·제외 항목 등)를 오늘 일기에 반영하세요.",
				"",
				"입력 데이터:",
				JSON.stringify(promptContext, null, 2),
			].join("\n")
		: [
				`Write a diary title and summary for ${formattedDate}.`,
				"Write both fields strictly in English only. No other languages or scripts.",
				'Return JSON only in this shape: {"title":"...","summary":"..."}',
				"",
				"Rules:",
				"- Title should be short and symbolic, without exaggeration.",
				"- Summary should be 2 to 4 factual sentences.",
				"- The schedule and completed lists will already be shown separately, so connect the day naturally instead of repeating every bullet verbatim.",
				"- If memo exists, weave it in naturally as a factual note.",
				"- If the day was inactive, mention that naturally.",
				"- If user interests are listed and relevant data (trends, news) exists, briefly reference them naturally.",
				"- briefingText contains time-stamped briefing snapshots saved throughout the day — use them as the primary source for what actually happened.",
				"- previousDayDiary is a STYLE REFERENCE ONLY. Do not copy or reference any events, facts, or content from it into today's entry.",
				"- All content for today must come exclusively from the input data (briefingText, completedLines, scheduleLines, diaryAnswers, qaPairs).",
				"- qaPairs are the user's own answers to today's reflection questions. Use the answers as personal facts woven naturally into the entry; do not quote the question text verbatim.",
				"- If previousDayFeedback is provided, apply those preferences (e.g. what to include or exclude) to today's entry.",
				"",
				"Input data:",
				JSON.stringify(promptContext, null, 2),
			].join("\n");

	const containsForeignScripts = (text: string, targetLang: string) => {
		if (!text) return false;
		if (targetLang === "ko") {
			return /[぀-ゟ゠-ヿЀ-ӿ؀-ۿ֐-׿฀-๿ऀ-ॿ]/.test(text);
		}
		if (targetLang === "en") {
			return /[가-힯぀-ゟ゠-ヿ一-鿿Ѐ-ӿ؀-ۿ]/.test(text);
		}
		return false;
	};

	const data = await invokeFunction("groq", {
		prompt: promptV2,
		system: systemPromptV2,
	});

	if (data?.text) {
		try {
			const match = String(data.text).match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : String(data.text));
			const title = normalizeDiaryLineText(parsed?.title, fallbackTitle);
			const summary = normalizeDiaryLineText(parsed?.summary, fallbackSummary);

			const titleHasForeign = containsForeignScripts(title, resolvedLanguage);
			const summaryHasForeign = containsForeignScripts(summary, resolvedLanguage);

			if (titleHasForeign || summaryHasForeign) {
				handleApiError({ message: `foreign script in AI output (lang=${resolvedLanguage})` }, "ai:diary_script");
				return buildDiaryTextForLanguage({
					title: titleHasForeign ? fallbackTitle : title,
					formattedDate,
					scheduleLines,
					completedLines,
					summary: summaryHasForeign ? fallbackSummary : summary,
					language: resolvedLanguage,
				});
			}

			return buildDiaryTextForLanguage({
				title,
				formattedDate,
				scheduleLines,
				completedLines,
				summary,
				language: resolvedLanguage,
			});
		} catch (error) {
			handleApiError(error, "ai:diary_parse");
		}
	}

	return buildDiaryTextForLanguage({
		title: fallbackTitle,
		formattedDate,
		scheduleLines,
		completedLines,
		summary: fallbackSummary,
		language: resolvedLanguage,
	});
}

/**
 * 피드백 기반 일기 재작성
 * @param {string} originalDiary - aiGeneratedDiary (baseline, 불변)
 * @param {Array<{text: string}>} feedbackHistory - 누적 피드백 목록
 * @param {string} language - "ko" | "en"
 * @returns {string} 재작성된 일기 전문
 */
export async function rewriteDiaryWithFeedback({
	originalDiary = "",
	feedbackHistory = [] as { at?: string; text: string }[],
	language = "ko",
}: { originalDiary?: string; feedbackHistory?: { at?: string; text: string }[]; language?: string } = {}) {
	const resolvedLanguage = resolveDiaryLanguage(language);
	const isKo = resolvedLanguage === "ko";
	const feedbackText = feedbackHistory
		.map((f) => f.text || "")
		.filter(Boolean)
		.join("\n");

	const systemPrompt = isKo
		? [
				"당신은 사용자의 피드백을 바탕으로 일기를 개선하는 보조 AI입니다.",
				"원본 일기의 사실과 구조를 유지하되, 피드백에서 요청한 사항을 반영하여 다시 작성하세요.",
				"과장하거나 사실을 추가·삭제하지 마세요. 순수하게 표현과 스타일만 개선하세요.",
			].join("\n")
		: [
				"You are a diary improvement assistant. Rewrite the diary based on the user's feedback.",
				"Preserve all facts and structure from the original. Only improve expression and style per the feedback.",
				"Do not invent new facts or remove existing ones.",
			].join("\n");

	const prompt = isKo
		? [
				"아래 원본 일기를 피드백을 반영하여 다시 작성하세요.",
				"사실은 그대로 유지하되, 피드백 내용을 반영해 표현·어조를 개선하세요.",
				"JSON 없이 일기 본문 텍스트만 반환하세요.",
				"",
				"[원본 일기]",
				originalDiary,
				"",
				"[피드백]",
				feedbackText || "(없음)",
			].join("\n")
		: [
				"Rewrite the diary below based on the feedback.",
				"Keep all facts intact. Only adjust tone and style per the feedback.",
				"Return only the rewritten diary text, no JSON.",
				"",
				"[Original Diary]",
				originalDiary,
				"",
				"[Feedback]",
				feedbackText || "(none)",
			].join("\n");

	const data = await invokeFunction("groq", { prompt, system: systemPrompt });
	const rewritten = data?.text ? String(data.text).trim() : "";
	return rewritten || originalDiary;
}

