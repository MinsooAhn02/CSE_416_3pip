import { getCurrentLanguage } from "../l10n/i18n";

const getLangConfig = () => {
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

const normalizeQuestionLanguage = (language = "") =>
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

function pickTopics(previousQuestions, count = 2, language = "ko", fixedInterestIds = []) {
	const resolvedLang = normalizeQuestionLanguage(language);
	const pool = TOPIC_POOL[resolvedLang] || TOPIC_POOL.ko;
	const interestMap = INTEREST_TOPIC_MAP[resolvedLang] || INTEREST_TOPIC_MAP.ko;

	const interestTopics = (fixedInterestIds ?? [])
		.map((id) => interestMap[id])
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

const normalizeQuestionCandidate = (value) =>
	String(value || "")
		.replace(/\r?\n+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^["'`\s\d.-]+/, "")
		.replace(/["'`]+$/g, "")
		.replace(/\s+([?!.,])/g, "$1")
		.trim();

const isValidDiaryQuestion = (value, language = "ko") => {
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

const pickFallbackQuestion = (previousQuestions = [], language = "ko") => {
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
} = {}) {
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

const invokeFunction = async (name, body) => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
	const startedAt = Date.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
	try {
		const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			console.warn(`[ai] ${name} HTTP ${res.status}:`, text);
			return null;
		}
		const data = await res.json();
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
		}
		return data;
	} catch (e) {
		clearTimeout(timer);
		if (e.name === "AbortError") {
			console.warn(`[ai] ${name} timed out after ${AI_TIMEOUT_MS}ms`);
		} else {
			console.warn(`[ai] ${name} failed:`, e.message);
		}
		return null;
	}
};

const getTimeProfile = (date = new Date()) => {
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

const toNum = (v, d = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : d;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const scoreSignals = ({ context, timeProfile }) => {
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

	const personaText = [
		persona?.persona,
		persona?.job,
		persona?.memo,
		...(Array.isArray(persona?.interests) ? persona.interests : []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	const activeSet = new Set(activeWidgetIds || []);

	const signals = [];

	const pushSignal = ({ id, title, payload, R, Kmatch, wPersona, U, Se }) => {
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
		const wPersona = persona?.job ? 1.1 : 1;
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
		const interests = Array.isArray(persona?.interests)
			? persona.interests
			: [];
		const overlap = trends.filter((t) =>
			interests.some((i) =>
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

const localBriefingFallback = ({ topSignals, timeProfile, lang }) => {
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
export function formatCalEventsForAI(calEvents = [], lang = "en") {
	const isKo = lang === "ko";
	if (!Array.isArray(calEvents) || calEvents.length === 0) {
		return isKo
			? "오늘 예정된 일정이 없습니다."
			: "No events are scheduled for today.";
	}
	return calEvents
		.slice()
		.sort((a, b) => new Date(a.start) - new Date(b.start))
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
			return `${time} ${e.title || e.summary || (isKo ? "일정" : "Event")}`;
		})
		.join(", ");
}

/**
 * 시간대별 공식 인사말 반환
 * @returns {string} 시간대에 맞는 공식 인사말
 */
export function getTimeGreeting() {
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

const truncateText = (value, max = 500) => {
	const text = String(value ?? "").replace(/\s+/g, " ").trim();
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max).trim()}...`;
};

const toSentenceSummary = (value, count = 2) => {
	const text = truncateText(value, 700);
	if (!text) return "";
	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return sentences.slice(0, count).join(" ");
};

const parseDetailLines = (raw) => {
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
}) => {
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

const normalizeBriefingJson = (rawText) => {
	const cleaned = String(rawText)
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();
	const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
	const parsed = JSON.parse(jsonCandidate);
	const summary = truncateText(parsed?.summary, 1200);
	const detailLines = Array.isArray(parsed?.detailLines)
		? parsed.detailLines.map((line) => truncateText(line, 240)).filter(Boolean)
		: parseDetailLines(parsed?.detail);
	if (!summary || detailLines.length === 0) return null;
	return {
		summary,
		detail: detailLines.join("\n"),
	};
};

const languageText = (lang) => (lang === "ko"
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

const buildListSection = (title, items = [], max = 5) => {
	const compactItems = items.map((item) => truncateText(item, 180)).filter(Boolean).slice(0, max);
	if (!title) return "";
	if (compactItems.length === 0) return `${title}:`;
	return `${title}:\n${compactItems.map((item) => `- ${item}`).join("\n")}`;
};

/**
 * 날씨 상태 → 이모지 매핑. 영/한 표현 모두 커버.
 */
const getWeatherEmoji = (condition = "") => {
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
const getBriefingTimeMode = (date = new Date()) => {
	const hour = date.getHours();
	if (hour >= 5 && hour < 12) return "morning";
	if (hour >= 12 && hour < 18) return "afternoon";
	return "evening";
};

/**
 * 일정 시간 추출 (오후/저녁 모드에서 "남은" 일정 판별용)
 */
const eventStartTime = (event) => {
	const start = event?.start;
	if (!start) return null;
	const time = new Date(start).getTime();
	return Number.isFinite(time) ? time : null;
};

const formatEventLine = (event, lang) => {
	const isKo = lang === "ko";
	const start = event?.start ? new Date(event.start) : null;
	const time = start
		? start.toLocaleTimeString(isKo ? "ko-KR" : "en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		})
		: "";
	const title = event?.title || event?.summary || (isKo ? "일정" : "Event");
	return time ? `${time} ${title}` : title;
};

/**
 * Groq 호출: 어제 일기를 1-2문장 과거형 사실 서술로 재작성
 * Returns trimmed string or "".
 */
const rewriteYesterdayDiary = async ({ diaryText, memoText, tone, lang, langInstruction }) => {
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
const summarizeSmartWidgets = async ({ smartSummaries, tone, lang, langInstruction }) => {
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
const summarizeArticlesBatch = async ({ articles, lang, langInstruction }) => {
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
		const raw = (data?.text || "").trim();
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
const hostFromUrl = (url) => {
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
export async function generateDetailedBriefing({ tone, length, context }) {
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
		const dateLabelText = `${isKo ? "날짜" : "Date"}: ${dateLabel}`;
		let weatherLabelText;
		if (weather) {
			const city = weather.city || (isKo ? "현재 위치" : "Current location");
			const temp = weather.temp != null ? `${weather.temp}°C` : "?°C";
			const condition = weather.condition || "";
			const emoji = getWeatherEmoji(condition);
			const precipitation =
				weather.precipitation != null
					? `, ${isKo ? "강수확률" : "precipitation"} ${weather.precipitation}%`
					: "";
			weatherLabelText = `${isKo ? "날씨" : "Weather"}: ${emoji} ${city} ${temp}${condition ? `, ${condition}` : ""}${precipitation}`;
		} else {
			weatherLabelText = `${isKo ? "날씨" : "Weather"}: ${isKo ? "정보 없음" : "No data"}`;
		}
		sections.push({
			id: "header",
			title: isKo ? "오늘" : "Today",
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
			const title = isKo ? "오늘 일정" : "Today's schedule";
			const lines =
				sortedToday.length > 0
					? sortedToday.slice(0, 6).map((e) => formatEventLine(e, lang))
					: [isKo ? "일정 없음" : "No events"];
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

			const remainingTitle = isKo ? "오늘 남은 일정" : "Remaining today";
			sections.push({
				id: "schedule_today_remaining",
				title: remainingTitle,
				lines:
					remaining.length > 0
						? remaining.slice(0, 5).map((e) => formatEventLine(e, lang))
						: [isKo ? "남은 일정 없음" : "No remaining events"],
			});

			const tomorrowTitle = isKo ? "내일 일정" : "Tomorrow";
			sections.push({
				id: "schedule_tomorrow",
				title: tomorrowTitle,
				lines:
					sortedTomorrow.length > 0
						? sortedTomorrow.slice(0, 5).map((e) => formatEventLine(e, lang))
						: [isKo ? "일정 없음" : "No events"],
			});
		}
	}

	// ── 4·5) Groq 병렬 호출 — 어제 일기 / 스마트 위젯 요약 / 기사 요약 ──
	const newsArticles = (Array.isArray(context?.newsResults) ? context.newsResults : []).slice(0, 3);
	const trendsArticles = (Array.isArray(context?.trendsResults) ? context.trendsResults : []).slice(0, 3);
	const allArticles = [...newsArticles, ...trendsArticles];

	const [diaryRewrite, smartSummary, articleSummaries] = await Promise.all([
		rewriteYesterdayDiary({
			diaryText: context?.yesterdayDiary,
			memoText: context?.yesterdayMemo,
			tone,
			lang,
			langInstruction,
		}),
		summarizeSmartWidgets({
			smartSummaries: context?.smartSummaries,
			tone,
			lang,
			langInstruction,
		}),
		summarizeArticlesBatch({ articles: allArticles, lang, langInstruction }),
	]);

	// index 0..newsArticles.length-1 → news summaries; rest → trends summaries
	const newsSummaryMap = {};
	const trendsSummaryMap = {};
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
		const fallback = isKo ? "기록된 일기가 없습니다." : "No diary was recorded.";
		const line =
			diaryRewrite ||
			(hasYesterdayData ? toSentenceSummary(context?.yesterdayDiary || context?.yesterdayMemo, 2) : fallback);
		sections.push({
			id: "yesterday",
			title: isKo ? "어제" : "Yesterday",
			lines: [line],
		});
	}

	// ── 5) 오늘 최신 정보 — 스마트 키워드 + 주요 뉴스 Top 3 + 트렌드 Top 3 ─
	{
		const smartLine =
			smartSummary ||
			(isKo ? "수집된 키워드 정보가 없습니다." : "No keyword info collected yet.");

		// News: structured objects { title, url, summary, source }
		const newsLines =
			newsArticles.length > 0
				? newsArticles.map((n, i) => ({
					title: truncateText(n?.title, 140) || "",
					url: n?.url || "",
					summary: truncateText(newsSummaryMap[i] || "", 200),
					source: truncateText(n?.source || hostFromUrl(n?.url), 40),
				  })).filter((o) => o.title && o.url)
				: [isKo ? "수집된 뉴스가 없습니다." : "No news collected yet."];

		// Trends: same structured shape
		const trendsLines =
			trendsArticles.length > 0
				? trendsArticles.map((t, i) => ({
					title: truncateText(t?.title, 140) || "",
					url: t?.url || "",
					summary: truncateText(trendsSummaryMap[i] || "", 200),
					source: truncateText(t?.source || hostFromUrl(t?.url), 40),
				  })).filter((o) => o.title && o.url)
				: [isKo ? "수집된 트렌드가 없습니다." : "No trends collected yet."];

		// detail 평문용: 객체를 "제목 — 출처: 요약" 형태로 직렬화
		const toPlainLine = (item) =>
			typeof item === "string"
				? item
				: `${item.title}${item.source ? ` — ${item.source}` : ""}${item.summary ? `: ${item.summary}` : ""}`;

		sections.push({
			id: "latest_info",
			title: isKo ? "오늘 최신 정보" : "Today's latest info",
			lines: [smartLine, ...newsLines.map(toPlainLine), ...trendsLines.map(toPlainLine)],
			subBlocks: [
				{
					id: "latest_smart",
					title: isKo ? "관심 키워드" : "Smart keywords",
					lines: [smartLine],
				},
				{
					id: "latest_news",
					title: isKo ? "주요 뉴스 Top 3" : "Top 3 news",
					lines: newsLines,
				},
				{
					id: "latest_trends",
					title: isKo ? "트렌드 Top 3" : "Trends Top 3",
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

export async function generateBriefing({ tone, length, context }) {
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
				.map((item) => (typeof item === "string" ? item : item?.title))
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
 * 1단계: Groq → 키워드 핵심 포인트 3개 + 이모지 추출
 * 2단계: Tavily → 키워드 관련 최신 뉴스/정보 검색
 * 3단계: 두 결과를 SmartWidgetContent 포맷으로 조합
 */
const _HANGUL = /[가-힣]/;
const _LATIN  = /[a-zA-Z]/;

// 문제 2 fix: KO 검색 시 도메인 화이트리스트로 2단계 재시도 + fallback 임계값 1로 인하
const KO_NEWS_DOMAINS = [
	"news.naver.com",
	"yna.co.kr",
	"chosun.com",
	"joins.com",
	"hani.co.kr",
	"news1.kr",
];

const filterSmartResults = (items, isKo) => {
	const langFiltered = items.filter((r) => {
		const t = r.title ?? "";
		return isKo ? _HANGUL.test(t) : (!_HANGUL.test(t) && _LATIN.test(t));
	});
	// 한국어 결과 1개라도 있으면 한국어만 표시 (이전: 2개 미만이면 전체 사용)
	return langFiltered.length >= 1 ? langFiltered : items;
};

const dedupeByUrl = (items) => {
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

export async function generateSmartWidgetData(keyword, context = {}) {
	const { lang } = getLangConfig();
	const isKo = lang === "ko";

	// ─── Step 1: Tavily 검색 (언어별 쿼리, 도메인 제한 없이 넓게 검색) ──
	const tavilyQuery = isKo
		? `${keyword} 최신 정보 동향 뉴스`
		: `${keyword} latest news trends updates`;

	const tavilyData = await invokeFunction("tavily", { query: tavilyQuery });

	let rawResults = tavilyData?.results ?? [];
	let langFiltered = filterSmartResults(rawResults, isKo);

	// 문제 2 fix: 한국어 모드인데 한국어 결과가 2개 미만이면 KO_NEWS_DOMAINS 화이트리스트로
	// 2단계 재호출. 첫 호출 결과와 머지 후 다시 필터링.
	if (isKo) {
		const koCount = rawResults.filter((r) => _HANGUL.test(r?.title ?? "")).length;
		if (koCount < 2) {
			const retry = await invokeFunction("tavily", {
				query: tavilyQuery,
				include_domains: KO_NEWS_DOMAINS,
			});
			const retryResults = retry?.results ?? [];
			if (retryResults.length > 0) {
				rawResults = dedupeByUrl([...retryResults, ...rawResults]);
				langFiltered = filterSmartResults(rawResults, isKo);
			}
		}
	}

	const newsItems = langFiltered
		.slice(0, 3)
		.map((r) => {
			let source = r.url ?? "";
			try {
				source = new URL(r.url).hostname.replace(/^www\./, "");
			} catch {}
			return {
				title: r.title ?? r.url ?? "",
				url: r.url ?? "",
				source,
				time: isKo ? "최근" : "recent",
			};
		})
		.filter((r) => r.title);

	// ─── Step 2: Groq — emoji + 3-4 bullet 요약 (뉴스 내용 기반, 언어 맞춤) ─────────
	const contextLines = [
		tavilyData?.answer ? `개요: ${tavilyData.answer}` : "",
		...langFiltered.slice(0, 3).map((r) => {
			const snippet = r.content?.trim();
			return snippet ? `[${r.title}]\n${snippet}` : `[${r.title}]`;
		}),
	].filter(Boolean);
	const tavilyContext = contextLines.join("\n\n");

	const groqPromptBase = isKo
		? `'${keyword}'에 대해 아래 뉴스 본문을 읽고 핵심 내용을 한국어 bullet 3-4개로 요약하세요. 각 bullet은 뉴스 내용에서 파악한 실질적인 정보를 담아야 합니다. 단순히 제목을 나열하지 말고, 내용을 읽고 요약하세요. 참고 내용이 없으면 일반적인 지식으로 답하세요.`
		: `Read the news content below about '${keyword}' and summarize the key insights in 3-4 English bullet points. Each bullet must contain substantive information synthesized from the content — do not just restate headlines. Use general knowledge if no content is provided.`;

	const groqData = await invokeFunction("groq", {
		system: isKo
			? "당신은 뉴스 분석 전문가입니다. 반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요."
			: "You are a news analyst. Return only valid JSON. No other text.",
		prompt: [
			groqPromptBase,
			`{ "emoji": "...", "bullets": ["...", "...", "..."] }`,
			"- emoji: single emoji best representing the keyword",
			isKo
				? "- bullets: 각 bullet은 뉴스 내용을 바탕으로 1-2문장, 핵심 정보만, 한국어로"
				: "- bullets: each bullet is 1-2 sentences synthesizing content, in English",
			tavilyContext ? `\n뉴스 참고:\n${tavilyContext}` : "",
		].join("\n"),
		temperature: 0.5,
	});

	let emoji = "🔍";
	let bullets = [];

	if (groqData?.text) {
		try {
			const match = groqData.text.trim().match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : groqData.text.trim());
			if (parsed?.emoji) emoji = parsed.emoji;
			if (Array.isArray(parsed?.bullets)) {
				bullets = parsed.bullets
					.map((b) => String(b).trim())
					.filter((b) => b.length > 3)
					.slice(0, 4);
			}
		} catch {
			// 파싱 실패 시 Tavily answer 문장 분리로 fallback
			if (tavilyData?.answer) {
				bullets = tavilyData.answer
					.split(/(?<=[.!?。])\s+/)
					.map((s) => s.trim())
					.filter((s) => s.length > 5)
					.slice(0, 4);
			}
		}
	}

	// Groq 완전 실패 시 뉴스 제목으로 최후 fallback
	if (bullets.length === 0 && newsItems.length > 0) {
		bullets = newsItems.map((n) => n.title).slice(0, 3);
	}

	// 문제 3 fix: Groq 응답 언어 검증.
	// 한국어 모드인데 bullets에 한글이 전혀 없으면(Tavily context가 영어라서 끌려간 경우)
	// Groq에 번역 재요청해서 한국어로 변환.
	if (isKo && bullets.length > 0) {
		const hasHangul = bullets.some((b) => _HANGUL.test(b));
		if (!hasHangul) {
			const translated = await invokeFunction("groq", {
				system: [
					"You translate English bullet points into natural, formal Korean.",
					"Return only valid JSON: an array of translated Korean strings.",
					"Preserve order and meaning. No code fences, no extra text.",
				].join("\n"),
				prompt: `Translate to Korean and return JSON only:\n${JSON.stringify(bullets)}`,
				temperature: 0.1,
			});
			if (translated?.text) {
				try {
					const match = translated.text.trim().match(/\[[\s\S]*\]/);
					const parsed = JSON.parse(match ? match[0] : translated.text.trim());
					if (Array.isArray(parsed) && parsed.length > 0) {
						const koBullets = parsed
							.map((b) => String(b).trim())
							.filter((b) => b.length > 3 && _HANGUL.test(b));
						if (koBullets.length > 0) bullets = koBullets.slice(0, 4);
					}
				} catch {
					/* translation parse failed — keep English bullets as last resort */
				}
			}
		}
	}

	// ─── Step 3: SmartWidgetContent 포맷으로 조합 ───────────────────
	const sections = [];

	if (bullets.length > 0) {
		sections.push({
			type: "summary",
			title: "Personalized Search",
			bullets,
		});
	}

	if (newsItems.length > 0) {
		sections.push({
			type: "news",
			title: isKo ? "관련 정보" : "Related Info",
			items: newsItems,
		});
	}

	if (sections.length === 0) return null;

	const now = new Date();
	const lastUpdated = isKo
		? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} 업데이트`
		: `Updated ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

	return { emoji, lastUpdated, sections };
}

/**
 * AI 최적화 To-do 생성 — 캘린더 일정 기반
 * @param {Array} calEvents - 오늘의 캘린더 일정 배열
 * @param {Array} existingTodos - 기존 Todo 배열
 * @returns {Array} AI가 추천하는 Todo 배열 [{ text, isFixed }]
 */
export async function generateAiTodo(calEvents = [], existingTodos = []) {
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
		const parsed = JSON.parse(data.text);
		if (Array.isArray(parsed)) {
			return parsed.slice(0, 5).map((item) => ({
				text: item.text || item,
				isFixed: false,
			}));
		}
	} catch {
		console.warn("AI Todo 파싱 실패:", data.text);
	}
	return [];
}

const DIARY_DATE_FORMATTER_KO = new Intl.DateTimeFormat("ko-KR", {
	year: "numeric",
	month: "long",
	day: "numeric",
});

const normalizeDiaryLineText = (value, fallback = "") => {
	const text = String(value || "").trim();
	if (!text || text === "(no title)") return fallback;
	return text.replace(/\s+/g, " ");
};

const formatDiaryDateLabel = (dateStr) => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime())
		? dateStr
		: DIARY_DATE_FORMATTER_KO.format(date);
};

const extractTimeLabel = (value) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	if (/^\d{2}:\d{2}$/.test(raw)) return raw;
	const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
	if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
	return "";
};

const buildDiaryEventLines = (events = []) =>
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

const buildDiaryCompletedTaskLines = (todos = []) =>
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
	scheduleLines = [],
	completedLines = [],
	wasActiveDay = false,
}) => {
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

const buildWeatherSummary = (weather) => {
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
	scheduleLines = [],
	completedLines = [],
	weather,
	memo = "",
	diaryAnswers = [],
	wasActiveDay = false,
}) => {
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
	scheduleLines = [],
	completedLines = [],
	summary,
}) =>
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
				scheduleSentence: (formattedDate, scheduleLines) =>
					`${formattedDate} included ${scheduleLines.join(", ")}.`,
				noScheduleSentence: (formattedDate) =>
					`${formattedDate} had no recorded schedule.`,
				completedSentence: (completedLines) =>
					`Completed items included ${completedLines.join(", ")}.`,
				noCompletedSentence: "No tasks were marked complete.",
				weatherSentence: (weatherSummary) =>
					`The weather note for the day was ${weatherSummary}.`,
				answerSentence: (answer) =>
					`The daily question response was "${answer}".`,
				memoSentence: (memoText) =>
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
				scheduleSentence: (formattedDate, scheduleLines) =>
					`${formattedDate}에는 ${scheduleLines.join(", ")} 일정이 있었다.`,
				noScheduleSentence: (formattedDate) =>
					`${formattedDate}에는 기록된 일정이 없었다.`,
				completedSentence: (completedLines) =>
					`완료한 일로는 ${completedLines.join(", ")}가 있었다.`,
				noCompletedSentence: "완료로 표시한 일은 없었다.",
				weatherSentence: (weatherSummary) =>
					`날씨 기록은 ${weatherSummary}였다.`,
				answerSentence: (answer) =>
					`하루 질문 답변에는 "${answer}"가 남아 있었다.`,
				memoSentence: (memoText) =>
					`Memo에는 "${memoText}"가 남아 있었다.`,
				inactiveSentence:
					"앱 접속 기록이 없어 자동 수집된 데이터만 정리했다.",
		};

const formatDiaryDateLabelForLanguage = (dateStr, language = "ko") => {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime())
		? dateStr
		: DIARY_DATE_FORMATTERS_V2[resolveDiaryLanguage(language)].format(date);
};

const buildDiaryEventLinesForLanguage = (events = [], language = "ko") => {
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
	todos = [],
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
	scheduleLines = [],
	completedLines = [],
	wasActiveDay = false,
	language = "ko",
}) => {
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
	scheduleLines = [],
	completedLines = [],
	weather,
	memo = "",
	diaryAnswers = [],
	wasActiveDay = false,
	language = "ko",
}) => {
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
	scheduleLines = [],
	completedLines = [],
	summary,
	language = "ko",
}) => {
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
	completedTodos = [],
	weather = null,
	trends = [],
	stocks = [],
	calEvents = [],
	diaryAnswers = [],
	memo = "",
	date = "",
	wasActiveDay = false,
	language = "ko",
	interests = [],
	briefingSnapshots = [],
	previousDayDiary = "",
	previousDayFeedback = "",
}) {
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

	// 시간대별 브리핑 스냅샷 요약 (최대 6개, 텍스트 앞 200자)
	const snapshotLines = Array.isArray(briefingSnapshots)
		? briefingSnapshots.slice(0, 6).map((s) => {
				const time = s.capturedAt
					? new Date(s.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
					: "";
				const text = (s.text || s.summary || "").slice(0, 200);
				return time ? `[${time}] ${text}` : text;
			})
		: [];

	const promptContext = {
		date: formattedDate,
		wasActiveDay,
		scheduleLines,
		completedLines,
		weather,
		stocks: Array.isArray(stocks) ? stocks.slice(0, 4) : [],
		trends: Array.isArray(trends) ? trends.slice(0, 5) : [],
		diaryAnswers: Array.isArray(diaryAnswers) ? diaryAnswers.slice(0, 3) : [],
		memo: normalizeDiaryLineText(memo),
		briefingText: snapshotLines.length > 0
			? snapshotLines.join("\n")
			: normalizeDiaryLineText(briefingText),
		previousDayDiary: normalizeDiaryLineText(previousDayDiary).slice(0, 400),
		previousDayFeedback: normalizeDiaryLineText(previousDayFeedback).slice(0, 200),
		interests: Array.isArray(interests)
			? interests.map((i) => (typeof i === "string" ? i : i?.keyword)).filter(Boolean).slice(0, 8)
			: [],
	};

	const systemPromptV2 = [
		"You are a diary assistant that summarizes a user's day from structured facts.",
		`Write the response in ${diaryCopy.targetLanguageName}.`,
		"Return exactly one JSON object and nothing else.",
		"Do not invent events, emotions, or conclusions that are not supported by the input.",
	].join("\n");

	const promptV2 = [
		`Write a diary title and summary for ${formattedDate}.`,
		`Write both fields in ${diaryCopy.targetLanguageName}.`,
		'Return JSON only in this shape: {"title":"...","summary":"..."}',
		"",
		"Rules:",
		"- Title should be short and symbolic, without exaggeration.",
		"- Summary should be 2 to 4 factual sentences.",
		"- The schedule and completed lists will already be shown separately, so connect the day naturally instead of repeating every bullet verbatim.",
		"- If memo exists, weave it in naturally as a factual note.",
		"- If the day was inactive, mention that naturally.",
		"- If user interests are listed and relevant data (trends, news, stocks) exists, briefly reference them naturally.",
		"- briefingText contains time-stamped briefing snapshots saved throughout the day — use them as the primary source for what actually happened.",
		"- If previousDayDiary is provided, write in a similar tone and style. If previousDayFeedback is provided, address those points in this entry.",
		"",
		"Input data:",
		JSON.stringify(promptContext, null, 2),
	].join("\n");

	const systemPrompt = [
		"당신은 사용자의 하루를 정리하는 일기 보조 AI입니다.",
		"반드시 JSON 객체 하나만 반환하세요.",
		"summary는 사실 기반으로만 쓰고, 감정 과장이나 추측은 금지합니다.",
		"title은 짧은 상징 문구로 작성하되 과장하지 마세요.",
	].join("\n");

	const prompt = [
		`${formattedDate}의 일기 제목과 요약을 작성하세요.`,
		"반드시 아래 형식의 JSON만 반환하세요.",
		'{"title":"...","summary":"..."}',
		"",
		"규칙:",
		"- title: 한국어 3~10자 내외의 짧은 상징 문구",
		"- summary: 한국어 2~4문장, 사실 기반",
		"- 일정 목록과 완료 목록은 앱에서 따로 보여주므로 summary는 흐름 정리에 집중",
		"- Memo가 있으면 사실 기반으로 한 문장 안에서 자연스럽게 반영 가능",
		"- 앱 미접속일이면 summary 안에 그 사실을 자연스럽게 한 문장으로 포함",
		"",
		"입력 데이터:",
		JSON.stringify(promptContext, null, 2),
	].join("\n");

	const data = await invokeFunction("groq", {
		prompt: promptV2,
		system: systemPromptV2,
	});

	if (data?.text) {
		try {
			const match = String(data.text).match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : data.text);
			const title = normalizeDiaryLineText(parsed?.title, fallbackTitle);
			const summary = normalizeDiaryLineText(parsed?.summary, fallbackSummary);

				return buildDiaryTextForLanguage({
					title,
					formattedDate,
					scheduleLines,
					completedLines,
					summary,
					language: resolvedLanguage,
				});
		} catch (error) {
			console.warn("AI Diary 파싱 실패:", error?.message || error);
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
	feedbackHistory = [],
	language = "ko",
}) {
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
	const rewritten = data?.text?.trim();
	return rewritten || originalDiary;
}

