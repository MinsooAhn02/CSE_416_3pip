import { create } from "zustand";
import toast from "react-hot-toast";
import i18n from "../l10n/i18n";
import { handleApiError } from "../utils/errorHandler";
import { load, save, onClearUserData } from "../utils/storage";
import { supabase, getSessionUser } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import {
	clearDeviceKeys,
	createDiaryEncryption,
	decryptText,
	encryptText,
	isEncryptedValue,
	isValidEncryptionConfig,
	keyMatchesConfig,
	loadDeviceKey,
	saveDeviceKey,
	unlockDiaryKey,
	type DiaryEncryptionConfig,
} from "../lib/diaryCrypto";
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

const todayStr = (): string => formatLocalDate();

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

/* ── 종단간 암호화 (BACKLOG I5) ──
 * 키는 모듈 변수에만 둔다(zustand 상태·localStorage 금지). state.entries는 항상 평문이거나,
 * 잠금 상태에서는 텍스트가 전부 ""(날짜 키만 유지). 암호문("enc:v1:")은 state로 나오지 않는다. */
type EncryptionStatus = "off" | "locked" | "unlocked";
const ENC_CONFIG_KEY = "mb_diary_enc_config"; // 서버 설정의 로컬 사본 — 초기 상태(잠금)를 동기적으로 알기 위함

const loadCachedConfig = (): DiaryEncryptionConfig | null => {
	const c = load<unknown>(ENC_CONFIG_KEY, null);
	return isValidEncryptionConfig(c) ? c : null;
};

let encConfig: DiaryEncryptionConfig | null = loadCachedConfig();
let diaryKey: CryptoKey | null = null;
let migrating = false; // 켜기/끄기 중에는 일기 쓰기를 막음(행 변환과 경합 방지)

const normalizeAll = (entries: Record<string, unknown>): Record<string, DiaryEntry> =>
	Object.fromEntries(
		Object.entries(entries || {}).map(([dateStr, entry]) => [
			normalizeDateKey(dateStr),
			normalizeEntry(entry),
		]),
	);

/** 키가 있으면 복호화, 평문은 그대로. 암호문인데 키가 없거나 실패하면 "" (암호문을 밖으로 내보내지 않음) */
const decField = async (key: CryptoKey | null, value: string | null | undefined): Promise<string> => {
	if (!value) return "";
	if (!isEncryptedValue(value)) return value;
	if (!key) return "";
	try {
		return await decryptText(key, value);
	} catch (e) {
		console.warn("Diary decrypt failed:", (e as Error)?.message);
		return "";
	}
};

/** AI·개인화 등 외부 소비자용: 암호화 켜짐+잠김이면 "" */
export const decryptDiaryField = (value: string | null | undefined): Promise<string> =>
	decField(diaryKey, value);

const mapEntryText = async (
	e: DiaryEntry,
	fn: (s: string) => Promise<string>,
): Promise<DiaryEntry> => {
	const fb = e.feedback;
	return {
		...e,
		diary: await fn(e.diary),
		aiGeneratedDiary: await fn(e.aiGeneratedDiary),
		editedDiary: await fn(e.editedDiary),
		notes: await fn(e.notes),
		memo: await fn(e.memo),
		feedback: {
			...fb,
			history: await Promise.all(fb.history.map(async (h) => ({ ...h, text: await fn(h.text) }))),
			pendingRewrite: fb.pendingRewrite ? await fn(fb.pendingRewrite) : null,
		},
	};
};

const decryptEntries = async (
	raw: Record<string, unknown>,
	key: CryptoKey | null,
): Promise<Record<string, DiaryEntry>> =>
	Object.fromEntries(
		await Promise.all(
			Object.entries(raw || {}).map(async ([d, e]) => [
				normalizeDateKey(d),
				await mapEntryText(normalizeEntry(e), (s) => decField(key, s)),
			] as const),
		),
	);

let persistChain: Promise<void> = Promise.resolve();

/** 로컬 캐시 저장: 꺼짐=평문, 켜짐+해제=암호화(순서 보장), 잠김=저장 안 함(캐시의 암호문 보존) */
/** 로컬 캐시 저장. 암호화 중이면 비동기 — 켜기/끄기는 반환된 Promise를 기다림 */
const persistEntries = (entries: Record<string, DiaryEntry>): Promise<void> => {
	const status = useDiaryStore.getState().encryptionStatus;
	if (status === "locked") return Promise.resolve();
	if (status === "off") {
		save(STORAGE_KEY, entries);
		return Promise.resolve();
	}
	const key = diaryKey;
	if (!key) return Promise.resolve(); // 해제 상태인데 키가 없으면 평문으로 쓰지 않음
	persistChain = persistChain
		.then(async () => {
			const enc = Object.fromEntries(
				await Promise.all(
					Object.entries(entries).map(async ([d, e]) => [d, await mapEntryText(e, (s) => encryptText(key, s))] as const),
				),
			);
			// 그 사이 잠기거나 키가 바뀌었으면 버림
			if (diaryKey === key && useDiaryStore.getState().encryptionStatus === "unlocked") save(STORAGE_KEY, enc);
		})
		.catch((e) => void handleApiError(e, "diary:cache_encrypt"));
	return persistChain;
};

const saveEntriesLocally = (entries: Record<string, unknown>): Record<string, DiaryEntry> => {
	const normalizedEntries = normalizeAll(entries);
	persistEntries(normalizedEntries);
	return normalizedEntries;
};

/** 쓰기 전 확인: 켜기/끄기 중이거나 잠겨 있으면 거부 (잠금 중 평문 쓰기 금지) */
const assertWritable = (): void => {
	if (migrating) throw new Error("diary_busy");
	if (useDiaryStore.getState().encryptionStatus === "locked") {
		const e = new Error("diary_locked");
		handleApiError(e, "diary:locked");
		throw e;
	}
};

/** DB 쓰기용: 해제 상태면 비어있지 않은 텍스트 필드를 암호화 */
const sealFields = async <T extends Record<string, string | null>>(fields: T): Promise<T> => {
	if (useDiaryStore.getState().encryptionStatus !== "unlocked" || !diaryKey) return fields;
	const key = diaryKey;
	const out: Record<string, string | null> = {};
	for (const [k, v] of Object.entries(fields)) out[k] = v ? await encryptText(key, v) : v;
	return out as T;
};

const upsertDiaryFields = async (dateStr: string, fields: Record<string, string | null>): Promise<void> => {
	if (!supabase) return;
	const user = await getSessionUser();
	if (!user) return;
	await supabase.from("diaries").upsert(
		{ user_id: user.id, date: dateStr, ...(await sealFields(fields)), updated_at: new Date().toISOString() },
		{ onConflict: "user_id,date" },
	).throwOnError(); // 실패 시 호출부 catch로 — 조용한 실패 방지
};

interface DiaryRow {
	date: string;
	ai_generated_diary: string | null;
	edited_diary: string | null;
	memo: string | null;
	answers: unknown;
}

const fetchDiaryRows = async (userId: string): Promise<DiaryRow[]> => {
	if (!supabase) throw new Error("Supabase not available");
	const { data, error } = await supabase
		.from("diaries")
		.select("date, ai_generated_diary, edited_diary, memo, answers")
		.eq("user_id", userId);
	if (error) throw error;
	return (data ?? []) as DiaryRow[];
};

const decryptAnswers = async (key: CryptoKey | null, v: unknown): Promise<string[]> => {
	if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
	if (typeof v === "string" && v) {
		const plain = await decField(key, v);
		try {
			const a = plain ? JSON.parse(plain) : [];
			return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
		} catch {
			return [];
		}
	}
	return [];
};

/** DB 행을 (평문) 엔트리에 병합 — 기존 hydrate 병합 규칙 유지 */
const applyRows = async (
	base: Record<string, DiaryEntry>,
	rows: DiaryRow[],
	key: CryptoKey | null,
): Promise<{ entries: Record<string, DiaryEntry>; diaryAnswers: Record<string, string[]> }> => {
	const entries = { ...base };
	const diaryAnswers: Record<string, string[]> = {};
	for (const row of rows) {
		const prev = normalizeEntry(entries[row.date]);
		const aiGeneratedDiary = (await decField(key, row.ai_generated_diary)) || prev.aiGeneratedDiary;
		const editedDiary = (await decField(key, row.edited_diary)) || prev.editedDiary;
		// prev를 펼쳐 로컬 전용 필드(feedback 등)를 유지
		entries[row.date] = normalizeEntry({
			...prev,
			diary: editedDiary || aiGeneratedDiary || prev.diary,
			aiGeneratedDiary,
			editedDiary,
			memo: (await decField(key, row.memo)) || prev.memo || "",
		});
		const answers = await decryptAnswers(key, row.answers);
		if (answers.length > 0) diaryAnswers[row.date] = answers;
	}
	return { entries, diaryAnswers };
};

const upsertRowsInBatches = async (userId: string, rows: Record<string, unknown>[]): Promise<void> => {
	if (!supabase) throw new Error("Supabase not available");
	for (let i = 0; i < rows.length; i += 100) {
		await supabase
			.from("diaries")
			.upsert(rows.slice(i, i + 100).map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,date" })
			.throwOnError();
	}
};

const writeEncryptionConfig = async (userId: string, config: DiaryEncryptionConfig | null): Promise<void> => {
	if (!supabase) throw new Error("Supabase not available");
	await supabase
		.from("user_settings")
		.upsert({ id: userId, diary_encryption: config }, { onConflict: "id" })
		.throwOnError();
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

// 로컬 캐시가 암호문이면 state에는 ""로 (복호화는 hydrate/unlock에서). 되쓰지 않음 — 캐시의 암호문 보존
const getInitialEntries = (): Record<string, DiaryEntry> =>
	normalizeAll(
		JSON.parse(
			JSON.stringify(load(STORAGE_KEY, {})),
			(_k, v) => (isEncryptedValue(v) ? "" : v),
		),
	);

interface DiaryState {
	entries: Record<string, DiaryEntry>;
	diaryAnswers: Record<string, string[]>;
	todayQA: { question: string; answer: string }[];
	encryptionStatus: EncryptionStatus;
	unlockDiary: (passphrase: string) => Promise<void>;
	enableDiaryEncryption: (passphrase: string) => Promise<void>;
	disableDiaryEncryption: () => Promise<void>;
	forgetDiaryKeyOnThisDevice: () => Promise<void>;
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
	encryptionStatus: (encConfig && !isGuest() ? "locked" : "off") as EncryptionStatus,
	pinModalVisible: false,

	unlockDiary: async (passphrase) => {
		if (!encConfig) throw new Error("encryption_off");
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");
		const key = await unlockDiaryKey(passphrase, encConfig); // 틀리면 WrongPassphraseError
		await saveDeviceKey(user.id, key);
		diaryKey = key;
		let { entries, diaryAnswers } = {
			entries: await decryptEntries(load(STORAGE_KEY, {}), key),
			diaryAnswers: get().diaryAnswers,
		};
		try {
			if (supabase) ({ entries, diaryAnswers } = await applyRows(entries, await fetchDiaryRows(user.id), key));
		} catch (e) {
			handleApiError(e, "diary:unlock_fetch"); // 네트워크 실패해도 로컬 캐시로 해제는 성공
		}
		set({ entries, diaryAnswers, encryptionStatus: "unlocked" });
		persistEntries(entries);
	},

	enableDiaryEncryption: async (passphrase) => {
		if (isGuest() || !supabase) throw new Error("encryption_unavailable");
		if (get().encryptionStatus !== "off" || migrating) throw new Error("encryption_already_on");
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");
		migrating = true;
		try {
			const { config, key } = await createDiaryEncryption(passphrase);
			await saveDeviceKey(user.id, key);
			try {
				await writeEncryptionConfig(user.id, config); // 3) 설정 먼저 — 행은 평문이어도 읽히므로 중간 실패에 안전
			} catch (e) {
				await clearDeviceKeys();
				throw e;
			}
			diaryKey = key;
			encConfig = config;
			save(ENC_CONFIG_KEY, config);
			set({ encryptionStatus: "unlocked" });
			// 4) 모든 행 재암호화 + 레거시 diary_text 제거 (이미 암호문인 필드는 그대로)
			const seal = async (v: string | null) => (v && !isEncryptedValue(v) ? encryptText(key, v) : v);
			const rows = await fetchDiaryRows(user.id);
			const out: Record<string, unknown>[] = [];
			for (const r of rows) {
				const answers =
					Array.isArray(r.answers) && r.answers.length > 0
						? await encryptText(key, JSON.stringify(r.answers))
						: r.answers;
				out.push({
					date: r.date,
					ai_generated_diary: await seal(r.ai_generated_diary),
					edited_diary: await seal(r.edited_diary),
					memo: await seal(r.memo),
					answers,
					diary_text: null,
				});
			}
			await upsertRowsInBatches(user.id, out);
			await persistEntries(get().entries); // 5) 로컬 캐시 암호화 (완료까지 대기 — 평문이 남지 않게)
		} finally {
			migrating = false;
		}
	},

	disableDiaryEncryption: async () => {
		const key = diaryKey;
		if (get().encryptionStatus !== "unlocked" || !key || !supabase || migrating) throw new Error("diary_not_unlocked");
		const user = await getSessionUser();
		if (!user) throw new Error("Not authenticated");
		migrating = true;
		try {
			// 1) 전부 복호화(하나라도 실패하면 쓰기 전에 중단) → 평문 upsert
			const rows = await fetchDiaryRows(user.id);
			const dec = async (v: string | null) => (v && isEncryptedValue(v) ? decryptText(key, v) : v);
			const out: Record<string, unknown>[] = [];
			for (const r of rows) {
				out.push({
					date: r.date,
					ai_generated_diary: await dec(r.ai_generated_diary),
					edited_diary: await dec(r.edited_diary),
					memo: await dec(r.memo),
					answers: typeof r.answers === "string" && isEncryptedValue(r.answers)
						? await decryptAnswers(key, r.answers)
						: r.answers,
				});
			}
			await upsertRowsInBatches(user.id, out);
			// 2) 설정 해제 → 3) 기기 키 삭제, 로컬 평문
			await writeEncryptionConfig(user.id, null);
			diaryKey = null;
			encConfig = null;
			save(ENC_CONFIG_KEY, null);
			await clearDeviceKeys();
			set({ encryptionStatus: "off" });
			await persistEntries(get().entries);
		} finally {
			migrating = false;
		}
	},

	forgetDiaryKeyOnThisDevice: async () => {
		if (!encConfig) throw new Error("encryption_off");
		diaryKey = null;
		await clearDeviceKeys();
		const blank = normalizeAll(Object.fromEntries(Object.keys(get().entries).map((d) => [d, {}])));
		set({ entries: blank, diaryAnswers: {}, encryptionStatus: "locked" });
	},

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
		clearPersistedPinSession();
		const pinLockMode = getPinLockMode();
		set({
			pinSet: true,
			isPinAuthenticated: pinLockMode === "off",
			pinAuthExpiresAt: null,
		});
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
			set({ isPinAuthenticated: false, pinAuthExpiresAt: null });
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
		assertWritable();
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
			await upsertDiaryFields(dateStr, { ai_generated_diary: diaryText, edited_diary: null });
		} catch (error) {
			handleApiError(error, "diary:generated_save");
			toast.error(i18n.t("toast.diary_save_failed"), { id: "diary-save", duration: 5000 });
		}
	},

	saveDiary: async (dateStr, diaryText) => {
		assertWritable();
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
			await upsertDiaryFields(dateStr, { edited_diary: editedDiary || null });
		} catch (error) {
			handleApiError(error, "diary:edit_save");
			toast.error(i18n.t("toast.diary_save_failed"), { id: "diary-save", duration: 5000 });
		}
	},

	revertDiaryToGenerated: async (dateStr) => {
		assertWritable();
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
			await upsertDiaryFields(dateStr, { edited_diary: null });
		} catch (error) {
			handleApiError(error, "diary:revert");
			toast.error(i18n.t("toast.diary_save_failed"), { id: "diary-save", duration: 5000 });
		}
	},

	saveNotes: async (dateStr, notesText) => {
		assertWritable();
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
			await upsertDiaryFields(dateStr, { memo: notesText });
		} catch (error) {
			handleApiError(error, "diary:notes_save");
			toast.error(i18n.t("toast.diary_save_failed"), { id: "diary-save", duration: 5000 });
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
		assertWritable(); // 잠김이면 baseline이 비어 AI 호출만 낭비
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
		assertWritable();
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
			await upsertDiaryFields(dateStr, { edited_diary: pending });
		} catch (e) {
			handleApiError(e, "diary:rewrite_confirm");
			toast.error(i18n.t("toast.diary_save_failed"), { id: "diary-save", duration: 5000 });
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
		const user = await getSessionUser();
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
		const user = await getSessionUser();
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
		const user = await getSessionUser();
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
		if (!supabase || isGuest() || migrating) return;

		try {
			const user = await getSessionUser();
			if (!user) return;

			// 암호화 설정(서버) → 상태 결정: 설정 없음=off, 있음+기기 키 일치=unlocked, 아니면 locked
			const { data: st, error: stErr } = await supabase
				.from("user_settings")
				.select("diary_encryption")
				.eq("id", user.id)
				.maybeSingle();
			if (stErr) throw stErr;
			const rawCfg = (st as { diary_encryption?: unknown } | null)?.diary_encryption ?? null;
			if (rawCfg !== null && !isValidEncryptionConfig(rawCfg)) {
				set({ encryptionStatus: "locked" }); // 알 수 없는 설정 — 평문 쓰기 방지를 위해 잠금 유지
				return;
			}
			const cfg = rawCfg as DiaryEncryptionConfig | null;
			const prevStatus = get().encryptionStatus;
			if (cfg) {
				if (!(diaryKey && (await keyMatchesConfig(diaryKey, cfg)))) {
					const k = await loadDeviceKey(user.id);
					diaryKey = k && (await keyMatchesConfig(k, cfg)) ? k : null;
				}
			} else {
				diaryKey = null;
			}
			encConfig = cfg;
			save(ENC_CONFIG_KEY, cfg);
			const status: EncryptionStatus = !cfg ? "off" : diaryKey ? "unlocked" : "locked";

			// 방금 해제된 경우 state는 비어 있으므로 로컬 캐시(암호문)를 복호화해 기반으로 사용
			const base =
				status === "unlocked" && prevStatus !== "unlocked"
					? await decryptEntries(load(STORAGE_KEY, {}), diaryKey)
					: status === "locked" && prevStatus === "unlocked"
						? normalizeAll(Object.fromEntries(Object.keys(get().entries).map((d) => [d, {}])))
						: get().entries;

			// 쓰기 경로(saveGeneratedDiary/saveDiary)와 같은 컬럼을 읽음. diary_text는 레거시 (백필 완료)
			const rows = await fetchDiaryRows(user.id);
			const merged = await applyRows(base, rows, status === "locked" ? null : diaryKey);
			const entries = rows.length > 0 ? merged.entries : base;
			set({
				entries,
				diaryAnswers: rows.length > 0 ? merged.diaryAnswers : get().diaryAnswers,
				encryptionStatus: status,
			});
			persistEntries(entries);
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

// 로그아웃·계정 전환(storage.clearUserData) 시 메모리의 키·설정도 폐기 (import 순환 방지용 콜백 등록)
onClearUserData(() => {
	diaryKey = null;
	encConfig = null;
	useDiaryStore.setState({ entries: {}, diaryAnswers: {}, encryptionStatus: "off" });
});
