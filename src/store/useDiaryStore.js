import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";

/**
 * useDiaryStore — 일기/메모/다이어리 답변 상태 관리
 *
 * entries: { [date]: { diary: string, memo: string } }
 * diaryAnswers: { [date]: string[] }  ← DiaryCard에서 이동
 * wasActiveToday: boolean ← 오늘 접속했는지 플래그
 */

const STORAGE_KEY = "mb_diary_entries";
const ACTIVE_KEY = "mb_last_access_date";
const PIN_KEY = "mb_diary_pin";
const PIN_AUTH_SESSION_KEY = "mb_diary_pin_auth";

const todayStr = () => new Date().toISOString().slice(0, 10);

const getInitialEntries = () => load(STORAGE_KEY, {});

export const useDiaryStore = create((set, get) => ({
	/* ── 상태 ── */
	entries: getInitialEntries(),                // { "2026-03-18": { diary: "...", memo: "..." } }
	diaryAnswers: {},                            // { "2026-03-18": string[] } — DB에서 hydrate
	todayQA: [],                                // [{ question, answer }] — 오늘의 Q&A 답변
	wasActiveToday: load(ACTIVE_KEY, "") === todayStr(),
	
	/* ── PIN Authentication State ── */
	pinSet: !!load(PIN_KEY, null),              // Whether a PIN has been set by user
	isPinAuthenticated: load(PIN_AUTH_SESSION_KEY, false), // Session-based auth state

	/* ── PIN Management ── */
	/**
	 * Initialize PIN on first use (or reset)
	 * @param {string} pin - 4-digit PIN
	 */
	setPIN: (pin) => {
		if (!/^\d{4}$/.test(pin)) {
			throw new Error("PIN must be exactly 4 digits");
		}
		save(PIN_KEY, pin);
		set({ pinSet: true });
	},

	/**
	 * Verify PIN and authenticate user
	 * @param {string} pin - 4-digit PIN to verify
	 * @returns {boolean} - true if PIN is correct
	 */
	verifyPIN: (pin) => {
		let storedPin = load(PIN_KEY, null);
		if (!storedPin) {
			// If no PIN is set, set this as the initial PIN
			get().setPIN(pin);
			storedPin = pin; // Use the newly set PIN for comparison
		}
		
		const isCorrect = storedPin === pin;
		if (isCorrect) {
			save(PIN_AUTH_SESSION_KEY, true);
			set({ isPinAuthenticated: true });
		}
		return isCorrect;
	},

	/**
	 * Clear PIN authentication for current session
	 */
	clearPinAuth: () => {
		save(PIN_AUTH_SESSION_KEY, false);
		set({ isPinAuthenticated: false });
	},

	/**
	 * Check if PIN is authenticated in current session
	 */
	isPinAuthenticatedSession: () => {
		return get().isPinAuthenticated;
	},

	/**
	 * Reset PIN (for account recovery)
	 */
	resetPIN: () => {
		save(PIN_KEY, null);
		save(PIN_AUTH_SESSION_KEY, false);
		set({ pinSet: false, isPinAuthenticated: false });
	},

	/**
	 * Clear PIN auth session WITHOUT resetting the PIN itself
	 * (Used when closing diary or switching dates)
	 */
	clearPinSession: () => {
		save(PIN_AUTH_SESSION_KEY, false);
		set({ isPinAuthenticated: false });
	},

	/* ── 접속 기록 ── */
	markActive: () => {
		save(ACTIVE_KEY, todayStr());
		set({ wasActiveToday: true });
	},

	/** 특정 날짜에 접속했었는지 확인 */
	wasActiveOn: (dateStr) => {
		// localStorage에  날짜별 접속 기록이 없으므로
		// 마지막 접속 날짜와 비교하여 판단
		const lastAccess = load(ACTIVE_KEY, "");
		return lastAccess === dateStr;
	},

	/* ── 일기 관리 ── */
	/** 특정 날짜의 일기를 가져옴 */
	getDiary: (dateStr) => {
		return get().entries[dateStr] || null;
	},

	/** AI가 생성한 일기를 저장 */
	saveDiary: async (dateStr, diaryText) => {
		set((s) => {
			const entries = {
				...s.entries,
				[dateStr]: { ...s.entries[dateStr], diary: diaryText },
			};
			save(STORAGE_KEY, entries);
			return { entries };
		});

		// Supabase DB 동기화 (가능한 경우)
		if (supabase) {
			try {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase.from("diaries").upsert({
						user_id: user.id,
						date: dateStr,
						diary_text: diaryText,
						updated_at: new Date().toISOString(),
					}, { onConflict: "user_id,date" });
				}
			} catch (e) {
				console.warn("Diary save to DB failed:", e?.message);
			}
		}
	},

	/* ── 메모 관리 ── */
	/** 특정 날짜의 메모를 저장 */
	saveMemo: async (dateStr, memoText) => {
		set((s) => {
			const entries = {
				...s.entries,
				[dateStr]: { ...s.entries[dateStr], memo: memoText },
			};
			save(STORAGE_KEY, entries);
			return { entries };
		});

		// Supabase DB 동기화 (가능한 경우)
		if (supabase) {
			try {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase.from("diaries").upsert({
						user_id: user.id,
						date: dateStr,
						memo: memoText,
						updated_at: new Date().toISOString(),
					}, { onConflict: "user_id,date" });
				}
			} catch (e) {
				console.warn("Memo save to DB failed:", e?.message);
			}
		}
	},

	/* ── DiaryCard Q&A 관리 (user_qa 테이블) ── */
	/** 질문+답변을 user_qa 테이블에 저장. 실패 시 에러 throw (UI에서 처리) */
	addAnswer: async (dateStr, question, answer) => {
		if (!supabase) throw new Error("Supabase not available");
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) throw new Error("Not authenticated");

		const { error } = await supabase.from("user_qa").insert({
			user_id: user.id,
			question,
			answer,
			asked_date: dateStr,
		});
		if (error) throw error;
		// 오늘 날짜이면 로컬 todayQA 상태도 즉시 업데이트
		if (dateStr === todayStr()) {
			set((s) => ({ todayQA: [...s.todayQA, { question, answer }] }));
		}
	},

	/** 오늘의 Q&A 답변을 user_qa 테이블에서 로드 */
	fetchTodayQA: async () => {
		if (!supabase) return;
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return;
		const { data } = await supabase
			.from("user_qa")
			.select("question, answer")
			.eq("user_id", user.id)
			.eq("asked_date", todayStr())
			.order("created_at", { ascending: true });
		if (data) set({ todayQA: data });
	},

	/** 특정 날짜의 답변 가져오기 (레거시 호환) */
	getAnswers: (dateStr) => {
		return get().diaryAnswers[dateStr] || [];
	},

	/* ── DB에서 일기 + 답변 불러오기 ── */
	hydrateFromDB: async () => {
		if (!supabase) return;
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const { data } = await supabase
				.from("diaries")
				.select("date, diary_text, memo, answers")
				.eq("user_id", user.id);

			if (data && data.length > 0) {
				const entries = { ...get().entries };
				const diaryAnswers = {};
				for (const row of data) {
					entries[row.date] = {
						diary: row.diary_text || entries[row.date]?.diary || "",
						memo: row.memo || entries[row.date]?.memo || "",
					};
					if (Array.isArray(row.answers) && row.answers.length > 0) {
						diaryAnswers[row.date] = row.answers;
					}
				}
				set({ entries, diaryAnswers });
				save(STORAGE_KEY, entries);
			}
		} catch (e) {
			console.warn("Diary hydrate failed:", e?.message);
		}
	},

	/** 일기가 있는 날짜 목록 반환 (캘린더 dot 표시용) */
	getDiaryDates: () => {
		const entries = get().entries;
		return Object.keys(entries).filter((d) => entries[d]?.diary);
	},
}));
