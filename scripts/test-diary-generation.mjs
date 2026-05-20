/**
 * 일기 생성 로직 테스트 스크립트
 * 실행: node scripts/test-diary-generation.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// .env 파싱
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env");
const env = Object.fromEntries(
	readFileSync(envPath, "utf-8")
		.split("\n")
		.filter((l) => l.includes("=") && !l.startsWith("#"))
		.map((l) => {
			const idx = l.indexOf("=");
			return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
		})
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error("❌ VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 없음");
	process.exit(1);
}

// ── 테스트 데이터 ──────────────────────────────────────────
const TEST_DATE = "2026-05-20";
const FORMATTED_DATE = "5월 20일";

// 시간대별 브리핑 스냅샷 (3시간 간격)
const briefingSnapshots = [
	{ capturedAt: "2026-05-20T09:00:00.000Z", text: "오전 브리핑: 코스피 2,580 보합. 오늘 날씨 맑음, 최고 24도. 주요 뉴스: AI 반도체 수요 급증으로 관련주 강세." },
	{ capturedAt: "2026-05-20T12:00:00.000Z", text: "오후 브리핑: 점심 시간, 날씨 여전히 맑음. 트렌드: 여름 여행지 검색 급증. 테크 뉴스: 오픈AI 새 모델 발표 예정." },
	{ capturedAt: "2026-05-20T15:00:00.000Z", text: "오후 3시 브리핑: 나스닥 소폭 상승. 관심 종목 삼성전자 0.5% 상승. 트렌드: 건강 식단 관련 콘텐츠 인기." },
];

// 완료 할일
const completedLines = ["CSE 416 프로젝트 일기 생성 로직 개선", "팀 미팅 자료 준비"];

// 캘린더 일정
const scheduleLines = ["14:00 팀 미팅", "18:00 헬스장"];

// Q&A 답변
const diaryAnswers = [
	{ question: "오늘 가장 집중했던 일은?", answer: "일기 생성 AI 프롬프트 개선 작업" },
	{ question: "오늘 기분은 어땠나요?", answer: "생산적인 하루였어서 만족스러움" },
];

// 전날 일기 (스타일 참고용)
const previousDayDiary = `제목: 코드와 커피의 하루
날짜: 5월 19일

📅 오늘의 일정
- 13:00 수업

✅ 완료한 일
- 데이터베이스 설계 검토

📝 오늘의 기록
어제는 수업 후 데이터베이스 구조를 꼼꼼히 살펴봤다. 생각보다 복잡한 부분이 있었지만 팀원들과 함께 정리하면서 해결했다. 저녁엔 잠깐 산책도 했다.`;

// 전날 피드백 없음 → 스타일만 참고
const previousDayFeedback = "";

// 날씨
const weather = { condition: "맑음", temp: 24, city: "Seoul" };

// 트렌드
const trends = [
	{ title: "여름 여행지", summary: "여름 휴가 시즌 앞두고 국내외 여행지 검색 급증" },
	{ title: "AI 반도체", summary: "AI 수요 확대로 반도체 관련주 강세 지속" },
];

// 관심사
const interests = ["인공지능", "프로그래밍", "건강", "여행", "독서", "음악", "경제", "스포츠"];

// ── promptContext 빌드 (aiService.js 로직 그대로) ──────────
const snapshotLines = briefingSnapshots.slice(0, 6).map((s) => {
	const time = s.capturedAt
		? new Date(s.capturedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
		: "";
	const text = (s.text || s.summary || "").slice(0, 200);
	return time ? `[${time}] ${text}` : text;
});

const promptContext = {
	date: FORMATTED_DATE,
	wasActiveDay: true,
	scheduleLines,
	completedLines,
	weather,
	trends: trends.slice(0, 5),
	// stocks 없음 ← 제거된 것 확인
	diaryAnswers: diaryAnswers.slice(0, 3),
	memo: "",
	briefingText: snapshotLines.join("\n"),
	previousDayDiary: previousDayDiary.slice(0, 400),
	previousDayFeedback: previousDayFeedback.slice(0, 200),
	interests: interests.slice(0, 8),
};

// ── 프롬프트 구성 ───────────────────────────────────────────
const systemPrompt = [
	"당신은 사용자의 하루를 정리하는 일기 보조 AI입니다.",
	"반드시 한국어(한글)로만 모든 텍스트를 작성하세요.",
	"일본어, 중국어, 러시아어, 아랍어 등 다른 언어/문자는 절대 사용하지 마세요.",
	'날짜는 "5월 15일"처럼 숫자+한글 형식으로 표기하세요.',
	"반드시 JSON 객체 하나만 반환하세요.",
	"summary는 사실 기반으로만 쓰고, 추측이나 감정 과장은 금지합니다.",
].join("\n");

const userPrompt = [
	`${FORMATTED_DATE}의 일기 제목과 요약을 한국어로 작성하세요.`,
	"반드시 한국어(한글)만 사용하고 다른 언어 문자는 절대 사용하지 마세요.",
	'반드시 아래 형식의 JSON만 반환하세요: {"title":"...","summary":"..."}',
	"",
	"규칙:",
	"- title: 3~10자 내외의 짧은 상징 문구 (한국어)",
	"- summary: 한국어 2~4문장, 사실 기반",
	"- 일정 목록과 완료 목록은 앱에서 따로 보여주므로 summary는 흐름 정리에 집중",
	"- memo가 있으면 사실 기반으로 자연스럽게 반영",
	"- briefingText에 시간대별 브리핑 스냅샷이 있으면 이를 그날의 주요 내용으로 활용",
	"- previousDayDiary는 문체·톤·스타일 참고용입니다. 전날 사건이나 내용은 오늘 일기에 절대 포함하지 마세요.",
	"- 오늘 내용은 오직 입력 데이터(briefingText, completedLines, scheduleLines, diaryAnswers)에서만 가져오세요.",
	"- previousDayFeedback이 있으면 해당 선호도(포함·제외 항목 등)를 오늘 일기에 반영하세요.",
	"",
	"입력 데이터:",
	JSON.stringify(promptContext, null, 2),
].join("\n");

// ── Edge Function 호출 ──────────────────────────────────────
async function callGroq(prompt, system) {
	const res = await fetch(`${SUPABASE_URL}/functions/v1/groq`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
		},
		body: JSON.stringify({ prompt, system, temperature: 0.4 }),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
	return res.json();
}

// ── 최종 일기 포맷 빌드 ────────────────────────────────────
function buildDiaryText(title, summary) {
	const lines = [
		`제목: ${title}`,
		`날짜: ${FORMATTED_DATE}`,
		"",
		"📅 오늘의 일정",
		...(scheduleLines.length > 0 ? scheduleLines.map((l) => `- ${l}`) : ["- 일정 없음"]),
		"",
		"✅ 완료한 일",
		...(completedLines.length > 0 ? completedLines.map((l) => `- ${l}`) : ["- 완료한 일 없음"]),
		"",
		"📝 오늘의 기록",
		summary,
	];
	return lines.join("\n");
}

// ── 실행 ────────────────────────────────────────────────────
console.log("🔍 promptContext 검증:");
console.log("  - stocks 없음?", !("stocks" in promptContext) ? "✅" : "❌ stocks 있음!");
console.log("  - briefingText 있음?", promptContext.briefingText ? "✅" : "⚠️ 없음");
console.log("  - previousDayDiary 있음?", promptContext.previousDayDiary ? "✅" : "⚠️ 없음");
console.log("  - interests 개수:", promptContext.interests.length, interests.length <= 8 ? "✅" : "❌");
console.log("");
console.log("📤 Groq Edge Function 호출 중...\n");

try {
	const data = await callGroq(userPrompt, systemPrompt);
	const raw = data?.text?.trim() || "";

	// JSON 파싱
	const jsonMatch = raw.match(/\{[\s\S]*\}/);
	const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

	if (!parsed?.title || !parsed?.summary) {
		console.error("❌ JSON 파싱 실패. 원본 응답:", raw);
		process.exit(1);
	}

	console.log("✅ LLM 응답 성공\n");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log(buildDiaryText(parsed.title, parsed.summary));
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("\n📋 검증:");
	console.log("  - 전날 이벤트('수업', '데이터베이스') 포함 여부:",
		(parsed.summary.includes("수업") || parsed.summary.includes("데이터베이스"))
			? "❌ 전날 내용 혼입됨!"
			: "✅ 전날 내용 없음"
	);
	console.log("  - 주식 언급 여부:",
		(parsed.summary.includes("주식") || parsed.summary.includes("코스피") || parsed.summary.includes("나스닥"))
			? "⚠️ 주식 언급 있음 (briefingText에서 온 것인지 확인 필요)"
			: "✅ 주식 언급 없음"
	);
	console.log("  - 오늘 할일 반영:",
		parsed.summary.includes("프로젝트") || parsed.summary.includes("미팅") || parsed.summary.includes("프롬프트")
			? "✅ 오늘 내용 반영됨"
			: "⚠️ 오늘 내용 미반영"
	);
} catch (err) {
	console.error("❌ 오류:", err.message);
}
