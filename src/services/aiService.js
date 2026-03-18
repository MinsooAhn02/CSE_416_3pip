import { supabase } from "../lib/supabase";

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
		restaurants,
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

	if (activeSet.has("restaurants") && Array.isArray(restaurants)) {
		const R = clamp(restaurants.length / 5, 0.1, 1.1);
		const Kmatch = ["점심", "식단", "음식", "푸드"].some((k) =>
			personaText.includes(k),
		)
			? 1.18
			: 1;
		const wPersona = 1.02;
		const U = timeProfile.mode === "lunch" ? 1 : 0.2;
		const Se = timeProfile.mode === "lunch" ? 0.45 : 0.08;
		pushSignal({
			id: "restaurants",
			title: "메뉴/맛집 추천",
			payload: restaurants.slice(0, 4),
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

export async function generateSmartWidgetData(keyword, context = {}) {
	const data = await invokeFunction("smart-widget", {
		keyword,
		...context,
	});
	return data ?? null;
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

	if (wasActiveDay) {
		// 시나리오 A: 풍부한 데이터 기반 일기
		prompt = [
			`${date}의 하루를 요약하는 일기를 작성해 주세요.`,
			"",
			"=== 사용자 활동 데이터 ===",
			briefingText ? `AI 브리핑:\n${briefingText}` : "",
			completedTodos.length > 0
				? `완료한 할 일:\n${completedTodos.map((t) => `- ${t.text || t}`).join("\n")}`
				: "",
			diaryAnswers.length > 0
				? `사용자 답변:\n${diaryAnswers.join("\n")}`
				: "",
			"",
			"=== 당일 사실 데이터 ===",
			weather ? `날씨: ${JSON.stringify(weather)}` : "",
			trends.length > 0 ? `트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			calEvents.length > 0
				? `일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "",
			"",
			"규칙:",
			"- 3~5문장으로 따뜻하고 회고적인 톤으로 작성하세요.",
			"- 한국어로 작성하세요.",
			"- 거시적 사건과 개인 활동을 자연스럽게 엮어 주세요.",
		]
			.filter(Boolean)
			.join("\n");
	} else {
		// 시나리오 B: 사실 기반 간결 일기
		prompt = [
			`${date}에 있었던 사실을 간결히 기록해 주세요.`,
			"(사용자가 이 날 앱에 접속하지 않아 개인 활동 데이터가 없습니다.)",
			"",
			weather ? `날씨: ${JSON.stringify(weather)}` : "",
			trends.length > 0 ? `트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			calEvents.length > 0
				? `일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "",
			"",
			"규칙:",
			"- 2~3문장으로 사실만 간결하게 기록하세요.",
			"- 한국어로 작성하세요.",
		]
			.filter(Boolean)
			.join("\n");
	}

	const data = await invokeFunction("groq", {
		prompt,
		system: "사용자의 하루를 요약하는 일기를 작성하는 AI입니다. 따뜻하고 자연스러운 한국어로 작성하세요.",
	});

	if (data?.text) {
		return String(data.text).trim();
	}

	// 로컬 fallback
	return wasActiveDay
		? `${date}, 바쁜 하루였습니다. 캘린더에 ${calEvents.length}개의 일정이 있었고, 할 일을 마무리했습니다.`
		: `${date}, 앱에 접속하지 않은 날이었습니다.${calEvents.length > 0 ? ` 캘린더에 ${calEvents.length}개의 일정이 있었습니다.` : ""}`;
}

