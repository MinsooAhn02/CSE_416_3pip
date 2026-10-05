import { isLowQualityResult, cleanSnippet } from "../../utils/articleQuality";
import type { ArticleItem, SmartResult, SmartSectionPlan } from "./types";

/**
 * 스마트 위젯 데이터 생성
 * 1단계: Groq/룰 기반으로 키워드 카테고리 분류
 * 2단계: 카테고리별 섹션 계획 생성
 * 3단계: Tavily로 섹션별 검색 후 Groq로 섹션 요약 생성
 */
export const _HANGUL = /[가-힣]/;
const _LATIN  = /[a-zA-Z]/;

export const KO_NEWS_DOMAINS = [
	"news.naver.com",
	"yna.co.kr",
	"chosun.com",
	"joins.com",
	"hani.co.kr",
	"news1.kr",
	"newsis.com",
	"ytn.co.kr",
	"mk.co.kr",
	"hankyung.com",
	"mt.co.kr",
	"heraldcorp.com",
	"etnews.com",
	"zdnet.co.kr",
	"kbs.co.kr",
	"mbc.co.kr",
	"sbs.co.kr",
	"jtbc.co.kr",
	"yonhapnews.co.kr",
];

const KO_INFO_DOMAINS = [
	"blog.naver.com",
	"m.blog.naver.com",
	"post.naver.com",
	"kin.naver.com",
	"brunch.co.kr",
	"tistory.com",
	"velog.io",
	"youtube.com",
	"youtu.be",
	"terms.naver.com",
	"namu.wiki",
];

const EN_INFO_DOMAINS = [
	"youtube.com",
	"youtu.be",
	"medium.com",
	"reddit.com",
	"substack.com",
	"wordpress.com",
	"blogspot.com",
	"quora.com",
];

const uniqueSmartDomains = (domains: string[]): string[] => Array.from(new Set(domains));

const KO_PLACE_DOMAINS = uniqueSmartDomains([
	"place.naver.com",
	"m.place.naver.com",
	"map.naver.com",
	"map.kakao.com",
	"place.map.kakao.com",
]);

export const KO_VIDEO_DOMAINS = uniqueSmartDomains([
	"youtube.com",
	"youtu.be",
]);

export const EN_VIDEO_DOMAINS = uniqueSmartDomains([
	"youtube.com",
	"youtu.be",
]);

export const KO_BLOG_DOMAINS = uniqueSmartDomains([
	"blog.naver.com",
	"m.blog.naver.com",
	"post.naver.com",
	"kin.naver.com",
	"brunch.co.kr",
	"tistory.com",
	"velog.io",
]);

export const EN_BLOG_DOMAINS = uniqueSmartDomains([
	"medium.com",
	"substack.com",
	"wordpress.com",
	"blogspot.com",
]);

const KO_KEY_INFO_DOMAINS = uniqueSmartDomains([
	"terms.naver.com",
	"namu.wiki",
	"wikipedia.org",
]);

const EN_KEY_INFO_DOMAINS = uniqueSmartDomains([
	"wikipedia.org",
	"britannica.com",
]);

const KO_ARTICLE_DOMAINS = uniqueSmartDomains([
	...KO_NEWS_DOMAINS,
]);

const EN_ARTICLE_DOMAINS = uniqueSmartDomains([
	"reuters.com",
	"apnews.com",
	"bbc.com",
	"theguardian.com",
	"nytimes.com",
	"wsj.com",
	"theverge.com",
	"wired.com",
	"vogue.com",
	"hypebeast.com",
]);

const KO_TRUSTED_DOMAINS = uniqueSmartDomains([
	...KO_KEY_INFO_DOMAINS,
	...KO_ARTICLE_DOMAINS,
]);

const EN_TRUSTED_DOMAINS = uniqueSmartDomains([
	...EN_KEY_INFO_DOMAINS,
	...EN_ARTICLE_DOMAINS,
]);

const KO_SMART_DOMAINS = uniqueSmartDomains([
	...KO_INFO_DOMAINS,
	...KO_NEWS_DOMAINS,
]);
const INFO_SMART_DOMAINS = uniqueSmartDomains([
	...KO_INFO_DOMAINS,
	...EN_INFO_DOMAINS,
]);

const getKoreanSmartDomains = (section: SmartSectionPlan): string[] =>
	section.searchMode === "news"
		? uniqueSmartDomains([...KO_NEWS_DOMAINS, ...KO_INFO_DOMAINS])
		: KO_SMART_DOMAINS;

const KEY_INFO_SMART_SECTION_TYPES = new Set([
	"overview",
	"brand_info",
	"profile",
]);

const ARTICLE_SMART_SECTION_TYPES = new Set([
	"updates",
	"release",
	"collab",
]);

const VIDEO_SMART_SECTION_TYPES = new Set(["video"]);
const BLOG_SMART_SECTION_TYPES = new Set(["blog"]);
const NUTRITION_SMART_SECTION_TYPES = new Set(["nutrition"]);

const TRUSTED_SMART_SECTION_TYPES = new Set([
	...KEY_INFO_SMART_SECTION_TYPES,
	...ARTICLE_SMART_SECTION_TYPES,
]);

export const isTrustedSmartSection = (section: SmartSectionPlan): boolean =>
	TRUSTED_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isKeyInfoSmartSection = (section: SmartSectionPlan): boolean =>
	KEY_INFO_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isArticleSmartSection = (section: SmartSectionPlan): boolean =>
	ARTICLE_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isVideoSmartSection = (section: SmartSectionPlan): boolean =>
	VIDEO_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isBlogSmartSection = (section: SmartSectionPlan): boolean =>
	BLOG_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isNutritionSmartSection = (section: SmartSectionPlan): boolean =>
	NUTRITION_SMART_SECTION_TYPES.has(section?.type ?? "");

export const isStreetwearFreshSearchSection = (section: SmartSectionPlan): boolean =>
	section?.category === "streetwear" &&
	(section?.type === "collab" || section?.type === "release");

export const smartSectionRequiresTitleKeyword = (section: SmartSectionPlan): boolean =>
	isArticleSmartSection(section) ||
	isVideoSmartSection(section) ||
	isBlogSmartSection(section);

export const getSmartSearchDomains = (section: SmartSectionPlan, isKo: boolean): string[] => {
	if (isNutritionSmartSection(section)) {
		return [];
	}
	if (section?.category === "streetwear" && isArticleSmartSection(section)) {
		return [];
	}
	if (isKeyInfoSmartSection(section)) {
		return isKo ? KO_KEY_INFO_DOMAINS : EN_KEY_INFO_DOMAINS;
	}
	if (section?.type === "local_spots") {
		return isKo ? KO_PLACE_DOMAINS : [];
	}
	if (isArticleSmartSection(section)) {
		return isKo ? KO_ARTICLE_DOMAINS : EN_ARTICLE_DOMAINS;
	}
	if (isVideoSmartSection(section)) {
		return isKo ? KO_VIDEO_DOMAINS : EN_VIDEO_DOMAINS;
	}
	if (isBlogSmartSection(section)) {
		return isKo ? KO_BLOG_DOMAINS : EN_BLOG_DOMAINS;
	}
	return isKo ? getKoreanSmartDomains(section) : [];
};

export const getSmartCurrentYear = (): number => new Date().getFullYear();

export const getSmartPublishedTime = (result: ArticleItem): number | null => {
	const date = new Date(result?.published_date ?? "");
	return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getSmartPublishedYear = (result: ArticleItem): number | null => {
	const publishedTime = getSmartPublishedTime(result);
	return publishedTime === null ? null : new Date(publishedTime).getFullYear();
};

export const isKoreanPersonUpdatesSection = (section: SmartSectionPlan, isKo: boolean): boolean =>
	Boolean(isKo && section?.category === "person" && section?.type === "updates");

export const smartResultHasYearSignal = (result: ArticleItem, year = getSmartCurrentYear()): boolean =>
	normalizeSmartSearchText(getSmartResultText(result)).includes(String(year));

export const smartResultHasOlderYearSignal = (result: ArticleItem, year = getSmartCurrentYear()): boolean => {
	const text = normalizeSmartSearchText(getSmartResultText(result));
	const years = text.match(/\b20\d{2}\b/g) ?? [];
	return years.some((value) => Number(value) < year);
};

export const smartResultTitleHasOlderYearSignal = (
	result: ArticleItem,
	year = getSmartCurrentYear(),
): boolean => {
	const title = normalizeSmartSearchText(result?.title ?? "");
	const years = title.match(/\b20\d{2}\b/g) ?? [];
	return years.some((value) => Number(value) < year);
};

export const smartResultHasStaleRelativeSignal = (result: ArticleItem): boolean => {
	const text = String(getSmartResultText(result) || "").toLowerCase();
	return (
		/\b(?:one|[1-9]\d*)\s*(?:year|years|yr|yrs)\s*ago\b/i.test(text) ||
		/\b(?:1[2-9]|[2-9]\d+)\s*(?:month|months|mo|mos)\s*ago\b/i.test(text) ||
		/[1-9]\d*\s*년\s*전/.test(text) ||
		/(?:1[2-9]|[2-9]\d+)\s*개월\s*전/.test(text)
	);
};

export const smartResultIsFreshEnough = (result: ArticleItem, section: SmartSectionPlan, isKo = false): boolean => {
	const currentYear = getSmartCurrentYear();
	const publishedYear = getSmartPublishedYear(result);
	if (isKeyInfoSmartSection(section)) return true;
	if (isArticleSmartSection(section)) {
		if (isKo && publishedYear !== null && publishedYear < currentYear - 1) return false;
		if (smartResultHasStaleRelativeSignal(result)) return false;
		if (isStreetwearFreshSearchSection(section)) return true;
		return !smartResultTitleHasOlderYearSignal(result, currentYear);
	}
	if (publishedYear !== null) return publishedYear >= currentYear - 1;
	if (smartResultHasStaleRelativeSignal(result)) return false;
	if (isVideoSmartSection(section)) {
		return smartResultHasYearSignal(result, currentYear) && !smartResultHasOlderYearSignal(result, currentYear);
	}
	if (smartResultHasYearSignal(result, currentYear)) return true;
	return !smartResultHasOlderYearSignal(result, currentYear);
};

export const getSmartResultText = (result: ArticleItem): string =>
	[
		result?.title,
		result?.content,
		result?.url,
	].filter(Boolean).join(" ");

export const hasSmartResultLanguage = (result: ArticleItem, isKo: boolean): boolean => {
	const text = getSmartResultText(result);
	return isKo ? _HANGUL.test(text) : (!_HANGUL.test(text) && _LATIN.test(text));
};

export const getSmartHostname = (url = ""): string => {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
};

const isSmartDomainMatch = (hostname: string, domain: string) =>
	hostname === domain || hostname.endsWith(`.${domain}`);

export const isSmartResultFromDomains = (result: SmartResult, domains: string[] = []) => {
	const hostname = getSmartHostname(result?.url ?? "");
	return hostname
		? domains.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

const BLOCKED_SMART_URL_PATTERNS = [
	/tistory\.com\/tag\//i,
	/\.tistory\.com\/tag\//i,
	/facebook\.com/i,
];

export const isBlockedSmartUrl = (url: string): boolean =>
	BLOCKED_SMART_URL_PATTERNS.some((pattern) => pattern.test(url));

export const isPreferredKoreanSource = (result: SmartResult) => {
	const hostname = getSmartHostname(result?.url ?? "");
	return hostname
		? KO_SMART_DOMAINS.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

export const isPreferredInfoSource = (result: SmartResult) => {
	const hostname = getSmartHostname(result?.url ?? "");
	return hostname
		? INFO_SMART_DOMAINS.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

export const isTrustedSmartSource = (result: SmartResult, isKo: boolean) => {
	const hostname = getSmartHostname(result?.url ?? "");
	const trustedDomains = isKo ? KO_TRUSTED_DOMAINS : EN_TRUSTED_DOMAINS;
	return hostname
		? trustedDomains.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

export const filterSmartResults = (items0: SmartResult[], isKo: boolean) => {
	// 섹션 목록·위키 메타 페이지 제외 + 메뉴 텍스트 요약 제거 (BACKLOG R11)
	const items = items0
		.filter((r) => !isLowQualityResult(r))
		.map((r) => ({ ...r, content: cleanSnippet(r.content) }));
	const langFiltered = items.filter((r) => {
		return hasSmartResultLanguage(r, isKo);
	});
	if (isKo && langFiltered.length >= 1) {
		const others = items.filter((r) => !langFiltered.includes(r));
		return [...langFiltered, ...others];
	}
	if (langFiltered.length >= 1) return langFiltered;
	// Korean mode: fall back to all items (Korean sources may mix scripts)
	// English mode: never fall back to mixed/Korean articles
	return isKo ? items : [];
};

export const dedupeByUrl = (items: SmartResult[]) => {
	const seen = new Set();
	const out = [];
	for (const r of items) {
		const key = String(r?.url || r?.title || "").trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(r);
	}
	return out;
};

export const SMART_CATEGORY_CONFIGS = {
	shopping: {
		emoji: "🛒",
		label: { ko: "쇼핑", en: "Shopping" },
		description:
			"shopping, products, retail items, stores, price checks, product reviews, availability",
		match:
			/(쇼핑|구매|제품|상품|스토어|매장|가격|가격비교|최저가|시세|비용|견적|특가|핫딜|쿠폰|할인|세일|딜|가성비|비싸|저렴|쿠팡|네이버쇼핑|무신사|shopping|shop|buy|product|item|store|retail|price|pricing|cost|costs|cheap|cheaper|cheapest|expensive|lowest price|best price|price comparison|deal|sale|discount|coupon|promo|promotion|bargain|value for money|amazon|coupang)/i,
		sections: [
			{
				type: "products",
				title: { ko: "제품 정보", en: "Product Info" },
				query: {
					ko: "{keyword} 제품 정보 특징 스펙 리뷰",
					en: "{keyword} product information features reviews",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "reviews",
				title: { ko: "리뷰/평가", en: "Reviews" },
				query: {
					ko: "{keyword} 리뷰 후기 평가 장단점",
					en: "{keyword} reviews ratings pros cons",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "deals",
				title: { ko: "가격 동향", en: "Price Watch" },
				query: {
					ko: "{keyword} 가격 할인 세일 재고 최신",
					en: "{keyword} price sale discount availability latest",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	streetwear: {
		emoji: "🛍️",
		label: { ko: "패션/스트릿웨어", en: "Fashion & streetwear" },
		description:
			"fashion brands, streetwear, sneakers, style, drops, collaborations, lookbooks",
		match:
			/(supreme|슈프림|streetwear|스트릿|sneaker|스니커|nike|나이키|adidas|아디다스|fashion|패션|스타일|룩북|의류|옷|stussy|스투시|palace|팔라스)/i,
		sections: [
			{
				type: "brand_info",
				title: { ko: "브랜드 정보", en: "Brand Info" },
				query: {
					ko: "{keyword} 브랜드 특징 룩북 스타일",
					en: "{keyword} brand profile lookbook style",
				},
				searchMode: "search",
				maxItems: 3,
			},
			{
				type: "collab",
				title: { ko: "콜라보 정보", en: "Collaborations" },
				query: {
					ko: "{keyword} 패션 스트릿웨어 콜라보 협업 컬렉션 최신",
					en: "{keyword} fashion streetwear latest collaborations collection",
				},
				searchMode: "news",
			},
			{
				type: "release",
				title: { ko: "발매/드롭", en: "Releases & Drops" },
				query: {
					ko: "{keyword} 패션 스트릿웨어 발매 일정 드롭 출시 정보",
					en: "{keyword} fashion streetwear release calendar drops launch date",
				},
				searchMode: "news",
			},
		],
	},
	chains: {
		emoji: "🏬",
		label: { ko: "체인/브랜드", en: "Chains & Brands" },
		description:
			"chains, franchises, brands, restaurant brands, cafe brands, store brands, brand updates, local branches",
		match:
			/(체인|프랜차이즈|브랜드|매장|지점|분점|스타벅스|맥도날드|서브웨이|버거킹|쉐이크쉑|던킨|이디야|백다방|투썸|파리바게뜨|chain|franchise|brand|branch|branches|store brand|restaurant chain|cafe chain|starbucks|mcdonald|subway|burger king|shake shack|dunkin|ediya|twosome|paris baguette)/i,
		sections: [
			{
				type: "brand_info",
				title: { ko: "브랜드 정보", en: "Brand Info" },
				query: {
					ko: "{keyword} 브랜드 정보 특징 대표 메뉴 제품",
					en: "{keyword} brand information signature menu products",
				},
				searchMode: "search",
				maxItems: 3,
			},
			{
				type: "updates",
				title: { ko: "최신 업데이트", en: "Latest Updates" },
				query: {
					ko: "{keyword} 최신 소식 신메뉴 이벤트 기사",
					en: "{keyword} latest updates new menu news",
				},
				searchMode: "news",
				maxItems: 2,
			},
			{
				type: "local_spots",
				title: { ko: "지점/매장 위치", en: "Store Locations" },
				query: {
					ko: "{keyword} 한국 전국 매장 지점 위치 주소 공식",
					en: "{keyword} store locations branches official",
				},
				searchMode: "search",
				maxItems: 4,
			},
		],
	},
	food: {
		emoji: "🍽️",
		label: { ko: "음식/레스토랑", en: "Food & restaurants" },
		description:
			"food, drinks, dishes, ingredients, cafes, restaurants, nutrition, recipes, local food spots",
		match:
			/(음식|맛집|식당|분식|요리|레시피|영양|칼로리|재료|메뉴|레스토랑|카페|디저트|베이커리|음료|food|drink|beverage|restaurant|cafe|bakery|dessert|cuisine|dish|meal|menu|recipe|nutrition|calorie|ingredient|snack)/i,
		sections: [
			{
				type: "nutrition",
				title: { ko: "영양 정보", en: "Nutrition" },
				query: {
					ko: "{keyword} 영양 정보 칼로리 성분 건강",
					en: "{keyword} nutrition calories ingredients health",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "recipe",
				title: { ko: "레시피", en: "Recipes" },
				query: {
					ko: "{keyword} 레시피 만드는 법 재료",
					en: "{keyword} recipe how to make ingredients",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "local_spots",
				title: { ko: "레스토랑/맛집", en: "Restaurants" },
				query: {
					ko: "{keyword} 맛집 레스토랑 추천 지역",
					en: "{keyword} restaurants local spots recommendations",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	camera: {
		emoji: "📷",
		label: { ko: "카메라/촬영", en: "Cameras & photography" },
		description:
			"cameras, lenses, photography gear, deals, shooting tips, model advice",
		match:
			/(카메라|렌즈|미러리스|dslr|사진|촬영|camera|lens|mirrorless|photography|canon|캐논|sony|소니|nikon|니콘|fujifilm|후지|leica|라이카)/i,
		sections: [
			{
				type: "gear",
				title: { ko: "카메라 정보", en: "Camera Info" },
				query: {
					ko: "{keyword} 카메라 정보 리뷰 스펙 추천",
					en: "{keyword} camera information reviews specs recommendations",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "deals",
				title: { ko: "세일/딜", en: "Sales & Deals" },
				query: {
					ko: "{keyword} 카메라 세일 할인 최저가",
					en: "{keyword} camera deals discounts sale price",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "촬영 팁", en: "Shooting Tips" },
				query: {
					ko: "{keyword} 사진 잘 찍는 법 촬영 팁 설정",
					en: "{keyword} photography tips camera settings how to shoot better",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "model_tips",
				title: { ko: "기종별 꿀팁", en: "Model-Specific Tips" },
				query: {
					ko: "{keyword} 기종별 설정 꿀팁 렌즈 추천",
					en: "{keyword} model specific settings tips lens recommendations",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	beauty: {
		emoji: "💄",
		label: { ko: "뷰티/화장품", en: "Beauty & cosmetics" },
		description:
			"beauty, skincare, makeup, perfume, cosmetics, routines, deals",
		match:
			/(뷰티|화장품|스킨케어|메이크업|향수|립스틱|틴트|파데|파운데이션|크림|토너|쿠션|선크림|beauty|cosmetic|skincare|makeup|perfume|fragrance|lipstick|tint|foundation|moisturizer|toner|cushion|sunscreen|sephora|olive young|올리브영)/i,
		sections: [
			{
				type: "products",
				title: { ko: "제품", en: "Products" },
				query: {
					ko: "{keyword} 제품 추천 성분 리뷰",
					en: "{keyword} products ingredients reviews",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "deals",
				title: { ko: "세일", en: "Deals" },
				query: {
					ko: "{keyword} 세일 할인 올리브영 행사",
					en: "{keyword} sale discount deals",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "사용 팁", en: "Routine Tips" },
				query: {
					ko: "{keyword} 사용법 루틴 팁",
					en: "{keyword} how to use routine tips",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	books: {
		emoji: "📚",
		label: { ko: "책/콘텐츠", en: "Books & reading" },
		description:
			"books, novels, manga, authors, reading lists, reviews, where to buy",
		match:
			/(책|소설|만화|웹툰|작가|독서|서점|book|novel|manga|comic|author|reading|bookstore|kindle)/i,
		sections: [
			{
				type: "reviews",
				title: { ko: "리뷰", en: "Reviews" },
				query: {
					ko: "{keyword} 리뷰 평점 독자 반응",
					en: "{keyword} reviews ratings reader reactions",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "related",
				title: { ko: "비슷한 작품", en: "Similar Picks" },
				query: {
					ko: "{keyword} 비슷한 책 추천",
					en: "{keyword} similar books recommendations",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	sports: {
		emoji: "🏃",
		label: { ko: "스포츠/운동", en: "Sports & fitness" },
		description:
			"sports, teams, athletes, workouts, gear, training tips, schedules",
		match:
			/(축구|야구|농구|테니스|러닝|헬스|요가|필라테스|운동|팀|선수|soccer|football|baseball|basketball|tennis|running|workout|fitness|gym|yoga|athlete|team)/i,
		sections: [
			{
				type: "updates",
				title: { ko: "최신 소식", en: "Updates" },
				query: {
					ko: "{keyword} 최신 소식 일정 결과",
					en: "{keyword} latest updates schedule results",
				},
				searchMode: "news",
				maxItems: 2,
			},
			{
				type: "gear",
				title: { ko: "장비", en: "Gear" },
				query: {
					ko: "{keyword} 장비 추천 용품 가격",
					en: "{keyword} gear recommendations equipment price",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "훈련 팁", en: "Training Tips" },
				query: {
					ko: "{keyword} 훈련 방법 팁 자세",
					en: "{keyword} training tips technique guide",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	finance: {
		emoji: "💸",
		label: { ko: "금융/투자", en: "Finance & investing" },
		description:
			"stocks, crypto, markets, personal finance, prices, risks, analysis",
		match:
			/(주식|코인|투자|금리|환율|ETF|경제|재테크|stock|crypto|bitcoin|ethereum|market|investing|finance|etf|interest rate|exchange rate)/i,
		sections: [
			{
				type: "updates",
				title: { ko: "시장 소식", en: "Market Updates" },
				query: {
					ko: "{keyword} 시장 소식 가격 전망",
					en: "{keyword} market news price outlook",
				},
				searchMode: "news",
				maxItems: 2,
			},
			{
				type: "comparison",
				title: { ko: "비교", en: "Comparison" },
				query: {
					ko: "{keyword} 비교 수수료 리스크",
					en: "{keyword} comparison fees risks",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "guide",
				title: { ko: "체크포인트", en: "Checklist" },
				query: {
					ko: "{keyword} 투자 전 체크포인트 리스크",
					en: "{keyword} investing checklist risks",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	health: {
		emoji: "🧘",
		label: { ko: "건강/웰니스", en: "Health & wellness" },
		description:
			"health, wellness, nutrition, supplements, sleep, routines, safety",
		match:
			/(건강|영양제|비타민|미네랄|수면|다이어트|운동법|피부과|병원|health|wellness|nutrition|supplement|vitamin|mineral|sleep|diet|clinic|medical)/i,
		sections: [
			{
				type: "guide",
				title: { ko: "핵심 정보", en: "Key Info" },
				query: {
					ko: "{keyword} 핵심 정보 주의사항",
					en: "{keyword} key information precautions",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "루틴 팁", en: "Routine Tips" },
				query: {
					ko: "{keyword} 루틴 방법 팁",
					en: "{keyword} routine tips how to",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "updates",
				title: { ko: "최신 연구/소식", en: "Research & Updates" },
				query: {
					ko: "{keyword} 최신 연구 뉴스",
					en: "{keyword} latest research news",
				},
				searchMode: "news",
				maxItems: 2,
			},
		],
	},
	education: {
		emoji: "🎓",
		label: { ko: "학습/커리어", en: "Learning & career" },
		description:
			"courses, exams, universities, career skills, learning resources",
		match:
			/(공부|강의|자격증|시험|대학|대학원|커리어|취업|코딩|course|class|exam|certification|university|graduate school|career|job|coding|programming)/i,
		sections: [
			{
				type: "guide",
				title: { ko: "학습 경로", en: "Learning Path" },
				query: {
					ko: "{keyword} 공부 방법 로드맵",
					en: "{keyword} learning path roadmap",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "실전 팁", en: "Practical Tips" },
				query: {
					ko: "{keyword} 실전 팁 준비 방법",
					en: "{keyword} practical tips preparation",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	automotive: {
		emoji: "🚗",
		label: { ko: "자동차/모빌리티", en: "Cars & mobility" },
		description:
			"cars, EVs, bikes, mobility, prices, reviews, maintenance, charging",
		match:
			/(자동차|전기차|차량|중고차|오토바이|자전거|테슬라|현대차|car|ev|vehicle|used car|motorcycle|bike|tesla|hyundai|charging)/i,
		sections: [
			{
				type: "reviews",
				title: { ko: "리뷰/스펙", en: "Reviews & Specs" },
				query: {
					ko: "{keyword} 리뷰 스펙 장단점",
					en: "{keyword} review specs pros cons",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "deals",
				title: { ko: "가격/구매", en: "Price & Buying" },
				query: {
					ko: "{keyword} 가격 구매 보조금 할인",
					en: "{keyword} price buying incentives deals",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "tips",
				title: { ko: "관리 팁", en: "Maintenance Tips" },
				query: {
					ko: "{keyword} 관리 팁 유지비",
					en: "{keyword} maintenance tips ownership cost",
				},
				searchMode: "search",
				maxItems: 2,
			},
		],
	},
	tech: {
		emoji: "💻",
		label: { ko: "테크/가젯", en: "Tech & gadgets" },
		description:
			"gadgets, laptops, phones, apps, specs, comparisons, deals",
		match:
			/(노트북|맥북|아이폰|갤럭시|태블릿|앱|소프트웨어|laptop|macbook|iphone|galaxy|android|tablet|app|software|gadget|device)/i,
		sections: [
			{
				type: "reviews",
				title: { ko: "리뷰/스펙", en: "Reviews & Specs" },
				query: {
					ko: "{keyword} 리뷰 스펙 장단점 비교",
					en: "{keyword} review specs pros cons comparison",
				},
				searchMode: "search",
			},
			{
				type: "deals",
				title: { ko: "할인/구매", en: "Deals & Buying" },
				query: {
					ko: "{keyword} 할인 특가 구매 최저가",
					en: "{keyword} deals discounts best price buy",
				},
				searchMode: "search",
			},
			{
				type: "comparison",
				title: { ko: "비교", en: "Comparisons" },
				query: {
					ko: "{keyword} 비교 추천 대안",
					en: "{keyword} comparison alternatives best picks",
				},
				searchMode: "search",
			},
			{
				type: "tips",
				title: { ko: "활용 팁", en: "How-To Tips" },
				query: {
					ko: "{keyword} 사용법 설정 팁 활용법",
					en: "{keyword} how to use settings tips guide",
				},
				searchMode: "search",
			},
		],
	},
	travel: {
		emoji: "📍",
		label: { ko: "장소/여행", en: "Places & travel" },
		description:
			"places, travel, neighborhoods, attractions, itineraries, local guides",
		match:
			/(여행|동네|지역|장소|호텔|공항|제주|부산|서울|뉴욕|도쿄|travel|trip|hotel|airport|city|place|neighborhood|tokyo|seoul|busan|jeju|new york)/i,
		sections: [
			{
				type: "guide",
				title: { ko: "가이드", en: "Guide" },
				query: {
					ko: "{keyword} 여행 가이드 코스 추천",
					en: "{keyword} travel guide itinerary recommendations",
				},
				searchMode: "search",
			},
			{
				type: "local_spots",
				title: { ko: "가볼 만한 곳", en: "Places to Visit" },
				query: {
					ko: "{keyword} 가볼만한 곳 맛집 카페",
					en: "{keyword} things to do restaurants cafes",
				},
				searchMode: "search",
			},
			{
				type: "deals",
				title: { ko: "예약/할인", en: "Booking & Deals" },
				query: {
					ko: "{keyword} 호텔 항공권 예약 할인",
					en: "{keyword} hotel flights booking deals",
				},
				searchMode: "search",
			},
		],
	},
	entertainment: {
		emoji: "🎬",
		label: { ko: "엔터테인먼트", en: "Entertainment" },
		description:
			"movies, music, games, shows, artists, releases, where to watch",
		match:
			/(영화|드라마|게임|음악|가수|앨범|콘서트|movie|film|drama|game|music|artist|album|concert|netflix|youtube)/i,
		sections: [
			{
				type: "overview",
				title: { ko: "핵심 정보", en: "Key Info" },
				query: {
					ko: "{keyword} 작품 정보 줄거리 출연진 기본 정보",
					en: "{keyword} key information cast plot overview",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "release",
				title: { ko: "공개/발매", en: "Releases" },
				query: {
					ko: "{keyword} 공개일 발매일 일정 최신",
					en: "{keyword} release date schedule latest",
				},
				searchMode: "news",
			},
			{
				type: "reviews",
				title: { ko: "리뷰/반응", en: "Reviews & Reactions" },
				query: {
					ko: "{keyword} 리뷰 반응 평점",
					en: "{keyword} reviews reactions ratings",
				},
				searchMode: "search",
			},
		],
	},
	person: {
		emoji: "👤",
		label: { ko: "인물", en: "Person" },
		description:
			"people, public figures, celebrities, creators, athletes, artists, politicians, executives, founders",
		match:
			/(배우|가수|아이돌|유튜버|크리에이터|인플루언서|작가|감독|선수|교수|창업자|대표|대통령|정치인|아티스트|actor|singer|idol|creator|influencer|writer|director|athlete|professor|founder|ceo|president|politician|artist|designer|celebrity)/i,
		sections: [
			{
				type: "profile",
				title: { ko: "프로필", en: "Profile" },
				query: {
					ko: "{keyword} 프로필 경력 작품",
					en: "{keyword} biography profile career",
				},
				searchMode: "search",
				maxItems: 2,
			},
			{
				type: "updates",
				title: { ko: "최신 기사", en: "Latest Coverage" },
				query: {
					ko: "{keyword} 최신 기사 근황 뉴스",
					en: "{keyword} latest news recent coverage",
				},
				searchMode: "news",
				maxItems: 2,
			},
		],
	},
	general: {
		emoji: "🔎",
		label: { ko: "일반 검색", en: "General Search" },
		description:
			"general topics, concepts, hobbies, anything not covered above",
		match: /.*/,
		sections: [
			{
				type: "overview",
				title: { ko: "핵심 정보", en: "Key Info" },
				query: {
					ko: "{keyword} 핵심 정보 최신 정리",
					en: "{keyword} key information latest overview",
				},
				searchMode: "search",
			},
			{
				type: "updates",
				title: { ko: "최신 업데이트", en: "Latest Updates" },
				query: {
					ko: "{keyword} 최신 소식 업데이트",
					en: "{keyword} latest updates news",
				},
				searchMode: "news",
			},
		],
	},
};

export const SMART_CATEGORY_IDS = Object.keys(SMART_CATEGORY_CONFIGS);
const _smartCategoryConfigsAsMap = SMART_CATEGORY_CONFIGS as unknown as Record<string, { label: { ko: string; en: string }; emoji: string }>;
export const SMART_WIDGET_CATEGORY_OPTIONS: { id: string; label: string; emoji: string; description?: string; match?: RegExp; sections?: unknown[] }[] = SMART_CATEGORY_IDS.map((id) => ({
	id,
	label: _smartCategoryConfigsAsMap[id].label.en ?? id,
	emoji: _smartCategoryConfigsAsMap[id].emoji,
}));

const getSmartCategoryKeywordHints = (config: { match?: RegExp } | null | undefined) => {
	const source = config?.match?.source ?? "";
	if (!source || source === ".*") return [];
	const body =
		source.startsWith("(") && source.endsWith(")")
			? source.slice(1, -1)
			: source;
	return Array.from(
		new Set(
			body
				.split("|")
				.map((term) =>
					term
						.replace(/\\s\+/g, " ")
						.replace(/\\/g, "")
						.replace(/[()[\]{}^$*+]/g, "")
						.trim(),
				)
				.filter((term) => term && term !== "."),
		),
	).slice(0, 36);
};

export const formatSmartCategoryPromptLine = (id: string) => {
	const config = (SMART_CATEGORY_CONFIGS as unknown as Record<string, { label: { en: string }; description: string; match: RegExp }>)[id];
	const keywordHints = getSmartCategoryKeywordHints(config);
	const hintText =
		keywordHints.length > 0
			? ` Keyword hints: ${keywordHints.join(", ")}.`
			: "";
	return `- ${id} (${config.label?.en ?? id}): ${config.description}.${hintText}`;
};


export const normalizeSmartSearchText = (value = "") =>
	String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
