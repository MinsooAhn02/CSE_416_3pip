import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { rewriteDiaryWithFeedback } from "../services/aiService";
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
const PIN_AUTH_EXPIRES_AT_KEY = "mb_diary_pin_auth_expires_at";

const todayStr = () => new Date().toISOString().slice(0, 10);

const hashPin = async (pin) => {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const isPlainPin = (value) => typeof value === "string" && /^\d{4}$/.test(value);

const getPinLockMode = () =>
	useSettingsStore.getState()?.pinLockMode ||
	load("mb_pin_lock_mode", DEFAULT_PIN_LOCK_MODE);

const getStoredPinExpiry = () => {
	const raw = load(PIN_AUTH_EXPIRES_AT_KEY, null);
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
};

const isPinExpiryValid = (expiresAt) =>
	Number.isFinite(expiresAt) && expiresAt > Date.now();

const clearPersistedPinSession = () => {
	save(PIN_AUTH_SESSION_KEY, false);
	save(PIN_AUTH_EXPIRES_AT_KEY, null);
};

const normalizeDateKey = (dateStr) => {
	const parsed = parseDateString?.(dateStr);
	return parsed ? formatLocalDate(parsed) : dateStr;
};

const normalizeFeedback = (fb) => {
	if (!fb || typeof fb !== "object") {
		return { rating: null, history: [], pendingRewrite: null, confirmedAt: null };
	}
	return {
		rating: fb.rating ?? null,
		history: Array.isArray(fb.history) ? fb.history : [],
		pendingRewrite: typeof fb.pendingRewrite === "string" ? fb.pendingRewrite : null,
		confirmedAt: fb.confirmedAt ?? null,
	};
};

const normalizeEntry = (entry) => {
	const safeEntry =
		entry && typeof entry === "object" ? entry : {};
	const diary = typeof safeEntry.diary === "string" ? safeEntry.diary : "";
	const aiGeneratedDiary =
		typeof safeEntry.aiGeneratedDiary === "string"
			? safeEntry.aiGeneratedDiary
			: diary;
	const editedDiary =
		typeof safeEntry.editedDiary === "string" ? safeEntry.editedDiary : "";
	const notes =
		typeof safeEntry.notes === "string"
			? safeEntry.notes
			: typeof safeEntry.memo === "string"
				? safeEntry.memo
				: "";

	return {
		...safeEntry,
		diary,
		aiGeneratedDiary,
		editedDiary,
		notes,
		memo: notes,
		feedback: normalizeFeedback(safeEntry.feedback),
	};
};

const saveEntriesLocally = (entries) => {
	const normalizedEntries = Object.fromEntries(
		Object.entries(entries || {}).map(([dateStr, entry]) => [
			normalizeDateKey(dateStr),
			normalizeEntry(entry),
		]),
	);
	save(STORAGE_KEY, normalizedEntries);
	return normalizedEntries;
};

const buildInitialPinSessionState = () => {
	const pinLockMode = getPinLockMode();

	if (pinLockMode === "off") {
		clearPersistedPinSession();
		return { isPinAuthenticated: true, pinAuthExpiresAt: null };
	}

	if (pinLockMode === "immediate") {
		return { isPinAuthenticated: false, pinAuthExpiresAt: null };
	}

	const isAuthed = load(PIN_AUTH_SESSION_KEY, false);
	const expiresAt = getStoredPinExpiry();
	if (isAuthed && isPinExpiryValid(expiresAt)) {
		return { isPinAuthenticated: true, pinAuthExpiresAt: expiresAt };
	}

	clearPersistedPinSession();
	return { isPinAuthenticated: false, pinAuthExpiresAt: null };
};

const initialPinSessionState = buildInitialPinSessionState();

const getInitialEntries = () => saveEntriesLocally(load(STORAGE_KEY, {}));

export const useDiaryStore = create((set, get) => ({
	/* ── 상태 ── */
	entries: getInitialEntries(),                // { "2026-03-18": { diary: "...", memo: "..." } }
	diaryAnswers: {},                            // { "2026-03-18": string[] } — DB에서 hydrate
	todayQA: [],                                // [{ question, answer }] — 오늘의 Q&A 답변
	pinModalVisible: false,

	pinSet: !!load(PIN_KEY, null),
	isPinAuthenticated: initialPinSessionState.isPinAuthenticated,
	pinAuthExpiresAt: initialPinSessionState.pinAuthExpiresAt,

	setPinModalVisible: (visible) => set({ pinModalVisible: visible }),

	setPIN: async (pin) => {
		if (!/^\d{4}$/.test(pin)) {
			throw new Error("PIN must be exactly 4 digits");
		}
		const hashed = await hashPin(pin);
		save(PIN_KEY, hashed);
		set({ pinSet: true });
	},

	verifyPIN: async (pin) => {
		let storedPin = load(PIN_KEY, null);
		if (!storedPin) return false;

		// 기존 평문 PIN 마이그레이션: 해시로 재저장
		if (isPlainPin(storedPin)) {
			storedPin = await hashPin(storedPin);
			save(PIN_KEY, storedPin);
		}

		const inputHash = await hashPin(pin);
		const isCorrect = storedPin === inputHash;
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

	saveMemo: async (dateStr, memoText) => {
		return get().saveNotes(dateStr, memoText);
	},

	/* ── Feedback / 재작성 ── */
	setFeedbackRating: (dateStr, rating) => {
		set((state) => {
			const prevEntry = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prevEntry,
					feedback: { ...normalizeFeedback(prevEntry.feedback), rating },
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});
	},

	applyFeedbackRewrite: async (dateStr, feedbackText, language = "ko") => {
		const entry = normalizeEntry(get().entries[dateStr]);
		const baseline = entry.aiGeneratedDiary || entry.diary || "";
		const prevFeedback = normalizeFeedback(entry.feedback);
		const newHistory = [
			...prevFeedback.history,
			{ at: new Date().toISOString(), text: feedbackText },
		];

		const rewritten = await rewriteDiaryWithFeedback({
			originalDiary: baseline,
			feedbackHistory: newHistory,
			language,
		});

		set((state) => {
			const prev = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prev,
					feedback: {
						...normalizeFeedback(prev.feedback),
						rating: "dislike",
						history: newHistory,
						pendingRewrite: rewritten,
					},
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		return rewritten;
	},

	confirmRewrite: async (dateStr) => {
		const entry = normalizeEntry(get().entries[dateStr]);
		const pending = entry.feedback?.pendingRewrite;
		if (!pending) return;

		set((state) => {
			const prev = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prev,
					diary: pending,
					editedDiary: pending,
					feedback: {
						...normalizeFeedback(prev.feedback),
						pendingRewrite: null,
						confirmedAt: new Date().toISOString(),
					},
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});

		if (!supabase) return;
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
			await supabase.from("diaries").upsert(
				{ user_id: user.id, date: dateStr, edited_diary: pending, updated_at: new Date().toISOString() },
				{ onConflict: "user_id,date" },
			);
		} catch (e) {
			console.warn("Confirm rewrite DB sync failed:", e?.message);
		}
	},

	discardPendingRewrite: (dateStr) => {
		set((state) => {
			const prev = normalizeEntry(state.entries[dateStr]);
			const entries = {
				...state.entries,
				[dateStr]: normalizeEntry({
					...prev,
					feedback: { ...normalizeFeedback(prev.feedback), pendingRewrite: null },
				}),
			};
			return { entries: saveEntriesLocally(entries) };
		});
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
