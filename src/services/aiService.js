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
	
	const contextWithPriority = {
		...(context ?? {}),
		timeProfile,
		topSignals,
		topSignalIds: topSignals.map((s) => s.id),
		formattedCalEvents,
		priorityOrder: priorityOrder || [],
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
			context?.persona?.memo
				? `- 사용자의 최근 Memo 성향도 참고: ${context.persona.memo}`
				: "",
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
		briefingText: normalizeDiaryLineText(briefingText),
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

