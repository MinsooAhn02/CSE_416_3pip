import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-10-06T09:00:00+09:00").getTime();
const HOUR = 60 * 60 * 1000;

// supabase 모킹: from("api_cache")가 호출됐는지 확인하기 위한 spy 체인
const setup = async () => {
	vi.resetModules();
	const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
	const eq = vi.fn(() => ({ single }));
	const select = vi.fn(() => ({ eq }));
	const upsert = vi.fn().mockResolvedValue({ error: null });
	const from = vi.fn(() => ({ select, upsert }));
	vi.doMock("../../lib/supabase", () => ({ supabase: { from }, getSessionUser: vi.fn() }));
	vi.doMock("../../store/useAuthStore", () => ({
		useAuthStore: { getState: () => ({ user: { id: "user-1" } }) },
	}));
	const mod = await import("./apiCache");
	return { mod, from, select, eq, upsert, single };
};

describe("apiCache private keys (calendar_*, health_*)", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		return () => vi.useRealTimers();
	});

	it.each(["calendar_today", "calendar_2026-10-06", "health_default"])(
		"%s round-trips via localStorage and never touches supabase",
		async (key) => {
			const { mod, from } = await setup();
			const payload = { events: [{ title: "x" }] };
			await mod.writeApiCache(key, payload, "user-1");
			expect(JSON.parse(localStorage.getItem(`mb_cache_api_${key}`) as string)).toEqual(payload);
			expect(Number(JSON.parse(localStorage.getItem(`mb_cache_api_${key}_at`) as string))).toBe(NOW);

			const hit = await mod.readApiCache(key, "user-1");
			expect(hit).toEqual({ data: payload, fetchedAt: NOW });
			expect(from).not.toHaveBeenCalled();
		},
	);

	it("honours fetchedAtArg and expires after 6h", async () => {
		const { mod, from } = await setup();
		await mod.writeApiCache("calendar_today", { a: 1 }, "user-1", NOW - 5 * HOUR);
		expect((await mod.readApiCache("calendar_today", "user-1"))?.fetchedAt).toBe(NOW - 5 * HOUR);
		vi.setSystemTime(NOW + 2 * HOUR); // 7h old
		expect(await mod.readApiCache("calendar_today", "user-1")).toBeNull();
		expect(from).not.toHaveBeenCalled();
	});

	it("returns null for forceRefresh, missing data or missing timestamp", async () => {
		const { mod, from } = await setup();
		await mod.writeApiCache("health_default", { steps: 1 }, "user-1");
		expect(await mod.readApiCache("health_default", "user-1", true)).toBeNull();
		localStorage.removeItem("mb_cache_api_health_default_at");
		expect(await mod.readApiCache("health_default", "user-1")).toBeNull();
		expect(await mod.readApiCache("calendar_2026-01-01", "user-1")).toBeNull();
		expect(from).not.toHaveBeenCalled();
	});
});

describe("apiCache non-private keys", () => {
	beforeEach(() => localStorage.clear());

	it("readApiCache queries api_cache with the row id", async () => {
		const { mod, from, eq } = await setup();
		expect(await mod.readApiCache("news_en_x", "user-1")).toBeNull(); // PGRST116 -> miss
		expect(from).toHaveBeenCalledWith("api_cache");
		expect(eq).toHaveBeenCalledWith("id", "u:user-1:news_en_x");
		expect(localStorage.getItem("mb_cache_api_news_en_x")).toBeNull();
	});

	it("readApiCache returns fresh rows and rejects stale ones", async () => {
		const { mod, single } = await setup();
		const fresh = new Date(Date.now() - HOUR).toISOString();
		single.mockResolvedValueOnce({ data: { data: { a: 1 }, fetched_at: fresh }, error: null });
		expect(await mod.readApiCache("news_en_x", "user-1")).toEqual({ data: { a: 1 }, fetchedAt: new Date(fresh).getTime() });
		const old = new Date(Date.now() - 7 * HOUR).toISOString();
		single.mockResolvedValueOnce({ data: { data: { a: 1 }, fetched_at: old }, error: null });
		expect(await mod.readApiCache("news_en_x", "user-1")).toBeNull();
	});

	it("writeApiCache upserts to api_cache and not to localStorage", async () => {
		const { mod, from, upsert } = await setup();
		await mod.writeApiCache("news_en_x", { r: 1 }, "user-1");
		expect(from).toHaveBeenCalledWith("api_cache");
		expect(upsert).toHaveBeenCalledWith(
			expect.objectContaining({ id: "u:user-1:news_en_x", user_id: "user-1", data: { r: 1 } }),
		);
		expect(localStorage.getItem("mb_cache_api_news_en_x")).toBeNull();
	});

	it("uses the auth store user when userId is not passed", async () => {
		const { mod, eq } = await setup();
		await mod.readApiCache("news_en_x", undefined);
		expect(eq).toHaveBeenCalledWith("id", "u:user-1:news_en_x");
	});
});

describe("toCacheRowId", () => {
	it("keeps short ids readable and hashes long ones to <=64 chars", async () => {
		const { mod } = await setup();
		const uid = "12345678-aaaa-bbbb-cccc-1234567890ab";
		expect(mod.toCacheRowId(uid, "news_en_x")).toBe(`u:${uid}:news_en_x`);
		const long = mod.toCacheRowId(uid, "k".repeat(80));
		expect(long.startsWith("h:12345678:")).toBe(true);
		expect(long.length).toBeLessThanOrEqual(64);
		expect(mod.toCacheRowId(uid, "k".repeat(80))).toBe(long); // deterministic
		expect(mod.toCacheRowId(uid, "k".repeat(81))).not.toBe(long);
	});
});
