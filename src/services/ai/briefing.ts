import { isGuest } from "../../lib/guest";
import { formatLocalDate } from "../../utils/date";
import { load, save } from "../../utils/storage";
import { isEncryptedBlob, isEncryptionOn, onDiaryKeyStateChange, openJson, sealJson } from "../../lib/diaryKeyState";
import type {
	CalEvent,
	BriefingResult,
} from "../../types/index";
import type { ArticleItem, BriefingContext } from "./types";
import { bs, getLangConfig, invokeFunction } from "./client";

/**
 * 시간대별 공식 인사말 반환
 * @returns {string} 시간대에 맞는 공식 인사말
 */
export function getTimeGreeting(): string {
	const { lang } = getLangConfig();
	const hour = new Date().getHours();
	const isKo = lang === "ko";
	if (hour >= 5 && hour < 12) {
		return isKo
			? "안녕하세요. 상쾌한 아침입니다. 오늘의 핵심 브리핑을 전달드립니다."
			: "Good morning. Here is your structured briefing for today.";
	}
	return isKo
		? "안녕하세요. 활기찬 오후입니다. 현재 시각 기준 업데이트된 브리핑입니다."
		: "Good afternoon. Here is your latest briefing update.";
}

const truncateText = (value: unknown, max = 500): string => {
	const text = String(value ?? "").replace(/\s+/g, " ").trim();
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max).trim()}...`;
};

const toSentenceSummary = (value: unknown, count = 2): string => {
	const text = truncateText(value, 700);
	if (!text) return "";
	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return sentences.slice(0, count).join(" ");
};

/**
 * 날씨 상태 → 이모지 매핑. 영/한 표현 모두 커버.
 */
const getWeatherEmoji = (condition = ""): string => {
	const c = String(condition).toLowerCase();
	if (!c) return "🌡️";
	if (/(thunder|storm|뇌우|천둥)/.test(c)) return "⛈️";
	if (/(snow|sleet|blizzard|눈)/.test(c)) return "❄️";
	if (/(drizzle|shower|rain|비|소나기)/.test(c)) return "🌧️";
	if (/(fog|mist|haze|안개|연무)/.test(c)) return "🌫️";
	if (/(clear|sunny|맑)/.test(c)) return "☀️";
	if (/(overcast|흐림|흐린|온흐림)/.test(c)) return "☁️";
	if (/(cloud|구름|partly)/.test(c)) return "⛅";
	return "🌡️";
};

/**
 * 시간대 모드: morning (5-12) / afternoon (12-18) / evening (18-5)
 */
const getBriefingTimeMode = (date = new Date()): string => {
	const hour = date.getHours();
	if (hour >= 5 && hour < 12) return "morning";
	if (hour >= 12 && hour < 18) return "afternoon";
	return "evening";
};

/**
 * 일정 시간 추출 (오후/저녁 모드에서 "남은" 일정 판별용)
 */
const eventStartTime = (event: CalEvent): number | null => {
	const start = event?.start;
	if (!start) return null;
	const time = new Date(start).getTime();
	return Number.isFinite(time) ? time : null;
};

const formatEventLine = (event: CalEvent, lang: string): string => {
	const isKo = lang === "ko";
	const start = event?.start ? new Date(event.start) : null;
	const time = start
		? start.toLocaleTimeString(isKo ? "ko-KR" : "en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		})
		: "";
	const title = event?.title || event?.summary || bs("event_untitled", lang);
	return time ? `${time} ${title}` : title;
};

/**
 * Groq 호출: 어제 일기를 1-2문장 과거형 사실 서술로 재작성
 * Returns trimmed string or "".
 */
const rewriteYesterdayDiary = async ({ diaryText, memoText, tone, lang, langInstruction }: {
	diaryText?: string | null;
	memoText?: string | null;
	tone: string;
	lang: string;
	langInstruction: string;
}): Promise<string> => {
	const source = (diaryText || memoText || "").trim();
	if (!source) return "";

	const isKo = lang === "ko";
	const prompt = [
		isKo
			? "다음은 사용자의 어제 일기/메모입니다. 1-2문장으로 과거형 사실만 간결하게 서술하세요. 의견·조언·감상·새로운 정보는 절대 추가하지 마세요."
			: "Below is yesterday's diary/memo. Rewrite it as 1-2 short past-tense factual sentences. Do not add opinions, advice, reflections, or new information.",
		"",
		source,
	].join("\n");

	try {
		const data = await invokeFunction("groq", {
			prompt,
			system: [
				isKo
					? "사용자의 어제 일기를 과거형 사실로만 요약한다."
					: "Summarize the user's yesterday diary as past-tense facts only.",
				isKo
					? "출력은 1-2개의 짧은 완결 문장. 군더더기 없음."
					: "Output 1-2 short complete sentences. No filler.",
				isKo
					? "반드시 한국어(한글)로만 작성하세요. 일본어, 중국어(한자), 러시아어, 아랍어 등 다른 언어/문자는 절대 사용하지 마세요."
					: "Write strictly in English only. Do not use Korean, Chinese, Japanese, Cyrillic, Arabic, or any other script.",
				`Tone: ${tone || "neutral"}.`,
				langInstruction,
			].join("\n"),
			temperature: 0.1,
		});
		return truncateText(data?.text, 280);
	} catch {
		return toSentenceSummary(source, 2);
	}
};


/**
 * Groq 호출: 기사 배열을 받아 각 기사에 대한 1문장 요약 반환
 * Returns: [{ index, summary }] — 실패 시 빈 배열 (UI는 제목+링크만 표시)
 */
const summarizeArticlesBatch = async ({ articles, lang, langInstruction }: {
	articles: ArticleItem[];
	lang: string;
	langInstruction: string;
}): Promise<{ index: number; summary: string }[]> => {
	if (!Array.isArray(articles) || articles.length === 0) return [];
	const isKo = lang === "ko";

	const body = articles
		.map((a, i) => {
			const snippet = truncateText(a?.content || a?.title || "", 200);
			return `[${i}] ${truncateText(a?.title || "", 80)}: ${snippet}`;
		})
		.join("\n");

	const prompt = [
		isKo
			? "아래 기사 목록에서 각 기사를 [인덱스] 형태로 1문장(최대 120자)으로 요약하세요. 사실만 사용하고 새로운 정보를 만들어내지 마세요. JSON으로 출력: {\"summaries\":[{\"index\":0,\"summary\":\"...\"}]}"
			: "For each article below, write a 1-sentence summary (max 120 chars). Facts only, no invented info. Output JSON: {\"summaries\":[{\"index\":0,\"summary\":\"...\"}]}",
		"",
		body,
	].join("\n");

	try {
		const data = await invokeFunction("groq", {
			prompt,
			system: [
				isKo ? "각 기사를 사실 기반 1문장으로 요약. JSON만 출력." : "Summarize each article in 1 fact-based sentence. Output JSON only.",
				langInstruction,
			].join("\n"),
			temperature: 0.1,
		});
		const raw = String(data?.text || "").trim();
		const jsonStart = raw.indexOf("{");
		const jsonEnd = raw.lastIndexOf("}");
		if (jsonStart === -1 || jsonEnd === -1) return [];
		const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
		return Array.isArray(parsed?.summaries) ? parsed.summaries : [];
	} catch {
		return [];
	}
};

/**
 * URL → 호스트명 (출처 라벨용). 실패 시 빈 문자열.
 */
const hostFromUrl = (url: unknown): string => {
	if (!url || typeof url !== "string") return "";
	try {
		const h = new URL(url).hostname.replace(/^www\./, "");
		return h;
	} catch {
		return "";
	}
};


/**
 * 상세 브리핑 생성 (deterministic sections + 좁은 범위 AI 보강)
 *
 * 반환값 사양:
 *   summary  - 1줄 요약 (결정론적)
 *   detail   - 후방호환용 평문 (섹션을 줄바꿈으로 연결)
 *   sections - [{ id, title, lines }] 형태의 구조화 배열 (BriefingWidget 모달에서 사용)
 *
 * 섹션 순서:
 *   1) 날짜+날씨  2) 일정  3) 어제  4) 오늘 최신 정보 (스마트키워드 / 뉴스Top3 / 트렌드Top3)
 */
// ── 브리핑 캐시 (BACKLOG R12/A3) ──────────────────────────────
// 같은 입력이면 60분간 재사용 + 동시 요청 합치기 → 새로고침·첫 로그인 모달/위젯 중복 Groq 호출 제거.
// Groq 요약이 실패한(로컬 문구로 대체된) 결과는 5분만 캐시 — 한도 초과 중에 새로고침할 때마다 다시 호출하지 않도록.
const BRIEFING_CACHE_KEY = "mb_briefing_cache";
// 암호화가 켜지는 순간(켜기·잠금 등) 평문으로 저장돼 있던 브리핑 캐시를 즉시 삭제 — 다음 읽기까지 남지 않게
onDiaryKeyStateChange(() => {
	if (!isEncryptionOn()) return;
	const stored = load<{ result?: unknown } | null>(BRIEFING_CACHE_KEY, null);
	if (stored && !isEncryptedBlob(stored.result)) save(BRIEFING_CACHE_KEY, null);
});
const BRIEFING_CACHE_TTL_MS = 60 * 60 * 1000;
const BRIEFING_FAILED_TTL_MS = 5 * 60 * 1000;
type BriefingCacheEntry = { fp: string; at: number; result: BriefingResult; aiOk?: boolean };
let briefingMemCache: BriefingCacheEntry | null = null;
const briefingInFlight = new Map<string, Promise<BriefingResult>>();

const briefingFingerprint = (tone: string, length: string, context: BriefingContext, lang: string): string => {
	const titles = (items?: { title?: string; summary?: string; start?: string }[]) =>
		(items ?? []).map((e) => `${e?.title ?? e?.summary ?? ""}@${e?.start ?? ""}`);
	return JSON.stringify([
		formatLocalDate(),
		getBriefingTimeMode(),
		lang,
		tone,
		length,
		// 기온은 재조회마다 1~2도씩 바뀌어 캐시를 깨므로 제외 (도시·날씨 상태만)
		[context?.weather?.city, context?.weather?.condition],
		titles(context?.calEvents as { title?: string; start?: string }[]),
		titles(context?.tomorrowEvents as { title?: string; start?: string }[]),
		titles(context?.newsResults),
		titles(context?.trendsResults),
		(context?.smartSummaries ?? []).map((s) => `${s.keyword}:${s.latestArticle?.title ?? ""}`),
		[context?.yesterdayDiary ?? "", context?.yesterdayMemo ?? ""].map((s) => `${s.length}:${s.slice(0, 40)}`),
	]);
};

/** fp 안의 일기·일정 제목 등 평문이 키로 남지 않도록 SHA-256 hex로 */
const hashFp = async (text: string): Promise<string> => {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
};

const readBriefingCache = async (fp: string): Promise<BriefingResult | null> => {
	let entry = briefingMemCache;
	if (!entry) {
		const stored = load<(Omit<BriefingCacheEntry, "result"> & { result: unknown }) | null>(BRIEFING_CACHE_KEY, null);
		if (stored) {
			// 암호화가 켜진 뒤 남은 평문 캐시는 버리고, 열 수 없는 암호문은 없는 것으로 취급
			if (isEncryptionOn() && !isEncryptedBlob(stored.result)) {
				save(BRIEFING_CACHE_KEY, null);
			} else {
				try {
					const result = await openJson<BriefingResult>(stored.result);
					if (result) entry = { ...stored, result };
				} catch {
					// 키가 달라 열 수 없음
				}
			}
		}
	}
	const ttl = entry?.aiOk === false ? BRIEFING_FAILED_TTL_MS : BRIEFING_CACHE_TTL_MS;
	if (!entry || entry.fp !== fp || Date.now() - entry.at > ttl) return null;
	briefingMemCache = entry;
	return entry.result;
};

/** 메모리엔 항상, localStorage엔 게스트가 아니고 (암호화 꺼짐 또는 해제 상태)일 때만 — 잠김이면 디스크 기록 없음 */
const persistBriefingCache = async (entry: BriefingCacheEntry): Promise<void> => {
	if (isGuest()) return;
	try {
		const result = await sealJson(entry.result);
		if (!result) {
			save(BRIEFING_CACHE_KEY, null); // 잠김: 남아 있던 평문 제거
			return;
		}
		save(BRIEFING_CACHE_KEY, { fp: entry.fp, at: entry.at, aiOk: entry.aiOk, result });
	} catch {
		save(BRIEFING_CACHE_KEY, null);
	}
};

/** force=true: 새로고침 버튼 — 캐시 무시하고 새로 생성 */
export async function generateDetailedBriefing(
	{ tone, length, context }: { tone: string; length: string; context: BriefingContext },
	{ force = false }: { force?: boolean } = {},
): Promise<BriefingResult> {
	const fp = await hashFp(briefingFingerprint(tone, length, context, getLangConfig().lang));
	if (!force) {
		const cached = await readBriefingCache(fp);
		if (cached) return cached;
		const pending = briefingInFlight.get(fp);
		if (pending) return pending;
	}
	const run = buildDetailedBriefing({ tone, length, context })
		.then(async ({ result, aiOk }) => {
			briefingMemCache = { fp, at: Date.now(), result, aiOk };
			// 게스트 건너뜀·잠김 시 디스크 기록 없음은 persistBriefingCache가 처리
			await persistBriefingCache(briefingMemCache);
			return result;
		})
		.finally(() => {
			// 강제 재생성이 같은 fp로 새 run을 등록했을 수 있음 — 내 것일 때만 삭제
			if (briefingInFlight.get(fp) === run) briefingInFlight.delete(fp);
		});
	briefingInFlight.set(fp, run);
	return run;
}

async function buildDetailedBriefing({ tone, length, context }: { tone: string; length: string; context: BriefingContext }): Promise<{ result: BriefingResult; aiOk: boolean }> {
	const { lang, langInstruction } = getLangConfig();
	const isKo = lang === "ko";
	const locale = isKo ? "ko-KR" : "en-US";
	const now = new Date();
	const timeMode = getBriefingTimeMode(now);

	const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(now);

	const sections = [];

	// ── 1) 날짜 + 날씨 (한 줄, 결합) ────────────
	{
		const weather = context?.weather;
		const dateLabelText = `${bs("date_label", lang)}: ${dateLabel}`;
		let weatherLabelText;
		if (weather) {
			const city = weather.city || bs("current_location", lang);
			const temp = weather.temp != null ? `${weather.temp}°C` : "?°C";
			const condition = weather.condition || "";
			const emoji = getWeatherEmoji(condition);
			const precipitation =
				weather.precipitation != null
					? `, ${bs("weather_precipitation", lang)} ${weather.precipitation}%`
					: "";
			weatherLabelText = `${bs("weather_label", lang)}: ${emoji} ${city} ${temp}${condition ? `, ${condition}` : ""}${precipitation}`;
		} else {
			weatherLabelText = `${bs("weather_label", lang)}: ${bs("no_data", lang)}`;
		}
		sections.push({
			id: "header",
			title: bs("today_header", lang),
			lines: [`${dateLabelText} | ${weatherLabelText}`],
		});
	}

	// ── 3) 일정 ────────────────────────────────
	{
		const calEvents = Array.isArray(context?.calEvents) ? context.calEvents : [];
		const tomorrowEvents = Array.isArray(context?.tomorrowEvents)
			? context.tomorrowEvents
			: [];

		const sortedToday = calEvents
			.slice()
			.sort((a, b) => (eventStartTime(a) ?? 0) - (eventStartTime(b) ?? 0));

		if (timeMode === "morning") {
			const title = bs("today_schedule", lang);
			const lines =
				sortedToday.length > 0
					? sortedToday.slice(0, 6).map((e) => formatEventLine(e, lang))
					: [bs("no_events", lang)];
			sections.push({ id: "schedule", title, lines });
		} else {
			const nowMs = now.getTime();
			const remaining = sortedToday.filter((e) => {
				const t = eventStartTime(e);
				return t == null ? false : t >= nowMs;
			});
			const sortedTomorrow = tomorrowEvents
				.slice()
				.sort((a, b) => (eventStartTime(a) ?? 0) - (eventStartTime(b) ?? 0));

			sections.push({
				id: "schedule_today_remaining",
				title: bs("remaining_today", lang),
				lines:
					remaining.length > 0
						? remaining.slice(0, 5).map((e) => formatEventLine(e, lang))
						: [bs("no_remaining_events", lang)],
			});

			sections.push({
				id: "schedule_tomorrow",
				title: bs("tomorrow", lang),
				lines:
					sortedTomorrow.length > 0
						? sortedTomorrow.slice(0, 5).map((e) => formatEventLine(e, lang))
						: [bs("no_events", lang)],
			});
		}
	}

	// ── 4·5) Groq 병렬 호출 — 어제 일기 / 스마트 위젯 요약 / 기사 요약 ──
	const newsArticles = (Array.isArray(context?.newsResults) ? context.newsResults : []).slice(0, 3);
	const trendsArticles = (Array.isArray(context?.trendsResults) ? context.trendsResults : []).slice(0, 3);
	const allArticles = [...newsArticles, ...trendsArticles];

	const [diaryRewrite, articleSummaries] = await Promise.all([
		rewriteYesterdayDiary({
			diaryText: context?.yesterdayDiary,
			memoText: context?.yesterdayMemo,
			tone,
			lang,
			langInstruction,
		}),
		summarizeArticlesBatch({ articles: allArticles, lang, langInstruction }),
	]);
	// 두 Groq 호출 중 하나라도 실패(빈 결과)면 캐시 금지 — 실패 시 둘 다 빈 값을 반환함
	const hasYesterdaySource = Boolean((context?.yesterdayDiary || context?.yesterdayMemo || "").trim());
	const aiOk =
		(allArticles.length === 0 || articleSummaries.length > 0) &&
		(!hasYesterdaySource || diaryRewrite !== "");

	// index 0..newsArticles.length-1 → news summaries; rest → trends summaries
	const newsSummaryMap: Record<number, string> = {};
	const trendsSummaryMap: Record<number, string> = {};
	if (Array.isArray(articleSummaries)) {
		articleSummaries.forEach((item) => {
			const idx = item?.index;
			const sum = item?.summary;
			if (typeof idx !== "number" || !sum) return;
			if (idx < newsArticles.length) newsSummaryMap[idx] = sum;
			else trendsSummaryMap[idx - newsArticles.length] = sum;
		});
	}

	// ── 4) 어제 ────────────────────────────────
	{
		const hasYesterdayData =
			Boolean(context?.yesterdayDiary) || Boolean(context?.yesterdayMemo);
		const fallback = bs("no_diary", lang);
		const line =
			diaryRewrite ||
			(hasYesterdayData ? toSentenceSummary(context?.yesterdayDiary || context?.yesterdayMemo, 2) : fallback);
		sections.push({
			id: "yesterday",
			title: bs("yesterday", lang),
			lines: [line],
		});
	}

	// ── 5) 오늘 최신 정보 — 스마트 키워드 + 주요 뉴스 Top 3 + 트렌드 Top 3 ─
	{
		// Build latest_smart lines: one hyperlinked article per smart keyword
		const smartLines = (context?.smartSummaries ?? [])
			.filter((s) => s.latestArticle?.url && s.latestArticle?.title)
			.map((s) => ({
				keyword: s.keyword,
				title: s.latestArticle!.title,
				url: s.latestArticle!.url,
				source: s.latestArticle!.source ?? "",
			}));
		const smartFallback = bs("no_keywords", lang);

		// News: structured objects { title, url, summary, source }
		const newsLines =
			newsArticles.length > 0
				? newsArticles.map((n, i) => ({
					title: truncateText(n?.title, 140) || "",
					url: n?.url || "",
					summary: truncateText(newsSummaryMap[i] || "", 200),
					source: truncateText(n?.source || hostFromUrl(n?.url), 40),
				  })).filter((o) => o.title && o.url)
				: [bs("no_news", lang)];

		// Trends: same structured shape
		const trendsLines =
			trendsArticles.length > 0
				? trendsArticles.map((t, i) => ({
					title: truncateText(t?.title, 140) || "",
					url: t?.url || "",
					summary: truncateText(trendsSummaryMap[i] || "", 200),
					source: truncateText(t?.source || hostFromUrl(t?.url), 40),
				  })).filter((o) => o.title && o.url)
				: [bs("no_trends", lang)];

		// detail 평문용: 객체를 "제목 — 출처: 요약" 형태로 직렬화
		const toPlainLine = (item: string | { title: string; url: string; summary?: string; source?: string }) =>
			typeof item === "string"
				? item
				: `${item.title}${item.source ? ` — ${item.source}` : ""}${item.summary ? `: ${item.summary}` : ""}`;

		// 스마트 위젯 개별 subBlock (키워드별 분리)
		const smartSubBlocks = smartLines.length > 0
			? smartLines.map((sl) => ({
				id: `latest_smart_${sl.keyword}`,
				title: sl.keyword,
				lines: [sl],
			  }))
			: [{ id: "latest_smart", title: bs("smart_keywords", lang), lines: [smartFallback] }];

		sections.push({
			id: "latest_info",
			title: bs("latest_info", lang),
			lines: [
				...(smartLines.length > 0 ? smartLines.map(toPlainLine) : [smartFallback]),
				...newsLines.map(toPlainLine),
				...trendsLines.map(toPlainLine),
			],
			subBlocks: [
				...smartSubBlocks,
				{
					id: "latest_news",
					title: bs("top_3_news", lang),
					lines: newsLines,
				},
				{
					id: "latest_trends",
					title: bs("top_3_trends", lang),
					lines: trendsLines,
				},
			],
		});
	}

	// ── 출력 빌드 ─────────────────────────────
	void length; // reserved for future per-length tweaks
	const summary = (() => {
		const timeLabel = isKo
			? timeMode === "morning"
				? "오전"
				: timeMode === "afternoon"
					? "오후"
					: "저녁"
			: timeMode.charAt(0).toUpperCase() + timeMode.slice(1);
		return isKo
			? `${dateLabel} ${timeLabel} 브리핑입니다.`
			: `${timeLabel} briefing for ${dateLabel}.`;
	})();

	const detail = sections
		.map((s) => {
			if (Array.isArray(s.subBlocks) && s.subBlocks.length > 0) {
				const inner = s.subBlocks
					.map((sb) => `${sb.title}\n${(sb.lines ?? []).join("\n")}`)
					.join("\n");
				return `${s.title}\n${inner}`;
			}
			return `${s.title}\n${(s.lines ?? []).join("\n")}`;
		})
		.join("\n\n");

	return { result: { summary, detail, sections, timeMode }, aiOk };
}
