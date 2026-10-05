import { getCurrentLanguage } from "../../l10n/i18n";
import { SUPABASE_URL, SUPABASE_ANON_KEY, invokeFunction } from "./client";

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
} = {}): Promise<{ question: string; fromAi: boolean }> {
	const resolvedLanguage = normalizeQuestionLanguage(language);
	const copy = QUESTION_COPY[resolvedLanguage];
	const dayOfWeek = DAY_NAMES[resolvedLanguage][new Date().getDay()];
	const isWeekend = resolvedLanguage === "ko"
		? ["토요일", "일요일"].includes(dayOfWeek)
		: ["Saturday", "Sunday"].includes(dayOfWeek);

	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		return { question: pickFallbackQuestion(previousQuestions, resolvedLanguage), fromAi: false };
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
			// 호출 자체가 실패(한도 초과·네트워크)면 재시도해도 같은 결과 → 토큰 낭비 없이 바로 fallback
			if (!data) break;
			const question = normalizeQuestionCandidate(data?.text);
			if (isValidDiaryQuestion(question, resolvedLanguage)) {
				return { question, fromAi: true };
			}
		} catch {
			// fall through to next attempt or fallback
		}
	}

	return { question: pickFallbackQuestion(previousQuestions, resolvedLanguage), fromAi: false };
}
