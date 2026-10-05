import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TODAY = "2026-10-05";
const LAST_ACCESS = "mb_last_access_date";

type Snap = unknown[] | null;
interface Deps {
	diaries: Set<string>; // dates that already have a diary
	snapshots: Record<string, Snap>; // dates -> getSnapshotsForDateAsync result
	generate: (d: string) => Promise<unknown>;
}

const setup = async (deps: Deps) => {
	vi.resetModules();
	const generate = vi.fn(async (d: string) => deps.generate(d));
	const clearDate = vi.fn(async () => undefined);
	const getSnapshotsForDateAsync = vi.fn(async (d: string) => (d in deps.snapshots ? deps.snapshots[d] : []));
	vi.doMock("../store/useDiaryStore", () => ({
		useDiaryStore: { getState: () => ({ getDiary: (d: string) => (deps.diaries.has(d) ? { diary: "x" } : null) }) },
	}));
	vi.doMock("../store/useBriefingHistoryStore", () => ({
		useBriefingHistoryStore: { getState: () => ({ getSnapshotsForDateAsync, clearDate }) },
	}));
	vi.doMock("../store/useTodoStore", () => ({ useTodoStore: { getState: () => ({}) } }));
	vi.doMock("../services/diaryGenerationService", () => ({ generateAndSaveDiaryForDate: generate }));
	const mod = await import("./useMidnightTrigger");
	return { ...mod, generate, clearDate, getSnapshotsForDateAsync };
};

const ok = async () => ({ ok: true, text: "diary" });
const snap = [{ text: "t" }];

beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(`${TODAY}T12:00:00+09:00`));
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe("recoverMissedDiaries + nextLastAccess", () => {
	it("returns the first failed date; LAST_ACCESS becomes the day before it", async () => {
		localStorage.setItem(LAST_ACCESS, JSON.stringify("2026-10-02"));
		const t = await setup({
			diaries: new Set(["2026-10-02"]),
			snapshots: { "2026-10-03": snap, "2026-10-04": snap },
			generate: async (d) => (d === "2026-10-03" ? { ok: false } : { ok: true, text: "x" }),
		});
		const failed = await t.recoverMissedDiaries();
		expect(failed).toBe("2026-10-03");
		expect(t.nextLastAccess(failed, TODAY)).toBe("2026-10-02");
		expect(t.generate).toHaveBeenCalledTimes(1); // stops at first failure; 10-04 not attempted
	});

	it("all done -> null and LAST_ACCESS becomes today", async () => {
		localStorage.setItem(LAST_ACCESS, JSON.stringify("2026-10-03"));
		const t = await setup({ diaries: new Set(), snapshots: { "2026-10-03": snap, "2026-10-04": snap }, generate: ok });
		const failed = await t.recoverMissedDiaries();
		expect(failed).toBeNull();
		expect(t.nextLastAccess(failed, TODAY)).toBe(TODAY);
		expect(t.generate).toHaveBeenCalledTimes(2);
		expect(t.clearDate).toHaveBeenCalledWith("2026-10-03");
	});

	it("skip (no snapshots) does not block later dates", async () => {
		localStorage.setItem(LAST_ACCESS, JSON.stringify("2026-10-03"));
		const t = await setup({ diaries: new Set(), snapshots: { "2026-10-03": [], "2026-10-04": snap }, generate: ok });
		expect(await t.recoverMissedDiaries()).toBeNull();
		expect(t.generate).toHaveBeenCalledTimes(1);
		expect(t.generate.mock.calls[0][0]).toBe("2026-10-04");
	});

	it("locked (snapshots null) is an error: retried, never generated or skipped", async () => {
		localStorage.setItem(LAST_ACCESS, JSON.stringify("2026-10-03"));
		const t = await setup({ diaries: new Set(), snapshots: { "2026-10-03": null, "2026-10-04": snap }, generate: ok });
		expect(await t.synthesizeDiary("2026-10-03")).toBe("error");
		expect(await t.recoverMissedDiaries()).toBe("2026-10-03");
		expect(t.generate).not.toHaveBeenCalled();
	});

	it("a throwing generator is an error", async () => {
		const t = await setup({
			diaries: new Set(), snapshots: { "2026-10-03": snap },
			generate: async () => { throw new Error("boom"); },
		});
		expect(await t.synthesizeDiary("2026-10-03")).toBe("error");
		expect(t.clearDate).not.toHaveBeenCalled();
	});

	it("an existing diary is done without touching snapshots", async () => {
		const t = await setup({ diaries: new Set(["2026-10-03"]), snapshots: {}, generate: ok });
		expect(await t.synthesizeDiary("2026-10-03")).toBe("done");
		expect(t.getSnapshotsForDateAsync).not.toHaveBeenCalled();
	});

	it("no LAST_ACCESS or already today -> nothing to recover", async () => {
		const t = await setup({ diaries: new Set(), snapshots: {}, generate: ok });
		expect(await t.recoverMissedDiaries()).toBeNull();
		localStorage.setItem(LAST_ACCESS, JSON.stringify(TODAY));
		expect(await t.recoverMissedDiaries()).toBeNull();
		expect(t.getSnapshotsForDateAsync).not.toHaveBeenCalled();
	});

	it("a date change re-runs recovery for the day that just ended", async () => {
		localStorage.setItem(LAST_ACCESS, JSON.stringify(TODAY));
		const t = await setup({ diaries: new Set(), snapshots: { [TODAY]: snap }, generate: ok });
		expect(await t.recoverMissedDiaries()).toBeNull();
		expect(t.generate).not.toHaveBeenCalled();
		vi.setSystemTime(new Date("2026-10-06T00:30:00+09:00"));
		expect(await t.recoverMissedDiaries()).toBeNull();
		expect(t.generate).toHaveBeenCalledTimes(1);
		expect(t.generate.mock.calls[0][0]).toBe(TODAY);
	});
});
