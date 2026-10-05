import { bs, invokeFunction } from "./client";
import { SMART_CATEGORY_CONFIGS, SMART_CATEGORY_IDS, formatSmartCategoryPromptLine } from "./smartWidgetConfig";

export const parseJsonFromText = (text: string) => {
	if (!text) return null;
	try {
		const trimmed = String(text).trim();
		const objectMatch = trimmed.match(/\{[\s\S]*\}/);
		const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
		const objectIndex = objectMatch ? trimmed.indexOf(objectMatch[0]) : Infinity;
		const arrayIndex = arrayMatch ? trimmed.indexOf(arrayMatch[0]) : Infinity;
		const raw = arrayIndex < objectIndex
			? (arrayMatch![0])
			: (objectMatch?.[0] || arrayMatch?.[0] || trimmed);
		return JSON.parse(raw);
	} catch {
		return null;
	}
};

const KOREAN_PERSON_SURNAME_RE =
	/^(김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍|유|고|문|양|손|배|백|허|남|심|노|하|곽|성|차|주|우|구|민|류|나|진|지|엄|채|원|천|방|공|현|함|변|염|여|추|도|석|선|설|마|길|연|위|표|명|기|반|라|왕|금|옥|육|인|맹|제|모|탁|국|어|은|편|용)/;

const KOREAN_NON_PERSON_KEYWORDS = new Set([
	"이거",
	"이것",
	"오늘",
	"내일",
	"음식",
	"커피",
]);

const PERSON_NAME_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"of",
	"the",
	"to",
	"with",
]);

const PERSON_NAME_BLOCKED_WORDS = new Set([
	"app",
	"bread",
	"cafe",
	"club",
	"coffee",
	"cost",
	"deal",
	"discount",
	"food",
	"health",
	"lens",
	"machine",
	"movie",
	"news",
	"price",
	"review",
	"restaurant",
	"sale",
	"show",
	"subway",
	"vitamin",
]);

const PERSON_NAME_PREFIXES = new Set([
	"dr",
	"mr",
	"mrs",
	"ms",
	"prof",
	"sir",
	"dame",
]);

const PERSON_NAME_SUFFIXES = new Set([
	"jr",
	"sr",
	"ii",
	"iii",
	"iv",
	"v",
]);

const PERSON_NAME_HINT_WORDS = new Set([
	"adele",
	"ariana",
	"barack",
	"beyonce",
	"bieber",
	"billie",
	"brad",
	"chalamet",
	"donald",
	"drake",
	"dua",
	"elon",
	"emma",
	"gaga",
	"grande",
	"harry",
	"jennie",
	"john",
	"jordan",
	"justin",
	"kardashian",
	"kim",
	"kylie",
	"messi",
	"musk",
	"obama",
	"olivia",
	"oprah",
	"pitt",
	"rihanna",
	"rodrigo",
	"ronaldo",
	"selena",
	"swift",
	"taylor",
	"trump",
	"zendaya",
]);

const SINGLE_NAME_PERSON_KEYWORDS = new Set([
	"adele",
	"beyonce",
	"cher",
	"drake",
	"jennie",
	"jisoo",
	"jungkook",
	"lisa",
	"madonna",
	"prince",
	"rihanna",
	"rosé",
	"rose",
	"suga",
	"zendaya",
]);

const looksLikeKoreanPersonNameKeyword = (keyword: string) => {
	const normalized = String(keyword || "").trim();
	return (
		/^[가-힣]{2,4}$/.test(normalized) &&
		!KOREAN_NON_PERSON_KEYWORDS.has(normalized) &&
		KOREAN_PERSON_SURNAME_RE.test(normalized)
	);
};

const looksLikeEnglishPersonNameKeyword = (keyword: string) => {
	const normalized = String(keyword || "").trim();
	const parts =
		normalized.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ]+)?|[A-Z]\.?/g) ?? [];
	if (parts.length === 0 || parts.length > 5) return false;
	const lowerParts = parts.map((part) =>
		part.toLowerCase().replace(/[.\u2019']/g, ""),
	);
	if (lowerParts.some((part) => PERSON_NAME_BLOCKED_WORDS.has(part))) {
		return false;
	}

	const contentParts = lowerParts.filter(
		(part) =>
			!PERSON_NAME_PREFIXES.has(part) &&
			!PERSON_NAME_SUFFIXES.has(part) &&
			!PERSON_NAME_STOPWORDS.has(part) &&
			part.length > 1,
	);
	if (contentParts.length === 1) {
		return SINGLE_NAME_PERSON_KEYWORDS.has(contentParts[0]);
	}
	if (contentParts.length < 2 || contentParts.length > 4) return false;

	const hasNameHint = contentParts.some((part) =>
		PERSON_NAME_HINT_WORDS.has(part),
	);
	const isTitleLike = parts
		.filter((part) => !/^[A-Z]\.?$/.test(part))
		.every((part) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(part));

	return hasNameHint || isTitleLike;
};

const looksLikePersonNameKeyword = (keyword: string) =>
	looksLikeEnglishPersonNameKeyword(keyword) ||
	looksLikeKoreanPersonNameKeyword(keyword);

const inferSmartCategoryFallback = (keyword: string) => {
	const normalized = String(keyword || "").trim();
	for (const [id, config] of Object.entries(SMART_CATEGORY_CONFIGS)) {
		if (id !== "general" && config.match.test(normalized)) return id;
	}
	if (looksLikePersonNameKeyword(normalized)) return "person";
	return "general";
};

export const classifySmartKeyword = async (keyword: string, isKo: boolean) => {
	const fallbackCategory = inferSmartCategoryFallback(keyword);
	const categoryText = SMART_CATEGORY_IDS
		.map(formatSmartCategoryPromptLine)
		.join("\n");

	const data = await invokeFunction("groq", {
		system: [
			"You classify a user's smart-widget keyword into one product/content vertical.",
			"Return only valid JSON. No markdown, no commentary.",
			`Allowed categories: ${SMART_CATEGORY_IDS.join(", ")}`,
			"Review every allowed category in the category guide before answering.",
			"Classify into the most relevant specific category when there is enough evidence.",
			"Use the category descriptions, keyword hints, and keyword meaning together.",
			"Keyword hints are soft signals: they help identify a category, but the final answer must still match the user's likely intent.",
			"Do not over-focus on the first few categories; camera, beauty, books, sports, finance, health, education, automotive, tech, travel, entertainment, person, and general are equally valid when supported.",
			"A single dish, ingredient, snack, drink, cuisine, or restaurant food name should be classified as food.",
			"Choose person only when the whole keyword appears to identify a real person, stage name, creator, celebrity, athlete, artist, founder, executive, or public figure. Do not choose person for generic nouns, products, foods, locations, or brands.",
			"If multiple categories seem possible, choose the one that best matches the user's likely intent.",
			"Only choose general when no specific category is reasonably supported.",
		].join("\n"),
		prompt: [
			`Keyword: ${keyword}`,
			"",
			"Categories:",
			categoryText,
			"",
			isKo
				? "The keyword may be Korean or mixed Korean/English. Compare it against every category guide line, including keyword hints, then choose the most specific supported category. Use general only as the final fallback."
				: "The keyword may be English or mixed English/Korean. Compare it against every category guide line, including keyword hints, then choose the most specific supported category. Use general only as the final fallback.",
			'Return shape: {"category":"streetwear","emoji":"🛍️"}',
		].join("\n"),
		temperature: 0.1,
	});

	const parsed = parseJsonFromText(String(data?.text ?? ""));
	const parsedCategory = SMART_CATEGORY_IDS.includes(parsed?.category)
		? parsed.category
		: null;
	const category = fallbackCategory === "person"
		? "person"
		: (parsedCategory && parsedCategory !== "general"
			? parsedCategory
			: fallbackCategory);
	const emoji = parsed?.emoji || (SMART_CATEGORY_CONFIGS as unknown as Record<string, { emoji: string }>)[category]?.emoji || "🔎";
	return { category, emoji };
};

const fillSmartTemplate = (template: string, keyword: string) =>
	String(template || "").replace(/\{keyword\}/g, keyword);

const OMIT_SMART_SECTION_TYPES = new Set(["shopping", "sites"]);
const SHOPPING_SMART_SECTION_RE =
	/(쇼핑|구매|구매처|할인|세일|딜|예약|shopping|stockists|buy|borrow|deals|sale|discount|booking|price & buying)/i;

const buildSmartCommunitySections = (keyword: string, category: string, isKo: boolean) => {
	const lang = isKo ? "ko" : "en";
	return [
		{
			type: "video",
			title: bs("smart_videos", lang),
			keyword,
			category,
			query: isKo
				? `${keyword} 유튜브 영상 리뷰 설명`
				: `${keyword} YouTube video review guide`,
			searchMode: "search",
			allowMixed: true,
			maxItems: 2,
		},
		{
			type: "blog",
			title: bs("smart_blogs", lang),
			keyword,
			category,
			query: isKo
				? `${keyword} 블로그 후기 정리 리뷰`
				: `${keyword} blog review analysis guide`,
			searchMode: "search",
			allowMixed: true,
			maxItems: 2,
		},
	];
};

export const buildSmartSectionPlan = (keyword: string, category: string, isKo: boolean) => {
	const lang = isKo ? "ko" : "en";
	const config =
		(SMART_CATEGORY_CONFIGS as unknown as Record<string, { sections: { type: string; title: Record<string, string>; query: Record<string, string>; searchMode?: string; allowMixed?: boolean; maxItems?: number; linkOnly?: boolean }[] }>)[category]
		?? (SMART_CATEGORY_CONFIGS as unknown as Record<string, { sections: { type: string; title: Record<string, string>; query: Record<string, string>; searchMode?: string; allowMixed?: boolean; maxItems?: number; linkOnly?: boolean }[] }>).general;

	const sections = config.sections
		.filter((section) => {
			const title = `${section.title?.ko ?? ""} ${section.title?.en ?? ""}`;
			if (section.type === "local_spots" && !isKo) return false;
			return (
				!section.linkOnly &&
				!OMIT_SMART_SECTION_TYPES.has(section.type) &&
				!SHOPPING_SMART_SECTION_RE.test(title)
			);
		})
		.map((section) => ({
			type: section.type,
			title: section.title[lang] ?? section.title.en,
			keyword,
			category,
			query: fillSmartTemplate(section.query[lang] ?? section.query.en, keyword),
			searchMode: section.searchMode ?? "search",
			allowMixed: Boolean(section.allowMixed),
			maxItems: section.maxItems ?? 2,
		}));

	return sections.some((section) => section.type === "community")
		? sections
		: [...sections, ...buildSmartCommunitySections(keyword, category, isKo)];
};
