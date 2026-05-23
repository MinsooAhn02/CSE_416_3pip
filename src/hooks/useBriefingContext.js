import { useMemo } from "react";
import { useSettingsStore } from "../store/useSettingsStore";
import { useDataStore } from "../store/useDataStore";
import { useTodoStore } from "../store/useTodoStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useAuthStore } from "../store/useAuthStore";
import { getSmartWidgetCacheKey, useWidgetStore } from "../store/useWidgetStore";
import { mergeInterestLists } from "../utils/interests";
import { shiftDateString, formatLocalDate } from "../utils/date";
import { getCurrentLanguage } from "../l10n/i18n";

const resolveSmartSummaryLang = () =>
	String(getCurrentLanguage() || "en").toLowerCase().startsWith("ko")
		? "ko"
		: "en";

const findSmartWidgetData = (data, keyword, lang) =>
	data?.[getSmartWidgetCacheKey(keyword, lang)] ??
	data?.[`${keyword}_${lang}`] ??
	data?.[keyword] ??
	Object.entries(data ?? {}).find(([key]) => key.startsWith(`${keyword}_`))?.[1];

export const buildSmartSummaries = (keywords, data) => {
	const lang = resolveSmartSummaryLang();
	return (keywords ?? [])
		.map((kw) => ({ keyword: kw, data: findSmartWidgetData(data, kw, lang) }))
		.filter((entry) => entry.data)
		.slice(0, 3)
		.map(({ keyword, data: widgetData }) => {
			const allItems = (widgetData?.sections ?? []).flatMap((s) => s.items ?? []);
			const firstItem = allItems.find((item) => item?.title && item?.url) ?? null;
			return {
				keyword,
				bullets: widgetData?.sections?.flatMap((s) => s.bullets ?? []).slice(0, 3) ?? [],
				latestArticle: firstItem
					? { title: firstItem.title, url: firstItem.url, source: firstItem.source ?? "" }
					: null,
			};
		});
};

/**
 * Shared hook — subscribes to all stores needed for briefing generation.
 * Returns `buildContext()` which assembles the full 14-field context object
 * (with past-ended calEvent filtering) at call time.
 * Also returns raw reactive fields for useEffect dependency arrays.
 */
export const useBriefingContext = () => {
	const tone = useSettingsStore((s) => s.tone);
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || [];
	const fixedInterestIds = useSettingsStore((s) => s.fixedInterestIds) || [];
	const keywordInterests = useSettingsStore((s) => s.keywordInterests) || [];
	const persona = useAuthStore((s) => s.persona);

	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const calEvents = useDataStore((s) => s.calEvents);
	const tomorrowEvents = useDataStore((s) => s.tomorrowEvents);
	const newsResults = useDataStore((s) => s.newsResults);
	const newsAnswer = useDataStore((s) => s.newsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const healthData = useDataStore((s) => s.healthData);
	const activeWidgetIds = useDataStore((s) => s.activeWidgetIds) || [];
	const todos = useTodoStore((s) => s.todos);

	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const smartWidgetData = useWidgetStore((s) => s.smartWidgetData);

	const todayQA = useDiaryStore((s) => s.todayQA);
	const fetchTodayQA = useDiaryStore((s) => s.fetchTodayQA);
	const diaryEntries = useDiaryStore((s) => s.entries);

	const yesterdayDateStr = shiftDateString(formatLocalDate(), -1);
	const yesterdayEntry = diaryEntries?.[yesterdayDateStr] || null;
	const yesterdayMemo = yesterdayEntry?.memo || "";
	const yesterdayDiary = yesterdayEntry?.diary || "";

	const effectiveInterests = useMemo(
		() => mergeInterestLists(fixedInterestIds, keywordInterests),
		[fixedInterestIds, keywordInterests],
	);

	const buildContext = () => {
		const nowMs = Date.now();
		const filteredCalEvents = (calEvents ?? []).filter((e) => {
			const endStr = e?.endTime || e?.end || null;
			if (!endStr) return true;
			try {
				return new Date(endStr).getTime() >= nowMs;
			} catch {
				return true;
			}
		});

		return {
			weather,
			stocks,
			trends,
			calEvents: filteredCalEvents,
			tomorrowEvents,
			todos,
			activeWidgetIds,
			yesterdayMemo,
			keywordInterests: effectiveInterests,
			fixedInterestIds,
			persona,
			newsResults: (newsResults ?? []).slice(0, 5),
			newsAnswer: newsAnswer ?? "",
			trendsResults: (trendsResults ?? []).slice(0, 5),
			todayQA: todayQA ?? [],
			smartSummaries: buildSmartSummaries(smartKeywords, smartWidgetData),
			healthData: healthData ?? null,
			yesterdayDiary,
		};
	};

	return {
		tone,
		priorityOrder,
		fetchTodayQA,
		buildContext,
		// Expose raw reactive fields for useEffect dependency arrays
		weather,
		calEvents,
		stocks,
		trends,
		activeWidgetIds,
	};
};
