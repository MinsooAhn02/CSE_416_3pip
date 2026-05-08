const FIXED_INTEREST_SCORE = 1000;

const FIXED_INTEREST_KEYWORDS = {
	news: "news",
	tech: "technology",
	fashion: "fashion",
	finance: "finance",
	health: "health",
	food: "food",
	entertainment: "entertainment",
	sports: "sports",
};

const FIXED_INTEREST_LABELS = {
	news: "News",
	tech: "Tech",
	fashion: "Fashion",
	finance: "Finance",
	health: "Health",
	food: "Food",
	entertainment: "Entertainment",
	sports: "Sports",
};

const normalizeText = (value) =>
	typeof value === "string" ? value.trim().toLowerCase() : "";

export const normalizeFixedInterestIds = (items) => {
	if (!Array.isArray(items)) return [];

	const seen = new Set();
	const normalized = [];

	for (const item of items) {
		const rawId =
			typeof item === "string"
				? item
				: typeof item?.id === "string"
					? item.id
					: typeof item?.keyword === "string"
						? item.keyword
						: "";
		const id = normalizeText(rawId);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		normalized.push(id);
	}

	return normalized;
};

export const buildFixedInterests = (fixedInterestIds) =>
	normalizeFixedInterestIds(fixedInterestIds).map((id) => ({
		id,
		keyword: FIXED_INTEREST_KEYWORDS[id] ?? id,
		label: FIXED_INTEREST_LABELS[id] ?? id,
		category: "interest",
		score: FIXED_INTEREST_SCORE,
		source: "onboarding",
		fixed: true,
	}));

export const mergeInterestLists = (fixedInterestIds, dynamicInterests) => {
	const merged = [];
	const seenKeywords = new Set();

	const pushInterest = (item) => {
		const keyword = typeof item?.keyword === "string" ? item.keyword.trim() : "";
		const normalizedKeyword = normalizeText(keyword);
		if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) return;
		seenKeywords.add(normalizedKeyword);
		merged.push({
			...item,
			keyword,
		});
	};

	buildFixedInterests(fixedInterestIds).forEach(pushInterest);

	(dynamicInterests ?? [])
		.slice()
		.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
		.forEach(pushInterest);

	return merged;
};

export const getTopInterestKeywords = (
	fixedInterestIds,
	dynamicInterests,
	limit = 5,
) =>
	mergeInterestLists(fixedInterestIds, dynamicInterests)
		.slice()
		.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
		.slice(0, limit)
		.map((item) => item.keyword)
		.filter(Boolean);

export const getInterestFingerprint = (
	fixedInterestIds,
	dynamicInterests,
	limit = 5,
) => getTopInterestKeywords(fixedInterestIds, dynamicInterests, limit).join("+") || "base";

export const getFixedInterestLabel = (id) =>
	FIXED_INTEREST_LABELS[normalizeText(id)] ?? id;
