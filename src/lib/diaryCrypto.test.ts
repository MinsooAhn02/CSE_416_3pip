// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
	createDiaryEncryption, unlockDiaryKey, encryptText, decryptText, keyMatchesConfig,
	isEncryptedValue, isValidEncryptionConfig, WrongPassphraseError, DIARY_ENC_PREFIX,
	type DiaryEncryptionConfig,
} from "./diaryCrypto";

const ITER = 100_000;
const PASS = "correct horse battery";
const text = "오늘은 산책을 했다 🌿 Long day.";

let config: DiaryEncryptionConfig;
let key: CryptoKey;
let enc: string;

beforeAll(async () => {
	({ config, key } = await createDiaryEncryption(PASS, ITER));
	enc = await encryptText(key, text);
});

describe("diaryCrypto", () => {
	it("creates a valid config", () => {
		expect(isValidEncryptionConfig(config)).toBe(true);
	});

	it("round-trips Korean + emoji and hides plaintext", async () => {
		expect(enc.startsWith(DIARY_ENC_PREFIX)).toBe(true);
		expect(enc).not.toContain("산책");
		expect(await decryptText(key, enc)).toBe(text);
	});

	it("uses a random IV (same plaintext, different ciphertext)", async () => {
		expect(await encryptText(key, text)).not.toBe(enc);
	});

	it("empty string stays empty", async () => {
		expect(await encryptText(key, "")).toBe("");
	});

	it("passes plaintext through decrypt", async () => {
		expect(await decryptText(key, "plain legacy diary")).toBe("plain legacy diary");
		expect(isEncryptedValue("plain")).toBe(false);
		expect(isEncryptedValue(enc)).toBe(true);
		expect(isEncryptedValue(null)).toBe(false);
	});

	it("unlocks with the right passphrase", async () => {
		const key2 = await unlockDiaryKey(PASS, config);
		expect(await decryptText(key2, enc)).toBe(text);
		expect(await keyMatchesConfig(key2, config)).toBe(true);
	});

	it("rejects the wrong passphrase", async () => {
		await expect(unlockDiaryKey("wrong password!", config)).rejects.toBeInstanceOf(WrongPassphraseError);
	});

	it("a key from another config does not match or decrypt", async () => {
		const other = await createDiaryEncryption("another passphrase", ITER);
		expect(await keyMatchesConfig(other.key, config)).toBe(false);
		await expect(decryptText(other.key, enc)).rejects.toThrow();
	});

	it("detects tampering", async () => {
		const [, , iv, ct] = enc.split(":");
		const flipped = ct[5] === "A" ? "B" : "A";
		const tampered = `${DIARY_ENC_PREFIX}${iv}:${ct.slice(0, 5)}${flipped}${ct.slice(6)}`;
		await expect(decryptText(key, tampered)).rejects.toThrow();
	});

	it("rejects malformed ciphertext", async () => {
		await expect(decryptText(key, `${DIARY_ENC_PREFIX}broken`)).rejects.toThrow();
	});

	it("rejects short passphrases", async () => {
		await expect(createDiaryEncryption("short")).rejects.toThrow();
	});

	it("isValidEncryptionConfig rejects bad configs", () => {
		expect(isValidEncryptionConfig({ v: 1, salt: "x", iterations: 1000, verifier: config.verifier })).toBe(false);
		expect(isValidEncryptionConfig(null)).toBe(false);
		expect(isValidEncryptionConfig("x")).toBe(false);
		expect(isValidEncryptionConfig({})).toBe(false);
	});
});
