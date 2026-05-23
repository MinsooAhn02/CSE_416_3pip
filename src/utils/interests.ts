import type { Interest } from "../types";

const FIXED_INTEREST_SCORE = 1000;

const FIXED_INTEREST_KEYWORDS: Record<string, string> = {
	news: "news",
	tech: "technology",
	fashion: "fashion",
	finance: "finance",
	health: "health",
	food: "food",
	entertainment: "entertainment",
	sports: "sports",
};

const FIXED_INTEREST_LABELS: Record<string, string> = {
	news: "News",
	tech: "Tech",
	fashion: "Fashion",
	finance: "Finance",
	health: "Health",
	food: "Food",
	entertainment: "Entertainment",
	sports: "Sports",
};

const normalizeText = (value: unknown): string =>
	typeof value === "string" ? value.trim().toLowerCase() : "";

export const normalizeFixedInterestIds = (items: unknown): string[] => {
	if (!Array.isArray(items)) return [];

	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const item of items) {
		const rawId =
			typeof item === "string"
				? item
				: typeof (item as Record<string, unknown>)?.id === "string"
					? String((item as Record<string, unknown>).id)
					: typeof (item as Record<string, unknown>)?.keyword === "string"
						? String((item as Record<string, unknown>).keyword)
						: "";
		const id = normalizeText(rawId);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		normalized.push(id);
	}

	return normalized;
};

export const buildFixedInterests = (fixedInterestIds: unknown): Interest[] =>
	normalizeFixedInterestIds(fixedInterestIds).map((id) => ({
		id,
		keyword: FIXED_INTEREST_KEYWORDS[id] ?? id,
		label: FIXED_INTEREST_LABELS[id] ?? id,
		category: "interest",
		score: FIXED_INTEREST_SCORE,
		source: "onboarding",
		fixed: true,
	}));

export const mergeInterestLists = (
	fixedInterestIds: unknown,
	dynamicInterests: Interest[] | null | undefined,
): Interest[] => {
	const merged: Interest[] = [];
	const seenKeywords = new Set<string>();

	const pushInterest = (item: Interest): void => {
		const keyword = typeof item?.keyword === "string" ? item.keyword.trim() : "";
		const normalizedKeyword = normalizeText(keyword);
		if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) return;
		seenKeywords.add(normalizedKeyword);
		merged.push({ ...item, keyword });
	};

	buildFixedInterests(fixedInterestIds).forEach(pushInterest);

	(dynamicInterests ?? [])
		.slice()
		.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
		.forEach(pushInterest);

	return merged;
};

export const getTopInterestKeywords = (
	fixedInterestIds: unknown,
	dynamicInterests: Interest[] | null | undefined,
	limit = 5,
): string[] =>
	mergeInterestLists(fixedInterestIds, dynamicInterests)
		.slice()
		.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
		.slice(0, limit)
		.map((item) => item.keyword)
		.filter(Boolean);

export const getInterestFingerprint = (
	fixedInterestIds: unknown,
	dynamicInterests: Interest[] | null | undefined,
	limit = 5,
): string =>
	getTopInterestKeywords(fixedInterestIds, dynamicInterests, limit).join("+") || "base";

export const getFixedInterestLabel = (id: unknown): string =>
	FIXED_INTEREST_LABELS[normalizeText(id)] ?? String(id ?? "");
