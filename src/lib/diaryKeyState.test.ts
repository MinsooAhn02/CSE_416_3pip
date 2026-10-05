// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDiaryEncryption } from "./diaryCrypto";

let key: CryptoKey;
beforeEach(async () => {
	vi.resetModules();
	if (!key) key = (await createDiaryEncryption("passphrase-123", 100_000)).key;
});
const load = () => import("./diaryKeyState");

describe("diaryKeyState", () => {
	it("defaults to off and passes everything through", async () => {
		const s = await load();
		expect(s.getDiaryEncryptionStatus()).toBe("off");
		expect(s.isEncryptionOn()).toBe(false);
		expect(s.getDiaryKey()).toBeNull();
		expect(await s.sealText("hi")).toBe("hi");
		expect(await s.sealJson({ a: 1 })).toEqual({ a: 1 });
		expect(await s.openText("hi")).toBe("hi");
		expect(await s.openJson({ a: 1 })).toEqual({ a: 1 });
	});

	it("unlocked: seals to enc:v1 / { enc } and opens back", async () => {
		const s = await load();
		s.setDiaryKeyState("unlocked", key);
		expect(s.getDiaryKey()).toBe(key);
		const t = await s.sealText("비밀 🌿");
		expect(t).toMatch(/^enc:v1:/);
		expect(t).not.toContain("비밀");
		expect(await s.openText(t)).toBe("비밀 🌿");
		const j = await s.sealJson({ a: [1, 2], b: "x" });
		expect(s.isEncryptedBlob(j)).toBe(true);
		expect(JSON.stringify(j)).not.toContain('"b"');
		expect(await s.openJson(j)).toEqual({ a: [1, 2], b: "x" });
		expect(await s.sealText("")).toBe("");
	});

	it("unlocked: plaintext values still pass through open*", async () => {
		const s = await load();
		s.setDiaryKeyState("unlocked", key);
		expect(await s.openText("legacy")).toBe("legacy");
		expect(await s.openJson({ plain: true })).toEqual({ plain: true });
	});

	it("locked: seal returns null (never plaintext), open of encrypted gives ''/null", async () => {
		const s = await load();
		s.setDiaryKeyState("unlocked", key);
		const t = await s.sealText("secret");
		const j = await s.sealJson({ s: 1 });
		s.setDiaryKeyState("locked", null);
		expect(s.isEncryptionOn()).toBe(true);
		expect(s.getDiaryKey()).toBeNull();
		expect(await s.sealText("secret")).toBeNull();
		expect(await s.sealJson({ s: 1 })).toBeNull();
		expect(await s.openText(t)).toBe("");
		expect(await s.openJson(j)).toBeNull();
		expect(await s.openJson({ plain: 1 })).toEqual({ plain: 1 });
	});

	it("getDiaryKey is null unless unlocked, even if a key is passed", async () => {
		const s = await load();
		s.setDiaryKeyState("locked", key);
		expect(s.getDiaryKey()).toBeNull();
		s.setDiaryKeyState("off", key);
		expect(s.getDiaryKey()).toBeNull();
	});

	it("openText returns '' for non-strings", async () => {
		const s = await load();
		expect(await s.openText(null)).toBe("");
		expect(await s.openText(42)).toBe("");
	});

	it("fires listeners on each state change", async () => {
		const s = await load();
		const fn = vi.fn();
		s.onDiaryKeyStateChange(fn);
		s.setDiaryKeyState("locked", null);
		s.setDiaryKeyState("unlocked", key);
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
