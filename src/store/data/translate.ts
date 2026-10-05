import { normalizeReadableText, cleanTrendTitle, normalizeArticleList, hasHangulText, needsKoreanTranslation, buildTrendTitlesFromResults } from "./articles";
import { invokeEdgeDetailed } from "./edge";
import { ArticleItem } from "./types";

export const extractJsonArray = (text: unknown): unknown[] | null => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	try {
		const parsed: unknown = JSON.parse(trimmed);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		const match = trimmed.match(/\[[\s\S]*\]/);
		if (!match) return null;
		try {
			const parsed: unknown = JSON.parse(match[0]);
			return Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}
};

export const translateTextToKorean = async (value = ""): Promise<string> => {
	const sourceText = normalizeReadableText(value);
	if (!sourceText || !needsKoreanTranslation(sourceText)) return sourceText;

	const edge = await invokeEdgeDetailed("groq", {
		system: [
			"You translate the user's text into natural Korean.",
			"Return only the translated Korean text.",
			"Do not add quotes, bullets, labels, or explanations.",
		].join("\n"),
		prompt: sourceText,
		temperature: 0.1,
	});

	const edgeData = edge?.data as Record<string, unknown> | null;
	const translated = normalizeReadableText(edgeData?.text);
	return translated || sourceText;
};

export const translateArticlesToKorean = async (items: ArticleItem[] = []): Promise<ArticleItem[]> => {
	const normalizedItems = normalizeArticleList(items, items.length || 10);
	if (normalizedItems.length === 0) return [];

	const targets = normalizedItems
		.map((item, index) => ({
			index,
			title: item.title || "",
			content: normalizeReadableText(item.content).slice(0, 240),
			needsTitle: needsKoreanTranslation(item.title),
			needsContent: needsKoreanTranslation(item.content),
		}))
		.filter((item) => item.needsTitle || item.needsContent);

	let translatedByIndex = new Map<number, { title: string; content: string }>();

	if (targets.length > 0) {
		const payload = targets.map(
			({ index, title, content, needsTitle, needsContent }) => ({
				index,
				title,
				content,
				needsTitle,
				needsContent,
			}),
		);

		const edge = await invokeEdgeDetailed("groq", {
			system: [
				"You translate news titles and short summaries into natural Korean.",
				"Return only a JSON array.",
				"Each item must be {\"index\": number, \"title\": string, \"content\": string}.",
				"Keep the same order and indexes.",
				"Translate only the fields that need Korean and leave the others natural.",
				"Do not add code fences or explanations.",
			].join("\n"),
			prompt: `Translate the following JSON array into Korean and return JSON only:\n${JSON.stringify(
				payload,
			)}`,
			temperature: 0.1,
		});

		const edgeData = edge?.data as Record<string, unknown> | null;
		const parsed = extractJsonArray(edgeData?.text);
		if (Array.isArray(parsed) && parsed.length > 0) {
			translatedByIndex = new Map(
				(parsed as unknown[])
					.map((item) => {
						const i = item as Record<string, unknown>;
						const index = Number(i?.index);
						if (!Number.isInteger(index) || index < 0) return null;
						return [
							index,
							{
								title: normalizeReadableText(i?.title),
								content: normalizeReadableText(i?.content),
							},
						] as [number, { title: string; content: string }];
					})
					.filter((entry): entry is [number, { title: string; content: string }] => entry !== null),
			);
		}
	}

	const mergedItems = normalizedItems.map((item, index) => {
		const translated = translatedByIndex.get(index);
		if (!translated) return item;
		return {
			...item,
			title: translated.title || item.title,
			content: translated.content || item.content,
		};
	});

	const fallbackTranslated = await Promise.all(
		mergedItems.map(async (item) => {
			const nextTitle = needsKoreanTranslation(item.title)
				? await translateTextToKorean(item.title)
				: item.title;
			const nextContent =
				item.content && needsKoreanTranslation(item.content)
					? await translateTextToKorean(
							normalizeReadableText(item.content).slice(0, 240),
						)
					: item.content;
			return {
				...item,
				title: nextTitle || item.title,
				content: nextContent || item.content,
			};
		}),
	);

	return fallbackTranslated;
};


export const buildLocalizedTrendTitles = async (
	items: ArticleItem[],
	fallbackTitles: string[] = [],
	language: string,
	limit = 8,
): Promise<string[]> => {
	const articleTitles = buildTrendTitlesFromResults(items, limit);
	const sourceTitles = articleTitles.length > 0 ? articleTitles : fallbackTitles;
	const uniqueTitles = Array.from(
		new Set(
			(Array.isArray(sourceTitles) ? sourceTitles : [])
				.map((title) => cleanTrendTitle(title))
				.filter((title) => title.length >= 2 && title.length <= 80),
		),
	).slice(0, limit);

	if (language !== "ko") return uniqueTitles;

	const translatedTitles = await Promise.all(
		uniqueTitles.map(async (title) =>
			needsKoreanTranslation(title) ? translateTextToKorean(title) : title,
		),
	);

	return Array.from(
		new Set(
			translatedTitles
				.map((title) => cleanTrendTitle(title))
				.filter((title) => title.length >= 2 && hasHangulText(title)),
		),
	).slice(0, limit);
};

export const shouldBackfillKoreanCache = (payload: unknown): boolean => {
	if (!payload || typeof payload !== "object") return false;
	const p = payload as Record<string, unknown>;
	const results = Array.isArray(p.results) ? (p.results as Record<string, unknown>[]) : [];
	const trends = Array.isArray(p.trends) ? (p.trends as string[]) : [];

	return (
		results.some(
			(item) =>
				needsKoreanTranslation(String(item?.title || "")) ||
				(item?.content && needsKoreanTranslation(String(item.content))),
		) || trends.some((title) => needsKoreanTranslation(title))
	);
};
