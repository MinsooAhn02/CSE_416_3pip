/**
 * 검색 결과 품질 필터 (BACKLOG R11). Tavily가 기사 대신 섹션 목록 페이지나 위키 메타 문서를
 * 돌려주고, 본문 요약 자리에 사이트 메뉴 텍스트가 들어오는 경우를 걸러냄.
 * ponytail: 휴리스틱 — 놓치는 사이트가 보이면 패턴만 추가
 */

// 위키 이름공간 문서 (편집 지침·도움말·분류 등) — 일반 문서는 통과
const WIKI_META_RE = /\/wiki\/(Wikipedia|Help|Portal|Category|Template|Special|Talk|File|Draft)(_talk)?:/i;
const WIKI_META_TITLE_RE = /^(Wikipedia|Help|Portal|Category|Template|Draft):/i;

// "Technology | Latest News & Updates | BBC News"
const LISTING_PHRASE_RE = /(latest news|breaking news|news (&|and) updates|top stories|^home ?page)/i;

// "Opinion - Economy - The New York Times", "Video Games - The New York Times":
// 사이트명 앞의 모든 조각이 3단어 이하 → 섹션 페이지. 기사 제목은 보통 그보다 김.
// (콜론은 기사 제목에도 흔해서 구분자로 쓰지 않음: "Science: New study ...")
const isSectionStyleTitle = (title: string): boolean => {
	if (/[가-힣]/.test(title)) return false; // 한국어 제목은 어절 수가 적어 오탐 ("환율 급등 - 한국경제")
	const parts = title.split(/\s[-|–]\s/).map((p) => p.trim()).filter(Boolean);
	if (parts.length < 2) return false;
	return parts.slice(0, -1).every((p) => p.split(/\s+/).length <= 3);
};

const urlPathSegments = (url: string): string[] => {
	try {
		return new URL(url).pathname.split("/").filter(Boolean);
	} catch {
		return [];
	}
};

/**
 * 섹션/허브 목록 페이지: 경로가 비었거나, 모든 마디가 짧은 단일 단어(하이픈·숫자 없음)인 경우.
 * 기사 URL은 보통 하이픈 slug나 날짜·ID 숫자를 포함함 (예: /article/slug-1a2b, /2026/10/04/...).
 */
const isListingPath = (url: string): boolean => {
	const segs = urlPathSegments(url);
	if (segs.length === 0) return true;
	return segs.length <= 3 && segs.every((s) => /^[a-z]{2,20}$/i.test(s));
};

export const isLowQualityResult = (item: { url?: string; title?: string } | null | undefined): boolean => {
	const url = String(item?.url ?? "");
	const title = String(item?.title ?? "");
	if (WIKI_META_RE.test(url) || WIKI_META_TITLE_RE.test(title)) return true;
	if (/wikipedia\.org/i.test(url)) return false; // 일반 위키 문서는 "핵심 정보" 소스로 사용
	return LISTING_PHRASE_RE.test(title) || isSectionStyleTitle(title) || (url !== "" && isListingPath(url));
};

// 사이트 메뉴·구독 문구가 섞인 요약 — 요약 대신 빈 값 (제목·링크만 표시)
const NAV_SNIPPET_RE =
	/\b(TOP STORIES|SECTIONS|Skip to (main )?content|Sign in|Subscribe now|Log in|Menu|Newsletters?)\b/;

export const cleanSnippet = (content: unknown): string => {
	const text = String(content ?? "").replace(/\s+/g, " ").trim();
	if (!text) return "";
	if (NAV_SNIPPET_RE.test(text)) return "";
	// CNN 메뉴: "World + Africa + Americas + Asia ..."
	if ((text.match(/ \+ /g) ?? []).length >= 3) return "";
	// 대문자 단어 비율이 높으면 메뉴/네비게이션 나열일 가능성이 큼
	const words = text.split(" ").filter((w) => /[A-Za-z]/.test(w));
	const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase());
	if (words.length >= 8 && capsWords.length / words.length > 0.3) return "";
	return text;
};

/**
 * 위키 결과 관련성: 제목이 키워드와 같거나 "키워드 + 공백/콜론"으로 시작해야 통과.
 * "(film)" 같은 괄호 구분어 문서와 단어 속에 키워드가 섞인 문서(WarGames)는 제외.
 * 키워드 자체에 구분어 단어가 있으면("Games film") 그 구분어는 허용. 위키가 아닌 결과는 항상 통과.
 * ponytail: 접두어 기준 — "Computer keyboard"처럼 키워드가 뒤에 오는 문서는 의도적으로 제외
 */
export const isRelevantWikiResult = (
	item: { url?: string; title?: string } | null | undefined,
	keyword: string,
): boolean => {
	if (!/wikipedia\.org/i.test(String(item?.url ?? ""))) return true;
	const kw = keyword.trim().toLowerCase();
	if (!kw) return true;
	const title = String(item?.title ?? "").replace(/\s[-–|]\s(Wikipedia|위키백과).*$/i, "").trim().toLowerCase();
	const paren = title.match(/^(.*?)\s*\(([^)]+)\)$/);
	if (paren) {
		const kwWords = kw.split(/[\s()]+/);
		return kw.startsWith(paren[1]) && paren[2].split(/\s+/).some((w) => kwWords.includes(w));
	}
	return title === kw || title.startsWith(`${kw} `) || title.startsWith(`${kw}:`);
};

const normalizeUrlKey = (url: string): string => {
	try {
		const u = new URL(url);
		const v = u.searchParams.get("v"); // 유튜브는 쿼리(v)가 영상 ID
		return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${v ? `?v=${v}` : ""}`;
	} catch {
		return url.trim().toLowerCase();
	}
};

/** 섹션 간 중복 URL 제거: 표시 순서상 먼저 나온 섹션에만 남김 (url 없는 항목은 유지) */
export const dedupeItemsAcrossSections = <T extends { items?: { url?: string }[] }>(sections: T[]): T[] => {
	const seen = new Set<string>();
	return sections.map((s) => {
		if (!Array.isArray(s.items)) return s;
		const items = s.items.filter((it) => {
			if (!it?.url) return true;
			const key = normalizeUrlKey(it.url);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return { ...s, items };
	});
};
