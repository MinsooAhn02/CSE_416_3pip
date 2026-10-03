import i18n, { getCurrentLanguage } from "../l10n/i18n";

const bs = (key: string, lng: string) => i18n.t(`briefing_sections.${key}`, { lng }) as string;
import { handleApiError } from "../utils/errorHandler";
import { supabase } from "../lib/supabase";
import type {
	WeatherData,
	StockItem,
	CalEvent,
	HealthData,
	TodoItem,
	PersonaContext,
	Interest,
	SmartWidgetData,
	SmartWidgetSummary,
	BriefingResult,
	BriefingSection,
	SmartSection,
	SmartSubBlock,
	SmartSectionLineOrString,
} from "../types/index";

// ── Local interface definitions ──────────────────────────────
interface ArticleItem {
	title?: string;
	url?: string;
	content?: string;
	source?: string;
	published_date?: string | null;
	image?: string | null;
}

type SmartResult = ArticleItem & { score?: number };

interface BriefingContext {
	weather?: WeatherData | null;
	stocks?: StockItem[];
	trends?: string[];
	trendsResults?: ArticleItem[];
	newsResults?: ArticleItem[];
	newsAnswer?: string | null;
	calEvents?: CalEvent[];
	tomorrowEvents?: CalEvent[];
	healthData?: HealthData | null;
	todos?: TodoItem[];
	activeWidgetIds?: string[];
	persona?: string | PersonaContext | null;
	yesterdayDiary?: string | null;
	yesterdayMemo?: string | null;
	smartSummaries?: SmartWidgetSummary[];
	keywordInterests?: Interest[];
}

interface SmartWidgetOpts {
	persona?: PersonaContext | null;
	token?: string | null;
	categoryOverride?: string | null;
}

interface LangConfig {
	lang: string;
	langInstruction: string;
	noneLabel: string;
}

interface TimeProfile {
	mode: string;
	label: string;
	desc: string;
	weight: number;
}

interface SignalComponent {
	R: number;
	Kmatch: number;
	wPersona: number;
	U: number;
	wTime: number;
	Se: number;
}

interface Signal {
	id: string;
	title: string;
	payload: unknown;
	score: number;
	components: SignalComponent;
}

interface SmartSectionPlan {
	id?: string;
	title?: string;
	type?: string;
	category?: string;
	searchMode?: string;
	query?: string;
	keyword?: string;
	maxItems?: number;
	allowMixed?: boolean;
	linkOnly?: boolean;
	[key: string]: unknown;
}

// ── Re-export used types so callers don't need separate imports ──
export type { BriefingContext, SmartWidgetOpts, ArticleItem };

const getLangConfig = (): LangConfig => {
	const raw = String(getCurrentLanguage() || "en").toLowerCase();
	const lang = raw.startsWith("ko") ? "ko" : "en";
	return {
		lang,
		langInstruction: lang === "ko"
			? "Respond formally and politely in Korean (한국어)."
			: "Respond formally and politely in English.",
		noneLabel: lang === "ko" ? "없음" : "None",
	};
};

const normalizeQuestionLanguage = (language = ""): "ko" | "en" =>
	String(language || getCurrentLanguage() || "en")
		.toLowerCase()
		.startsWith("ko")
		? "ko"
		: "en";

// fallback 질문 — Groq 실패 시 사용
const FALLBACK_QUESTIONS = {
	ko: [
		"좋아하는 음식 종류가 있나요? (한식, 일식, 양식, 중식 등)",
		"요즘 가장 관심 있는 게 있나요?",
		"지금 가장 먹고 싶은 게 있나요?",
		"자주 가는 카페나 식당이 있나요?",
		"요즘 즐겨 보는 콘텐츠가 있나요?",
		"취미로 하고 있는 게 있나요?",
		"최근에 가 본 곳 중에 좋았던 데가 있나요?",
		"요즘 가장 자주 먹는 음식이 뭔가요?",
		"좋아하는 음악 장르나 아티스트가 있나요?",
		"운동이나 스포츠를 즐기시나요?",
		"주말에 주로 어떻게 보내세요?",
		"요즘 새로 시작해 보고 싶은 게 있나요?",
	],
	en: [
		"What kind of food do you enjoy most these days?",
		"What have you been most interested in lately?",
		"What are you craving right now?",
		"Do you have a cafe or restaurant you visit often?",
		"Is there any content you've been enjoying lately?",
		"What hobby have you been spending time on recently?",
		"Was there anywhere you visited recently that you really liked?",
		"What food do you end up eating most often these days?",
		"Do you have a favorite music genre or artist?",
		"Do you enjoy any exercise or sports?",
		"What do you usually like to do on weekends?",
		"Is there something new you'd like to start soon?",
	],
};

// 탐색 주제 풀 — 매 호출마다 랜덤 1~2개 선택
const TOPIC_POOL = {
	ko: [
		"좋아하는 음식 종류 (한식/일식/양식/중식 등)",
		"요즘 관심 있는 것 또는 취미",
		"즐겨 보는 콘텐츠 (드라마/영화/유튜브 등)",
		"주말에 주로 하는 것, 운동, 스포츠",
		"자주 가는 장소 유형 (카페, 공원, 쇼핑몰 등)",
		"최근에 먹어본 것 중 맛있었던 것",
		"좋아하는 음악 장르 또는 아티스트",
		"요즘 새로 시작해보고 싶은 것",
		"즐겨 먹는 간식 또는 야식",
		"좋아하는 계절과 그 이유",
	],
	en: [
		"favorite kinds of food",
		"recent interests or hobbies",
		"content you enjoy watching",
		"weekend routines, exercise, or sports",
		"places you like to visit often",
		"something delicious you tried recently",
		"favorite music genres or artists",
		"something new you'd like to start",
		"favorite snacks or late-night food",
		"a season you like and why",
	],
};

const INTEREST_TOPIC_MAP = {
	ko: {
		news: "최근에 관심 있게 본 뉴스나 시사 이슈",
		tech: "관심 있는 기술이나 IT 제품, 앱",
		fashion: "요즘 눈여겨보는 패션 아이템이나 스타일",
		finance: "관심 있는 재테크나 경제 이슈",
		health: "요즘 신경 쓰는 건강 습관이나 운동",
		food: "먹고 싶거나 가 보고 싶은 음식이나 음식점",
		entertainment: "요즘 즐겨 보는 드라마, 영화, 유튜브 등",
		sports: "즐기거나 관심 있는 운동이나 스포츠 경기",
	},
	en: {
		news: "recent news or current events you followed",
		tech: "technology, gadgets, or apps you're curious about",
		fashion: "fashion trends or items you've been eyeing",
		finance: "money topics or investment ideas on your mind",
		health: "health habits or wellness routines lately",
		food: "food or restaurants you've been wanting to try",
		entertainment: "movies, shows, or videos you've enjoyed recently",
		sports: "sports or exercise you've been playing or following",
	},
};

function pickTopics(previousQuestions: string[], count = 2, language = "ko", fixedInterestIds: string[] = []): string[] {
	const resolvedLang = normalizeQuestionLanguage(language);
	const pool = TOPIC_POOL[resolvedLang] || TOPIC_POOL.ko;
	const interestMap = INTEREST_TOPIC_MAP[resolvedLang] || INTEREST_TOPIC_MAP.ko;

	const interestTopics = (fixedInterestIds ?? [])
		.map((id) => (interestMap as Record<string, string>)[id])
		.filter(Boolean);

	if (interestTopics.length === 0) {
		return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
	}

	const pickedInterest = interestTopics[Math.floor(Math.random() * interestTopics.length)];
	const genericPool = [...pool].filter((t) => t !== pickedInterest);
	const pickedGeneric = genericPool.sort(() => Math.random() - 0.5).slice(0, count - 1);
	return [pickedInterest, ...pickedGeneric].slice(0, count);
}

const DAY_NAMES = {
	ko: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
	en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const QUESTION_COPY = {
	ko: {
		weekend: "주말",
		weekday: "평일",
		contextLabel: "시간",
		weatherLabel: "날씨",
		personaLabel: "사용자 정보",
		topicsLabel: "주제",
		excludedLabel: "제외 대상 (이미 물어본 질문)",
		systemLines: [
			"당신은 상대방에게 과하지 않은 관심을 표현하며 대화를 시작하는 '다정한 대화 파트너'입니다.",
			"당신의 목적은 주어진 상황(날씨, 요일 등)에 어울리는 주제를 골라, 상대방이 편안하게 자신의 이야기를 꺼낼 수 있도록 돕는 질문을 만드는 것입니다.",
			"",
			"[핵심 원칙]",
			"1. 자연스러움: 기계적인 질문이 아니라, 친구에게 말을 건네는 듯한 분위기를 유지하세요.",
			"2. 부드러운 시작: 질문 바로 앞에 '날씨가 화창해서 그런지~', '벌써 목요일이라 그런지~' 처럼 상황을 활용한 부드러운 도입부를 한 문장 덧붙이세요.",
			"3. 간결성: 전체 문장은 두 문장 이내로 작성하세요.",
			"4. 출력 형식: 오직 질문 텍스트만 출력하세요. (번호, 따옴표, 설명 금지)",
			"5. 문자 제한: 한글, 숫자, 공백, 기본 문장부호만 사용하세요.",
			"6. 언어 제한: 중국어, 일본어, 러시아어 등 다른 문자나 단어를 섞지 마세요.",
			"[질문 스타일 예시]",
			"- 날씨가 정말 좋은데, 이런 날씨에 산책하면서 듣기 좋은 본인만의 플레이리스트가 있나요?",
			"- 벌써 목요일이네요, 이번 주말에 특별히 계획하고 계신 즐거운 일이 있으신가요?",
			"- 요즘 유튜브에서 우연히 본 영상 중에 기억에 남는 재미있는 주제가 있었나요?",
			"",
			"반드시 한국어 존댓말을 사용하고 물음표(?)로 끝내세요.",
		],
		strictLine:
			"한글이 아닌 문자가 섞이면 실패입니다. 반드시 자연스러운 한국어 질문 한 개만 출력하세요.",
		finalInstruction:
			"위 정보를 바탕으로 자연스러운 질문을 생성해주세요. 반드시 존댓말을 사용하고 물음표로 끝내주세요.",
	},
	en: {
		weekend: "Weekend",
		weekday: "Weekday",
		contextLabel: "Time",
		weatherLabel: "Weather",
		personaLabel: "User profile",
		topicsLabel: "Topics",
		excludedLabel: "Avoid (already asked)",
		systemLines: [
			'You are a warm conversation partner who starts gentle, low-pressure small talk.',
			"Your goal is to choose a topic that fits the situation, like the weather or day of week, and ask one natural question that helps the user share something comfortably.",
			"",
			"[Core rules]",
			"1. Keep it natural and human, not robotic.",
			"2. Add a soft lead-in sentence that lightly uses the situation before the question.",
			"3. Keep the full output within two sentences.",
			"4. Output only the question text. No numbering, quotes, or explanations.",
			"5. Use English only, with standard punctuation.",
			"6. Do not mix in Korean, Chinese, Japanese, Russian, or any other language.",
			"[Style examples]",
			"- The weather feels especially nice today, is there a playlist you love listening to on a walk like this?",
			"- It's already Thursday, do you have anything fun planned for the weekend?",
			"- Have you come across any video or topic lately that stayed in your mind longer than expected?",
			"",
			"End with a question mark.",
		],
		strictLine:
			"If any non-English wording appears, treat it as a failure. Output one natural English question only.",
		finalInstruction:
			"Using the details above, write one natural English question that ends with a question mark.",
	},
};

const DISALLOWED_QUESTION_SCRIPT_RE =
	/[\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\u0E00-\u0EFF\u0600-\u06FF\u0590-\u05FF\u0900-\u09FF\u0A00-\u0AFF\u0B00-\u0BFF\u0C00-\u0CFF\u0D00-\u0D7F\u0F00-\u0FFF\u1000-\u109F\u1780-\u17FF]/;
const HANGUL_RE = /[가-힣]/;
const ENGLISH_LETTER_RE = /[A-Za-z]/g;

const normalizeQuestionCandidate = (value: unknown): string =>
	String(value || "")
		.replace(/\r?\n+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^["'`\s\d.-]+/, "")
		.replace(/["'`]+$/g, "")
		.replace(/\s+([?!.,])/g, "$1")
		.trim();

const isValidDiaryQuestion = (value: unknown, language = "ko"): boolean => {
	const resolvedLanguage = normalizeQuestionLanguage(language);
	const text = normalizeQuestionCandidate(value);
	if (!text || text.length < 6 || text.length > 110) return false;
	if (!text.endsWith("?")) return false;
	if (DISALLOWED_QUESTION_SCRIPT_RE.test(text)) return false;

	if (resolvedLanguage === "en") {
		if (HANGUL_RE.test(text)) return false;
		const englishLetters = text.match(ENGLISH_LETTER_RE) || [];
		return englishLetters.length >= 8;
	}

	const letterMatches = text.match(/[A-Za-z가-힣]/g) || [];
	const hangulMatches = text.match(/[가-힣]/g) || [];
	if (hangulMatches.length < 4) return false;
	if (
		letterMatches.length > 0 &&
		hangulMatches.length / letterMatches.length < 0.6
	) {
		return false;
	}
	return true;
};

const pickFallbackQuestion = (previousQuestions: string[] = [], language = "ko"): string => {
	const resolvedLanguage = normalizeQuestionLanguage(language);
	const fallbackQuestions =
		FALLBACK_QUESTIONS[resolvedLanguage] || FALLBACK_QUESTIONS.ko;
	const unused = fallbackQuestions.filter((q) => !previousQuestions.includes(q));
	const pool = unused.length > 0 ? unused : fallbackQuestions;
	return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Groq로 현재 상황에 맞는 개인화 질문 1개 생성
 */
export async function generatePersonalizedQuestion({
	persona = "",
	city = "",
	weatherCondition = "",
	previousQuestions = [],
	language,
	fixedInterestIds = [],
}: {
	persona?: string;
	city?: string;
	weatherCondition?: string;
	previousQuestions?: string[];
	language?: string;
	fixedInterestIds?: string[];
} = {}): Promise<string> {
	const resolvedLanguage = normalizeQuestionLanguage(language);
	const copy = QUESTION_COPY[resolvedLanguage];
	const dayOfWeek = DAY_NAMES[resolvedLanguage][new Date().getDay()];
	const isWeekend = resolvedLanguage === "ko"
		? ["토요일", "일요일"].includes(dayOfWeek)
		: ["Saturday", "Sunday"].includes(dayOfWeek);

	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		return pickFallbackQuestion(previousQuestions, resolvedLanguage);
	}

	const topics = pickTopics(previousQuestions, 2, resolvedLanguage, fixedInterestIds);
	const contextParts = [
		`${isWeekend ? copy.weekend : copy.weekday} / ${dayOfWeek}`,
		city && weatherCondition
			? `${city} (${copy.weatherLabel}: ${weatherCondition})`
			: city || weatherCondition || "",
	].filter(Boolean).join(", ");

	const buildQuestionPrompt = (strict = false) => ({
		system: [...copy.systemLines, strict ? copy.strictLine : ""]
			.filter(Boolean)
			.join("\n"),
		prompt: [
			"[상황 정보]",
			`- ${copy.contextLabel}: ${contextParts}`,
			persona ? `- ${copy.personaLabel}: ${persona}` : "",
			"",
			`[탐색 대상]`,
			`- ${copy.topicsLabel}: ${topics.join(resolvedLanguage === "ko" ? " 또는 " : " or ")}`,
			previousQuestions.length > 0
				? `- ${copy.excludedLabel}:\n${previousQuestions.map((q) => `  · ${q}`).join("\n")}`
				: "",
			"",
			copy.finalInstruction,
		]
			.filter(Boolean)
			.join("\n"),
	});

	const attempts = [
		{ strict: false, temperature: 0.6 },
		{ strict: true, temperature: 0.2 },
	];

	for (const attempt of attempts) {
		try {
			const prompt = buildQuestionPrompt(attempt.strict);
			const data = await invokeFunction("groq", {
				...prompt,
				temperature: attempt.temperature,
			});
			const question = normalizeQuestionCandidate(data?.text);
			if (isValidDiaryQuestion(question, resolvedLanguage)) {
				return question;
			}
		} catch {
			// fall through to next attempt or fallback
		}
	}

	return pickFallbackQuestion(previousQuestions, resolvedLanguage);
}

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const AI_TIMEOUT_MS = 20000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const invokeFunction = async (name: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
	const startedAt = Date.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
	// Edge Function이 로그인 사용자만 허용 → 세션 토큰 전송 (없으면 anon → 401)
	const session = supabase ? (await supabase.auth.getSession()).data.session : null;
	try {
		const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			handleApiError(
				{ message: `HTTP ${res.status}: ${text}` },
				`ai:${name}`,
				{ httpStatus: res.status },
			);
			return null;
		}
		const data = await res.json();
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
		}
		return data;
	} catch (e) {
		clearTimeout(timer);
		handleApiError(e, `ai:${name}`);
		return null;
	}
};

const getTimeProfile = (date = new Date()): TimeProfile => {
	const hour = date.getHours();
	if (hour < 12) {
		return {
			mode: "morning",
			label: "Morning",
			desc: "Date, weather, latest news, trends, pre-lunch tasks, and yesterday diary summary",
			weight: 1.15,
		};
	}
	return {
		mode: "afternoon",
		label: "Afternoon",
		desc: "Updated weather, updated news, trends, and remaining tasks for the rest of today",
		weight: 1.05,
	};
};

const toNum = (v: unknown, d = 0): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : d;
};

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const scoreSignals = ({ context, timeProfile }: { context: BriefingContext; timeProfile: TimeProfile }): Signal[] => {
	const {
		weather,
		stocks,
		trends,
		calEvents,
		healthData,
		todos,
		activeWidgetIds,
		persona,
	} = context;

	const personaObj = typeof persona === "object" && persona !== null ? persona as PersonaContext : null;
	const personaText = [
		personaObj?.persona,
		personaObj?.job,
		personaObj?.memo,
		...(Array.isArray(personaObj?.interests) ? personaObj.interests : []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	const activeSet = new Set(activeWidgetIds || []);

	const signals: Signal[] = [];

	const pushSignal = ({ id, title, payload, R, Kmatch, wPersona, U, Se }: {
		id: string; title: string; payload: unknown;
		R: number; Kmatch: number; wPersona: number; U: number; Se: number;
	}): void => {
		const wTime = timeProfile.weight;
		const score = R * Kmatch * wPersona + U * wTime + Se;
		signals.push({
			id,
			title,
			payload,
			score: Number(score.toFixed(3)),
			components: { R, Kmatch, wPersona, U, wTime, Se },
		});
	};

	if (activeSet.has("calendar") && Array.isArray(calEvents)) {
		const todayCount = calEvents.length;
		const urgent = calEvents.filter((e) => {
			const start = e?.start ? new Date(e.start).getTime() : NaN;
			if (!Number.isFinite(start)) return false;
			const diffHours = (start - Date.now()) / 3600000;
			return diffHours >= 0 && diffHours <= 4;
		}).length;
		const R = clamp(todayCount / 5, 0.1, 1.2);
		const Kmatch = ["일정", "캘린더", "업무", "meeting", "회의"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = personaObj?.job ? 1.1 : 1;
		const U = clamp(urgent / 2, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.35 : 0.15;
		pushSignal({
			id: "calendar",
			title: "오늘 일정",
			payload: calEvents.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("todo") && Array.isArray(todos)) {
		const pending = todos.filter((t) => !t.completed);
		const R = clamp(pending.length / 5, 0.1, 1.2);
		const Kmatch = ["생산성", "업무", "공부"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = 1.05;
		const U = clamp(pending.length / 4, 0, 1.2);
		const Se = timeProfile.mode === "afternoon" ? 0.35 : 0.2;
		pushSignal({
			id: "todo",
			title: "미완료 할 일",
			payload: pending.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("weather") && weather) {
		const temp = toNum(weather.temp, 20);
		const R = clamp(Math.abs(temp - 22) / 12, 0.15, 1.2);
		const Kmatch = ["운동", "외출", "출근"].some((k) => personaText.includes(k))
			? 1.1
			: 1;
		const wPersona = 1;
		const U = clamp(toNum(weather.precipitation, 0) / 60, 0, 1.2);
		const Se = timeProfile.mode === "afternoon" ? 0.3 : 0.12;
		pushSignal({
			id: "weather",
			title: "날씨 변화",
			payload: weather,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("stocks") && Array.isArray(stocks)) {
		const volatility = stocks.reduce((acc, s) => {
			const c = String(s.change ?? "0").replace(/[+,%]/g, "");
			return acc + Math.abs(toNum(c, 0));
		}, 0);
		const R = clamp(volatility / 8, 0.1, 1.2);
		const Kmatch = ["금융", "투자", "경제"].some((k) => personaText.includes(k))
			? 1.2
			: 1;
		const wPersona = ["student", "학생"].some((k) => personaText.includes(k))
			? 0.95
			: 1.1;
		const U = clamp(volatility / 10, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.28 : 0.15;
		pushSignal({
			id: "stocks",
			title: "시장 변동",
			payload: stocks.slice(0, 4),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("trends") && Array.isArray(trends)) {
		const interests: string[] = Array.isArray(personaObj?.interests)
			? (personaObj.interests as string[])
			: [];
		const overlap = trends.filter((t) =>
			interests.some((i: string) =>
				String(t).toLowerCase().includes(String(i).toLowerCase()),
			),
		).length;
		const R = clamp(trends.length / 7, 0.1, 1.2);
		const Kmatch = overlap > 0 ? 1.2 : 1;
		const wPersona = 1.05;
		const U = clamp(overlap / 3, 0, 1.1);
		const Se = timeProfile.mode === "morning" ? 0.25 : 0.1;
		pushSignal({
			id: "trends",
			title: "실시간 트렌드",
			payload: trends.slice(0, 7),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("health") && healthData) {
		const steps = toNum(healthData.steps, 0);
		const R = clamp((10000 - steps) / 10000, 0.1, 1.1);
		const Kmatch = ["건강", "운동", "다이어트"].some((k) =>
			personaText.includes(k),
		)
			? 1.2
			: 1;
		const wPersona = 1.1;
		const U = clamp((7000 - steps) / 7000, 0, 1.2);
		const Se = timeProfile.mode === "afternoon" ? 0.22 : 0.1;
		pushSignal({
			id: "health",
			title: "오늘 건강 지표",
			payload: healthData,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	return signals.sort((a, b) => b.score - a.score).slice(0, 3);
};

const localBriefingFallback = ({ topSignals, timeProfile, lang }: { topSignals: Signal[]; timeProfile: TimeProfile; lang?: string }): string => {
	const langCode = lang ?? getLangConfig().lang;
	const isKo = langCode === "ko";
	if (!topSignals.length) {
		return isKo
			? "오늘도 좋은 하루 보내세요.\n아직 큰 변화는 감지되지 않았습니다.\n새로고침 후 최신 브리핑을 확인해 주세요."
			: "Have a great day.\nNo major signals were detected yet.\nRefresh to get the latest briefing.";
	}

	const lines = topSignals.map(
		(s) => (isKo
			? `${s.title}: 핵심 변화를 우선 확인하세요.`
			: `${s.title}: Check this key change first.`),
	);
	while (lines.length < 3) {
		lines.push(
			isKo
				? "지금 시점에 맞는 우선 작업부터 하나씩 처리해보세요."
				: "Start with the highest-priority task for this time window.",
		);
	}
	const intro = isKo
		? `${timeProfile.label} 브리핑입니다. ${timeProfile.desc}`
		: `${timeProfile.label} briefing. ${timeProfile.desc}.`;
	return [
		intro,
		lines[0],
		lines[1],
	].join("\n");
};

/**
 * 캘린더 이벤트를 AI 프롬프트용 가독성 높은 문자열로 변환
 * @param {Array} calEvents - 캘린더 일정 배열
 * @returns {string} "HH:MM 제목, HH:MM 제목" 형식 문자열
 */
export function formatCalEventsForAI(calEvents: CalEvent[] = [], lang = "en"): string {
	const isKo = lang === "ko";
	if (!Array.isArray(calEvents) || calEvents.length === 0) {
		return isKo
			? "오늘 예정된 일정이 없습니다."
			: "No events are scheduled for today.";
	}
	return calEvents
		.slice()
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
		.map((e) => {
			const startDate = new Date(e.start);
			const time = startDate.toLocaleTimeString(
				isKo ? "ko-KR" : "en-US",
				{
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
				},
			);
			return `${time} ${e.title || e.summary || bs("event_untitled", lang)}`;
		})
		.join(", ");
}

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

const parseDetailLines = (raw: unknown): string[] => {
	if (!raw) return [];
	return String(raw)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("{") && !line.startsWith("}") && !line.startsWith('"'));
};

const buildStructuredFallbackDetail = ({
	lang,
	dateLabel,
	weatherSection,
	newsSection,
	trendsSection,
	todosSection,
	diarySection,
}: {
	lang: string;
	dateLabel: string;
	weatherSection?: string;
	newsSection?: string;
	trendsSection?: string;
	todosSection?: string;
	diarySection?: string;
}): string => {
	const isKo = lang === "ko";
	const parts = [
		isKo ? "로컬 브리핑으로 안내드립니다." : "Showing a local structured briefing.",
		`${isKo ? "날짜" : "Date"}: ${dateLabel}`,
		weatherSection || `${isKo ? "날씨" : "Weather"}: ${isKo ? "데이터 없음" : "No data"}`,
		newsSection || `${isKo ? "뉴스" : "News"}: ${isKo ? "데이터 없음" : "No data"}`,
		trendsSection || `${isKo ? "트렌드" : "Trends"}: ${isKo ? "데이터 없음" : "No data"}`,
		todosSection || `${isKo ? "할 일" : "Tasks"}: ${isKo ? "남은 항목 없음" : "No remaining tasks"}`,
		diarySection,
	];
	return parts.filter(Boolean).join("\n");
};

const normalizeBriefingJson = (rawText: unknown): { summary: string; detail: string } | null => {
	const cleaned = String(rawText)
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();
	const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
	const parsed = JSON.parse(jsonCandidate);
	const summary = truncateText(parsed?.summary, 1200);
	const detailLines = Array.isArray(parsed?.detailLines)
		? parsed.detailLines.map((line: unknown) => truncateText(line, 240)).filter(Boolean)
		: parseDetailLines(parsed?.detail);
	if (!summary || detailLines.length === 0) return null;
	return {
		summary,
		detail: detailLines.join("\n"),
	};
};

const languageText = (lang: string): Record<string, string> => (lang === "ko"
	? {
		noDiarySummary:
			"어제 일기 데이터가 없어 거시 이벤트 중심으로 자동 생성된 요약을 사용합니다.",
		noDiaryStored: "어제 일기 요약: 없음",
		noTasksMorning: "점심 전 우선 할 일: 없음",
		noTasksAfternoon: "오늘 남은 할 일: 없음",
		noData: "데이터 없음",
	}
	: {
		noDiarySummary:
			"Yesterday's diary was missing, so an auto-generated macro-events summary is used.",
		noDiaryStored: "Yesterday diary summary: None",
		noTasksMorning: "Pre-lunch priorities: None",
		noTasksAfternoon: "Remaining tasks for the rest of today: None",
		noData: "No data",
	});

const buildListSection = (title: string, items: string[] = [], max = 5): string => {
	const compactItems = items.map((item) => truncateText(item, 180)).filter(Boolean).slice(0, max);
	if (!title) return "";
	if (compactItems.length === 0) return `${title}:`;
	return `${title}:\n${compactItems.map((item) => `- ${item}`).join("\n")}`;
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
 * Groq 호출: 스마트 위젯 데이터를 1-2문장 자연어 요약
 */
const summarizeSmartWidgets = async ({ smartSummaries, tone, lang, langInstruction }: {
	smartSummaries?: SmartWidgetSummary[];
	tone: string;
	lang: string;
	langInstruction: string;
}): Promise<string> => {
	const filtered = (smartSummaries ?? []).filter(
		(s) => Array.isArray(s?.bullets) && s.bullets.length > 0,
	);
	if (filtered.length === 0) return "";

	const isKo = lang === "ko";
	const body = filtered
		.slice(0, 3)
		.map(
			(s) =>
				`[${truncateText(s.keyword, 40)}] ${s.bullets
					.map((b) => truncateText(b, 90))
					.slice(0, 3)
					.join(" / ")}`,
		)
		.join("\n");

	const prompt = [
		isKo
			? "다음은 사용자의 관심 키워드별 오늘 최신 정보입니다. 키워드와 핵심 내용을 묶어 1-2문장으로 자연스럽게 요약하세요. 새로운 사실을 만들어내지 말고 주어진 내용만 사용하세요."
			: "Below is today's latest info for the user's interest keywords. Summarize naturally in 1-2 sentences, grouping keyword and key content. Use only the given content; do not invent facts.",
		"",
		body,
	].join("\n");

	try {
		const data = await invokeFunction("groq", {
			prompt,
			system: [
				isKo
					? "오늘 키워드별 최신 정보를 사실 기반으로 1-2문장 요약."
					: "Summarize today's per-keyword latest info in 1-2 fact-based sentences.",
				`Tone: ${tone || "neutral"}.`,
				langInstruction,
			].join("\n"),
			temperature: 0.1,
		});
		return truncateText(data?.text, 320);
	} catch {
		return filtered
			.slice(0, 2)
			.map((s) => `${s.keyword}: ${s.bullets[0]}`)
			.join(" / ");
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
export async function generateDetailedBriefing({ tone, length, context }: { tone: string; length: string; context: BriefingContext }): Promise<BriefingResult> {
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

	return { summary, detail, sections, timeMode };
}

export async function generateBriefing({ tone, length, context }: { tone: string; length: string; context: BriefingContext }): Promise<string> {
	const { lang, langInstruction, noneLabel } = getLangConfig();
	const isKo = lang === "ko";
	const timeProfile = getTimeProfile();
	const topSignals = scoreSignals({ context: context ?? {}, timeProfile });
	const isMorning = timeProfile.mode === "morning";

	const weatherSection = (() => {
		const weather = context?.weather;
		if (!weather) return `${isKo ? "날씨" : "Weather"}: ${noneLabel}`;
		return `${isKo ? "날씨" : "Weather"}: ${weather.city ?? ""} ${weather.temp ?? "?"}°C, ${weather.condition ?? ""}`.trim();
	})();

	const newsSection = (() => {
		const newsItems = Array.isArray(context?.newsResults)
			? context.newsResults.map((r) => r?.title).filter(Boolean).slice(0, 4)
			: [];
		const answer = truncateText(context?.newsAnswer, 240);
		const merged = answer ? [answer, ...newsItems] : newsItems;
		if (merged.length === 0) return `${isKo ? "뉴스" : "News"}: ${noneLabel}`;
		return `${isKo ? "뉴스" : "News"}:\n${merged.map((item) => `- ${item}`).join("\n")}`;
	})();

	const trendsSection = (() => {
		const trendItems = Array.isArray(context?.trendsResults)
			? context.trendsResults.map((r) => r?.title).filter(Boolean).slice(0, 4)
			: [];
		const trendKeywords = Array.isArray(context?.trends)
			? context.trends
				.map((item) => (typeof item === "string" ? item : (item as { title?: string })?.title))
				.filter(Boolean)
				.slice(0, 4)
			: [];
		const merged = [...trendItems, ...trendKeywords].slice(0, 5);
		if (merged.length === 0) return `${isKo ? "트렌드" : "Trends"}: ${noneLabel}`;
		return `${isKo ? "트렌드" : "Trends"}:\n${merged.map((item) => `- ${item}`).join("\n")}`;
	})();

	const stocksSection = (() => {
		const stocks = context?.stocks ?? [];
		if (stocks.length === 0) return `${isKo ? "시장" : "Market"}: ${noneLabel}`;
		return `${isKo ? "시장" : "Market"}:\n${stocks
			.slice(0, 4)
			.map((st) => `- ${st.name}: ${st.value} (${st.change})`)
			.join("\n")}`;
	})();

	const todosSection = (() => {
		const pending = (context?.todos ?? [])
			.filter((t) => !t.completed)
			.map((t) => t?.text)
			.filter(Boolean)
			.slice(0, 5);
		if (pending.length === 0) {
			return isMorning
				? (isKo ? "점심 전 우선 할 일: 없음" : "Pre-lunch priorities: None")
				: (isKo ? "오늘 남은 할 일: 없음" : "Remaining tasks today: None");
		}
		const title = isMorning
			? (isKo ? "점심 전 우선 할 일" : "Pre-lunch priorities")
			: (isKo ? "오늘 남은 할 일" : "Remaining tasks today");
		return `${title}:\n${pending.map((task) => `- ${task}`).join("\n")}`;
	})();

	const briefingKeywordInterests = Array.isArray(context?.keywordInterests)
		? context.keywordInterests : [];
	const briefingTopKeywords = briefingKeywordInterests.slice(0, 10).map((k) => k.keyword);
	const briefingInterestsGuidance = briefingTopKeywords.length > 0
		? `User's recent interest keywords: ${briefingTopKeywords.join(", ")}. Naturally incorporate relevant information into the briefing.`
		: "";

	const prompt = [
		"You are a time-aware dashboard briefing AI.",
		`Tone: ${tone}`,
		`Length: ${length}`,
		`Mode: ${timeProfile.mode}`,
		`Mode guidance: ${timeProfile.desc}`,
		"Write exactly 3 lines. Each line must be one sentence.",
		"Do not use bullets, numbering, or headings.",
		briefingInterestsGuidance ? `Interest guidance: ${briefingInterestsGuidance}` : "",
		weatherSection,
		newsSection,
		trendsSection,
		stocksSection,
		todosSection,
		context?.yesterdayDiary
			? `Yesterday diary summary: ${toSentenceSummary(context.yesterdayDiary, 2)}`
			: "",
		context?.yesterdayMemo
			? `Yesterday memo summary: ${toSentenceSummary(context.yesterdayMemo, 1)}`
			: "",
		`Top signals: ${topSignals.map((s) => s.title).join(", ") || noneLabel}`,
	]
		.filter(Boolean)
		.join("\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: [
			"You are a personalized briefing writer.",
			"Morning mode (<12:00): include date/weather/news/trends/pre-lunch priorities/yesterday diary summary.",
			"Afternoon mode (>=12:00): include updated weather/news/trends and remaining tasks for today.",
			"Output exactly 3 concise lines.",
			langInstruction,
		].join("\n"),
	});

	if (!data?.text) {
		return localBriefingFallback({ topSignals, timeProfile, lang });
	}

	const lines = String(data.text)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 3);
	while (lines.length < 3) {
		lines.push(
			isKo
				? "지금 우선순위가 높은 항목부터 짧게 정리해 처리해보세요."
				: "Start with the highest-priority item for this time window.",
		);
	}

	return lines.join("\n");
}

/**
 * 스마트 위젯 데이터 생성
 * 1단계: Groq/룰 기반으로 키워드 카테고리 분류
 * 2단계: 카테고리별 섹션 계획 생성
 * 3단계: Tavily로 섹션별 검색 후 Groq로 섹션 요약 생성
 */
const _HANGUL = /[가-힣]/;
const _LATIN  = /[a-zA-Z]/;

const KO_NEWS_DOMAINS = [
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

const KO_VIDEO_DOMAINS = uniqueSmartDomains([
	"youtube.com",
	"youtu.be",
]);

const EN_VIDEO_DOMAINS = uniqueSmartDomains([
	"youtube.com",
	"youtu.be",
]);

const KO_BLOG_DOMAINS = uniqueSmartDomains([
	"blog.naver.com",
	"m.blog.naver.com",
	"post.naver.com",
	"kin.naver.com",
	"brunch.co.kr",
	"tistory.com",
	"velog.io",
]);

const EN_BLOG_DOMAINS = uniqueSmartDomains([
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
const COMMUNITY_SMART_SECTION_TYPES = new Set([
	...VIDEO_SMART_SECTION_TYPES,
	...BLOG_SMART_SECTION_TYPES,
	"community",
]);

const TRUSTED_SMART_SECTION_TYPES = new Set([
	...KEY_INFO_SMART_SECTION_TYPES,
	...ARTICLE_SMART_SECTION_TYPES,
]);

const isTrustedSmartSection = (section: SmartSectionPlan): boolean =>
	TRUSTED_SMART_SECTION_TYPES.has(section?.type ?? "");

const isKeyInfoSmartSection = (section: SmartSectionPlan): boolean =>
	KEY_INFO_SMART_SECTION_TYPES.has(section?.type ?? "");

const isArticleSmartSection = (section: SmartSectionPlan): boolean =>
	ARTICLE_SMART_SECTION_TYPES.has(section?.type ?? "");

const isCommunitySmartSection = (section: SmartSectionPlan): boolean =>
	COMMUNITY_SMART_SECTION_TYPES.has(section?.type ?? "");

const isVideoSmartSection = (section: SmartSectionPlan): boolean =>
	VIDEO_SMART_SECTION_TYPES.has(section?.type ?? "");

const isBlogSmartSection = (section: SmartSectionPlan): boolean =>
	BLOG_SMART_SECTION_TYPES.has(section?.type ?? "");

const isNutritionSmartSection = (section: SmartSectionPlan): boolean =>
	NUTRITION_SMART_SECTION_TYPES.has(section?.type ?? "");

const isStreetwearFreshSearchSection = (section: SmartSectionPlan): boolean =>
	section?.category === "streetwear" &&
	(section?.type === "collab" || section?.type === "release");

const smartSectionRequiresTitleKeyword = (section: SmartSectionPlan): boolean =>
	isArticleSmartSection(section) ||
	isVideoSmartSection(section) ||
	isBlogSmartSection(section);

const getSmartSearchDomains = (section: SmartSectionPlan, isKo: boolean): string[] => {
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

const getSmartCurrentYear = (): number => new Date().getFullYear();

const getSmartPublishedTime = (result: ArticleItem): number | null => {
	const date = new Date(result?.published_date ?? "");
	return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getSmartPublishedYear = (result: ArticleItem): number | null => {
	const publishedTime = getSmartPublishedTime(result);
	return publishedTime === null ? null : new Date(publishedTime).getFullYear();
};

const isKoreanPersonUpdatesSection = (section: SmartSectionPlan, isKo: boolean): boolean =>
	Boolean(isKo && section?.category === "person" && section?.type === "updates");

const smartResultHasYearSignal = (result: ArticleItem, year = getSmartCurrentYear()): boolean =>
	normalizeSmartSearchText(getSmartResultText(result)).includes(String(year));

const smartResultHasOlderYearSignal = (result: ArticleItem, year = getSmartCurrentYear()): boolean => {
	const text = normalizeSmartSearchText(getSmartResultText(result));
	const years = text.match(/\b20\d{2}\b/g) ?? [];
	return years.some((value) => Number(value) < year);
};

const smartResultTitleHasOlderYearSignal = (
	result: ArticleItem,
	year = getSmartCurrentYear(),
): boolean => {
	const title = normalizeSmartSearchText(result?.title ?? "");
	const years = title.match(/\b20\d{2}\b/g) ?? [];
	return years.some((value) => Number(value) < year);
};

const smartResultHasStaleRelativeSignal = (result: ArticleItem): boolean => {
	const text = String(getSmartResultText(result) || "").toLowerCase();
	return (
		/\b(?:one|[1-9]\d*)\s*(?:year|years|yr|yrs)\s*ago\b/i.test(text) ||
		/\b(?:1[2-9]|[2-9]\d+)\s*(?:month|months|mo|mos)\s*ago\b/i.test(text) ||
		/[1-9]\d*\s*년\s*전/.test(text) ||
		/(?:1[2-9]|[2-9]\d+)\s*개월\s*전/.test(text)
	);
};

const smartResultIsFreshEnough = (result: ArticleItem, section: SmartSectionPlan, isKo = false): boolean => {
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

const getSmartResultText = (result: ArticleItem): string =>
	[
		result?.title,
		result?.content,
		result?.url,
	].filter(Boolean).join(" ");

const hasSmartResultLanguage = (result: ArticleItem, isKo: boolean): boolean => {
	const text = getSmartResultText(result);
	return isKo ? _HANGUL.test(text) : (!_HANGUL.test(text) && _LATIN.test(text));
};

const getSmartHostname = (url = ""): string => {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
};

const isSmartDomainMatch = (hostname: string, domain: string) =>
	hostname === domain || hostname.endsWith(`.${domain}`);

const isSmartResultFromDomains = (result: SmartResult, domains: string[] = []) => {
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

const isBlockedSmartUrl = (url: string): boolean =>
	BLOCKED_SMART_URL_PATTERNS.some((pattern) => pattern.test(url));

const isPreferredKoreanSource = (result: SmartResult) => {
	const hostname = getSmartHostname(result?.url ?? "");
	return hostname
		? KO_SMART_DOMAINS.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

const isPreferredInfoSource = (result: SmartResult) => {
	const hostname = getSmartHostname(result?.url ?? "");
	return hostname
		? INFO_SMART_DOMAINS.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

const isTrustedSmartSource = (result: SmartResult, isKo: boolean) => {
	const hostname = getSmartHostname(result?.url ?? "");
	const trustedDomains = isKo ? KO_TRUSTED_DOMAINS : EN_TRUSTED_DOMAINS;
	return hostname
		? trustedDomains.some((domain) => isSmartDomainMatch(hostname, domain))
		: false;
};

const filterSmartResults = (items: SmartResult[], isKo: boolean) => {
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

const dedupeByUrl = (items: SmartResult[]) => {
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

const SMART_CATEGORY_CONFIGS = {
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

const SMART_CATEGORY_IDS = Object.keys(SMART_CATEGORY_CONFIGS);
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

const formatSmartCategoryPromptLine = (id: string) => {
	const config = (SMART_CATEGORY_CONFIGS as unknown as Record<string, { label: { en: string }; description: string; match: RegExp }>)[id];
	const keywordHints = getSmartCategoryKeywordHints(config);
	const hintText =
		keywordHints.length > 0
			? ` Keyword hints: ${keywordHints.join(", ")}.`
			: "";
	return `- ${id} (${config.label?.en ?? id}): ${config.description}.${hintText}`;
};

const parseJsonFromText = (text: string) => {
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

const classifySmartKeyword = async (keyword: string, isKo: boolean) => {
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

const buildSmartSectionPlan = (keyword: string, category: string, isKo: boolean) => {
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

const normalizeSmartSearchText = (value = "") =>
	String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

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

const getSmartKeywordVariants = (keyword = "") => {
	const normalized = normalizeSmartSearchText(keyword);
	const tokens = getSmartKeywordTokens(keyword);
	const variants = new Set([normalized, ...tokens]);
	for (const token of [normalized, ...tokens]) {
		((SMART_KEYWORD_ALIASES as Record<string, string[]>)[token] ?? []).forEach((alias: string) =>
			variants.add(normalizeSmartSearchText(alias)),
		);
	}
	return Array.from(variants).filter((value) => value.length >= 2);
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

const smartResultTitleMatchesSectionKeyword = (result: SmartResult, section: SmartSectionPlan) =>
	section?.category === "person"
		? smartResultTitleMatchesPersonName(result, section.keyword ?? "")
		: smartResultTitleMatchesKeyword(result, section.keyword ?? "");

const smartResultMatchesRequiredSectionKeyword = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) =>
	smartResultTitleMatchesSectionKeyword(result, section) ||
	(isNutritionSmartSection(section) &&
		smartResultMatchesKeyword(result, section.keyword ?? "")) ||
	(isKo &&
		section?.category === "person" &&
		hasSmartResultLanguage(result, true) &&
		smartResultMatchesKeyword(result, section.keyword ?? ""));

const smartResultIsEligibleForSection = (result: SmartResult, section: SmartSectionPlan, isKo: boolean) =>
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

const cleanSmartContentText = (value = "") => {
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

const smartResultHasSummarizableContent = (result: SmartResult, isKo: boolean) => {
	const title = cleanSmartContentText(result?.title ?? "");
	const content = cleanSmartContentText(result?.content ?? "");
	if (!title || !content) return false;
	if (BAD_SMART_CONTENT_RE.test(title)) return false;
	if (!isMeaningfulSmartContentText(content, isKo)) return false;
	return normalizeSmartSearchText(title) !== normalizeSmartSearchText(content);
};

const smartResultHasDisplayableContent = (result: SmartResult, isKo: boolean) => {
	const title = cleanSmartContentText(result?.title ?? "");
	if (!title || BAD_SMART_CONTENT_RE.test(title)) return false;
	const content = cleanSmartContentText(result?.content ?? "");
	return !content || isMeaningfulSmartContentText(content, isKo);
};

const getSmartItemSummaryText = (item: SmartResult & { detail?: string; snippet?: string }, isKo: boolean, maxLength = 260) => {
	const detail = cleanSmartDetail(item?.detail || item?.snippet, maxLength);
	return isMeaningfulSmartContentText(detail, isKo) ? detail : "";
};

const cleanSmartSnippet = (value = "", maxLength = 90) => {
	const text = cleanSmartContentText(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
};

const cleanSmartDetail = (value = "", maxLength = 260) => {
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

const formatSmartItems = (results: SmartResult[], isKo: boolean, section: SmartSectionPlan) => {
	const ranked = dedupeByUrl(
		rankSmartResultsForLanguage(
			results,
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
		console.log(`[smart-fmt] ranked=${ranked.length} eligible=${eligibleRanked.length} titleMatches=${titleKeywordMatches.length}`);
		console.log(`[smart-fmt] eligibleTitles=`, eligibleRanked.map(r => r?.title?.slice(0, 50)));
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
	console.log(`[smart-batch] batchNull=${primaryBatch === null} batchLen=${primaryBatch?.length}`);

	// 2단계: 결과 처리 + retry가 필요한 섹션 수집
	const rawResultsPerSection: SmartResult[][] = sections.map((section, i) => {
		const batchItem = primaryBatch?.[i];
		const results = ((batchItem?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
		const p = params[i];
		if (isKo && isArticleSmartSection(section) && p.isKoArticle) {
			console.log(`[smart-ko-article] section=${section.type} keyword="${section.keyword}" includeDomains=${JSON.stringify(p.includeDomains?.slice(0,3))} count=${results.length}`);
			console.log(`[smart-ko-article] titles=`, results.map(r => r?.title?.slice(0, 60)));
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

const searchSmartSection = async (section: SmartSectionPlan, isKo: boolean) => {
	const useFreshSearchMode = isStreetwearFreshSearchSection(section);
	// 한국어 기사 섹션: general 웹 크롤 인덱스 + 한국 뉴스 도메인 강제
	// → Tavily news 인덱스는 영어 위주라 한국 기사가 안 잡힘
	const isKoArticle = isKo && isArticleSmartSection(section) && !useFreshSearchMode;
	const mode = isKoArticle ? "search" : (isArticleSmartSection(section) && !useFreshSearchMode ? "news" : "search");
	const preferredDomains = getSmartSearchDomains(section, isKo);
	const includeDomains = isKoArticle ? KO_NEWS_DOMAINS : preferredDomains;
	const excludeDomains: string[] = [];
	const primaryTimeRange = (
		isKeyInfoSmartSection(section) ||
		isNutritionSmartSection(section) ||
		(isArticleSmartSection(section) && !useFreshSearchMode)
	)
		? null
		: isKo ? "year" : "month";
	const retryTimeRange = (isKeyInfoSmartSection(section) || isNutritionSmartSection(section))
		? null
		: useFreshSearchMode
			? null
			: isKo
				? null
				: primaryTimeRange;
	const tavilyData = await fetchSmartTavily(section, mode, isKo, includeDomains, primaryTimeRange, excludeDomains);

	let rawResults = ((tavilyData?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));

	if (isKoArticle) {
		console.log(`[smart-ko-article] section=${section.type} keyword="${section.keyword}"`);
		console.log(`[smart-ko-article] tavilyData null?`, tavilyData === null);
		console.log(`[smart-ko-article] rawResults count=`, rawResults.length);
		console.log(`[smart-ko-article] rawResults titles=`, rawResults.map(r => r?.title?.slice(0, 50)));
	}

	const titleMatchCount = rawResults.filter((r) =>
		(smartSectionRequiresTitleKeyword(section)
			? smartResultTitleMatchesSectionKeyword(r, section)
			: smartResultMatchesRequiredSectionKeyword(r, section, isKo)) &&
		smartResultIsEligibleForSection(r, section, isKo),
	).length;

	if (isKoArticle) {
		console.log(`[smart-ko-article] titleMatchCount=`, titleMatchCount);
	}

	if (
		titleMatchCount < (section.maxItems ?? 2) &&
		retryTimeRange !== primaryTimeRange
	) {
		const retry = await fetchSmartTavily(section, mode, isKo, includeDomains, retryTimeRange, excludeDomains);
		const retryResults = ((retry?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
		if (retryResults.length > 0) {
			rawResults = dedupeByUrl([...rawResults, ...retryResults]);
		}
	}

	let items = formatSmartItems(rawResults, isKo, section);
	if ((isVideoSmartSection(section) || isBlogSmartSection(section)) && items.length === 0) {
		const fallback = await fetchSmartTavily(section, mode, isKo, includeDomains, null, excludeDomains);
		const fallbackResults = ((fallback?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
		if (fallbackResults.length > 0) {
			rawResults = dedupeByUrl([...rawResults, ...fallbackResults]);
			items = formatSmartItems(rawResults, isKo, section);
		}
	}
	if (isArticleSmartSection(section) && !useFreshSearchMode && items.length === 0) {
		const fallback = await fetchNonLatestArticleTavily(
			section,
			isKo,
			includeDomains,
			excludeDomains,
		);
		const fallbackResults2 = ((fallback?.results as SmartResult[] | undefined) ?? []).filter((r) => !isBlockedSmartUrl(r?.url ?? ""));
		if (fallbackResults2.length > 0) {
			rawResults = dedupeByUrl([...rawResults, ...fallbackResults2]);
			items = formatSmartItems(rawResults, isKo, section);
		}
	}
	return {
		...section,
		answer: isMeaningfulSmartContentText(String(tavilyData?.answer ?? ""), isKo)
			? String(tavilyData!.answer)
			: "",
		items,
	};
};

const fallbackSmartBullets = (section: SmartSectionPlan & { linkOnly?: boolean; items?: { snippet?: string; detail?: string; title?: string }[] }, isKo: boolean) => {
	if (section.linkOnly) return [];
	const fromItems = (section.items ?? [])
		.slice(0, 5)
		.map((item, index) => {
			const labels = getSmartBulletLabels(section, isKo);
			const fact = compactSmartBulletFact(
				item.snippet || item.detail || item.title,
				isKo,
			);
			if (!fact) return "";
			return fact;
		})
		.filter(Boolean);
	if (fromItems.length > 0) return fromItems;

	return [];
};

const cleanSmartSummary = (value: unknown, isKo: boolean) => {
	const text = cleanSmartContentText(String(value ?? ""))
		.replace(/^[-•*\d.)\s]+/, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!text || BAD_SMART_BULLET_RE.test(text)) return "";
	const maxLength = isKo ? 34 : 58;
	if (text.length <= maxLength) return text.replace(/[.!?。]+$/g, "");
	const firstChunk = text.split(/[.!?。]/)[0]?.trim() ?? "";
	if (firstChunk.length > 4 && firstChunk.length <= maxLength) return firstChunk;
	return `${text.slice(0, maxLength).trim()}...`;
};

const cleanSmartTitle = (value: unknown, isKo: boolean) => {
	const text = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	const maxLength = isKo ? 64 : 82;
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
};

const getSmartSummaryFallback = (section: SmartSectionPlan & { items?: { snippet?: string; detail?: string; title?: string }[] }, isKo: boolean) => {
	const snippets = (section.items ?? [])
		.map((item) => getSmartItemSummaryText(item, isKo, 120))
		.filter((snippet) => String(snippet || "").trim().length > 8);
	return snippets[0] ?? "";
};

const getSmartSummaryTokens = (value: unknown) =>
	normalizeSmartSearchText(String(value ?? ""))
		.split(/[^\p{L}\p{N}]+/u)
		.filter((token) => token.length > 2);

const smartSummaryRepeatsTitle = (summary: string, section: SmartSectionPlan & { items?: { title?: string }[] }) => {
	const summaryText = normalizeSmartSearchText(summary);
	if (!summaryText) return false;
	return (section.items ?? []).some((item) => {
		const titleText = normalizeSmartSearchText(item.title ?? "");
		if (!titleText) return false;
		if (titleText.includes(summaryText) || summaryText.includes(titleText)) {
			return true;
		}
		const summaryTokens = getSmartSummaryTokens(summaryText);
		const titleTokens = getSmartSummaryTokens(titleText);
		if (summaryTokens.length < 2 || titleTokens.length < 2) return false;
		const overlap = summaryTokens.filter((token) =>
			titleTokens.includes(token),
		).length;
		return overlap / summaryTokens.length >= 0.7;
	});
};

const BAD_SMART_BULLET_RE =
	/(^additionally$|^also$|^however$|^moreover$|^therefore$|^meanwhile$|^overall$|to ensure|ensure you|check that|quality denim|season and purpose|based on|provided data|no direct|no specific|not available|insufficient|lack of|cannot compare|no comparison|official site|website|click|visit|link|source|aboutpresscopyrightcontact|privacy policy|terms of service|cookie policy|skip navigation|sign in|all rights reserved|copyright|google llc|©|검색 결과가 부족|제공된|직접 비교|비교.*없|정보.*없|자료.*없|공식|사이트|링크|확인하세요)/i;

const BULLET_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"for",
	"in",
	"is",
	"of",
	"on",
	"the",
	"to",
	"with",
	"that",
	"this",
	"you",
	"your",
]);

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

function compactSmartBulletFact(value: unknown, isKo: boolean) {
	const text = cleanSmartContentText(String(value ?? ""))
		.replace(/^[-•*\d.)\s]+/, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!isMeaningfulSmartContentText(text, isKo)) return "";
	const firstSentence = text.split(/[.!?。]/)[0]?.trim() || text;
	const maxLength = isKo ? 72 : 96;
	const clipped =
		firstSentence.length <= maxLength
			? firstSentence
			: firstSentence.slice(0, maxLength).trim();
	return clipped.replace(/[,:;·\-–—|]+$/g, "").trim();
}

const getBulletTokens = (value: unknown) =>
	normalizeSmartSearchText(String(value ?? ""))
		.split(/[^\p{L}\p{N}]+/u)
		.filter((token) => token.length > 1 && !BULLET_STOPWORDS.has(token));

const areSimilarBullets = (a: string, b: string) => {
	if (!a || !b) return false;
	if (a.includes(b) || b.includes(a)) return true;
	const aTokens = getBulletTokens(a);
	const bTokens = getBulletTokens(b);
	if (aTokens.length === 0 || bTokens.length === 0) return false;
	const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
	return overlap / Math.min(aTokens.length, bTokens.length) >= 0.6;
};

const normalizeSmartBullets = (value: unknown, section: (SmartSectionPlan & { items?: unknown[] }) | null = null, isKo = false) => {
	const bullets: string[] = [];
	const labels = section ? getSmartBulletLabels(section, isKo) : [];
	for (const item of Array.isArray(value) ? value : []) {
		const bullet = formatSmartStructuredBullet(
			item,
			labels[bullets.length],
			isKo,
		);
		if (
			bullet.length > 3 &&
			!bullets.some((existing) => areSimilarBullets(existing, bullet))
		) {
			bullets.push(bullet);
		}
		if (bullets.length >= 5) break;
	}
	return bullets;
};

function stripSmartBulletLabel(value: unknown) {
	const text = String(value || "").trim();
	const match = text.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
	return match ? match[2].trim() : text;
}

function formatSmartStructuredBullet(value: unknown, label: string | undefined, isKo: boolean) {
	const fact = cleanSmartBullet(stripSmartBulletLabel(value));
	if (!fact) return "";
	if (!label) return fact;
	return `${label}: ${fact}`;
}

const SMART_UI_TOKEN_RE =
	/(?:\uC811\uAE30|\uB354\uBCF4\uAE30|show\s+more|read\s+more|view\s+more|open|close)/gi;
const SMART_INCOMPLETE_TAIL_RE =
	/(?:\b(?:and|or|with|for|to|from|about|including|featuring|starting|additionally)\b|\uC2DC\uC791\uD558\uB294|\uB098\uC624\uB294|\uD558\uB294|\uB418\uB294|\uAC19\uC740|\uC788\uB294|\uADF8\uB9AC\uACE0|\uB610\uD55C)$/i;

const getSmartGeneratedBulletValue = (item: unknown) => {
	if (typeof item === "string") return item;
	if (!item || typeof item !== "object") return "";
	const obj = item as Record<string, unknown>;
	return obj.text ?? obj.fact ?? obj.value ?? obj.summary ?? obj.content ?? "";
};

const cleanSmartEvidenceText = (value = "", isKo = false, maxLength = 220) => {
	const text = cleanSmartContentText(value)
		.replace(SMART_UI_TOKEN_RE, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!isMeaningfulSmartContentText(text, isKo)) return "";
	if (text.length <= maxLength) return text;
	const firstSentence = text.split(/[.!?。]/)[0]?.trim() ?? "";
	if (firstSentence.length >= (isKo ? 12 : 35) && firstSentence.length <= maxLength) {
		return firstSentence;
	}
	return text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
};

const getSmartSectionEvidence = (section: SmartSectionPlan & { items?: { detail?: string; snippet?: string; title?: string; source?: string; time?: string }[] }, isKo: boolean) =>
	(section.items ?? [])
		.map((item) => {
			const text = cleanSmartEvidenceText(
				item.detail || item.snippet || item.title,
				isKo,
				240,
			);
			if (!text) return null;
			return {
				title: cleanSmartTitle(item.title ?? "", isKo),
				source: item.source ?? "",
				time: item.time ?? "",
				text,
			};
		})
		.filter(Boolean)
		.slice(0, 3);

const smartTextRepeatsSourceTitle = (value: unknown, section: SmartSectionPlan & { items?: { title?: string }[] }) => {
	const text = normalizeSmartSearchText(stripSmartBulletLabel(value));
	if (text.length < 12) return false;
	const textTokens = getBulletTokens(text);
	return (section.items ?? []).some((item) => {
		const title = normalizeSmartSearchText(item.title ?? "");
		if (!title || title.length < 12) return false;
		if (title.includes(text) || text.includes(title)) return true;
		const titleTokens = getBulletTokens(title);
		if (textTokens.length < 3 || titleTokens.length < 3) return false;
		const overlap = textTokens.filter((token) => titleTokens.includes(token)).length;
		return overlap / Math.min(textTokens.length, titleTokens.length) >= 0.8;
	});
};

const cleanSmartGeneratedFact = (value: unknown, section: SmartSectionPlan & { items?: { title?: string }[] }, isKo: boolean) => {
	const text = cleanSmartContentText(stripSmartBulletLabel(value))
		.replace(SMART_UI_TOKEN_RE, " ")
		.replace(/^["'`]+|["'`]+$/g, "")
		.replace(/[.!?。]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!text || BAD_SMART_BULLET_RE.test(text)) return "";
	if (SMART_INCOMPLETE_TAIL_RE.test(text)) return "";
	if (!isMeaningfulSmartContentText(text, isKo)) return "";
	if (smartTextRepeatsSourceTitle(text, section)) return "";
	const maxLength = isKo ? 74 : 105;
	if (text.length <= maxLength) return text;
	const firstSentence = text.split(/[.!?。;]/)[0]?.trim() ?? "";
	if (firstSentence.length >= (isKo ? 10 : 24) && firstSentence.length <= maxLength) {
		return firstSentence;
	}
	return "";
};

const formatSmartGeneratedBullet = (fact: string, label: string | undefined) =>
	label ? `${label}: ${fact}` : fact;

const normalizeSmartGeneratedBullets = (value: unknown, section: SmartSectionPlan & { items?: { title?: string }[] }, isKo: boolean) => {
	const bullets: string[] = [];
	const facts: string[] = [];
	const labels = getSmartBulletLabels(section, isKo);
	for (const item of Array.isArray(value) ? value : []) {
		const fact = cleanSmartGeneratedFact(
			getSmartGeneratedBulletValue(item),
			section,
			isKo,
		);
		if (!fact || facts.some((existing) => areSimilarBullets(existing, fact))) {
			continue;
		}
		facts.push(fact);
		bullets.push(formatSmartGeneratedBullet(fact, labels[bullets.length]));
		if (bullets.length >= 5) break;
	}
	return bullets;
};

const fallbackSmartBulletsFromEvidence = (section: SmartSectionPlan & { items?: { detail?: string; snippet?: string; title?: string; source?: string; time?: string }[] }, isKo: boolean) => {
	const evidence = getSmartSectionEvidence(section, isKo);
	return normalizeSmartGeneratedBullets(
		evidence.map((item) => item?.text ?? ""),
		section,
		isKo,
	);
};

const cleanSmartGeneratedSummary = (value: unknown, section: SmartSectionPlan & { items?: { title?: string }[] }, isKo: boolean) => {
	const text = cleanSmartSummary(value, isKo);
	if (!text || SMART_INCOMPLETE_TAIL_RE.test(text)) return "";
	if (smartSummaryRepeatsTitle(text, section)) return "";
	return text;
};

const getSmartSectionDetails = (section: SmartSectionPlan & { items?: { snippet?: string; detail?: string; title?: string }[] }, isKo: boolean) => {
	const seen = new Set();
	const details = [];
	for (const item of section.items ?? []) {
		const detail = getSmartItemSummaryText(item, isKo, 260);
		const key = normalizeSmartSearchText(detail).slice(0, 90);
		if (!detail || key.length < 10 || seen.has(key)) continue;
		seen.add(key);
		details.push(detail);
		if (details.length >= 3) break;
	}
	return details;
};

function getSmartBulletLabels(section: SmartSectionPlan | null | undefined, isKo: boolean) {
	const ko = {
		profile: ["이름/나이", "분야", "대표작", "최근 활동", "핵심"],
		overview: ["정체", "핵심", "특징", "최근 변화", "체크포인트"],
		brand_info: ["브랜드", "대표 항목", "특징", "최근 변화", "체크포인트"],
		updates: ["최신 소식", "변화", "대상", "날짜", "핵심"],
		release: ["발매", "날짜", "제품", "변화", "체크포인트"],
		collab: ["콜라보", "파트너", "제품", "일정", "핵심"],
		nutrition: ["영양", "칼로리", "성분", "주의점", "팁"],
		recipe: ["재료", "방법", "시간", "맛 포인트", "팁"],
		local_spots: ["지역", "장소", "특징", "메뉴", "팁"],
		video: ["영상", "주제", "핵심", "팁", "볼거리"],
		blog: ["후기", "핵심", "장점", "주의점", "팁"],
		reviews: ["평가", "장점", "단점", "반응", "핵심"],
		tips: ["팁", "방법", "주의점", "효과", "핵심"],
		products: ["제품", "특징", "스펙", "리뷰", "체크포인트"],
		deals: ["가격", "할인", "시기", "재고", "체크포인트"],
	};
	const en = {
		profile: ["Name/Age", "Field", "Known for", "Recent work", "Key note"],
		overview: ["Identity", "Key fact", "Feature", "Recent change", "Watchpoint"],
		brand_info: ["Brand", "Signature", "Feature", "Recent change", "Watchpoint"],
		updates: ["Latest", "Change", "Subject", "Date", "Key note"],
		release: ["Release", "Date", "Product", "Change", "Watchpoint"],
		collab: ["Collab", "Partner", "Product", "Timing", "Key note"],
		nutrition: ["Nutrition", "Calories", "Ingredient", "Caution", "Tip"],
		recipe: ["Ingredient", "Method", "Time", "Flavor", "Tip"],
		local_spots: ["Area", "Place", "Feature", "Menu", "Tip"],
		video: ["Video", "Topic", "Key point", "Tip", "Highlight"],
		blog: ["Review", "Key point", "Pro", "Caution", "Tip"],
		reviews: ["Review", "Pro", "Con", "Reaction", "Key note"],
		tips: ["Tip", "Method", "Caution", "Effect", "Key note"],
		products: ["Product", "Feature", "Spec", "Review", "Watchpoint"],
		deals: ["Price", "Discount", "Timing", "Stock", "Watchpoint"],
	};
	const fallback = isKo
		? ["핵심", "특징", "최근", "활용", "체크포인트"]
		: ["Key fact", "Feature", "Recent", "Use case", "Watchpoint"];
	const map: Record<string, string[]> = isKo ? ko : en;
	return map[section?.type ?? ""] ?? fallback;
}

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
		sections: sections as unknown as SmartSection[],
	};
}

/**
 * AI 최적화 To-do 생성 — 캘린더 일정 기반
 * @param {Array} calEvents - 오늘의 캘린더 일정 배열
 * @param {Array} existingTodos - 기존 Todo 배열
 * @returns {Array} AI가 추천하는 Todo 배열 [{ text, isFixed }]
 */
export async function generateAiTodo(calEvents: CalEvent[] = [], existingTodos: TodoItem[] = []) {
	const prompt = [
		"사용자의 오늘 캘린더 일정을 분석하여 최적의 할 일 목록을 생성하세요.",
		"기존 할 일 목록도 참고하여 중복을 피하세요.",
		"",
		"오늘 일정:",
		JSON.stringify(calEvents.slice(0, 10), null, 2),
		"",
		"기존 할 일:",
		JSON.stringify(existingTodos.map((t) => t.text).slice(0, 10), null, 2),
		"",
		"규칙:",
		"- 최대 5개의 할 일을 제안하세요.",
		"- 각 항목은 간결한 한 문장으로 작성하세요.",
		"- JSON 배열 형식으로 반환하세요: [{\"text\": \"...\"}]",
		"- JSON만 반환하고 다른 텍스트는 작성하지 마세요.",
	].join("\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: "캘린더 일정을 분석하여 최적의 할 일을 추천하는 AI입니다. JSON 배열만 반환하세요.",
	});

	if (!data?.text) return [];

	try {
		const parsed = JSON.parse(String(data.text));
		if (Array.isArray(parsed)) {
			return parsed.slice(0, 5).map((item) => ({
				text: item.text || item,
				isFixed: false,
			}));
		}
	} catch {
		handleApiError({ message: "AI Todo parse failed" }, "ai:todo_parse");
	}
	return [];
}

const DIARY_DATE_FORMATTER_KO = new Intl.DateTimeFormat("ko-KR", {
	year: "numeric",
	month: "long",
	day: "numeric",
});

const normalizeDiaryLineText = (value: unknown, fallback = "") => {
	const text = String(value || "").trim();
	if (!text || text === "(no title)") return fallback;
	return text.replace(/\s+/g, " ");
};

const formatDiaryDateLabel = (dateStr: string | null | undefined) => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime())
		? dateStr
		: DIARY_DATE_FORMATTER_KO.format(date);
};

const extractTimeLabel = (value: unknown) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	if (/^\d{2}:\d{2}$/.test(raw)) return raw;
	const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
	if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
	return "";
};

const buildDiaryEventLines = (events: { title?: string; summary?: string; startTime?: string; start?: string; endTime?: string; end?: string }[] = []) =>
	(Array.isArray(events) ? events : [])
		.map((event) => {
			const title = normalizeDiaryLineText(
				event?.title || event?.summary,
				"제목 없는 일정",
			);
			const start = extractTimeLabel(event?.startTime || event?.start);
			const end = extractTimeLabel(event?.endTime || event?.end);
			const timeLabel = start && end ? `${start}-${end}` : start || end || "종일";
			return {
				sortKey: start || end || "00:00",
				line: `${timeLabel} ${title}`,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);

const buildDiaryCompletedTaskLines = (todos: { title?: string; text?: string; startTime?: string; endTime?: string }[] = []) =>
	(Array.isArray(todos) ? todos : [])
		.map((todo) => {
			const title = normalizeDiaryLineText(
				todo?.title || todo?.text,
				"제목 없는 할 일",
			);
			const timeLabel = extractTimeLabel(todo?.startTime || todo?.endTime);
			return {
				sortKey: timeLabel || "99:99",
				line: timeLabel ? `${timeLabel} ${title}` : title,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);

const buildDiaryFallbackTitle = ({
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	wasActiveDay = false,
}: { scheduleLines?: string[]; completedLines?: string[]; wasActiveDay?: boolean } = {}) => {
	if (completedLines.length > 0 && scheduleLines.length > 0) {
		return "일정과 완료가 겹친 날";
	}
	if (completedLines.length > 0) {
		return "완료가 남은 하루";
	}
	if (scheduleLines.length > 0) {
		return "일정이 이어진 하루";
	}
	return wasActiveDay ? "기록이 적은 하루" : "조용한 하루";
};

const buildWeatherSummary = (weather: (WeatherData & Record<string, unknown>) | null | undefined) => {
	if (!weather || typeof weather !== "object") return "";
	const temp =
		weather?.temp ?? weather?.temperature ?? weather?.currentTemp ?? null;
	const condition = normalizeDiaryLineText(
		weather?.condition ||
			weather?.description ||
			weather?.summary ||
			weather?.main,
	);
	return [temp !== null && temp !== undefined ? `${temp}°C` : "", condition]
		.filter(Boolean)
		.join(" ");
};

const buildDiaryFallbackSummary = ({
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	weather,
	memo = "",
	diaryAnswers = [] as unknown[],
	wasActiveDay = false,
}: { formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; weather?: (WeatherData & Record<string, unknown>) | null; memo?: string; diaryAnswers?: unknown[]; wasActiveDay?: boolean }) => {
	const sentences = [];

	if (scheduleLines.length > 0) {
		sentences.push(`${formattedDate}에는 ${scheduleLines.join(", ")} 일정이 있었다.`);
	} else {
		sentences.push(`${formattedDate}에는 기록된 일정이 없었다.`);
	}

	if (completedLines.length > 0) {
		sentences.push(`완료한 일은 ${completedLines.join(", ")}였다.`);
	} else if (wasActiveDay) {
		sentences.push("완료로 표시된 할 일은 없었다.");
	}

	const weatherSummary = buildWeatherSummary(weather);
	if (weatherSummary) {
		sentences.push(`날씨 기록은 ${weatherSummary}였다.`);
	}

	const firstAnswer = normalizeDiaryLineText(diaryAnswers?.[0] || "");
	if (firstAnswer) {
		sentences.push(`하루 질문 답변에는 "${firstAnswer}"가 남아 있었다.`);
	}

	const memoText = normalizeDiaryLineText(memo);
	if (memoText) {
		sentences.push(`Memo에는 "${memoText}"가 남아 있었다.`);
	}

	if (!wasActiveDay) {
		sentences.push("앱 접속 기록이 없어 자동 수집된 데이터만 정리했다.");
	}

	return sentences.slice(0, 4).join(" ");
};

const buildDiaryText = ({
	title,
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	summary,
}: { title: string; formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; summary: string }) =>
	[
		`제목: ${title}`,
		`날짜: ${formattedDate}`,
		"",
		"일정",
		...(scheduleLines.length > 0
			? scheduleLines.map((line) => `- ${line}`)
			: ["- 일정 없음"]),
		"",
		"완료한 일",
		...(completedLines.length > 0
			? completedLines.map((line) => `- ${line}`)
			: ["- 완료한 일 없음"]),
		"",
		"기록",
		summary,
	].join("\n");

const DIARY_DATE_FORMATTERS_V2 = {
	ko: new Intl.DateTimeFormat("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}),
	en: new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}),
};

const resolveDiaryLanguage = (language = "ko") =>
	language === "en" ? "en" : "ko";

const getDiaryCopy = (language = "ko") =>
	resolveDiaryLanguage(language) === "en"
		? {
				targetLanguageName: "English",
				untitledEvent: "Untitled event",
				untitledTask: "Untitled task",
				allDay: "All day",
				titleLabel: "Title",
				dateLabel: "Date",
				scheduleHeading: "Schedule",
				completedHeading: "Completed",
				notesHeading: "Notes",
				noSchedule: "No scheduled items",
				noCompleted: "Nothing marked complete",
				fallbackTitleBoth: "A day of plans and checkmarks",
				fallbackTitleCompleted: "A day of completions",
				fallbackTitleScheduled: "A day shaped by plans",
				fallbackTitleActive: "A day with notes",
				fallbackTitleQuiet: "A quiet day",
				scheduleSentence: (formattedDate: string, scheduleLines: string[]) =>
					`${formattedDate} included ${scheduleLines.join(", ")}.`,
				noScheduleSentence: (formattedDate: string) =>
					`${formattedDate} had no recorded schedule.`,
				completedSentence: (completedLines: string[]) =>
					`Completed items included ${completedLines.join(", ")}.`,
				noCompletedSentence: "No tasks were marked complete.",
				weatherSentence: (weatherSummary: string) =>
					`The weather note for the day was ${weatherSummary}.`,
				answerSentence: (answer: string) =>
					`The daily question response was "${answer}".`,
				memoSentence: (memoText: string) =>
					`The memo for the day said "${memoText}".`,
				inactiveSentence:
					"There was no app activity record, so this entry uses only automatically collected data.",
		}
		: {
				targetLanguageName: "Korean",
				untitledEvent: "제목 없는 일정",
				untitledTask: "제목 없는 작업",
				allDay: "종일",
				titleLabel: "제목",
				dateLabel: "날짜",
				scheduleHeading: "일정",
				completedHeading: "완료한 일",
				notesHeading: "기록",
				noSchedule: "일정 없음",
				noCompleted: "완료한 일 없음",
				fallbackTitleBoth: "일정과 완료가 겹친 날",
				fallbackTitleCompleted: "완료가 쌓인 하루",
				fallbackTitleScheduled: "일정이 이어진 하루",
				fallbackTitleActive: "기록이 남은 하루",
				fallbackTitleQuiet: "조용한 하루",
				scheduleSentence: (formattedDate: string, scheduleLines: string[]) =>
					`${formattedDate}에는 ${scheduleLines.join(", ")} 일정이 있었다.`,
				noScheduleSentence: (formattedDate: string) =>
					`${formattedDate}에는 기록된 일정이 없었다.`,
				completedSentence: (completedLines: string[]) =>
					`완료한 일로는 ${completedLines.join(", ")}가 있었다.`,
				noCompletedSentence: "완료로 표시한 일은 없었다.",
				weatherSentence: (weatherSummary: string) =>
					`날씨 기록은 ${weatherSummary}였다.`,
				answerSentence: (answer: string) =>
					`하루 질문 답변에는 "${answer}"가 남아 있었다.`,
				memoSentence: (memoText: string) =>
					`Memo에는 "${memoText}"가 남아 있었다.`,
				inactiveSentence:
					"앱 접속 기록이 없어 자동 수집된 데이터만 정리했다.",
		};

const formatDiaryDateLabelForLanguage = (dateStr: string | null | undefined, language = "ko") => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime())
		? dateStr
		: (DIARY_DATE_FORMATTERS_V2 as Record<string, Intl.DateTimeFormat>)[resolveDiaryLanguage(language)].format(date);
};

const buildDiaryEventLinesForLanguage = (events: { title?: string; summary?: string; startTime?: string; start?: string; endTime?: string; end?: string }[] = [], language = "ko") => {
	const copy = getDiaryCopy(language);
	return (Array.isArray(events) ? events : [])
		.map((event) => {
			const title = normalizeDiaryLineText(
				event?.title || event?.summary,
				copy.untitledEvent,
			);
			const start = extractTimeLabel(event?.startTime || event?.start);
			const end = extractTimeLabel(event?.endTime || event?.end);
			const timeLabel = start && end ? `${start}-${end}` : start || end || copy.allDay;
			return {
				sortKey: start || end || "00:00",
				line: `${timeLabel} ${title}`,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);
};

const buildDiaryCompletedTaskLinesForLanguage = (
	todos: { title?: string; text?: string; startTime?: string; endTime?: string }[] = [],
	language = "ko",
) => {
	const copy = getDiaryCopy(language);
	return (Array.isArray(todos) ? todos : [])
		.map((todo) => {
			const title = normalizeDiaryLineText(
				todo?.title || todo?.text,
				copy.untitledTask,
			);
			const timeLabel = extractTimeLabel(todo?.startTime || todo?.endTime);
			return {
				sortKey: timeLabel || "99:99",
				line: timeLabel ? `${timeLabel} ${title}` : title,
			};
		})
		.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
		.map((item) => item.line);
};

const buildDiaryFallbackTitleForLanguage = ({
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	wasActiveDay = false,
	language = "ko",
}: { scheduleLines?: string[]; completedLines?: string[]; wasActiveDay?: boolean; language?: string } = {}) => {
	const copy = getDiaryCopy(language);
	if (completedLines.length > 0 && scheduleLines.length > 0) {
		return copy.fallbackTitleBoth;
	}
	if (completedLines.length > 0) {
		return copy.fallbackTitleCompleted;
	}
	if (scheduleLines.length > 0) {
		return copy.fallbackTitleScheduled;
	}
	return wasActiveDay ? copy.fallbackTitleActive : copy.fallbackTitleQuiet;
};

const buildDiaryFallbackSummaryForLanguage = ({
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	weather,
	memo = "",
	diaryAnswers = [] as unknown[],
	wasActiveDay = false,
	language = "ko",
}: { formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; weather?: (WeatherData & Record<string, unknown>) | null; memo?: string; diaryAnswers?: unknown[]; wasActiveDay?: boolean; language?: string }) => {
	const copy = getDiaryCopy(language);
	const sentences = [];

	if (scheduleLines.length > 0) {
		sentences.push(copy.scheduleSentence(formattedDate, scheduleLines));
	} else {
		sentences.push(copy.noScheduleSentence(formattedDate));
	}

	if (completedLines.length > 0) {
		sentences.push(copy.completedSentence(completedLines));
	} else if (wasActiveDay) {
		sentences.push(copy.noCompletedSentence);
	}

	const weatherSummary = buildWeatherSummary(weather).replace("째C", "C");
	if (weatherSummary) {
		sentences.push(copy.weatherSentence(weatherSummary));
	}

	const firstAnswer = normalizeDiaryLineText(diaryAnswers?.[0] || "");
	if (firstAnswer) {
		sentences.push(copy.answerSentence(firstAnswer));
	}

	const memoText = normalizeDiaryLineText(memo);
	if (memoText) {
		sentences.push(copy.memoSentence(memoText));
	}

	if (!wasActiveDay) {
		sentences.push(copy.inactiveSentence);
	}

	return sentences.slice(0, 4).join(" ");
};

const buildDiaryTextForLanguage = ({
	title,
	formattedDate,
	scheduleLines = [] as string[],
	completedLines = [] as string[],
	summary,
	language = "ko",
}: { title: string; formattedDate: string; scheduleLines?: string[]; completedLines?: string[]; summary: string; language?: string }) => {
	const copy = getDiaryCopy(language);
	return [
		`${copy.titleLabel}: ${title}`,
		`${copy.dateLabel}: ${formattedDate}`,
		"",
		copy.scheduleHeading,
		...(scheduleLines.length > 0
			? scheduleLines.map((line) => `- ${line}`)
			: [`- ${copy.noSchedule}`]),
		"",
		copy.completedHeading,
		...(completedLines.length > 0
			? completedLines.map((line) => `- ${line}`)
			: [`- ${copy.noCompleted}`]),
		"",
		copy.notesHeading,
		summary,
	].join("\n");
};

/**
 * AI 일기 자동 생성
 * @param {Object} params
 * @param {string} params.briefingText - 당일 AI 브리핑
 * @param {Array} params.completedTodos - 완료된 Todo 리스트
 * @param {Object} params.weather - 날씨 데이터
 * @param {Array} params.trends - 뉴스/트렌드 요약
 * @param {Array} params.stocks - 증시/환율 데이터
 * @param {Array} params.calEvents - 캘린더 일정
 * @param {Array} params.diaryAnswers - DiaryCard 질문 답변
 * @param {string} params.date - 대상 날짜 (YYYY-MM-DD)
 * @param {boolean} params.wasActiveDay - true=접속했음(A), false=비접속(B)
 * @returns {string} 일기 텍스트
 */
export async function generateDiary({
	briefingText = "",
	completedTodos = [] as { title?: string; text?: string; startTime?: string; endTime?: string }[],
	weather = null as (WeatherData & Record<string, unknown>) | null,
	trends = [] as string[],
	calEvents = [] as CalEvent[],
	diaryAnswers = [] as unknown[],
	qaPairs = [] as { question: string; answer: string }[],
	memo = "",
	date = "",
	wasActiveDay = false,
	language = "ko",
	interests = [] as string[],
	briefingSnapshots = [] as { capturedAt?: string; text?: string; summary?: string; sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }[],
	previousDayDiary = "",
	previousDayFeedback = "",
}: {
	briefingText?: string;
	completedTodos?: { title?: string; text?: string; startTime?: string; endTime?: string }[];
	weather?: (WeatherData & Record<string, unknown>) | null;
	trends?: string[];
	calEvents?: CalEvent[];
	diaryAnswers?: unknown[];
	qaPairs?: { question: string; answer: string }[];
	memo?: string;
	date?: string;
	wasActiveDay?: boolean;
	language?: string;
	interests?: string[];
	briefingSnapshots?: { capturedAt?: string; text?: string; summary?: string; sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }[];
	previousDayDiary?: string;
	previousDayFeedback?: string;
} = {}) {
	const resolvedLanguage = resolveDiaryLanguage(language);
	const diaryCopy = getDiaryCopy(resolvedLanguage);
	const formattedDate =
		formatDiaryDateLabelForLanguage(date, resolvedLanguage) || date;
	const scheduleLines = buildDiaryEventLinesForLanguage(
		calEvents,
		resolvedLanguage,
	);
	const completedLines = buildDiaryCompletedTaskLinesForLanguage(
		completedTodos,
		resolvedLanguage,
	);

	const fallbackTitle = buildDiaryFallbackTitleForLanguage({
		scheduleLines,
		completedLines,
		wasActiveDay,
		language: resolvedLanguage,
	});
	const fallbackSummary = buildDiaryFallbackSummaryForLanguage({
		formattedDate,
		scheduleLines,
		completedLines,
		weather,
		memo,
		diaryAnswers,
		wasActiveDay,
		language: resolvedLanguage,
	});

	// 브리핑 스냅샷에서 뉴스/트렌드/스마트 키워드 헤드라인 추출
	const extractHeadlinesFromSnapshot = (snapshot: { sections?: { id: string; subBlocks?: { id: string; lines?: { title?: string }[] }[] }[] }) => {
		const latestInfo = (snapshot.sections ?? []).find((sec) => sec.id === "latest_info");
		if (!latestInfo) return "";
		const allLines = [
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_news")?.lines ?? []),
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_trends")?.lines ?? []),
			...(latestInfo.subBlocks?.find((sb) => sb.id === "latest_smart")?.lines ?? []),
		];
		const titles = allLines
			.filter((l) => typeof l === "object" && l?.title)
			.map((l) => `- ${l.title}`)
			.slice(0, 8);
		return titles.join("\n");
	};

	// 시간대별 브리핑 스냅샷 요약 (최대 6개, 텍스트 앞 200자 + 헤드라인)
	const snapshotLines = Array.isArray(briefingSnapshots)
		? briefingSnapshots.slice(0, 6).map((s) => {
				const time = s.capturedAt
					? new Date(s.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
					: "";
				const text = (s.text || s.summary || "").slice(0, 200);
				const headlines = extractHeadlinesFromSnapshot(s);
				const body = headlines ? `${text}\n[Headlines]\n${headlines}` : text;
				return time ? `[${time}] ${body}` : body;
			})
		: [];

	const promptContext = {
		date: formattedDate,
		wasActiveDay,
		scheduleLines,
		completedLines,
		weather,
		trends: Array.isArray(trends) ? trends.slice(0, 5) : [],
		diaryAnswers: Array.isArray(diaryAnswers) ? diaryAnswers.slice(0, 3) : [],
		qaPairs: Array.isArray(qaPairs) ? qaPairs.slice(0, 3).map((p) => ({ question: p.question, answer: p.answer })) : [],
		memo: normalizeDiaryLineText(memo),
		briefingText: snapshotLines.length > 0
			? snapshotLines.join("\n")
			: normalizeDiaryLineText(briefingText),
		previousDayDiary: normalizeDiaryLineText(previousDayDiary).slice(0, 400),
		previousDayFeedback: normalizeDiaryLineText(previousDayFeedback).slice(0, 200),
		interests: Array.isArray(interests)
			? interests.map((i) => (typeof i === "string" ? i : (i as { keyword?: string })?.keyword)).filter(Boolean).slice(0, 8)
			: [],
	};

	const isKoTarget = resolvedLanguage === "ko";

	const systemPromptV2 = isKoTarget
		? [
				"당신은 사용자의 하루를 정리하는 일기 보조 AI입니다.",
				"반드시 한국어(한글)로만 모든 텍스트를 작성하세요.",
				"일본어, 중국어, 러시아어, 아랍어 등 다른 언어/문자는 절대 사용하지 마세요.",
				'날짜는 "5월 15일"처럼 숫자+한글 형식으로 표기하세요 ("五月十五日" 같은 한자 단독 표기 금지).',
				"반드시 JSON 객체 하나만 반환하세요.",
				"summary는 사실 기반으로만 쓰고, 추측이나 감정 과장은 금지합니다.",
			].join("\n")
		: [
				"You are a diary assistant that summarizes a user's day from structured facts.",
				"Write ALL output strictly in English. Do not use Korean Hangul, Japanese kana, Chinese characters, Cyrillic, Arabic, or any other script.",
				'Use plain Latin letters for dates (e.g. "May 15"). Never use CJK or other non-Latin date formats.',
				"Return exactly one JSON object and nothing else.",
				"Summary must be factual only. Do not invent events, emotions, or conclusions not supported by the input.",
			].join("\n");

	const promptV2 = isKoTarget
		? [
				`${formattedDate}의 일기 제목과 요약을 한국어로 작성하세요.`,
				"반드시 한국어(한글)만 사용하고 다른 언어 문자는 절대 사용하지 마세요.",
				'반드시 아래 형식의 JSON만 반환하세요: {"title":"...","summary":"..."}',
				"",
				"규칙:",
				"- title: 3~10자 내외의 짧은 상징 문구 (한국어)",
				"- summary: 한국어 2~4문장, 사실 기반",
				"- 일정 목록과 완료 목록은 앱에서 따로 보여주므로 summary는 흐름 정리에 집중",
				"- memo가 있으면 사실 기반으로 자연스럽게 반영",
				"- 앱 미접속일이면 summary에 그 사실을 자연스럽게 포함",
				"- briefingText에 시간대별 브리핑 스냅샷이 있으면 이를 그날의 주요 내용으로 활용",
				"- previousDayDiary는 문체·톤·스타일 참고용입니다. 전날 사건이나 내용은 오늘 일기에 절대 포함하지 마세요.",
				"- 오늘 내용은 오직 입력 데이터(briefingText, completedLines, scheduleLines, diaryAnswers, qaPairs)에서만 가져오세요.",
				"- qaPairs는 사용자가 오늘 직접 답한 질문/답변입니다. 답변 내용을 그날의 개인적 사실로 자연스럽게 반영하되, 질문 문구를 그대로 옮겨 적지는 마세요.",
				"- previousDayFeedback이 있으면 해당 선호도(포함·제외 항목 등)를 오늘 일기에 반영하세요.",
				"",
				"입력 데이터:",
				JSON.stringify(promptContext, null, 2),
			].join("\n")
		: [
				`Write a diary title and summary for ${formattedDate}.`,
				"Write both fields strictly in English only. No other languages or scripts.",
				'Return JSON only in this shape: {"title":"...","summary":"..."}',
				"",
				"Rules:",
				"- Title should be short and symbolic, without exaggeration.",
				"- Summary should be 2 to 4 factual sentences.",
				"- The schedule and completed lists will already be shown separately, so connect the day naturally instead of repeating every bullet verbatim.",
				"- If memo exists, weave it in naturally as a factual note.",
				"- If the day was inactive, mention that naturally.",
				"- If user interests are listed and relevant data (trends, news) exists, briefly reference them naturally.",
				"- briefingText contains time-stamped briefing snapshots saved throughout the day — use them as the primary source for what actually happened.",
				"- previousDayDiary is a STYLE REFERENCE ONLY. Do not copy or reference any events, facts, or content from it into today's entry.",
				"- All content for today must come exclusively from the input data (briefingText, completedLines, scheduleLines, diaryAnswers, qaPairs).",
				"- qaPairs are the user's own answers to today's reflection questions. Use the answers as personal facts woven naturally into the entry; do not quote the question text verbatim.",
				"- If previousDayFeedback is provided, apply those preferences (e.g. what to include or exclude) to today's entry.",
				"",
				"Input data:",
				JSON.stringify(promptContext, null, 2),
			].join("\n");

	const containsForeignScripts = (text: string, targetLang: string) => {
		if (!text) return false;
		if (targetLang === "ko") {
			return /[぀-ゟ゠-ヿЀ-ӿ؀-ۿ֐-׿฀-๿ऀ-ॿ]/.test(text);
		}
		if (targetLang === "en") {
			return /[가-힯぀-ゟ゠-ヿ一-鿿Ѐ-ӿ؀-ۿ]/.test(text);
		}
		return false;
	};

	const data = await invokeFunction("groq", {
		prompt: promptV2,
		system: systemPromptV2,
	});

	if (data?.text) {
		try {
			const match = String(data.text).match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : String(data.text));
			const title = normalizeDiaryLineText(parsed?.title, fallbackTitle);
			const summary = normalizeDiaryLineText(parsed?.summary, fallbackSummary);

			const titleHasForeign = containsForeignScripts(title, resolvedLanguage);
			const summaryHasForeign = containsForeignScripts(summary, resolvedLanguage);

			if (titleHasForeign || summaryHasForeign) {
				handleApiError({ message: `foreign script in AI output (lang=${resolvedLanguage})` }, "ai:diary_script");
				return buildDiaryTextForLanguage({
					title: titleHasForeign ? fallbackTitle : title,
					formattedDate,
					scheduleLines,
					completedLines,
					summary: summaryHasForeign ? fallbackSummary : summary,
					language: resolvedLanguage,
				});
			}

			return buildDiaryTextForLanguage({
				title,
				formattedDate,
				scheduleLines,
				completedLines,
				summary,
				language: resolvedLanguage,
			});
		} catch (error) {
			handleApiError(error, "ai:diary_parse");
		}
	}

	return buildDiaryTextForLanguage({
		title: fallbackTitle,
		formattedDate,
		scheduleLines,
		completedLines,
		summary: fallbackSummary,
		language: resolvedLanguage,
	});
}

/**
 * 피드백 기반 일기 재작성
 * @param {string} originalDiary - aiGeneratedDiary (baseline, 불변)
 * @param {Array<{text: string}>} feedbackHistory - 누적 피드백 목록
 * @param {string} language - "ko" | "en"
 * @returns {string} 재작성된 일기 전문
 */
export async function rewriteDiaryWithFeedback({
	originalDiary = "",
	feedbackHistory = [] as { at?: string; text: string }[],
	language = "ko",
}: { originalDiary?: string; feedbackHistory?: { at?: string; text: string }[]; language?: string } = {}) {
	const resolvedLanguage = resolveDiaryLanguage(language);
	const isKo = resolvedLanguage === "ko";
	const feedbackText = feedbackHistory
		.map((f) => f.text || "")
		.filter(Boolean)
		.join("\n");

	const systemPrompt = isKo
		? [
				"당신은 사용자의 피드백을 바탕으로 일기를 개선하는 보조 AI입니다.",
				"원본 일기의 사실과 구조를 유지하되, 피드백에서 요청한 사항을 반영하여 다시 작성하세요.",
				"과장하거나 사실을 추가·삭제하지 마세요. 순수하게 표현과 스타일만 개선하세요.",
			].join("\n")
		: [
				"You are a diary improvement assistant. Rewrite the diary based on the user's feedback.",
				"Preserve all facts and structure from the original. Only improve expression and style per the feedback.",
				"Do not invent new facts or remove existing ones.",
			].join("\n");

	const prompt = isKo
		? [
				"아래 원본 일기를 피드백을 반영하여 다시 작성하세요.",
				"사실은 그대로 유지하되, 피드백 내용을 반영해 표현·어조를 개선하세요.",
				"JSON 없이 일기 본문 텍스트만 반환하세요.",
				"",
				"[원본 일기]",
				originalDiary,
				"",
				"[피드백]",
				feedbackText || "(없음)",
			].join("\n")
		: [
				"Rewrite the diary below based on the feedback.",
				"Keep all facts intact. Only adjust tone and style per the feedback.",
				"Return only the rewritten diary text, no JSON.",
				"",
				"[Original Diary]",
				originalDiary,
				"",
				"[Feedback]",
				feedbackText || "(none)",
			].join("\n");

	const data = await invokeFunction("groq", { prompt, system: systemPrompt });
	const rewritten = data?.text ? String(data.text).trim() : "";
	return rewritten || originalDiary;
}

