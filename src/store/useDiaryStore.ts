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

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const hashPin = async (pin: string): Promise<string> => {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const isPlainPin = (value: unknown): boolean =>
	typeof value === "string" && /^\d{4}$/.test(value);

const getPinLockMode = (): string =>
	useSettingsStore.getState()?.pinLockMode ||
	load("mb_pin_lock_mode", DEFAULT_PIN_LOCK_MODE);

const getStoredPinExpiry = (): number | null => {
	const raw = load(PIN_AUTH_EXPIRES_AT_KEY, null);
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
};

const isPinExpiryValid = (expiresAt: number | null): boolean =>
	expiresAt !== null && Number.isFinite(expiresAt) && expiresAt > Date.now();

const clearPersistedPinSession = (): void => {
	save(PIN_AUTH_SESSION_KEY, false);
	save(PIN_AUTH_EXPIRES_AT_KEY, null);
};

const normalizeDateKey = (dateStr: string): string => {
	const parsed = parseDateString?.(dateStr);
	return parsed ? formatLocalDate(parsed) : dateStr;
};

interface DiaryFeedback {
	rating: "like" | "dislike" | null;
	history: { at: string; text: string }[];
	pendingRewrite: string | null;
	confirmedAt: string | null;
}

interface DiaryEntry {
	diary: string;
	aiGeneratedDiary: string;
	editedDiary: string;
	notes: string;
	memo: string;
	feedback: DiaryFeedback;
}

const normalizeFeedback = (fb: unknown): DiaryFeedback => {
	if (!fb || typeof fb !== "object") {
		return { rating: null, history: [], pendingRewrite: null, confirmedAt: null };
	}
	const f = fb as Record<string, unknown>;
	return {
		rating: (f.rating === "like" || f.rating === "dislike") ? f.rating : null,
		history: Array.isArray(f.history) ? (f.history as { at: string; text: string }[]) : [],
		pendingRewrite: typeof f.pendingRewrite === "string" ? f.pendingRewrite : null,
		confirmedAt: typeof f.confirmedAt === "string" ? f.confirmedAt : null,
	};
};

const normalizeEntry = (entry: unknown): DiaryEntry => {
	const safeEntry =
		entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
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
	} as DiaryEntry;
};

const saveEntriesLocally = (entries: Record<string, unknown>): Record<string, DiaryEntry> => {
	const normalizedEntries = Object.fromEntries(
		Object.entries(entries || {}).map(([dateStr, entry]) => [
			normalizeDateKey(dateStr),
			normalizeEntry(entry),
		]),
	);
	save(STORAGE_KEY, normalizedEntries);
	return normalizedEntries;
};

interface PinSessionState {
	isPinAuthenticated: boolean;
	pinAuthExpiresAt: number | null;
}

const buildInitialPinSessionState = (): PinSessionState => {
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

const getInitialEntries = (): Record<string, DiaryEntry> =>
	saveEntriesLocally(load(STORAGE_KEY, {}));

interface DiaryState {
	entries: Record<string, DiaryEntry>;
	diaryAnswers: Record<string, string[]>;
	todayQA: { question: string; answer: string }[];
	pinModalVisible: boolean;
	pinSet: boolean;
	isPinAuthenticated: boolean;
	pinAuthExpiresAt: number | null;

	setPinModalVisible: (visible: boolean) => void;
	setPIN: (pin: string) => Promise<void>;
	verifyPIN: (pin: string) => Promise<boolean>;
	clearPinAuth: () => void;
	refreshPinAuthState: () => boolean;
	applyPinLockMode: (pinLockMode: string) => void;
	resetPIN: () => void;
	clearPinSession: () => void;

	markActive: () => void;
	wasActiveOn: (dateStr: string) => boolean;
	getDiary: (dateStr: string) => DiaryEntry | null;
	saveGeneratedDiary: (dateStr: string, diaryText: string) => Promise<void>;
	saveDiary: (dateStr: string, diaryText: string) => Promise<void>;
	revertDiaryToGenerated: (dateStr: string) => Promise<void>;
	saveNotes: (dateStr: string, notesText: string) => Promise<void>;
	saveMemo: (dateStr: string, memoText: string) => Promise<void>;

	setFeedbackRating: (dateStr: string, rating: "like" | "dislike" | null) => void;
	applyFeedbackRewrite: (
		dateStr: string,
		feedbackText: string,
		language?: string,
	) => Promise<string>;
	confirmRewrite: (dateStr: string) => Promise<void>;
	discardPendingRewrite: (dateStr: string) => void;

	addAnswer: (dateStr: string, question: string, answer: string) => Promise<void>;
	fetchTodayQA: () => Promise<void>;
	fetchQAForDate: (dateStr: string) => Promise<{ question: string; answer: string }[]>;
	getAnswers: (dateStr: string) => string[];

	hydrateFromDB: () => Promise<void>;
	getDiaryDates: () => string[];

	getRecentMemoSummary: (opts: {
		beforeDate: string;
		days: number;
		limit: number;
		includeSameDate: boolean;
	}) => string;
}

export const useDiaryStore = create<DiaryState>()((set, get) => ({
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
		let storedPin = load<string | null>(PIN_KEY, null);
		if (!storedPin) return false;

		// 기존 평문 PIN 마이그레이션: 해시로 재저장
		if (isPlainPin(storedPin)) {
			storedPin = await hashPin(storedPin as string);
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

		const expiresAt = Date.now() + timeoutMs!;
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
			console.warn("Generated diary save to DB failed:", (error as Error)?.message);
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
			console.warn("Diary edit save to DB failed:", (error as Error)?.message);
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
			console.warn("Diary revert failed:", (error as Error)?.message);
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
			console.warn("Memo save to DB failed:", (error as Error)?.message);
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
		const newHistory: { at: string; text: string }[] = [
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
			console.warn("Confirm rewrite DB sync failed:", (e as Error)?.message);
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
		if (data) set({ todayQA: data as { question: string; answer: string }[] });
	},

	/** 특정 날짜의 Q&A 쌍을 user_qa 테이블에서 읽기 전용으로 조회 */
	fetchQAForDate: async (dateStr) => {
		if (!supabase) return [];
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];
		const { data } = await supabase
			.from("user_qa")
			.select("question, answer")
			.eq("user_id", user.id)
			.eq("asked_date", dateStr)
			.order("created_at", { ascending: true });
		return (data ?? []) as { question: string; answer: string }[];
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
				const diaryAnswers: Record<string, string[]> = {};
				for (const row of data as {
					date: string;
					diary_text: string | null;
					memo: string | null;
					answers: string[] | null;
				}[]) {
					entries[row.date] = normalizeEntry({
						diary: row.diary_text || entries[row.date]?.diary || "",
						memo: row.memo || entries[row.date]?.memo || "",
					});
					if (Array.isArray(row.answers) && row.answers.length > 0) {
						diaryAnswers[row.date] = row.answers;
					}
				}
				set({ entries, diaryAnswers });
				save(STORAGE_KEY, entries);
			}
		} catch (e) {
			console.warn("Diary hydrate failed:", (e as Error)?.message);
		}
	},

	getDiaryDates: () => {
		const entries = get().entries;
		return Object.keys(entries).filter((dateStr) => entries[dateStr]?.diary);
	},

	getRecentMemoSummary: ({ beforeDate, days, limit, includeSameDate }) => {
		const entries = get().entries;
		const cutoff = new Date(beforeDate);
		const results: string[] = [];

		for (const [dateStr, entry] of Object.entries(entries)) {
			const d = new Date(dateStr);
			const diffDays = (cutoff.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
			const isValid = includeSameDate
				? diffDays >= 0 && diffDays <= days
				: diffDays > 0 && diffDays <= days;
			if (isValid && entry?.memo) {
				results.push(`[${dateStr}] ${entry.memo}`);
			}
			if (results.length >= limit) break;
		}

		return results.join("\n");
	},
}));
