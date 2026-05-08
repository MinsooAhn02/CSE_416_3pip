import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { formatLocalDate, parseDateString } from "../utils/date";
import {
	DEFAULT_PIN_LOCK_MODE,
	getPinLockTimeoutMs,
	useSettingsStore,
} from "./useSettingsStore";

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
	pinModalVisible: false,

	pinSet: !!load(PIN_KEY, null),
	isPinAuthenticated: initialPinSessionState.isPinAuthenticated,
	pinAuthExpiresAt: initialPinSessionState.pinAuthExpiresAt,

	setPinModalVisible: (visible) => set({ pinModalVisible: visible }),

	setPIN: (pin) => {
		if (!/^\d{4}$/.test(pin)) {
			throw new Error("PIN must be exactly 4 digits");
		}
		save(PIN_KEY, pin);
		set({ pinSet: true });
	},

	verifyPIN: (pin) => {
		const storedPin = load(PIN_KEY, null);
		if (!storedPin) return false;

		const isCorrect = storedPin === pin;
		if (isCorrect) {
			const pinLockMode = getPinLockMode();

			if (pinLockMode === "off") {
				clearPersistedPinSession();
				set({ isPinAuthenticated: true, pinAuthExpiresAt: null });
				return true;
			}

			if (pinLockMode === "immediate") {
				clearPersistedPinSession();
				set({ isPinAuthenticated: true, pinAuthExpiresAt: null });
				return true;
			}

			const timeoutMs = getPinLockTimeoutMs(pinLockMode);
			const expiresAt = timeoutMs ? Date.now() + timeoutMs : null;
			save(PIN_AUTH_SESSION_KEY, true);
			save(PIN_AUTH_EXPIRES_AT_KEY, expiresAt);
			set({ isPinAuthenticated: true, pinAuthExpiresAt: expiresAt });
		}
		return isCorrect;
	},

	clearPinAuth: () => {
		clearPersistedPinSession();
		set({
			isPinAuthenticated: getPinLockMode() === "off",
			pinAuthExpiresAt: null,
		});
	},

	refreshPinAuthState: () => {
		const pinLockMode = getPinLockMode();

		if (pinLockMode === "off") {
			clearPersistedPinSession();
			if (!get().isPinAuthenticated || get().pinAuthExpiresAt !== null) {
				set({ isPinAuthenticated: true, pinAuthExpiresAt: null });
			}
			return true;
		}

		if (pinLockMode === "immediate") {
			clearPersistedPinSession();
			if (get().pinAuthExpiresAt !== null) {
				set({ pinAuthExpiresAt: null });
			}
			return !!get().isPinAuthenticated;
		}

		const expiresAt = getStoredPinExpiry() ?? get().pinAuthExpiresAt;
		if (isPinExpiryValid(expiresAt)) {
			if (
				!get().isPinAuthenticated ||
				get().pinAuthExpiresAt !== expiresAt
			) {
				set({ isPinAuthenticated: true, pinAuthExpiresAt: expiresAt });
			}
			return true;
		}

		clearPersistedPinSession();
		if (get().isPinAuthenticated || get().pinAuthExpiresAt !== null) {
			set({ isPinAuthenticated: false, pinAuthExpiresAt: null });
		}
		return false;
	},

	isPinAuthenticatedSession: () => {
		const pinLockMode = getPinLockMode();
		if (pinLockMode === "off") return true;
		if (pinLockMode === "immediate") return !!get().isPinAuthenticated;

		const expiresAt = getStoredPinExpiry() ?? get().pinAuthExpiresAt;
		return isPinExpiryValid(expiresAt);
	},

	applyPinLockMode: (pinLockMode) => {
		if (pinLockMode === "off") {
			clearPersistedPinSession();
			set({ isPinAuthenticated: true, pinAuthExpiresAt: null });
			return;
		}

		if (pinLockMode === "immediate") {
			clearPersistedPinSession();
			set({ pinAuthExpiresAt: null });
			return;
		}

		const timeoutMs = getPinLockTimeoutMs(pinLockMode);
		const shouldCarrySession = Boolean(
			get().pinSet && get().isPinAuthenticated && timeoutMs,
		);

		if (!shouldCarrySession) {
			clearPersistedPinSession();
			set({ isPinAuthenticated: false, pinAuthExpiresAt: null });
			return;
		}

		const expiresAt = Date.now() + timeoutMs;
		save(PIN_AUTH_SESSION_KEY, true);
		save(PIN_AUTH_EXPIRES_AT_KEY, expiresAt);
		set({ isPinAuthenticated: true, pinAuthExpiresAt: expiresAt });
	},

	resetPIN: () => {
		save(PIN_KEY, null);
		clearPersistedPinSession();
		set({
			pinSet: false,
			isPinAuthenticated: getPinLockMode() === "off",
			pinAuthExpiresAt: null,
		});
	},

	clearPinSession: () => {
		clearPersistedPinSession();
		set({
			isPinAuthenticated: getPinLockMode() === "off",
			pinAuthExpiresAt: null,
		});
	},

	markActive: () => {
		save(ACTIVE_KEY, todayStr());
		set({ wasActiveToday: true });
	},

	wasActiveOn: (dateStr) => {
		const lastAccess = load(ACTIVE_KEY, "");
		return lastAccess === dateStr;
	},

	getDiary: (dateStr) => get().entries[dateStr] || null,

	saveGeneratedDiary: async (dateStr, diaryText) => {
		set((state) => {
			const prevEntry = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prevEntry,
					diary: diaryText,
					aiGeneratedDiary: diaryText,
					editedDiary: "",
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		if (!supabase) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			await supabase.from("diaries").upsert(
				{
					user_id: user.id,
					date: dateStr,
					ai_generated_diary: diaryText,
					edited_diary: null,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id,date" },
			);
		} catch (error) {
			console.warn("Generated diary save to DB failed:", error?.message);
		}
	},

	saveDiary: async (dateStr, diaryText) => {
		const nextDiary = diaryText.trim();
		const currentEntry = normalizeEntry(get().entries[dateStr]);
		const originalDiary = currentEntry.aiGeneratedDiary || currentEntry.diary || "";
		const editedDiary = nextDiary === originalDiary ? "" : nextDiary;

		set((state) => {
			const prevEntry = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prevEntry,
					diary: editedDiary || originalDiary,
					aiGeneratedDiary: originalDiary,
					editedDiary,
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		if (!supabase) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			await supabase.from("diaries").upsert(
				{
					user_id: user.id,
					date: dateStr,
					edited_diary: editedDiary || null,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id,date" },
			);
		} catch (error) {
			console.warn("Diary edit save to DB failed:", error?.message);
		}
	},

	revertDiaryToGenerated: async (dateStr) => {
		const currentEntry = normalizeEntry(get().entries[dateStr]);
		const originalDiary = currentEntry.aiGeneratedDiary || "";

		set((state) => {
			const prevEntry = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prevEntry,
					diary: originalDiary,
					editedDiary: "",
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		if (!supabase) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			await supabase.from("diaries").upsert(
				{
					user_id: user.id,
					date: dateStr,
					edited_diary: null,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id,date" },
			);
		} catch (error) {
			console.warn("Diary revert failed:", error?.message);
		}
	},

	saveNotes: async (dateStr, notesText) => {
		set((state) => {
			const prevEntry = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prevEntry,
					notes: notesText,
					memo: notesText,
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		if (!supabase) return;

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			await supabase.from("diaries").upsert(
				{
					user_id: user.id,
					date: dateStr,
					memo: notesText,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id,date" },
			);
		} catch (error) {
			console.warn("Memo save to DB failed:", error?.message);
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
			const {
				data: { user },
			} = await supabase.auth.getUser();
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

	getDiaryDates: () => {
		const entries = get().entries;
		return Object.keys(entries).filter((dateStr) => entries[dateStr]?.diary);
	},
}));
