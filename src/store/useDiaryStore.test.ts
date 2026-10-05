import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../test/fakeSupabase";

type Row = Record<string, unknown>;
const PASS = "correct horse battery";
const D1 = "2026-10-01";
const ENC = "enc:v1:";
const PLAINTEXTS = ["SECRET-ai", "SECRET-edit", "SECRET-memo", "SECRET-answer-1", "SECRET-question", "SECRET-qa-answer", "SECRET-snap"];

const seedRows = (): Record<string, Row[]> => ({
	diaries: [
		{ id: "d1", user_id: "u1", date: D1, ai_generated_diary: "SECRET-ai", edited_diary: "SECRET-edit", memo: "SECRET-memo", answers: ["SECRET-answer-1"], diary_text: "legacy" },
		{ id: "d2", user_id: "u1", date: "2026-10-02", ai_generated_diary: "second ai", edited_diary: "", memo: "", answers: [], diary_text: null },
	],
	user_qa: [{ id: "q1", user_id: "u1", asked_date: D1, question: "SECRET-question", answer: "SECRET-qa-answer", created_at: "1" }],
	briefing_snapshots: [{ id: "s1", user_id: "u1", date: D1, captured_at: "x", source: "auto", payload: { text: "SECRET-snap", summary: "", sections: [] } }],
	user_settings: [{ id: "u1", diary_encryption: null }],
});

// Real WebCrypto; the IndexedDB key helpers (absent in jsdom) are replaced by an in-memory Map.
const setup = async (seed: Record<string, Row[]> = seedRows(), opts: { config?: unknown; localEntries?: unknown } = {}) => {
	vi.resetModules();
	const fake = createFakeSupabase(seed);
	const deviceKeys = new Map<string, CryptoKey>();
	vi.doMock("../lib/supabase", () => ({ supabase: fake.client, getSessionUser: async () => ({ id: "u1" }) }));
	vi.doMock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
	vi.doMock("../services/aiService", () => ({ rewriteDiaryWithFeedback: vi.fn() }));
	vi.doMock("../lib/diaryCrypto", async () => ({
		...(await vi.importActual<typeof import("../lib/diaryCrypto")>("../lib/diaryCrypto")),
		saveDeviceKey: async (u: string, k: CryptoKey) => void deviceKeys.set(u, k),
		loadDeviceKey: async (u: string) => deviceKeys.get(u) ?? null,
		clearDeviceKeys: async () => deviceKeys.clear(),
	}));
	if (opts.config) localStorage.setItem("mb_diary_enc_config", JSON.stringify(opts.config));
	if (opts.localEntries) localStorage.setItem("mb_diary_entries", JSON.stringify(opts.localEntries));
	const { useDiaryStore: store } = await import("./useDiaryStore");
	return { fake, store, deviceKeys };
};
const flush = () => new Promise((r) => setTimeout(r, 30));
const dump = (v: unknown) => JSON.stringify(v);

/** A locked store: config cached in localStorage, no device key; DB/local cache hold ciphertext for D1. */
const lockedSetup = async () => {
	const crypto = await import("../lib/diaryCrypto");
	const { config, key } = await crypto.createDiaryEncryption(PASS, 100_000);
	const e = (s: string) => crypto.encryptText(key, s);
	const seed: Record<string, Row[]> = {
		diaries: [{ id: "d1", user_id: "u1", date: D1, ai_generated_diary: await e("SECRET-ai"), edited_diary: "", memo: await e("SECRET-memo"), answers: [] }],
		user_qa: [],
		user_settings: [{ id: "u1", diary_encryption: config }],
	};
	const entry = { diary: await e("SECRET-ai"), aiGeneratedDiary: await e("SECRET-ai"), editedDiary: "", notes: await e("SECRET-memo"), memo: await e("SECRET-memo") };
	return setup(seed, { config, localEntries: { [D1]: entry } });
};

beforeEach(() => localStorage.clear());

describe("enable / disable encryption", () => {
	it("enable encrypts every server field and the local cache; state stays plaintext", async () => {
		const { fake, store } = await setup(seedRows(), { localEntries: { [D1]: { diary: "SECRET-ai", memo: "SECRET-memo", notes: "SECRET-memo" } } });
		await store.getState().enableDiaryEncryption(PASS); // default 310k iterations
		await flush();

		const [d1, d2] = fake.db.diaries;
		for (const f of ["ai_generated_diary", "edited_diary", "memo"]) expect(String(d1[f]).startsWith(ENC)).toBe(true);
		expect(String(d1.answers).startsWith(ENC)).toBe(true);
		expect(d1.diary_text).toBeNull();
		expect(String(d2.ai_generated_diary).startsWith(ENC)).toBe(true);
		expect(d2.edited_diary).toBe(""); // empty stays empty
		expect(d2.memo).toBe("");

		const qa = fake.db.user_qa[0];
		expect(String(qa.question).startsWith(ENC)).toBe(true);
		expect(String(qa.answer).startsWith(ENC)).toBe(true);
		const payload = fake.db.briefing_snapshots[0].payload as { enc: string };
		expect(Object.keys(payload)).toEqual(["enc"]);
		expect(payload.enc.startsWith(ENC)).toBe(true);

		const cfg = fake.db.user_settings[0].diary_encryption as { v: number; iterations: number };
		expect(cfg).toMatchObject({ v: 1, iterations: 310_000 });
		expect(store.getState().encryptionStatus).toBe("unlocked");

		const local = localStorage.getItem("mb_diary_entries")!;
		expect(local).toContain(ENC);
		for (const p of PLAINTEXTS) expect(local).not.toContain(p);
		expect(store.getState().entries[D1].diary).toBe("SECRET-ai");
		expect(store.getState().entries[D1].notes).toBe("SECRET-memo");
	});

	it("disable restores the exact original plaintext and clears the config", async () => {
		const { fake, store } = await setup(seedRows());
		await store.getState().enableDiaryEncryption(PASS);
		expect(dump(fake.db.diaries)).not.toContain("SECRET-ai");
		await store.getState().disableDiaryEncryption();
		await flush();

		const expected = seedRows();
		expected.diaries.forEach((r) => (r.diary_text = null)); // legacy column is dropped by enable
		expect(fake.db.diaries).toEqual(expected.diaries);
		expect(fake.db.user_qa).toEqual(expected.user_qa);
		expect(fake.db.briefing_snapshots).toEqual(expected.briefing_snapshots);
		expect(fake.db.user_settings[0].diary_encryption).toBeNull();
		expect(store.getState().encryptionStatus).toBe("off");
		expect(localStorage.getItem("mb_diary_enc_config")).toBe("null");
	});

	it("enable refuses a too-short passphrase and writes nothing", async () => {
		const { fake, store } = await setup();
		await expect(store.getState().enableDiaryEncryption("short")).rejects.toThrow("passphrase_too_short");
		expect(fake.writes).toEqual([]);
		expect(store.getState().encryptionStatus).toBe("off");
	});
});

describe("locked", () => {
	it("state texts are empty, never ciphertext", async () => {
		const { store } = await lockedSetup();
		expect(store.getState().encryptionStatus).toBe("locked");
		const e = store.getState().entries[D1];
		expect(e).toMatchObject({ diary: "", aiGeneratedDiary: "", notes: "", memo: "" });
		expect(dump(store.getState().entries)).not.toContain(ENC);
	});

	it("saveDiary / saveNotes / addAnswer reject with diary_locked and nothing reaches the DB", async () => {
		const { fake, store } = await lockedSetup();
		const before = localStorage.getItem("mb_diary_entries");
		await expect(store.getState().saveDiary(D1, "NEW-PLAINTEXT")).rejects.toThrow("diary_locked");
		await expect(store.getState().saveNotes(D1, "NEW-PLAINTEXT")).rejects.toThrow("diary_locked");
		await expect(store.getState().addAnswer(D1, "NEW-PLAINTEXT", "NEW-PLAINTEXT")).rejects.toThrow("diary_locked");
		expect(fake.writes).toEqual([]);
		expect(dump(fake.db)).not.toContain("NEW-PLAINTEXT");
		expect(localStorage.getItem("mb_diary_entries")).toBe(before);
	});

	it("unlock with a wrong passphrase throws WrongPassphraseError and stays locked", async () => {
		const { store } = await lockedSetup();
		await expect(store.getState().unlockDiary("definitely wrong pass")).rejects.toMatchObject({ name: "WrongPassphraseError" });
		expect(store.getState().encryptionStatus).toBe("locked");
		expect(store.getState().entries[D1].diary).toBe("");
	});

	it("unlock with the right passphrase restores text", async () => {
		const { store, deviceKeys } = await lockedSetup();
		await store.getState().unlockDiary(PASS);
		await flush();
		expect(store.getState().encryptionStatus).toBe("unlocked");
		expect(store.getState().entries[D1]).toMatchObject({ diary: "SECRET-ai", notes: "SECRET-memo" });
		expect(deviceKeys.has("u1")).toBe(true);
	});
});

describe("Q&A", () => {
	it("addAnswer stores ciphertext when unlocked; fetchQAForDate returns plaintext", async () => {
		const { fake, store } = await lockedSetup();
		await store.getState().unlockDiary(PASS);
		await flush();
		await store.getState().addAnswer(D1, "NEW-question?", "NEW-answer!");
		const row = fake.db.user_qa.find((r) => r.asked_date === D1)!;
		expect(String(row.question).startsWith(ENC)).toBe(true);
		expect(String(row.answer).startsWith(ENC)).toBe(true);
		expect(dump(fake.db.user_qa)).not.toContain("NEW-");
		expect(await store.getState().fetchQAForDate(D1)).toEqual([{ question: "NEW-question?", answer: "NEW-answer!" }]);
	});

	it("fetchQAForDate returns [] while locked even if ciphertext rows exist", async () => {
		const { fake, store } = await lockedSetup();
		fake.db.user_qa = [{ id: "q", user_id: "u1", asked_date: D1, question: "enc:v1:aa:bb", answer: "enc:v1:aa:bb", created_at: "1" }];
		expect(await store.getState().fetchQAForDate(D1)).toEqual([]);
	});
});
