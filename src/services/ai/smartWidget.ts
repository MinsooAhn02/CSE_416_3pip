import { dedupeItemsAcrossSections } from "../../utils/articleQuality";
import type {
	SmartWidgetData,
	SmartSection,
} from "../../types/index";
import type { SmartResult, SmartWidgetOpts, SmartSectionPlan } from "./types";
import { getLangConfig, DEBUG_FLOW, invokeFunction } from "./client";
import { _HANGUL, KO_NEWS_DOMAINS, isKeyInfoSmartSection, isArticleSmartSection, isVideoSmartSection, isBlogSmartSection, isNutritionSmartSection, isStreetwearFreshSearchSection, smartSectionRequiresTitleKeyword, getSmartSearchDomains, getSmartCurrentYear, isBlockedSmartUrl, dedupeByUrl, SMART_CATEGORY_CONFIGS, SMART_CATEGORY_IDS } from "./smartWidgetConfig";
import { parseJsonFromText, classifySmartKeyword, buildSmartSectionPlan } from "./smartWidgetClassify";
import { smartResultTitleMatchesSectionKeyword, smartResultMatchesRequiredSectionKeyword, smartResultIsEligibleForSection, cleanSmartContentText, cleanSmartDetail, formatSmartItems, cleanSmartTitle } from "./smartWidgetMatch";

const buildLatestSmartTavilyQuery = (baseQuery: string, isKo: boolean, section: SmartSectionPlan | null = null) => {
	if (section && (isKeyInfoSmartSection(section) || isNutritionSmartSection(section))) {
		return String(baseQuery || "").trim();
	}
	const currentYear = getSmartCurrentYear();
	const latestTerms = isKo
		? `${currentYear} 최신 최근 업데이트 오늘`
		: `${currentYear} latest recent current updates today`;
	return `${String(baseQuery || "").trim()} ${latestTerms}`.trim();
};

const buildSmartTavilyQuery = (section: SmartSectionPlan, isKo: boolean) => {
	const currentYear = getSmartCurrentYear();
	if (section.category === "person") {
		return isKo
			? `"${section.keyword}" ${section.query} 인물`
			: `"${section.keyword}" ${section.query} person`;
	}
	if (section.category === "streetwear" && isArticleSmartSection(section)) {
		if (section.type === "collab") {
			return isKo
				? `"${section.keyword}" 패션 콜라보 협업 컬렉션 최신`
				: `"${section.keyword}" fashion collaboration collection latest`;
		}
		if (section.type === "release") {
			return isKo
				? `"${section.keyword}" 패션 발매 드롭 출시 최신`
				: `"${section.keyword}" fashion release drops launch latest`;
		}
		return isKo
			? `${section.query} ${currentYear}년 패션 스트릿웨어 기사`
			: `${section.query} ${currentYear} fashion streetwear news`;
	}
	if (isArticleSmartSection(section)) {
		return isKo
			? `${section.query} ${currentYear}년 최신 기사 뉴스`
			: `${section.query} ${currentYear} latest news article recent`;
	}
	if (isNutritionSmartSection(section)) {
		return isKo
			? `"${section.keyword}" 영양정보 칼로리 성분 영양성분`
			: `"${section.keyword}" nutrition facts calories ingredients`;
	}
	if (isKeyInfoSmartSection(section)) {
		return isKo
			? `${section.query} 위키 백과 기본 정보`
			: `${section.query} Wikipedia encyclopedia profile key facts`;
	}
	if (isVideoSmartSection(section)) {
		return isKo
			? `${section.query} 유튜브 영상`
			: `${section.query} YouTube video`;
	}
	if (isBlogSmartSection(section)) {
		return isKo
			? `${section.query} 블로그 후기`
			: `${section.query} blog review`;
	}
	if (!isKo) return `${section.query} useful information guide`;
	return `${section.query} 한국 정보 후기 정리`;
};

const fetchSmartTavily = (
	section: SmartSectionPlan,
	mode: string,
	isKo: boolean,
	includeDomains: string[] = [],
	timeRange: string | null | undefined = "month",
	excludeDomains: string[] = [],
) => {
	const payload: Record<string, unknown> = {
		query: buildLatestSmartTavilyQuery(
			buildSmartTavilyQuery(section, isKo),
			isKo,
			section,
		),
		mode,
		search_topic: mode === "news" ? "news" : "general",
		max_results: smartSectionRequiresTitleKeyword(section)
			? Math.max((section.maxItems ?? 2) + 10, 12)
			: Math.max((section.maxItems ?? 2) + 4, 6),
		include_domains: includeDomains,
		exclude_domains: excludeDomains,
	};
	if (timeRange) payload.time_range = timeRange;
	return invokeFunction("tavily", payload);
};

const buildNonLatestArticleQuery = (section: SmartSectionPlan, isKo: boolean) => {
	const keyword = `"${section.keyword}"`;
	if (section.category === "person") {
		return isKo
			? `${keyword} 뉴스 기사 인물`
			: `${keyword} news coverage person`;
	}
	if (section.category === "streetwear") {
		return isKo
			? `${keyword} 패션 스트릿웨어 뉴스 기사`
			: `${keyword} fashion streetwear news coverage`;
	}
	return isKo
		? `${keyword} 뉴스 기사`
		: `${keyword} news coverage`;
};

const fetchNonLatestArticleTavily = (section: SmartSectionPlan, isKo: boolean, includeDomains: string[] = [], excludeDomains: string[] = []) =>
	invokeFunction("tavily", {
		query: buildNonLatestArticleQuery(section, isKo),
		mode: "news",
		search_topic: "news",
		max_results: Math.max((section.maxItems ?? 2) + 10, 12),
		include_domains: includeDomains,
		exclude_domains: excludeDomains,
	});

// 한 섹션의 primary Tavily 파라미터를 반환 (배치 호출 시 재사용)
const buildSectionParams = (section: SmartSectionPlan, isKo: boolean) => {
	const useFreshSearchMode = isStreetwearFreshSearchSection(section);
	const isKoArticle = isKo && isArticleSmartSection(section) && !useFreshSearchMode;
	const mode = isKoArticle ? "search" : (isArticleSmartSection(section) && !useFreshSearchMode ? "news" : "search");
	const includeDomains = isKoArticle ? KO_NEWS_DOMAINS : getSmartSearchDomains(section, isKo);
	const excludeDomains: string[] = [];
	const primaryTimeRange =
		isKeyInfoSmartSection(section) || isNutritionSmartSection(section)
			? null
			: isArticleSmartSection(section) && !useFreshSearchMode
				? (isKoArticle ? "month" : null)
				: isKo ? "year" : "month";
	const retryTimeRange = (isKeyInfoSmartSection(section) || isNutritionSmartSection(section))
		? null
		: useFreshSearchMode ? null : primaryTimeRange;

	const query = buildLatestSmartTavilyQuery(buildSmartTavilyQuery(section, isKo), isKo, section);
	const max_results = smartSectionRequiresTitleKeyword(section)
		? Math.max((section.maxItems ?? 2) + 10, 12)
		: Math.max((section.maxItems ?? 2) + 4, 6);

	return {
		useFreshSearchMode, isKoArticle, mode, includeDomains, excludeDomains,
		primaryTimeRange, retryTimeRange, query, max_results,
	};
};

// 모든 섹션의 primary 쿼리를 한 번의 배치 요청으로 처리
const searchSmartSectionsBatched = async (sections: SmartSectionPlan[], isKo: boolean) => {
	const params = sections.map((s) => buildSectionParams(s, isKo));

	// 1단계: primary 배치
	const primaryQueries = params.map(({ query, mode, max_results, includeDomains, excludeDomains, primaryTimeRange }) => {
		const q: Record<string, unknown> = {
			query, mode, max_results,
			search_topic: mode === "news" ? "news" : "general",
			include_domains: includeDomains,
			exclude_domains: excludeDomains,
		};
		if (primaryTimeRange) q.time_range = primaryTimeRange;
		return q;
	});

	const batchData = await invokeFunction("tavily", { queries: primaryQueries });
	const primaryBatch = Array.isArray(batchData?.batch) ? batchData.batch as Record<string, unknown>[] : null;
	if (DEBUG_FLOW) console.log(`[smart-batch] batchNull=${primaryBatch === null} batchLen=${primaryBatch?.length}`);

	// 2단계: 결과 처리 + retry가 필요한 섹션 수집
	const rawResultsPerSection: SmartResult[][] = sections.map((section, i) => {
		const batchItem = primaryBatch?.[i];
		const results = ((batchItem?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
		const p = params[i];
		if (isKo && isArticleSmartSection(section) && p.isKoArticle) {
			if (DEBUG_FLOW) console.log(`[smart-ko-article] section=${section.type} keyword="${section.keyword}" includeDomains=${JSON.stringify(p.includeDomains?.slice(0,3))} count=${results.length}`);
			if (DEBUG_FLOW) console.log(`[smart-ko-article] titles=`, results.map(r => r?.title?.slice(0, 60)));
		}
		return results;
	});

	const retryIndices: number[] = [];
	sections.forEach((section, i) => {
		const rawResults = rawResultsPerSection[i];
		const p = params[i];
		const titleMatchCount = rawResults.filter((r) =>
			(smartSectionRequiresTitleKeyword(section)
				? smartResultTitleMatchesSectionKeyword(r, section)
				: smartResultMatchesRequiredSectionKeyword(r, section, isKo)) &&
			smartResultIsEligibleForSection(r, section, isKo),
		).length;
		if (titleMatchCount < (section.maxItems ?? 2) && p.retryTimeRange !== p.primaryTimeRange) {
			retryIndices.push(i);
		}
	});

	// 3단계: retry 배치 (필요한 섹션만)
	if (retryIndices.length > 0) {
		const retryQueries = retryIndices.map((i) => {
			const p = params[i];
			const q: Record<string, unknown> = {
				query: p.query, mode: p.mode, max_results: p.max_results,
				search_topic: p.mode === "news" ? "news" : "general",
				include_domains: p.includeDomains,
				exclude_domains: p.excludeDomains,
			};
			if (p.retryTimeRange) q.time_range = p.retryTimeRange;
			return q;
		});
		const retryBatchData = await invokeFunction("tavily", { queries: retryQueries });
		const retryBatch = Array.isArray(retryBatchData?.batch) ? retryBatchData.batch as Record<string, unknown>[] : null;
		retryIndices.forEach((sectionIdx, batchPos) => {
			const retryResults = ((retryBatch?.[batchPos]?.results as SmartResult[] | undefined) ?? [])
				.filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
			if (retryResults.length > 0) {
				rawResultsPerSection[sectionIdx] = dedupeByUrl([...rawResultsPerSection[sectionIdx], ...retryResults]);
			}
		});
	}

	// 4단계: 섹션별 최종 포맷팅 (fallback은 개별 처리)
	return Promise.all(sections.map(async (section, i) => {
		const p = params[i];
		let rawResults = rawResultsPerSection[i];
		let items = formatSmartItems(rawResults, isKo, section);

		if ((isVideoSmartSection(section) || isBlogSmartSection(section)) && items.length === 0) {
			const fallback = await fetchSmartTavily(section, p.mode, isKo, p.includeDomains, null, p.excludeDomains);
			const fbResults = ((fallback?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
			if (fbResults.length > 0) {
				rawResults = dedupeByUrl([...rawResults, ...fbResults]);
				items = formatSmartItems(rawResults, isKo, section);
			}
		}
		if (isArticleSmartSection(section) && !p.useFreshSearchMode && items.length === 0) {
			const fallback2 = await fetchNonLatestArticleTavily(section, isKo, p.includeDomains, p.excludeDomains);
			const fb2Results = ((fallback2?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
			if (fb2Results.length > 0) {
				rawResults = dedupeByUrl([...rawResults, ...fb2Results]);
				items = formatSmartItems(rawResults, isKo, section);
			}
		}
		return { ...section, items };
	}));
};


const BAD_SMART_BULLET_RE =
	/(^additionally$|^also$|^however$|^moreover$|^therefore$|^meanwhile$|^overall$|to ensure|ensure you|check that|quality denim|season and purpose|based on|provided data|no direct|no specific|not available|insufficient|lack of|cannot compare|no comparison|official site|website|click|visit|link|source|aboutpresscopyrightcontact|privacy policy|terms of service|cookie policy|skip navigation|sign in|all rights reserved|copyright|google llc|©|검색 결과가 부족|제공된|직접 비교|비교.*없|정보.*없|자료.*없|공식|사이트|링크|확인하세요)/i;

const cleanSmartBullet = (value: unknown) => {
	const text = cleanSmartContentText(String(value ?? ""))
		.replace(/^[-•*\d.)\s]+/, "")
		.replace(/[.!?。]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!text || BAD_SMART_BULLET_RE.test(text)) return "";
	if (!_HANGUL.test(text)) {
		const wordCount = text.split(/\s+/).filter(Boolean).length;
		if (wordCount < 2 || wordCount > 14) return "";
	}
	const maxLength = _HANGUL.test(text) ? 80 : 110;
	if (text.length <= maxLength) return text;
	const firstChunk = text.split(/[;·\-–—|]/)[0]?.trim() ?? "";
	if (firstChunk.length > 3 && firstChunk.length <= maxLength) return firstChunk;
	return "";
};

const synthesizeSmartSections = async ({ keyword, category, sections, isKo }: { keyword: string; category: string; sections: (SmartSectionPlan & { items?: unknown[]; bullets?: string[]; details?: string[]; title?: string; linkOnly?: boolean })[]; isKo: boolean }) => {
	return sections.map((section) => {
		return {
			type: section.type,
			title: section.title,
			linkOnly: section.linkOnly,
			details: [],
			items: section.items,
		};
	});
};

type SmartSectionFull = SmartSectionPlan & { items?: { title?: string; url?: string; source?: string; time?: string; snippet?: string; detail?: string; score?: number | null; image?: string | null }[]; bullets?: string[]; details?: string[]; title?: string; linkOnly?: boolean; answer?: string };

const ensureKoreanSmartText = async (sections: SmartSectionFull[]) => {
	const targets: { kind: string; sectionIndex: number; bulletIndex?: number; detailIndex?: number; itemIndex?: number; text: string }[] = [];
	sections.forEach((section, sectionIndex) => {
		(section.bullets ?? []).forEach((bullet, bulletIndex) => {
			if (!_HANGUL.test(bullet)) {
				targets.push({
					kind: "bullet",
					sectionIndex,
					bulletIndex,
					text: bullet,
				});
			}
		});
		(section.details ?? []).forEach((detail, detailIndex) => {
			if (detail && !_HANGUL.test(detail)) {
				targets.push({
					kind: "detail",
					sectionIndex,
					detailIndex,
					text: detail,
				});
			}
		});
		(section.items ?? []).forEach((item, itemIndex) => {
			if (item.title && !_HANGUL.test(item.title)) {
				targets.push({
					kind: "itemTitle",
					sectionIndex,
					itemIndex,
					text: item.title,
				});
			}
		});
	});
	if (targets.length === 0) return sections;

	const data = await invokeFunction("groq", {
		system: [
			"You translate smart-widget UI text into natural Korean.",
			"Return only valid JSON array. No markdown, no commentary.",
			"Preserve kind, sectionIndex, bulletIndex, detailIndex, and itemIndex when provided.",
		].join("\n"),
		prompt: [
			"Translate each text to Korean.",
			"Keep product names, brand names, model names, and proper nouns recognizable.",
			'Return shape: [{"kind":"bullet","sectionIndex":0,"bulletIndex":0,"text":"..."},{"kind":"detail","sectionIndex":0,"detailIndex":0,"text":"..."},{"kind":"itemTitle","sectionIndex":0,"itemIndex":0,"text":"..."}]',
			JSON.stringify(targets, null, 2),
		].join("\n"),
		temperature: 0.1,
	});

	const parsed = parseJsonFromText(String(data?.text ?? ""));
	const translations = Array.isArray(parsed) ? parsed : [];
	if (translations.length === 0) return sections;

	const next = sections.map((section) => ({
		...section,
		details: [...(section.details ?? [])],
		items: (section.items ?? []).map((item) => ({ ...item })),
	}));
	for (const rawItem of translations) {
		const item = rawItem as Record<string, unknown>;
		const kind = item?.kind;
		const sectionIndex = Number(item?.sectionIndex);
		const bulletIndex = Number(item?.bulletIndex);
		const detailIndex = Number(item?.detailIndex);
		const itemIndex = Number(item?.itemIndex);
		if (!Number.isInteger(sectionIndex) || !next[sectionIndex]) continue;

		if (kind === "bullet") {
			const text = cleanSmartBullet(String(item?.text ?? ""));
			if (
				Number.isInteger(bulletIndex) &&
				next[sectionIndex]?.bullets?.[bulletIndex] &&
				_HANGUL.test(text)
			) {
				next[sectionIndex].bullets![bulletIndex] = text;
			}
			continue;
		}
		if (kind === "detail") {
			const text = cleanSmartDetail(String(item?.text ?? ""), 220);
			if (
				Number.isInteger(detailIndex) &&
				next[sectionIndex]?.details?.[detailIndex] &&
				_HANGUL.test(text)
			) {
				next[sectionIndex].details![detailIndex] = text;
			}
			continue;
		}
		if (kind === "itemTitle") {
			const text = cleanSmartTitle(String(item?.text ?? ""), true);
			if (
				Number.isInteger(itemIndex) &&
				next[sectionIndex]?.items?.[itemIndex] &&
				_HANGUL.test(text)
			) {
				next[sectionIndex].items![itemIndex].title = text;
			}
		}
	}
	return next;
};

export async function generateSmartWidgetData(keyword: string, context: SmartWidgetOpts = {}): Promise<SmartWidgetData | null> {
	const { lang } = getLangConfig();
	const isKo = lang === "ko";
	const categoryOverride = SMART_CATEGORY_IDS.includes(context?.categoryOverride ?? "")
		? context.categoryOverride
		: null;
	const classified = categoryOverride
		? {
			category: categoryOverride,
			emoji: (SMART_CATEGORY_CONFIGS as unknown as Record<string, { emoji: string }>)[categoryOverride]?.emoji || "🔎",
		}
		: await classifySmartKeyword(keyword, isKo);
	const { category, emoji } = classified;
	const sectionPlan = buildSmartSectionPlan(keyword, category, isKo);
	// 배치 모드: 모든 섹션의 primary 쿼리를 한 번의 요청으로 처리 (5~20 호출 → 1~2 호출)
	const searchedSections = await searchSmartSectionsBatched(sectionPlan, isKo);
	const synthesizedSections = await synthesizeSmartSections({
		keyword,
		category,
		sections: searchedSections,
		isKo,
	});
	const sections = isKo
		? await ensureKoreanSmartText(synthesizedSections as SmartSectionFull[])
		: synthesizedSections;
	// 같은 URL은 표시 순서상 첫 섹션에만 (모든 경로가 이 지점을 지남)
	const dedupedSections = dedupeItemsAcrossSections(sections as SmartSectionFull[]);

	const now = new Date();
	const lastUpdated = isKo
		? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} 업데이트`
		: `Updated ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
	const lastUpdatedAt = now.toISOString();

	return {
		keyword,
		emoji,
		category,
		categoryLabel:
			(SMART_CATEGORY_CONFIGS as unknown as Record<string, { label: Record<string, string> }>)[category]?.label?.[lang] ??
			(SMART_CATEGORY_CONFIGS.general.label as Record<string, string>)[lang],
		lastUpdated,
		lastUpdatedAt,
		sections: dedupedSections as unknown as SmartSection[],
	};
}

