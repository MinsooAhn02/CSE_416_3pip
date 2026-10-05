/**
 * 일기 암호화 키·상태 공유 지점. useDiaryStore가 갱신하고, 다른 스토어(브리핑 기록·캐시, Q&A, 개인화)는
 * 여기서 읽어 순환 import 없이 암복호화한다. 키는 메모리에만 (영구 보관은 diaryCrypto의 IndexedDB).
 * 저장 형식: 텍스트 = "enc:v1:…", JSON 묶음 = { enc: "enc:v1:…" } (원래 JSON을 문자열로 암호화).
 */
import { decryptText, encryptText, isEncryptedValue } from "./diaryCrypto";

export type DiaryEncryptionStatus = "off" | "locked" | "unlocked";

let status: DiaryEncryptionStatus = "off";
let key: CryptoKey | null = null;

const listeners: Array<() => void> = [];
/** 상태가 바뀔 때마다 호출됨 — 예: 암호화가 켜지면 평문으로 남은 캐시를 지움 */
export const onDiaryKeyStateChange = (fn: () => void): void => {
	listeners.push(fn);
};

/** useDiaryStore 전용 — 상태가 바뀔 때마다 호출 */
export const setDiaryKeyState = (next: DiaryEncryptionStatus, nextKey: CryptoKey | null): void => {
	status = next;
	key = next === "unlocked" ? nextKey : null;
	for (const fn of listeners) fn();
};

export const getDiaryEncryptionStatus = (): DiaryEncryptionStatus => status;
/** 암호화가 켜져 있음 (잠김 포함) — 이때는 개인 데이터를 평문으로 저장·전송하면 안 됨 */
export const isEncryptionOn = (): boolean => status !== "off";
export const getDiaryKey = (): CryptoKey | null => (status === "unlocked" ? key : null);

export interface EncryptedBlob {
	enc: string;
}

export const isEncryptedBlob = (value: unknown): value is EncryptedBlob =>
	!!value && typeof value === "object" && isEncryptedValue((value as { enc?: unknown }).enc);

/** 암호화가 꺼져 있으면 그대로, 켜져 있고 해제 상태면 { enc }, 잠김이면 null (저장하지 말 것) */
export const sealJson = async <T>(value: T): Promise<T | EncryptedBlob | null> => {
	if (status === "off") return value;
	const k = getDiaryKey();
	if (!k) return null;
	return { enc: await encryptText(k, JSON.stringify(value)) };
};

/** { enc } 이면 복호화(키 없으면 null), 평문이면 그대로 */
export const openJson = async <T>(value: unknown): Promise<T | null> => {
	if (!isEncryptedBlob(value)) return value as T;
	const k = getDiaryKey();
	if (!k) return null;
	return JSON.parse(await decryptText(k, value.enc)) as T;
};

/** 텍스트 한 칸: 꺼짐 → 그대로, 해제 → 암호문, 잠김 → null (저장하지 말 것) */
export const sealText = async (text: string): Promise<string | null> => {
	if (status === "off" || !text) return text;
	const k = getDiaryKey();
	return k ? encryptText(k, text) : null;
};

/** 텍스트 한 칸: 평문 → 그대로, 암호문 → 복호화(키 없으면 "") */
export const openText = async (value: unknown): Promise<string> => {
	if (!isEncryptedValue(value)) return typeof value === "string" ? value : "";
	const k = getDiaryKey();
	return k ? decryptText(k, value) : "";
};
