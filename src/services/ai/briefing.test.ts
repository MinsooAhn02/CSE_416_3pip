import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefingContext } from "./types";

const KEY = "mb_briefing_cache";
const EVENT_TITLE = "Secret dentist appointment";
const DIARY = "I quietly rehearsed my resignation speech";

const invokeFunction = vi.fn();

// groq stub: article-summary prompt ("[0]") → JSON summaries, otherwise a diary rewrite
const okGroq = async (_name: string, body: Record<string, unknown>) =>
	String(body.prompt).includes("[0]")
		? { text: JSON.stringify({ summaries: [{ index: 0, summary: "Short news summary." }] }) }
		: { text: "Yesterday was quiet." };

const ctx = (over: Partial<BriefingContext> = {}): BriefingContext =>
	({
		weather: { city: "Seoul", condition: "Clear", temp: 20 },
		calEvents: [{ title: EVENT_TITLE, start: "2026-10-05T10:00:00+09:00" }],
		newsResults: [{ title: "Big news", url: "https://example.com/a", content: "body" }],
		...over,
	}) as unknown as BriefingContext;

const load = async () => {
	vi.resetModules();
	vi.doMock("./client", () => ({
		bs: (k: string) => k,
		getLangConfig: () => ({ lang: "en", langInstruction: "English", noneLabel: "None" }),
		invokeFunction,
	}));
	const briefing = await import("./briefing");
	const keyState = await import("../../lib/diaryKeyState");
	return { gen: briefing.generateDetailedBriefing, keyState };
};

const args = (context: BriefingContext) => ({ tone: "neutral", length: "short", context });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

describe("generateDetailedBriefing", () => {
	beforeEach(() => {
		localStorage.clear();
		invokeFunction.mockReset();
		invokeFunction.mockImplementation(okGroq);
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-05T09:00:00+09:00"));
	});
	afterEach(() => vi.useRealTimers());

	it("reuses the cache for the same context within 60 minutes", async () => {
		const { gen } = await load();
		const a = await gen(args(ctx()));
		const calls = invokeFunction.mock.calls.length;
		expect(calls).toBeGreaterThan(0);
		vi.setSystemTime(Date.now() + 59 * 60_000);
		expect(await gen(args(ctx()))).toEqual(a);
		expect(invokeFunction).toHaveBeenCalledTimes(calls);
	});

	it("regenerates after the 60 minute TTL", async () => {
		const { gen } = await load();
		await gen(args(ctx()));
		const calls = invokeFunction.mock.calls.length;
		vi.setSystemTime(Date.now() + 61 * 60_000);
		await gen(args(ctx()));
		expect(invokeFunction.mock.calls.length).toBeGreaterThan(calls);
	});

	it("ignores temperature changes but misses on event title changes", async () => {
		const { gen } = await load();
		await gen(args(ctx()));
		const calls = invokeFunction.mock.calls.length;
		await gen(args(ctx({ weather: { city: "Seoul", condition: "Clear", temp: 23 } as never })));
		expect(invokeFunction).toHaveBeenCalledTimes(calls);
		await gen(args(ctx({ calEvents: [{ title: "Other", start: "2026-10-05T10:00:00+09:00" }] as never })));
		expect(invokeFunction.mock.calls.length).toBeGreaterThan(calls);
	});

	it("reuses a failed-AI result for <5 min, then regenerates", async () => {
		invokeFunction.mockResolvedValue(null);
		const { gen } = await load();
		await gen(args(ctx()));
		const calls = invokeFunction.mock.calls.length;
		expect(stored().aiOk).toBe(false);
		vi.setSystemTime(Date.now() + 4 * 60_000);
		await gen(args(ctx()));
		expect(invokeFunction).toHaveBeenCalledTimes(calls);
		vi.setSystemTime(Date.now() + 2 * 60_000); // 6 min total
		await gen(args(ctx()));
		expect(invokeFunction.mock.calls.length).toBeGreaterThan(calls);
	});

	it("keeps a successful result past 5 minutes", async () => {
		const { gen } = await load();
		await gen(args(ctx()));
		expect(stored().aiOk).toBe(true);
		const calls = invokeFunction.mock.calls.length;
		vi.setSystemTime(Date.now() + 10 * 60_000);
		await gen(args(ctx()));
		expect(invokeFunction).toHaveBeenCalledTimes(calls);
	});

	it("dedupes concurrent calls into one generation", async () => {
		const { gen } = await load();
		const [a, b] = await Promise.all([gen(args(ctx())), gen(args(ctx()))]);
		expect(a).toEqual(b);
		// one build = article batch call only (no diary source) → exactly 1 groq call
		expect(invokeFunction).toHaveBeenCalledTimes(1);
	});

	it("force: true bypasses the cache", async () => {
		const { gen } = await load();
		await gen(args(ctx()));
		const calls = invokeFunction.mock.calls.length;
		await gen(args(ctx()), { force: true });
		expect(invokeFunction.mock.calls.length).toBeGreaterThan(calls);
	});

	it("stores only a hashed fingerprint, never context plaintext in fp", async () => {
		const { gen } = await load();
		await gen(args(ctx({ yesterdayDiary: DIARY })));
		const s = stored();
		expect(s.fp).toMatch(/^[0-9a-f]{64}$/);
		expect(s.fp).not.toContain("dentist");
		expect(localStorage.getItem(KEY)).not.toContain(`"fp":"${EVENT_TITLE}`);
	});

	it("stores an { enc } blob with no plaintext when encryption is unlocked, and reads it back", async () => {
		const { gen, keyState } = await load();
		const { createDiaryEncryption } = await import("../../lib/diaryCrypto");
		const { key } = await createDiaryEncryption("correct horse battery", 100_000);
		keyState.setDiaryKeyState("unlocked", key);
		const first = await gen(args(ctx({ yesterdayDiary: DIARY })));
		const raw = localStorage.getItem(KEY) ?? "";
		expect(Object.keys(stored().result)).toEqual(["enc"]);
		expect(stored().result.enc).toMatch(/^enc:v1:/);
		for (const secret of [EVENT_TITLE, DIARY, "Big news", "Yesterday was quiet", "Seoul"]) {
			expect(raw).not.toContain(secret);
		}
		// fresh module (memory cache empty) must decrypt from disk instead of regenerating
		const again = await load();
		const { key: k2 } = { key };
		again.keyState.setDiaryKeyState("unlocked", k2);
		invokeFunction.mockClear();
		expect(await again.gen(args(ctx({ yesterdayDiary: DIARY })))).toEqual(first);
		expect(invokeFunction).not.toHaveBeenCalled();
	});

	it("persists nothing while locked and removes leftovers", async () => {
		const { gen, keyState } = await load();
		localStorage.setItem(KEY, JSON.stringify({ fp: "x", at: 1, result: { summary: "old plaintext" } }));
		keyState.setDiaryKeyState("locked", null);
		await gen(args(ctx()));
		expect(localStorage.getItem(KEY)).not.toContain("plaintext");
		expect(stored()).toBeNull();
	});

	it("purges a stored plaintext cache the moment encryption turns on", async () => {
		const { gen, keyState } = await load();
		await gen(args(ctx()));
		expect(stored().result.summary).toBeTruthy();
		keyState.setDiaryKeyState("locked", null);
		expect(stored()).toBeNull();
	});
});
