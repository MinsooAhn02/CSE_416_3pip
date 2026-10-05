/**
 * 일기 종단간 암호화 (BACKLOG I5). 서버(Supabase)에는 암호문만 저장된다.
 * - 키: 사용자 비밀번호 → PBKDF2-SHA256(사용자별 salt) → AES-GCM 256, 추출 불가(non-extractable)
 * - 저장 형식: "enc:v1:<iv base64>:<ciphertext base64>" — 빈 문자열은 그대로 "" (내용 없음만 드러남)
 * - verifier: 알려진 문장을 암호화한 값. 비밀번호가 맞는지 서버에 아무것도 보내지 않고 확인.
 * - 이 기기 기억: 잠금 해제한 CryptoKey를 IndexedDB에 보관 (추출 불가라 원본 키 바이트는 꺼낼 수 없음).
 * 비밀번호를 잊으면 복구 불가 — 키를 서버가 갖고 있지 않으므로.
 */

export const DIARY_ENC_PREFIX = "enc:v1:";
const VERIFIER_PLAINTEXT = "morningbriefing-diary-verifier-v1";
const DEFAULT_ITERATIONS = 310_000; // OWASP 2023 권장치 (PBKDF2-SHA256)
export const MIN_PASSPHRASE_LENGTH = 8;

export interface DiaryEncryptionConfig {
	v: 1;
	salt: string; // base64
	iterations: number;
	verifier: string; // DIARY_ENC_PREFIX 형식
}

export class WrongPassphraseError extends Error {
	constructor() {
		super("wrong_passphrase");
		this.name = "WrongPassphraseError";
	}
}

const b64 = (bytes: Uint8Array): string => {
	let s = "";
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
	return btoa(s);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const isEncryptedValue = (value: unknown): value is string =>
	typeof value === "string" && value.startsWith(DIARY_ENC_PREFIX);

export const deriveDiaryKey = async (
	passphrase: string,
	saltB64: string,
	iterations: number,
): Promise<CryptoKey> => {
	const base = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations },
		base,
		{ name: "AES-GCM", length: 256 },
		false, // 추출 불가
		["encrypt", "decrypt"],
	);
};

export const encryptText = async (key: CryptoKey, text: string): Promise<string> => {
	if (!text) return "";
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
	return `${DIARY_ENC_PREFIX}${b64(iv)}:${b64(new Uint8Array(ct))}`;
};

/** 평문(암호화 전 데이터)은 그대로 반환. 키가 틀리거나 변조됐으면 throw. */
export const decryptText = async (key: CryptoKey, value: string): Promise<string> => {
	if (!isEncryptedValue(value)) return value;
	const [iv, ct] = value.slice(DIARY_ENC_PREFIX.length).split(":");
	if (!iv || !ct) throw new Error("malformed ciphertext");
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
	return new TextDecoder().decode(pt);
};

/** 새 비밀번호로 설정 생성 (켜기·비밀번호 변경). 반환된 key로 기존 일기를 다시 암호화. */
export const createDiaryEncryption = async (
	passphrase: string,
	iterations = DEFAULT_ITERATIONS,
): Promise<{ config: DiaryEncryptionConfig; key: CryptoKey }> => {
	if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error("passphrase_too_short");
	const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
	const key = await deriveDiaryKey(passphrase, salt, iterations);
	const verifier = await encryptText(key, VERIFIER_PLAINTEXT);
	return { config: { v: 1, salt, iterations, verifier }, key };
};

/** 비밀번호로 잠금 해제. 틀리면 WrongPassphraseError. */
export const unlockDiaryKey = async (
	passphrase: string,
	config: DiaryEncryptionConfig,
): Promise<CryptoKey> => {
	const key = await deriveDiaryKey(passphrase, config.salt, config.iterations);
	try {
		if ((await decryptText(key, config.verifier)) === VERIFIER_PLAINTEXT) return key;
	} catch {
		/* AES-GCM 인증 실패 = 틀린 키 */
	}
	throw new WrongPassphraseError();
};

/** IndexedDB에 저장된 키가 현재 설정(salt)과 맞는지 확인 — 다른 기기에서 비밀번호를 바꾼 경우 대비 */
export const keyMatchesConfig = async (key: CryptoKey, config: DiaryEncryptionConfig): Promise<boolean> => {
	try {
		return (await decryptText(key, config.verifier)) === VERIFIER_PLAINTEXT;
	} catch {
		return false;
	}
};

export const isValidEncryptionConfig = (value: unknown): value is DiaryEncryptionConfig => {
	const c = value as Partial<DiaryEncryptionConfig> | null;
	return !!c && c.v === 1 && typeof c.salt === "string" && typeof c.iterations === "number" &&
		c.iterations >= 100_000 && isEncryptedValue(c.verifier);
};

// ── 이 기기 기억 (IndexedDB, 사용자별) ──────────────────────────────
const IDB_NAME = "mb_diary_keys";
const IDB_STORE = "keys";

const openKeyDb = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

const idbRequest = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> =>
	openKeyDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(IDB_STORE, mode);
				const req = run(tx.objectStore(IDB_STORE));
				req.onsuccess = () => resolve(req.result as T);
				req.onerror = () => reject(req.error);
				tx.oncomplete = () => db.close();
			}),
	);

export const saveDeviceKey = (userId: string, key: CryptoKey): Promise<void> =>
	idbRequest<void>("readwrite", (s) => s.put(key, userId)).catch(() => undefined);

export const loadDeviceKey = (userId: string): Promise<CryptoKey | null> =>
	idbRequest<CryptoKey | undefined>("readonly", (s) => s.get(userId))
		.then((k) => k ?? null)
		.catch(() => null);

/** 로그아웃·계정 전환·암호화 끄기 때 호출 */
export const clearDeviceKeys = (): Promise<void> =>
	idbRequest<void>("readwrite", (s) => s.clear()).catch(() => undefined);
