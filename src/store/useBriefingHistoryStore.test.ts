import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../test/fakeSupabase";
import { formatLocalDate, shiftDateString } from "../utils/date";

const HISTORY_KEY = "mb_briefing_history";
const TODAY = formatLocalDate();
const payload = { text: "SECRET-briefing-text", summary: "sum", sections: [{ k: 1 }] };

// diaryCrypto is real (WebCrypto); only the helpers for IndexedDB are not needed here.
const setup = async (seed: Record<string, Record<string, unknown>[]> = {}) => {
	vi.resetModules();
	const fake = createFakeSupabase(seed);
	vi.doMock("../lib/supabase", () => ({ supabase: fake.client, getSessionUser: async () => ({ id: "u1" }) }));
	const crypto = await import("../lib/diaryCrypto");
	const keyState = await import("../lib/diaryKeyState");
	const { useBriefingHistoryStore: store } = await import("./useBriefingHistoryStore");
	const { key } = await crypto.createDiaryEncryption("correct horse battery", 100_000);
	return { fake, store, keyState, key };
};
const flush = () => new Promise((r) => setTimeout(r, 10));
const rawLocal = () => localStorage.getItem(HISTORY_KEY);

beforeEach(() => localStorage.clear());

describe("addSnapshot", () => {
	it("encryption off: plaintext payload in DB and localStorage", async () => {
		const { fake, store } = await setup();
		await store.getState().addSnapshot(payload);
		expect(fake.db.briefing_snapshots).toHaveLength(1);
		expect(fake.db.briefing_snapshots[0].payload).toEqual(payload);
		expect(JSON.parse(rawLocal()!)[TODAY][0].payload).toEqual(payload);
		expect(store.getState().getSnapshotsForDate(TODAY)[0].text).toBe(payload.text);
	});

	it("unlocked: { enc } in DB and localStorage, plaintext only in memory", async () => {
		const { fake, store, keyState, key } = await setup();
		keyState.setDiaryKeyState("unlocked", key);
		await store.getState().addSnapshot(payload);
		const dbPayload = fake.db.briefing_snapshots[0].payload as { enc: string };
		expect(Object.keys(dbPayload)).toEqual(["enc"]);
		expect(dbPayload.enc.startsWith("enc:v1:")).toBe(true);
		expect(rawLocal()).toContain("enc:v1:");
		expect(rawLocal()).not.toContain("SECRET-briefing-text");
		expect(JSON.stringify(fake.writes)).not.toContain("SECRET-briefing-text");
		expect(store.getState().getSnapshotsForDate(TODAY)[0].text).toBe(payload.text);
	});

	it("locked: nothing is written anywhere", async () => {
		const { fake, store, keyState } = await setup();
		keyState.setDiaryKeyState("locked", null);
		await store.getState().addSnapshot(payload);
		expect(fake.writes).toEqual([]);
		expect(rawLocal()).toBeNull();
		expect(store.getState().byDate).toEqual({});
	});
});

describe("hydrateFromDB", () => {
	it("keeps only the last 7 days and deletes older rows on the server", async () => {
		const row = (date: string) => ({ user_id: "u1", date, captured_at: `${date}T01:00:00Z`, source: "auto", payload });
		const dates = [TODAY, shiftDateString(TODAY, -6), shiftDateString(TODAY, -7), shiftDateString(TODAY, -10)];
		const { fake, store } = await setup({ briefing_snapshots: dates.map(row) });
		await store.getState().hydrateFromDB();
		await flush();
		expect(Object.keys(store.getState().byDate).sort()).toEqual([dates[1], dates[0]].sort());
		expect(fake.db.briefing_snapshots.map((r) => r.date).sort()).toEqual([dates[1], dates[0]].sort());
		expect(fake.writes.some((w) => w.op === "delete" && w.table === "briefing_snapshots")).toBe(true);
	});
});

describe("getSnapshotsForDateAsync", () => {
	const encRow = async (key: CryptoKey, date: string) => {
		const { encryptText } = await import("../lib/diaryCrypto");
		return { user_id: "u1", date, captured_at: `${date}T01:00:00Z`, source: "auto", payload: { enc: await encryptText(key, JSON.stringify(payload)) } };
	};

	it("returns null when locked with encrypted rows, [] when there are none", async () => {
		const ctx = await setup();
		ctx.fake.db.briefing_snapshots = [await encRow(ctx.key, TODAY)];
		ctx.keyState.setDiaryKeyState("unlocked", ctx.key);
		await ctx.store.getState().hydrateFromDB();
		expect((await ctx.store.getState().getSnapshotsForDateAsync(TODAY))?.[0].text).toBe(payload.text);

		ctx.keyState.setDiaryKeyState("locked", null);
		expect(await ctx.store.getState().getSnapshotsForDateAsync(TODAY)).toBeNull();
		expect(await ctx.store.getState().getSnapshotsForDateAsync(shiftDateString(TODAY, -1))).toEqual([]);
	});

	it("locked with only plaintext rows still reads them", async () => {
		const { store, keyState } = await setup();
		await store.getState().addSnapshot(payload);
		keyState.setDiaryKeyState("locked", null);
		expect(await store.getState().getSnapshotsForDateAsync(TODAY)).toHaveLength(1);
	});
});
