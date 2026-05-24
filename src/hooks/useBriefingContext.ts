import { useMemo } from "react";
import { useSettingsStore } from "../store/useSettingsStore";
import { useDataStore } from "../store/useDataStore";
import { useTodoStore } from "../store/useTodoStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { getSmartWidgetCacheKey, useWidgetStore } from "../store/useWidgetStore";
import { mergeInterestLists } from "../utils/interests";
import { shiftDateString, formatLocalDate } from "../utils/date";
import { getCurrentLanguage } from "../l10n/i18n";
import type { SmartWidgetData, SmartWidgetSummary, Interest } from "../types";

const resolveSmartSummaryLang = (): "ko" | "en" =>
	String(getCurrentLanguage() || "en").toLowerCase().startsWith("ko")
		? "ko"
		: "en";

const findSmartWidgetData = (
	data: Record<string, SmartWidgetData> | null | undefined,
	keyword: string,
	lang: string,
): SmartWidgetData | undefined => {
	if (!data) return undefined;
	return (
		data[getSmartWidgetCacheKey(keyword, lang)] ??
		data[`${keyword}_${lang}`] ??
		data[keyword] ??
		(Object.entries(data).find(([key]) => key.startsWith(`${keyword}_`))?.[1])
	);
};

interface SmartSection {
	items?: { title?: string; url?: string; source?: string }[];
	bullets?: string[];
}

export const buildSmartSummaries = (
	keywords: string[],
	data: Record<string, SmartWidgetData>,
): SmartWidgetSummary[] => {
	const lang = resolveSmartSummaryLang();
	return (keywords ?? [])
		.map((kw) => ({ keyword: kw, data: findSmartWidgetData(data, kw, lang) }))
		.filter((entry): entry is { keyword: string; data: SmartWidgetData } => !!entry.data)
		.slice(0, 3)
		.map(({ keyword, data: widgetData }) => {
			const sections = (widgetData?.sections ?? []) as SmartSection[];
			const allItems = sections.flatMap((s) => s.items ?? []);
			const firstItem = allItems.find((item) => item?.title && item?.url) ?? null;
			return {
				keyword,
				bullets: sections.flatMap((s) => s.bullets ?? []).slice(0, 3),
				latestArticle: firstItem
					? { title: firstItem.title!, url: firstItem.url!, source: firstItem.source ?? "" }
					: null,
			};
		});
};

export const useBriefingContext = () => {
	const tone = useSettingsStore((s) => s.tone);
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || [];
	const fixedInterestIds = useSettingsStore((s) => s.fixedInterestIds) || [];
	const keywordInterests = useSettingsStore((s) => s.keywordInterests) || [];
	const persona = useOnboardingStore((s) => s.persona);

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

	const effectiveInterests: Interest[] = useMemo(
		() => mergeInterestLists(fixedInterestIds, keywordInterests),
		[fixedInterestIds, keywordInterests],
	);

	const buildContext = () => {
		const nowMs = Date.now();
		const filteredCalEvents = (calEvents ?? []).filter((e) => {
			const endStr = (e as unknown as Record<string, unknown>)?.endTime as string | undefined
				|| (e as unknown as Record<string, unknown>)?.end as string | undefined || null;
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
		weather,
		calEvents,
		tomorrowEvents,
		stocks,
		trends,
		activeWidgetIds,
	};
};
