import { isGuest } from "../lib/guest";

export const load = <T>(k: string, fb: T): T => {
	try {
		const v = localStorage.getItem(k);
		return v !== null ? (JSON.parse(v) as T) : fb;
	} catch {
		return fb;
	}
};

// 둘러보기(게스트) 중에는 어떤 mb_ 키도 쓰지 않음 — 샘플 데이터·게스트 조작이
// 같은 브라우저의 실제 사용자 데이터에 섞이지 않게 (언어 설정·auth 세션은 별도 경로)
export const save = (k: string, v: unknown): void => {
	if (isGuest()) return;
	localStorage.setItem(k, JSON.stringify(v));
};

/**
 * 계정에 속한 로컬 데이터 키. 로그아웃하거나 다른 계정으로 로그인하면 지움
 * (공용 PC에서 다음 사람이 이전 사람의 일기·브리핑·일정을 보지 않게 — BACKLOG A8).
 * 테마·글꼴·레이아웃 같은 기기 설정은 남김.
 */
const USER_DATA_KEYS = [
	"mb_diary_entries",
	"mb_diary_pin", // 이전 사용자의 PIN으로 다음 사용자가 잠기지 않게
	"mb_diary_pin_auth",
	"mb_diary_pin_auth_expires_at",
	"mb_briefing_cache",
	"mb_briefing_history",
	"mb_daily_question",
	"mb_last_briefing_shown",
	"mb_last_synthesis_date",
	"mb_last_access_date",
	"mb_todos",
	"mb_task_last_reset",
	"mb_calendar_events",
	"mb_google_tasks",
	"mb_smart",
	"mb_smart_data",
	"mb_smart_categories",
	"mb_last_fetched_at",
	"mb_last_access_time",
];
const USER_DATA_PREFIXES = ["mb_cache_"]; // 날씨·일정·건강·주식 등 API 응답 캐시

export const LAST_USER_KEY = "mb_last_user_id";

export const clearUserData = (): void => {
	for (const k of USER_DATA_KEYS) localStorage.removeItem(k);
	for (const k of Object.keys(localStorage)) {
		if (USER_DATA_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
	}
};
