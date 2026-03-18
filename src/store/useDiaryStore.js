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
const ANSWERS_KEY = "mb_diary_answers";
const ACTIVE_KEY = "mb_last_access_date";

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useDiaryStore = create((set, get) => ({
	/* ── 상태 ── */
	entries: load(STORAGE_KEY, {}),             // { "2026-03-18": { diary: "...", memo: "..." } }
	diaryAnswers: load(ANSWERS_KEY, {}),        // { "2026-03-18": ["답변1", "답변2"] }
	wasActiveToday: load(ACTIVE_KEY, "") === todayStr(),

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

	/* ── DiaryCard 답변 관리 ── */
	/** 답변 추가 (DiaryCard에서 호출) */
	addAnswer: (dateStr, text) => {
		set((s) => {
			const answers = { ...s.diaryAnswers };
			if (!answers[dateStr]) answers[dateStr] = [];
			answers[dateStr] = [...answers[dateStr], text];
			save(ANSWERS_KEY, answers);
			return { diaryAnswers: answers };
		});
	},

	/** 특정 날짜의 답변 가져오기 */
	getAnswers: (dateStr) => {
		return get().diaryAnswers[dateStr] || [];
	},

	/* ── DB에서 일기 데이터 불러오기 ── */
	hydrateFromDB: async () => {
		if (!supabase) return;
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const { data } = await supabase
				.from("diaries")
				.select("date, diary_text, memo")
				.eq("user_id", user.id);

			if (data && data.length > 0) {
				const entries = { ...get().entries };
				for (const row of data) {
					entries[row.date] = {
						diary: row.diary_text || entries[row.date]?.diary || "",
						memo: row.memo || entries[row.date]?.memo || "",
					};
				}
				set({ entries });
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
