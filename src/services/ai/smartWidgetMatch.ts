import { isRelevantWikiResult } from "../../utils/articleQuality";
import type { SmartResult, SmartSectionPlan } from "./types";
import { bs, DEBUG_FLOW } from "./client";
import { KO_VIDEO_DOMAINS, EN_VIDEO_DOMAINS, KO_BLOG_DOMAINS, EN_BLOG_DOMAINS, isTrustedSmartSection, isArticleSmartSection, isVideoSmartSection, isBlogSmartSection, isNutritionSmartSection, smartSectionRequiresTitleKeyword, getSmartCurrentYear, getSmartPublishedTime, isKoreanPersonUpdatesSection, smartResultHasYearSignal, smartResultHasOlderYearSignal, smartResultTitleHasOlderYearSignal, smartResultHasStaleRelativeSignal, smartResultIsFreshEnough, getSmartResultText, hasSmartResultLanguage, getSmartHostname, isSmartResultFromDomains, isPreferredKoreanSource, isPreferredInfoSource, isTrustedSmartSource, filterSmartResults, dedupeByUrl, normalizeSmartSearchText } from "./smartWidgetConfig";

const rankSmartResultsForLanguage = (
	items: SmartResult[],
	isKo: boolean,
	allowMixed = false,
	keyword = "",
) => {
	const normalized = Array.isArray(items) ? items : [];
	if (!allowMixed) return filterSmartResults(normalized, isKo);

	const preferred = normalized.filter((r) => {
		return hasSmartResultLanguage(r, isKo);
	});
	const others = normalized.filter((r) => !preferred.includes(r));
	if (isKo) return [...preferred, ...others];
	return preferred.length
		? preferred
		: normalized.filter((r) => hasSmartResultLanguage(r, false));
};

const SMART_KEYWORD_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"of",
	"the",
	"to",
	"with",
	"정보",
	"추천",
	"최신",
]);

const SMART_SECTION_STOPWORDS = new Set([
	...SMART_KEYWORD_STOPWORDS,
	"가이드",
	"가격",
	"검색",
	"공개",
	"구매",
	"뉴스",
	"리뷰",
	"메뉴",
	"방법",
	"발매",
	"브랜드",
	"비교",
	"사용법",
	"소식",
	"스펙",
	"신메뉴",
	"업데이트",
	"일정",
	"정리",
	"체인점",
	"특징",
	"할인",
	"핵심",
	"best",
	"brands",
	"comparison",
	"guide",
	"how",
	"info",
	"information",
	"latest",
	"news",
	"overview",
	"recommendations",
	"reviews",
	"tips",
	"updates",
]);


const getSmartKeywordTokens = (keyword = "") =>
	normalizeSmartSearchText(keyword)
		.split(/[^\p{L}\p{N}]+/u)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2 && !SMART_KEYWORD_STOPWORDS.has(token));

const SMART_KEYWORD_ALIASES = {
	슈프림: ["supreme"],
	supreme: ["슈프림"],
	나이키: ["nike"],
	nike: ["나이키"],
	아디다스: ["adidas"],
	adidas: ["아디다스"],
	스투시: ["stussy"],
	stussy: ["스투시"],
	팔라스: ["palace"],
	palace: ["팔라스"],
	무신사: ["musinsa"],
	musinsa: ["무신사"],
	떡볶이: ["tteokbokki", "topokki"],
	tteokbokki: ["떡볶이"],
	카메라: ["camera"],
	camera: ["카메라"],
	캐논: ["canon"],
	canon: ["캐논"],
	소니: ["sony"],
	sony: ["소니"],
	니콘: ["nikon"],
	nikon: ["니콘"],
	후지: ["fujifilm", "fuji"],
	fujifilm: ["후지필름", "후지"],
	라이카: ["leica"],
	leica: ["라이카"],
};

const SMART_CATEGORY_REQUIRED_TERMS = {
	streetwear: [
		"fashion",
		"streetwear",
		"sneaker",
		"sneakers",
		"apparel",
		"clothing",
		"wear",
		"drop",
		"drops",
		"release",
		"collab",
		"collaboration",
		"collaborations",
		"collection",
		"lookbook",
		"droplist",
		"drop list",
		"box logo",
		"spring/summer",
		"fall/winter",
		"brand",
		"skate",
		"skateboarding",
		"supreme new york",
		"hypebeast",
		"패션",
		"스트릿",
		"스니커",
		"의류",
		"드롭",
		"발매",
		"콜라보",
		"협업",
		"컬렉션",
		"룩북",
		"브랜드",
	],
};

const SMART_CATEGORY_EXCLUDED_TERMS = {
	streetwear: [
		"supreme court",
		"chris stussy",
	],
};

const smartTextIncludesAny = (text: string, terms: string[] = []) =>
	terms.some((term) => text.includes(term));

const smartResultMatchesCategoryContext = (result: SmartResult, section: SmartSectionPlan) => {
	const category = section?.category;
	const requiredTermsMap = SMART_CATEGORY_REQUIRED_TERMS as Record<string, string[]>;
	const excludedTermsMap = SMART_CATEGORY_EXCLUDED_TERMS as Record<string, string[]>;
	if (!category || !requiredTermsMap[category]) return true;
	const haystack = normalizeSmartSearchText(getSmartResultText(result));
	if (
		smartTextIncludesAny(
			haystack,
			excludedTermsMap[category] ?? [],
		)
	) {
		return false;
	}
	return smartTextIncludesAny(haystack, requiredTermsMap[category]);
};

const smartResultMatchesSourceScope = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) => {
	if (isVideoSmartSection(section)) {
		return isSmartResultFromDomains(
			result,
			isKo ? KO_VIDEO_DOMAINS : EN_VIDEO_DOMAINS,
		);
	}
	if (isBlogSmartSection(section)) {
		return isSmartResultFromDomains(
			result,
			isKo ? KO_BLOG_DOMAINS : EN_BLOG_DOMAINS,
		);
	}
	return true;
};

const smartResultMatchesKeyword = (result: SmartResult, keyword: string) => {
	const normalizedKeyword = normalizeSmartSearchText(keyword);
	const haystack = normalizeSmartSearchText(
		[
			result?.title,
			result?.content,
			result?.url,
		].filter(Boolean).join(" "),
	);
	if (!normalizedKeyword || !haystack) return false;
	if (normalizedKeyword.length >= 2 && haystack.includes(normalizedKeyword)) {
		return true;
	}

	const tokens = getSmartKeywordTokens(keyword);
	if (tokens.length === 0) return false;
	return tokens.every((token) => haystack.includes(token));
};

const smartResultTitleMatchesKeyword = (result: SmartResult, keyword: string) => {
	const title = normalizeSmartSearchText(result?.title ?? "");
	if (!title) return false;
	const normalizedKeyword = normalizeSmartSearchText(keyword);
	if (normalizedKeyword && title.includes(normalizedKeyword)) return true;

	const aliasMap = SMART_KEYWORD_ALIASES as Record<string, string[]>;
	const normalizedAliases = aliasMap[normalizedKeyword] ?? [];
	if (normalizedAliases.some((alias: string) => title.includes(normalizeSmartSearchText(alias)))) {
		return true;
	}

	const tokens = getSmartKeywordTokens(keyword);
	if (tokens.length === 0) return false;
	const tokenMatches = (token: string) =>
		title.includes(token) ||
		(aliasMap[token] ?? []).some((alias: string) =>
			title.includes(normalizeSmartSearchText(alias)),
		);
	return tokens.length === 1
		? tokenMatches(tokens[0])
		: tokens.every(tokenMatches);
};

const smartResultTitleMatchesPersonName = (result: SmartResult, keyword: string) => {
	const title = normalizeSmartSearchText(result?.title ?? "");
	const normalizedKeyword = normalizeSmartSearchText(keyword);
	if (!title || !normalizedKeyword) return false;
	const tokens = getSmartKeywordTokens(keyword);
	if (tokens.length >= 2) {
		return title.includes(normalizedKeyword) || tokens.every((token) =>
			title.includes(token),
		);
	}
	return title.includes(normalizedKeyword);
};

export const smartResultTitleMatchesSectionKeyword = (result: SmartResult, section: SmartSectionPlan) =>
	section?.category === "person"
		? smartResultTitleMatchesPersonName(result, section.keyword ?? "")
		: smartResultTitleMatchesKeyword(result, section.keyword ?? "");

export const smartResultMatchesRequiredSectionKeyword = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) =>
	smartResultTitleMatchesSectionKeyword(result, section) ||
	(isNutritionSmartSection(section) &&
		smartResultMatchesKeyword(result, section.keyword ?? "")) ||
	(isKo &&
		section?.category === "person" &&
		hasSmartResultLanguage(result, true) &&
		smartResultMatchesKeyword(result, section.keyword ?? ""));

export const smartResultIsEligibleForSection = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) =>
	smartResultIsFreshEnough(result, section, isKo) &&
	smartResultMatchesCategoryContext(result, section) &&
	smartResultMatchesSourceScope(result, section, isKo);

const getSmartResultScore = (result: SmartResult) => {
	const score = Number(result?.score);
	return Number.isFinite(score) ? score : null;
};

const getSmartResultFreshnessRank = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) => {
	const currentYear = getSmartCurrentYear();
	const publishedTime = getSmartPublishedTime(result);
	if (publishedTime !== null) {
		const publishedYear = new Date(publishedTime).getFullYear();
		if (publishedYear >= currentYear) return 3;
		if (publishedYear >= currentYear - 1) return 1;
		return -8;
	}
	if (
		isKoreanPersonUpdatesSection(section, isKo) &&
		!smartResultTitleHasOlderYearSignal(result, currentYear)
	) {
		return 0.8;
	}
	if (smartResultHasStaleRelativeSignal(result)) return -8;
	if (smartResultHasYearSignal(result, currentYear)) return 1.6;
	if (smartResultHasOlderYearSignal(result, currentYear)) return -8;
	return 0;
};

const getSmartSectionTokens = (section: SmartSectionPlan) =>
	getSmartKeywordTokens(`${section.keyword ?? ""} ${section.query ?? ""}`)
		.filter((token) => !SMART_SECTION_STOPWORDS.has(token))
		.slice(0, 8);

const smartResultMatchesSection = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) => {
	if (smartResultMatchesKeyword(result, section.keyword ?? "")) return true;
	const haystack = normalizeSmartSearchText(getSmartResultText(result));
	const title = normalizeSmartSearchText(result?.title ?? "");
	const sectionTokens = getSmartSectionTokens(section);
	const tokenMatches = sectionTokens.filter((token) => haystack.includes(token));
	const titleTokenMatches = sectionTokens.filter((token) => title.includes(token));
	const score = getSmartResultScore(result);
	if (score !== null && score >= 0.62 && titleTokenMatches.length >= 1) return true;
	if (
		isKo &&
		hasSmartResultLanguage(result, true) &&
		isPreferredKoreanSource(result) &&
		(score === null || score >= 0.45) &&
		(titleTokenMatches.length >= 1 || tokenMatches.length >= 2)
	) {
		return true;
	}
	if (isPreferredInfoSource(result) && score !== null && score >= 0.58) {
		return titleTokenMatches.length >= 1 || tokenMatches.length >= 2;
	}
	return tokenMatches.length >= 2;
};

const formatSmartSource = (url = "") => {
	return getSmartHostname(url);
};

const BAD_SMART_CONTENT_RE =
	/(aboutpresscopyrightcontact\s*uscreatorsadvertisedeveloperstermsprivacypolicy|about\s+press\s+copyright\s+contact\s+us\s+creators\s+advertise\s+developers\s+terms\s+privacy\s+policy|youtube\s+about\s+press\s+copyright|skip navigation|sign in to confirm|privacy policy|terms of service|cookie policy|all rights reserved|copyright|google llc|subscribe to|log in|login|sign up|cookie settings|advertisement|sponsored content|share this|copy link)/i;

const SMART_MARKDOWN_LINK_RE =
	/\[([^\]]{1,140})\]\((?:https?:\/\/|www\.)[^)]+\)/gi;
const SMART_RAW_URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const SMART_SYMBOL_RUN_RE =
	/[|\u2022\u25CF\u25A0\u25A1\u25C6\u25C7\u2605\u2606\u25B6\u25B7\u25BA\u25BC\u25B2]{2,}/g;
const SMART_HTML_ENTITY_RE = /&(?:nbsp|amp|quot|apos|#39|lt|gt);/gi;
const SMART_EMPTY_UI_RE =
	/^(home|menu|search|login|log in|sign in|subscribe|share|comment|watch|shorts|videos|channels|about|contact)$/i;

export const cleanSmartContentText = (value = "") => {
	const text = String(value || "")
		.replace(SMART_MARKDOWN_LINK_RE, "$1")
		.replace(SMART_RAW_URL_RE, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(SMART_HTML_ENTITY_RE, " ")
		.replace(/[\u200B-\u200D\uFEFF]/g, " ")
		.replace(SMART_SYMBOL_RUN_RE, " ")
		.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu, " ")
		.replace(/(?:©|\(c\)|copyright)\s*\d{4}[^.!?。]*[.!?。]?/gi, " ")
		.replace(/(^|\s)[#@]([\p{L}\p{N}_-]+)/gu, "$1$2")
		.replace(
			/AboutPressCopyrightContact\s*usCreatorsAdvertiseDevelopersTermsPrivacyPolicy.*/gi,
			" ",
		)
		.replace(
			/About\s+Press\s+Copyright\s+Contact\s+us\s+Creators\s+Advertise\s+Developers\s+Terms\s+Privacy\s+Policy.*/gi,
			" ",
		)
		.replace(
			/\b(Privacy Policy|Terms of Service|Cookie Policy|All rights reserved|Skip navigation|Sign in to confirm)\b.*/gi,
			" ",
		)
		.replace(/\s+/g, " ")
		.trim();
	if (!text || BAD_SMART_CONTENT_RE.test(text)) return "";
	return text;
};

const countSmartTextMatches = (value: unknown, pattern: RegExp) =>
	String(value || "").match(pattern)?.length ?? 0;

const isMeaningfulSmartContentText = (value = "", isKo = false) => {
	const text = cleanSmartContentText(value);
	if (!text || SMART_EMPTY_UI_RE.test(text)) return false;
	if (/\b(?:https?:\/\/|www\.)\S+/i.test(text) || BAD_SMART_CONTENT_RE.test(text)) {
		return false;
	}

	const compact = text.replace(/\s+/g, "");
	const letterCount = countSmartTextMatches(text, /\p{L}/gu);
	const numberCount = countSmartTextMatches(text, /\p{N}/gu);
	const contentCount = letterCount + numberCount;
	const symbolCount = countSmartTextMatches(
		text,
		/[^\p{L}\p{N}\s.,!?;:'"()[\]{}%&/+\u00B7\-\u2013\u2014]/gu,
	);

	if (compact.length < (isKo ? 10 : 28)) return false;
	if (contentCount < (isKo ? 6 : 18)) return false;
	if (symbolCount > Math.max(4, Math.floor(contentCount * 0.28))) {
		return false;
	}

	if (!isKo) {
		const words = text.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word));
		if (words.length < 4) return false;
	}
	return true;
};

const smartResultHasDisplayableContent = (result: SmartResult, isKo: boolean) => {
	const title = cleanSmartContentText(result?.title ?? "");
	if (!title || BAD_SMART_CONTENT_RE.test(title)) return false;
	const content = cleanSmartContentText(result?.content ?? "");
	return !content || isMeaningfulSmartContentText(content, isKo);
};

const cleanSmartSnippet = (value = "", maxLength = 90) => {
	const text = cleanSmartContentText(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
};

export const cleanSmartDetail = (value = "", maxLength = 260) => {
	const text = cleanSmartContentText(value);
	if (text.length <= maxLength) return text;
	const firstChunk = text.split(/[.!?。]/)[0]?.trim() ?? "";
	if (firstChunk.length > 40 && firstChunk.length <= maxLength) return firstChunk;
	return `${text.slice(0, maxLength).trim()}...`;
};

const formatSmartTime = (publishedDate: string | null | undefined, isKo: boolean) => {
	const lang = isKo ? "ko" : "en";
	if (!publishedDate) return bs("smart_recent", lang);
	const date = new Date(publishedDate);
	if (Number.isNaN(date.getTime())) return bs("smart_recent", lang);
	return date.toLocaleDateString(isKo ? "ko-KR" : "en-US", {
		month: "short",
		day: "numeric",
	});
};

const getSmartResultRank = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) => {
	const score = getSmartResultScore(result) ?? 0;
	let rank = score + getSmartResultFreshnessRank(result, section, isKo);
	if (smartResultTitleMatchesSectionKeyword(result, section)) rank += 4;
	if (smartResultMatchesKeyword(result, section.keyword ?? "")) rank += 2;
	if (isTrustedSmartSection(section) && isTrustedSmartSource(result, isKo)) {
		rank += 1.4;
	}
	if (isPreferredInfoSource(result)) rank += 0.8;
	if (isKo && isPreferredKoreanSource(result)) rank += 0.6;
	return rank;
};

export const formatSmartItems = (results: SmartResult[], isKo: boolean, section: SmartSectionPlan) => {
	const ranked = dedupeByUrl(
		rankSmartResultsForLanguage(
			results.filter((r) => isRelevantWikiResult(r, section.keyword ?? "")),
			isKo,
			section.allowMixed,
			section.keyword,
		),
	);
	const eligibleRanked = ranked.filter((r) =>
		smartResultIsEligibleForSection(r, section, isKo),
	).filter((r) =>
		smartResultHasDisplayableContent(r, isKo),
	);
	const titleKeywordMatches = eligibleRanked.filter((r) =>
		smartResultTitleMatchesSectionKeyword(r, section),
	);
	if (isKo && isArticleSmartSection(section)) {
		if (DEBUG_FLOW) console.log(`[smart-fmt] ranked=${ranked.length} eligible=${eligibleRanked.length} titleMatches=${titleKeywordMatches.length}`);
		if (DEBUG_FLOW) console.log(`[smart-fmt] eligibleTitles=`, eligibleRanked.map(r => r?.title?.slice(0, 50)));
	}
	const requiredKeywordMatches = eligibleRanked.filter((r) =>
		smartResultMatchesRequiredSectionKeyword(r, section, isKo),
	);
	const keywordMatches = eligibleRanked.filter((r) =>
		smartResultMatchesKeyword(r, section.keyword ?? ""),
	);
	const relatedMatches = eligibleRanked.filter((r) =>
		smartResultMatchesSection(r, section, isKo),
	);
	const highConfidenceMatches = eligibleRanked.filter((r) => {
		const score = getSmartResultScore(r);
		return (
			score !== null &&
			score >= 0.72 &&
			(isPreferredInfoSource(r) || hasSmartResultLanguage(r, isKo))
		);
	});
	const requiredMatchSet = new Set(requiredKeywordMatches);
	const titleMatchSet = new Set(titleKeywordMatches);
	const mustMatchKeyword =
		isNutritionSmartSection(section) ||
		section?.category === "streetwear";
	const mustMatchTitleKeyword = smartSectionRequiresTitleKeyword(section);
	const sourceItems = dedupeByUrl([
		...titleKeywordMatches,
		...requiredKeywordMatches,
		...keywordMatches,
		...relatedMatches,
		...highConfidenceMatches,
	]).filter((item) =>
		mustMatchTitleKeyword
			? titleMatchSet.has(item)
			: mustMatchKeyword
			? smartResultMatchesKeyword(item, section.keyword ?? "")
			: (requiredMatchSet.size > 0 ? requiredMatchSet.has(item) : true),
	);

	return sourceItems
		.sort(
			(a, b) =>
				getSmartResultRank(b, section, isKo) -
				getSmartResultRank(a, section, isKo),
		)
		.slice(0, section.maxItems ?? 2)
		.map((r) => {
			const detail = cleanSmartDetail(r.content);
			const snippet = cleanSmartSnippet(r.content);
			return {
				title: cleanSmartTitle(r.title ?? r.url ?? "", isKo),
				url: r.url ?? "",
				source: formatSmartSource(r.url),
				time: formatSmartTime(r.published_date, isKo),
				image: r.image ?? null,
				score: getSmartResultScore(r),
				snippet,
				detail,
			};
		})
		.filter((item) => item?.title);
};


export const cleanSmartTitle = (value: unknown, isKo: boolean) => {
	const text = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	const maxLength = isKo ? 64 : 82;
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
};
