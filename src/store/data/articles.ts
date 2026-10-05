import { isLowQualityResult, cleanSnippet } from "../../utils/articleQuality";
import { ArticleItem } from "./types";

export const KO_NEWS_DOMAINS = [
	"news.naver.com",
	"yna.co.kr",
	"chosun.com",
	"joins.com",
	"hani.co.kr",
	"news1.kr",
	"khan.co.kr",
	"donga.com",
	"hankyung.com",
	"mk.co.kr",
	"ytn.co.kr",
	"jtbc.co.kr",
	"sbs.co.kr",
	"imnews.imbc.com",
	"news.kbs.co.kr",
	"edaily.co.kr",
	"zdnet.co.kr",
	"etnews.com",
];
export const EN_NEWS_DOMAINS = [
	"reuters.com",
	"apnews.com",
	"bbc.com",
	"cnn.com",
	"nytimes.com",
	"theguardian.com",
	"npr.org",
	"wsj.com",
	"bloomberg.com",
];
export const HANGUL_REGEX = /[가-힣]/;
export const LATIN_REGEX = /[A-Za-zÀ-ɏ]/;
export const FOREIGN_SCRIPT_REGEX =
	/[Ѐ-ӿ぀-ヿ㐀-䶿一-鿿豈-﫿؀-ۿ฀-๿ऀ-ॿ]/;


export const normalizeReadableText = (value: unknown): string =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim();

export const getUrlHost = (value = ""): string => {
	try {
		return new URL(String(value || "")).hostname.toLowerCase();
	} catch {
		return String(value || "").toLowerCase();
	}
};

export const cleanTrendTitle = (raw = ""): string =>
	normalizeReadableText(raw)
		.replace(/\s*[-–|]\s*[^-–|]{2,35}$/, "")
		.replace(/\[.*?\]/g, "")
		.replace(/["'`*_#]/g, "")
		.trim();

export const scoreLocalizedText = (text: unknown, language: string): number => {
	const sample = normalizeReadableText(text);
	if (!sample) return 0;

	const hasHangul = HANGUL_REGEX.test(sample);
	const hasLatin = LATIN_REGEX.test(sample);
	const hasForeignScript = FOREIGN_SCRIPT_REGEX.test(sample);

	if (language === "ko") {
		let score = 0;
		if (hasHangul) score += 3;
		if (hasLatin && !hasHangul) score -= 2;
		if (hasForeignScript && !hasHangul) score -= 3;
		return score;
	}

	let score = 0;
	if (hasLatin) score += 3;
	if (hasHangul) score -= 3;
	if (hasForeignScript) score -= 3;
	return score;
};

export const scoreArticleForLanguage = (item: ArticleItem, language: string): number => {
	const title = normalizeReadableText(item?.title);
	const content = normalizeReadableText(item?.content);
	const host = getUrlHost(item?.url);

	const titleScore = scoreLocalizedText(title, language);
	const contentScore = scoreLocalizedText(content, language);
	const isKoHost = KO_NEWS_DOMAINS.some((domain) => host.includes(domain));
	const isEnHost = EN_NEWS_DOMAINS.some((domain) => host.includes(domain));
	const hostBonus = language === "ko" ? (isKoHost ? 2 : 0) : (isEnHost ? 2 : 0);

	if (language === "ko") {
		if (titleScore > 0) return titleScore * 4 + hostBonus;
		if (contentScore > 0) return contentScore * 2 + hostBonus;
		if (isKoHost) return hostBonus;
		return -1;
	}

	if (titleScore > 0) return titleScore * 4 + hostBonus;
	return hostBonus > 1 ? hostBonus : -1;
};

export const normalizeArticleItem = (item: unknown): ArticleItem => {
	const i = item as Record<string, unknown> | null;
	return {
		title: normalizeReadableText(i?.title),
		url: String(i?.url || "").trim(),
		content: normalizeReadableText(i?.content),
		image: (i?.image ?? null) as string | null,
		published_date: (i?.published_date ?? null) as string | null,
	};
};

export const normalizeArticleList = (items: unknown[] = [], limit = 10): ArticleItem[] =>
	(Array.isArray(items) ? items : [])
		.map(normalizeArticleItem)
		.filter((item) => item.title || item.url)
		.slice(0, limit);

export const countPatternMatches = (value = "", pattern: RegExp): number =>
	(normalizeReadableText(value).match(pattern) ?? []).length;

export const hasHangulText = (value = ""): boolean => HANGUL_REGEX.test(String(value || ""));

export const needsKoreanTranslation = (value = ""): boolean => {
	const sample = normalizeReadableText(value);
	if (!sample) return false;
	const hangulCount = countPatternMatches(sample, /[가-힣]/g);
	const latinCount = countPatternMatches(sample, /[A-Za-zÀ-ɏ]/g);
	const foreignCount = countPatternMatches(
		sample,
		/[Ѐ-ӿ぀-ヿ㐀-䶿一-鿿豈-﫿؀-ۿ฀-๿ऀ-ॿ]/g,
	);

	if (hangulCount === 0) return true;
	if (foreignCount > hangulCount) return true;
	// Titles like "Trump tariff fight - 연합뉴스" contain Hangul, but are still English.
	return latinCount >= 12 && latinCount > hangulCount * 2;
};

export const dedupeArticles = (items: ArticleItem[] = []): ArticleItem[] => {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key =
			String(item?.url || "").trim().toLowerCase() ||
			String(item?.title || "").trim().toLowerCase();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const filterByAllowedDomains = (items: ArticleItem[], language: string): ArticleItem[] => {
	if (!Array.isArray(items) || items.length === 0) return items;
	const allowedDomains = language === "ko" ? KO_NEWS_DOMAINS : EN_NEWS_DOMAINS;
	return items.filter((item) => {
		const host = getUrlHost(item?.url);
		// Exclude English-language subdomains (e.g. en.yna.co.kr) from Korean feed
		if (language === "ko" && /^en\./i.test(host)) return false;
		return allowedDomains.some((domain) => host.includes(domain));
	});
};

export const filterLocalizedArticles = (
	items: unknown[],
	language: string,
	limit = 10,
): ArticleItem[] => {
	const scored = dedupeArticles(
		(Array.isArray(items) ? items : [])
			.map((item) => {
				const normalized = normalizeArticleItem(item);
				if (!normalized.title && !normalized.url) return null;
				// 섹션 목록·위키 메타 페이지 제외, 메뉴 텍스트 요약 제거 (BACKLOG R11)
				if (isLowQualityResult(normalized)) return null;
				normalized.content = cleanSnippet(normalized.content);
				const score = scoreArticleForLanguage(normalized, language);
				return { ...normalized, __score: score };
			})
			.filter((item): item is ArticleItem & { __score: number } => item !== null)
			.sort((a, b) => (b as ArticleItem & { __score: number }).__score - (a as ArticleItem & { __score: number }).__score),
	);

	if (language === "ko") {
		const localized = (scored as (ArticleItem & { __score?: number })[])
			.filter((item) => (item.__score ?? 0) > 0)
			.map(({ __score: _score, ...rest }) => rest as ArticleItem);
		return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
	}

	const localized = (scored as (ArticleItem & { __score?: number })[])
		.filter((item) => (item.__score ?? 0) > 0)
		.map(({ __score: _score, ...rest }) => rest as ArticleItem);
	return filterByAllowedDomains(dedupeArticles(localized), language).slice(0, limit);
};

export const buildTrendTitlesFromResults = (items: ArticleItem[], limit = 8): string[] =>
	Array.from(
		new Set(
			(Array.isArray(items) ? items : [])
				.map((item) => cleanTrendTitle(item?.title))
				.filter((title) => title.length >= 5 && title.length <= 80),
		),
	).slice(0, limit);
