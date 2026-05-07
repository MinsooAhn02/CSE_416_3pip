import { supabase } from "../lib/supabase";

// fallback 질문 — Groq 실패 시 사용
const FALLBACK_QUESTIONS = [
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
];

// 탐색 주제 풀 — 매 호출마다 랜덤 1~2개 선택
const TOPIC_POOL = [
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
];

function pickTopics(previousQuestions, count = 2) {
	// 이미 물어본 질문에서 언급된 주제는 우선순위 낮춤 (단순 랜덤으로도 충분)
	const shuffled = [...TOPIC_POOL].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

function getDayOfWeekKo() {
	const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
	return days[new Date().getDay()];
}

/**
 * Groq로 현재 상황에 맞는 개인화 질문 1개 생성
 */
export async function generatePersonalizedQuestion({
	persona = "",
	city = "",
	weatherCondition = "",
	previousQuestions = [],
} = {}) {
	const dayOfWeek = getDayOfWeekKo();
	const isWeekend = ["토요일", "일요일"].includes(dayOfWeek);

	if (!supabase) {
		const unused = FALLBACK_QUESTIONS.filter((q) => !previousQuestions.includes(q));
		const pool = unused.length > 0 ? unused : FALLBACK_QUESTIONS;
		return pool[Math.floor(Math.random() * pool.length)];
	}

	const topics = pickTopics(previousQuestions);
	const contextParts = [
		`${isWeekend ? "주말" : "평일"} / ${dayOfWeek}`,
		city && weatherCondition ? `${city} (날씨: ${weatherCondition})` : city || weatherCondition || "",
	].filter(Boolean).join(", ");

	try {
		const data = await invokeFunction("groq", {
			system: [
				"당신은 상대방에게 과하지 않은 관심을 표현하며 대화를 시작하는 '다정한 대화 파트너'입니다.",
				"당신의 목적은 주어진 상황(날씨, 요일 등)에 어울리는 주제를 골라, 상대방이 편안하게 자신의 이야기를 꺼낼 수 있도록 돕는 질문을 만드는 것입니다.",
				"",
				"[핵심 원칙]",
				"1. 자연스러움: 기계적인 질문이 아니라, 친구에게 말을 건네는 듯한 분위기를 유지하세요.",
				"2. 부드러운 시작: 질문 바로 앞에 '날씨가 화창해서 그런지~', '벌써 목요일이라 그런지~' 처럼 상황을 활용한 부드러운 도입부를 한 문장 덧붙이세요.",
				"3. 간결성: 전체 문장은 두 문장 이내로 작성하세요.",
				"4. 출력 형식: 오직 질문 텍스트만 출력하세요. (번호, 따옴표, 설명 금지)",
				"",
				"[질문 스타일 예시]",
				"- 날씨가 정말 좋은데, 이런 날씨에 산책하면서 듣기 좋은 본인만의 플레이리스트가 있나요?",
				"- 벌써 목요일이네요, 이번 주말에 특별히 계획하고 계신 즐거운 일이 있으신가요?",
				"- 요즘 유튜브에서 우연히 본 영상 중에 기억에 남는 재미있는 주제가 있었나요?",
				"",
				"반드시 한국어 존댓말을 사용하고 물음표(?)로 끝내세요.",
			].join("\n"),
			prompt: [
				"[상황 정보]",
				`- 시간: ${contextParts}`,
				persona ? `- 사용자 정보: ${persona}` : "",
				"",
				`[탐색 대상]`,
				`- 주제: ${topics.join(" 또는 ")}`,
				previousQuestions.length > 0
					? `- 제외 대상 (이미 물어본 질문):\n${previousQuestions.map((q) => `  · ${q}`).join("\n")}`
					: "",
				"",
				`위 정보를 바탕으로 자연스러운 질문을 생성해주세요. 반드시 존댓말을 사용하고 물음표로 끝내주세요.`,
			]
				.filter(Boolean)
				.join("\n"),
			temperature: 0.8,
		});

		const q = data?.text?.trim().replace(/^["'\d.\s]+|["']+$/g, "");
		if (q && q.length > 3 && q.length < 100) return q;
	} catch {
		// fall through to fallback
	}

	// 이미 물어본 것 제외한 fallback
	const unused = FALLBACK_QUESTIONS.filter((q) => !previousQuestions.includes(q));
	const pool = unused.length > 0 ? unused : FALLBACK_QUESTIONS;
	return pool[Math.floor(Math.random() * pool.length)];
}

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const AI_TIMEOUT_MS = 15000;

const invokeFunction = async (name, body) => {
	if (!supabase) return null;
	const startedAt = Date.now();
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve({ __timeout: true }), AI_TIMEOUT_MS);
	});
	try {
		const result = await Promise.race([
			supabase.functions.invoke(name, { body }),
			timeoutPromise,
		]);
		if (result?.__timeout) {
			console.warn(`[ai] ${name} timed out after ${AI_TIMEOUT_MS}ms`);
			return null;
		}

		const { data, error } = result;
		if (error) throw error;
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
		}
		return data;
	} catch (error) {
		console.warn(`${name} function failed:`, error.message);
		if (DEBUG_FLOW) {
			console.warn(`[ai] ${name} failed in ${Date.now() - startedAt}ms`);
		}
		return null;
	}
};

const getTimeProfile = (date = new Date()) => {
	const hour = date.getHours();
	if (hour < 11) {
		return {
			mode: "morning",
			label: "아침",
			desc: "동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			weight: 1.2,
		};
	}
	if (hour >= 11 && hour <= 15) {
		return {
			mode: "lunch",
			label: "점심",
			desc: "메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			weight: 1.05,
		};
	}
	if (hour >= 18) {
		return {
			mode: "evening",
			label: "저녁",
			desc: "마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			weight: 1.15,
		};
	}
	return {
		mode: "day",
		label: "일반",
		desc: "핵심 변화와 남은 일정 중심",
		weight: 1,
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
		const Se = timeProfile.mode === "evening" ? 0.4 : 0.2;
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
		const Se = timeProfile.mode === "lunch" ? 0.3 : 0.12;
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
		const Se = timeProfile.mode === "evening" ? 0.22 : 0.1;
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

const localBriefingFallback = ({ topSignals, timeProfile }) => {
	if (!topSignals.length) {
		return "오늘도 좋은 하루 보내세요.\n중요한 변화는 아직 감지되지 않았어요.\n필요한 위젯을 켜고 새로고침해 최신 브리핑을 받아보세요.";
	}

	const lines = topSignals.map(
		(s) => `• ${s.title}: 핵심 변화를 우선 확인하세요.`,
	);
	while (lines.length < 3) {
		lines.push("• 지금 시점에 맞는 우선 작업부터 하나씩 처리해보세요.");
	}
	return [
		`${timeProfile.label} 브리핑입니다. ${timeProfile.desc}`,
		lines[0],
		lines[1],
	].join("\n");
};

/**
 * 캘린더 이벤트를 AI 프롬프트용 가독성 높은 문자열로 변환
 * @param {Array} calEvents - 캘린더 일정 배열
 * @returns {string} "HH:MM 제목, HH:MM 제목" 형식 문자열
 */
export function formatCalEventsForAI(calEvents = []) {
	if (!Array.isArray(calEvents) || calEvents.length === 0) {
		return "오늘 예정된 일정이 없습니다.";
	}
	return calEvents
		.slice()
		.sort((a, b) => new Date(a.start) - new Date(b.start))
		.map((e) => {
			const startDate = new Date(e.start);
			const time = startDate.toLocaleTimeString("ko-KR", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
			return `${time} ${e.title || e.summary || "일정"}`;
		})
		.join(", ");
}

/**
 * 시간대별 공식 인사말 반환
 * @returns {string} 시간대에 맞는 공식 인사말
 */
export function getTimeGreeting() {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) {
		return "안녕하세요. 상쾌한 아침입니다. 금일 예정된 일정과 주요 정보를 보고드립니다.";
	} else if (hour >= 12 && hour < 18) {
		return "안녕하세요. 활기찬 오후입니다. 현재 시각 기준 업데이트된 브리핑을 확인해 주십시오.";
	} else {
		return "안녕하세요. 편안한 저녁입니다. 금일 하루의 마무리 요약과 내일의 준비 사항입니다.";
	}
}

/**
 * 상세 브리핑 생성 (summary + detail 동시 반환)
 * @param {{ tone: string, length: string, context: object }} params
 * @returns {Promise<{ summary: string, detail: string } | null>}
 */
export async function generateDetailedBriefing({ tone, length, context, priorityOrder }) {
	const timeProfile = getTimeProfile();
	const topSignals = scoreSignals({ context: context ?? {}, timeProfile });

	// calEvents를 가독성 높은 문자열로 변환
	const formattedCalEvents = formatCalEventsForAI(context?.calEvents);

	// Build priority guidance for AI (REQ-US-006)
	const priorityGuidance = priorityOrder?.length > 0
		? `사용자가 다음 순서로 정보 우선순위를 설정했습니다: ${priorityOrder.join(" > ")}. 이 순서대로 정보를 강조하세요.`
		: "";

	// 개인화 관심 키워드 상위 10개
	const keywordInterests = Array.isArray(context?.keywordInterests)
		? context.keywordInterests : [];
	const topKeywords = keywordInterests.slice(0, 10).map((k) => k.keyword);
	const interestsGuidance = topKeywords.length > 0
		? `사용자의 최근 관심 키워드: ${topKeywords.join(", ")}. 관련 정보가 있으면 브리핑에 자연스럽게 반영하세요.`
		: "";

	const contextWithPriority = {
		...(context ?? {}),
		timeProfile,
		topSignals,
		topSignalIds: topSignals.map((s) => s.id),
		formattedCalEvents,
		priorityOrder: priorityOrder || [],
		topKeywords,
	};

	// Map length to actual line counts for summary
	const lengthConfig = {
		short: { summaryLines: 1, detailLines: "5~7" },
		medium: { summaryLines: 3, detailLines: "10~12" },
		long: { summaryLines: 5, detailLines: "15~20" },
	};
	const config = lengthConfig[length] || lengthConfig.medium;

	const prompt = [
		"당신은 사용자의 시간대별 대시보드 브리핑 AI입니다.",
		`톤: ${tone}`,
		`길이: ${length}`,
		`현재 모드: ${timeProfile.label} (${timeProfile.mode})`,
		`모드 가이드: ${timeProfile.desc}`,
		priorityGuidance ? `\n=== 우선순위 지침 ===\n${priorityGuidance}` : "",
		interestsGuidance ? `\n=== 개인화 관심사 ===\n${interestsGuidance}` : "",
		"",
		"=== 오늘의 일정 ===",
		formattedCalEvents,
		"",
		"=== 작업 지시 ===",
		"다음 JSON 형식으로 정확히 응답하세요:",
		`{ "summary": "${config.summaryLines}줄 요약 (각 문장은 마침표로 끝남)", "detail": "${config.detailLines}줄 상세 브리핑 (각 줄은 \\n으로 구분)" }`,
		"",
		`- summary: 핵심 정보를 정확히 ${config.summaryLines}개의 문장으로 요약 (각 문장은 마침표로 끝나는 완전한 문장)`,
		`- detail: 날씨, 일정, 트렌드, 증시, 주요 뉴스를 자연스럽게 포함한 ${config.detailLines}줄 상세 브리핑`,
		"- 공식적이고 정중한 어체 사용",
		"- JSON만 반환하고 다른 텍스트는 작성하지 마세요.",
		"",
		context?.yesterdayMemo
			? `사용자가 전날 남긴 메모를 참고하세요: "${context.yesterdayMemo}"`
			: "",
		"",
		"=== 컨텍스트 데이터 ===",
		JSON.stringify(contextWithPriority, null, 2),
	]
		.filter(Boolean)
		.join("\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: [
			"당신은 개인화된 브리핑 작성기입니다.",
			"반드시 유효한 JSON 형식으로만 응답하세요.",
			`summary는 정확히 ${config.summaryLines}개의 완전한 문장, detail은 ${config.detailLines}줄로 작성하세요.`,
			"공식적이고 정중한 한국어를 사용하세요.",
		].join("\n"),
	});

	if (!data?.text) {
		// 로컬 폴백
		const fallbackSummary = localBriefingFallback({ topSignals, timeProfile });
		return {
			summary: fallbackSummary,
			detail: [
				getTimeGreeting(),
				"",
				"현재 시스템에서 상세 브리핑을 생성하지 못했습니다.",
				"주요 정보를 간략히 안내드립니다.",
				"",
				formattedCalEvents !== "오늘 예정된 일정이 없습니다."
					? `📅 오늘의 일정: ${formattedCalEvents}`
					: "📅 오늘 예정된 일정이 없습니다.",
				"",
				topSignals.length > 0
					? `📊 주요 시그널: ${topSignals.map((s) => s.title).join(", ")}`
					: "",
				"",
				"새로고침 버튼을 눌러 다시 시도해 주십시오.",
			]
				.filter(Boolean)
				.join("\n"),
		};
	}

	try {
		const parsed = JSON.parse(data.text);
		if (parsed.summary && parsed.detail) {
			return {
				summary: String(parsed.summary),
				detail: String(parsed.detail),
			};
		}
	} catch {
		console.warn("AI 상세 브리핑 JSON 파싱 실패:", data.text);
	}

	// 파싱 실패 시 텍스트 그대로 사용
	const lines = String(data.text)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	
	return {
		summary: lines.slice(0, 3).join("\n") || "브리핑 요약을 생성하지 못했습니다.",
		detail: lines.join("\n") || "상세 브리핑을 생성하지 못했습니다.",
	};
}

export async function generateBriefing({ tone, length, context }) {
	const timeProfile = getTimeProfile();
	const topSignals = scoreSignals({ context: context ?? {}, timeProfile });
	const contextWithPriority = {
		...(context ?? {}),
		timeProfile,
		topSignals,
		topSignalIds: topSignals.map((s) => s.id),
	};

	const prompt = [
		"당신은 사용자의 시간대별 대시보드 브리핑 AI입니다.",
		`톤: ${tone}`,
		`길이: ${length}`,
		`현재 모드: ${timeProfile.label} (${timeProfile.mode})`,
		`모드 가이드: ${timeProfile.desc}`,
		"우선순위 상위 3개 시그널(topSignals)만 바탕으로 브리핑을 작성하세요.",
		"반드시 정확히 3줄로 작성하세요. 각 줄은 한 문장으로, 불릿/번호/제목 없이 작성하세요.",
		"응답은 순수 텍스트만 작성하세요.",
		// 전날 메모가 있으면 참고 지시 추가
		context?.yesterdayMemo
			? `사용자가 전날 남긴 메모를 참고하여 브리핑에 반영하세요:\n"${context.yesterdayMemo}"`
			: "",
		JSON.stringify(contextWithPriority, null, 2),
	]
		.filter(Boolean)
		.join("\n\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: [
			"당신은 개인화된 브리핑 작성기입니다.",
			"아침(11시 이전): 동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			"점심(11~15시): 메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			"저녁(18시 이후): 마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			"반드시 정확히 3줄, 한국어, 간결하게 작성하세요.",
		].join("\n"),
	});

	if (!data?.text) {
		return localBriefingFallback({ topSignals, timeProfile });
	}

	const lines = String(data.text)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 3);
	while (lines.length < 3) {
		lines.push("지금 우선순위가 높은 항목부터 짧게 정리해 처리해보세요.");
	}

	return lines.join("\n");
}

/**
 * 스마트 위젯 데이터 생성
 * 1단계: Groq → 키워드 핵심 포인트 3개 + 이모지 추출
 * 2단계: Tavily → 키워드 관련 최신 뉴스/정보 검색
 * 3단계: 두 결과를 SmartWidgetContent 포맷으로 조합
 */
export async function generateSmartWidgetData(keyword, context = {}) {
	// ─── Step 1: Groq 분석 ───────────────────────────────────────────
	const groqData = await invokeFunction("groq", {
		system: [
			"당신은 키워드 분석 전문가입니다.",
			"반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요.",
		].join("\n"),
		prompt: [
			`'${keyword}'에 대해 다음 JSON 형식으로 정확히 응답하세요:`,
			`{ "emoji": "관련 이모지 1개", "bullets": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"] }`,
			"- emoji: 키워드를 가장 잘 나타내는 이모지 1개",
			"- bullets: 현재 시점에서 '${keyword}'에 대해 알아야 할 핵심 포인트 3개 (각 1~2문장)",
			"- 한국어로 작성",
		].join("\n"),
		temperature: 0.5,
	});

	let emoji = "🔍";
	let bullets = [];

	if (groqData?.text) {
		try {
			const text = groqData.text.trim();
			const match = text.match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : text);
			if (parsed?.emoji) emoji = parsed.emoji;
			if (Array.isArray(parsed?.bullets)) bullets = parsed.bullets.slice(0, 3);
		} catch {
			// 파싱 실패 시 텍스트에서 추출 시도
			const lines = groqData.text
				.split("\n")
				.map((l) => l.replace(/^[-•*\d.]\s*/, "").trim())
				.filter((l) => l.length > 10)
				.slice(0, 3);
			bullets = lines;
		}
	}

	// ─── Step 2: Tavily 검색 ─────────────────────────────────────────
	const tavilyData = await invokeFunction("tavily", {
		query: `${keyword} 최신 정보 동향 뉴스`,
	});

	const newsItems = (tavilyData?.results ?? [])
		.slice(0, 5)
		.map((r) => {
			let source = r.url ?? "";
			try {
				source = new URL(r.url).hostname.replace(/^www\./, "");
			} catch {}
			return {
				title: r.title ?? r.url ?? "",
				url: r.url ?? "",
				source,
				time: "최근",
			};
		})
		.filter((r) => r.title);

	// ─── Step 3: SmartWidgetContent 포맷으로 조합 ───────────────────
	const sections = [];

	if (bullets.length > 0) {
		sections.push({
			type: "summary",
			title: "핵심 포인트",
			bullets,
		});
	}

	if (tavilyData?.answer) {
		sections.push({
			type: "summary",
			title: "AI 요약",
			bullets: [tavilyData.answer],
		});
	}

	if (newsItems.length > 0) {
		sections.push({
			type: "news",
			title: "관련 정보",
			items: newsItems,
		});
	}

	if (sections.length === 0) return null;

	const now = new Date();
	const lastUpdated = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} 업데이트`;

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

/**
 * AI 일기 자동 생성
 * @param {Object} params
 * @param {string} params.briefingText - 당일 AI 브리핑 (시나리오 A만)
 * @param {Array} params.completedTodos - 완료된 Todo 리스트 (시나리오 A만)
 * @param {Object} params.weather - 날씨 데이터
 * @param {Array} params.trends - 뉴스/트렌드 요약
 * @param {Array} params.stocks - 증시/환율 데이터
 * @param {Array} params.calEvents - 캘린더 일정
 * @param {Array} params.diaryAnswers - DiaryCard 질문 답변 (시나리오 A만)
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
	date = "",
	wasActiveDay = false,
}) {
	let prompt;

	// Factual-Only System Prompt (REQ-AJ-006)
	const FACTUAL_SYSTEM_PROMPT = [
		"당신은 사용자의 하루를 요약하는 객관적 일기 작성기입니다.",
		"",
		"=== 반드시 지켜야 할 규칙 ===",
		"1. 사실 기반 서술만 사용하세요 (예: '날씨: 23°C, 흐림', '회의 3건 완료', 'KOSPI +1.2%')",
		"2. 감정적 언어 금지: '기분 좋은', '놀라운', '실망스러운', '다행히', '아쉽게도' 등",
		"3. 비교/추측 금지: '평소와 달리', '아마도', '~일 것이다' 등",
		"4. 미사여구 금지: 인사말, 마무리 덕담, 응원 문구 등",
		"",
		"=== 올바른 예시 ===",
		"✓ '오전 9시 팀 스탠드업 미팅 참석. 날씨 18°C 맑음. KOSPI 2,450pt(+0.8%).'",
		"✓ '프로젝트 제안서 작성 완료. 오후 3시 클라이언트 미팅.'",
		"",
		"=== 잘못된 예시 ===",
		"✗ '오늘은 정말 알찬 하루였습니다.'",
		"✗ '날씨가 좋아서 기분이 상쾌했습니다.'",
		"✗ '내일도 좋은 하루 되세요!'",
	].join("\n");

	if (wasActiveDay) {
		// 시나리오 A: 풍부한 데이터 기반 일기
		prompt = [
			`${date}의 하루를 사실 기반으로 요약하세요.`,
			"",
			"=== [Macro Events] 거시적 사건 ===",
			weather ? `날씨: ${JSON.stringify(weather)}` : "",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			trends.length > 0 ? `뉴스 트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			"",
			"=== [Personal Records] 개인 활동 ===",
			completedTodos.length > 0
				? `완료한 할 일:\n${completedTodos.map((t) => `- ${t.text || t}`).join("\n")}`
				: "완료한 할 일: 없음",
			calEvents.length > 0
				? `일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "일정: 없음",
			diaryAnswers.length > 0
				? `Daily Question 답변:\n${diaryAnswers.join("\n")}`
				: "",
			"",
			"=== 출력 형식 ===",
			"[Macro Events] 섹션과 [Personal Records] 섹션으로 구분하여 작성하세요.",
			"각 섹션은 2-3문장으로 사실만 간결하게 서술하세요.",
		]
			.filter(Boolean)
			.join("\n");
	} else {
		// 시나리오 B: 사실 기반 간결 일기
		prompt = [
			`${date}에 있었던 사실을 기록하세요.`,
			"(사용자가 이 날 앱에 접속하지 않아 개인 활동 데이터가 없습니다.)",
			"",
			"=== [Macro Events] ===",
			weather ? `날씨: ${JSON.stringify(weather)}` : "날씨 정보 없음",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			trends.length > 0 ? `뉴스 트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			calEvents.length > 0
				? `예정된 일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "",
			"",
			"=== 출력 형식 ===",
			"2-3문장으로 Macro Events만 사실 기반으로 기록하세요.",
		]
			.filter(Boolean)
			.join("\n");
	}

	const data = await invokeFunction("groq", {
		prompt,
		system: FACTUAL_SYSTEM_PROMPT,
	});

	if (data?.text) {
		return String(data.text).trim();
	}

	// 로컬 fallback (also factual)
	const fallbackParts = [`[${date}]`];
	if (weather?.temp) fallbackParts.push(`날씨: ${weather.temp}°C`);
	if (calEvents.length > 0) fallbackParts.push(`일정: ${calEvents.length}건`);
	if (completedTodos.length > 0) fallbackParts.push(`완료: ${completedTodos.length}건`);
	if (!wasActiveDay) fallbackParts.push("앱 미접속");
	
	return fallbackParts.join(". ") + ".";
}

