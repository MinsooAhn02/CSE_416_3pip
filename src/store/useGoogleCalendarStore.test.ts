import { beforeEach, describe, expect, it, vi } from "vitest";

type Body = Record<string, unknown>;
interface EdgeRes {
	ok: boolean;
	status: number;
	data: unknown;
	errorType: "http_4xx" | "http_5xx" | "network" | null;
	timedOut: boolean;
	cause?: unknown;
}

const okRes = (data: unknown): EdgeRes => ({ ok: true, status: 200, data, errorType: null, timedOut: false });
const httpErr = (status: number, error: string): EdgeRes => ({
	ok: false,
	status,
	data: { error },
	errorType: status >= 500 ? "http_5xx" : "http_4xx",
	timedOut: false,
});

const deferred = <T,>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
};

const ev = (id: string, date: string) => ({ id, title: id, date, start: date, end: date, allDay: true });

type Route = (name: string, body: Body) => EdgeRes | Promise<EdgeRes>;

const setup = async (route: Route, token: string | null = "tok") => {
	vi.resetModules();
	const callEdge = vi.fn((name: string, body: Body) => Promise.resolve(route(name, body)));
	const ensureProviderToken = vi.fn(async (_force?: boolean) => token);
	vi.doMock("../lib/supabase", () => ({ supabase: {}, getSessionUser: vi.fn() }));
	vi.doMock("../lib/edge", () => ({ callEdge }));
	vi.doMock("./useAuthStore", () => ({
		useAuthStore: { getState: () => ({ ensureProviderToken, user: { id: "u1" } }) },
	}));
	const mod = await import("./useGoogleCalendarStore");
	return { ...mod, callEdge, ensureProviderToken };
};

beforeEach(() => {
	localStorage.clear();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("dedupe of concurrent fetches", () => {
	it("two fetchTasks({skipLoading}) share one listTaskLists + one list request", async () => {
		const gate = deferred<void>();
		const { useGoogleCalendarStore: s, callEdge } = await setup(async (_n, body) => {
			await gate.promise;
			return body.action === "listTaskLists"
				? okRes([{ id: "L1", title: "Work" }])
				: okRes([{ id: "t1", title: "Task", taskListId: "L1" }]);
		});
		const a = s.getState().fetchTasks({ skipLoading: true });
		const b = s.getState().fetchTasks({ skipLoading: true });
		await vi.waitFor(() => expect(callEdge).toHaveBeenCalledTimes(2));
		gate.resolve();
		const [ta, tb] = await Promise.all([a, b]);

		expect(callEdge).toHaveBeenCalledTimes(2);
		expect(callEdge.mock.calls.map((c) => c[1].action).sort()).toEqual(["list", "listTaskLists"]);
		expect(ta).toBe(tb);
		expect(ta.map((t) => t.id)).toEqual(["t1"]);
		expect(s.getState().taskLists).toEqual([{ id: "L1", title: "Work" }]);
		expect(s.getState().tasksLoaded).toBe(true);
	});

	it("two fetchEvents for the same month share one request", async () => {
		const gate = deferred<void>();
		const { useGoogleCalendarStore: s, callEdge } = await setup(async () => {
			await gate.promise;
			return okRes([ev("e1", "2026-10-03")]);
		});
		const a = s.getState().fetchEvents({ date: "2026-10-05", skipLoading: true });
		const b = s.getState().fetchEvents({ date: "2026-10-20", skipLoading: true });
		await vi.waitFor(() => expect(callEdge).toHaveBeenCalledTimes(1));
		gate.resolve();
		const [ea, eb] = await Promise.all([a, b]);
		expect(callEdge).toHaveBeenCalledTimes(1);
		expect(ea).toBe(eb);
		expect(s.getState().events.map((e) => e.id)).toEqual(["e1"]);
		expect(s.getState().loadedMonthKey).toBe("2026-10");
	});
});

describe("stale month responses", () => {
	// TZ=Asia/Seoul: October starts 2026-09-30T15:00Z, November 2026-10-31T15:00Z
	const isOct = (body: Body) => String(body.timeMin).startsWith("2026-09-30");

	it("a late October response does not overwrite November", async () => {
		const oct = deferred<EdgeRes>();
		const nov = deferred<EdgeRes>();
		const { useGoogleCalendarStore: s, callEdge } = await setup((_n, body) =>
			isOct(body) ? oct.promise : nov.promise,
		);
		const pOct = s.getState().fetchEvents({ date: "2026-10-15", skipLoading: true });
		const pNov = s.getState().fetchEvents({ date: "2026-11-15", skipLoading: true });
		await vi.waitFor(() => expect(callEdge).toHaveBeenCalledTimes(2));

		nov.resolve(okRes([ev("nov", "2026-11-02")]));
		await pNov;
		expect(s.getState().loadedMonthKey).toBe("2026-11");
		oct.resolve(okRes([ev("oct", "2026-10-02")]));
		const octResult = await pOct;

		expect(octResult.map((e) => e.id)).toEqual(["oct"]); // the caller still gets its own data
		expect(s.getState().events.map((e) => e.id)).toEqual(["nov"]);
		expect(s.getState().loadedMonthKey).toBe("2026-11");
		const stored = JSON.parse(localStorage.getItem("mb_calendar_events") as string) as { id: string }[];
		expect(stored.map((e) => e.id)).toEqual(["nov"]);
	});

	it("a late October failure does not set error or state over November", async () => {
		const oct = deferred<EdgeRes>();
		const nov = deferred<EdgeRes>();
		const { useGoogleCalendarStore: s, callEdge } = await setup((_n, body) =>
			isOct(body) ? oct.promise : nov.promise,
		);
		const pOct = s.getState().fetchEvents({ date: "2026-10-15", skipLoading: true });
		const pNov = s.getState().fetchEvents({ date: "2026-11-15", skipLoading: true });
		await vi.waitFor(() => expect(callEdge).toHaveBeenCalledTimes(2));
		nov.resolve(okRes([ev("nov", "2026-11-02")]));
		await pNov;
		oct.resolve(httpErr(500, "boom"));
		await expect(pOct).rejects.toThrow("HTTP 500: boom");
		expect(s.getState().error).toBeNull();
		expect(s.getState().loadedMonthKey).toBe("2026-11");
		expect(s.getState().events.map((e) => e.id)).toEqual(["nov"]);
	});
});

describe("write then refetch isolation", () => {
	const eventsRoute =
		(refetch: () => EdgeRes): Route =>
		(_n, body) =>
			body.action === "list"
				? refetch()
				: okRes({ id: "srv1", title: "Lunch", date: "2026-10-15", start: "2026-10-15", allDay: true });

	it("addEvent resolves with the created event when the follow-up refetch fails", async () => {
		const { useGoogleCalendarStore: s, callEdge } = await setup(eventsRoute(() => httpErr(500, "down")));
		const created = await s.getState().addEvent({ title: "Lunch", date: "2026-10-15" });
		expect(created.id).toBe("srv1");
		expect(callEdge.mock.calls.map((c) => c[1].action)).toEqual(["create", "list"]);
		expect(s.getState().loading).toBe(false);
	});

	it("updateEvent and deleteEvent also survive a failing refetch", async () => {
		const { useGoogleCalendarStore: s, callEdge } = await setup(eventsRoute(() => httpErr(500, "down")));
		const updated = await s.getState().updateEvent("srv1", { title: "Lunch2", date: "2026-10-15" });
		expect(updated.id).toBe("srv1");
		await expect(s.getState().deleteEvent("srv1")).resolves.toBeUndefined();
		expect(callEdge.mock.calls.map((c) => c[1].action)).toEqual(["update", "list", "delete", "list"]);
	});

	it("addEvent throws and records the error when create itself fails (no refetch)", async () => {
		const { useGoogleCalendarStore: s, callEdge } = await setup(() => httpErr(500, "quota"));
		await expect(s.getState().addEvent({ title: "x", date: "2026-10-15" })).rejects.toThrow("HTTP 500: quota");
		expect(s.getState().error).toBe("HTTP 500: quota");
		expect(callEdge).toHaveBeenCalledTimes(1);
		expect(s.getState().loading).toBe(false);
	});
});

describe("error messages", () => {
	it("falls back to the localized gsync.* text when the error has no message", async () => {
		const { useGoogleCalendarStore: s } = await setup(() => ({
			ok: false,
			status: 0,
			data: null,
			errorType: "network",
			timedOut: false,
			cause: new Error(""),
		}));
		await expect(s.getState().addEvent({ title: "x", date: "2026-10-15" })).rejects.toThrow();
		expect(s.getState().error).toBe("Failed to create event.");
		await expect(s.getState().deleteEvent("e")).rejects.toThrow();
		expect(s.getState().error).toBe("Failed to delete event.");
		await expect(s.getState().fetchTasks({ skipLoading: true })).rejects.toThrow();
		expect(s.getState().error).toBe("Failed to load Google Tasks.");
	});

	it("maps 401/403 to the stable GOOGLE_SYNC_AUTH_ERROR sentinel after one forced token refresh", async () => {
		const { useGoogleCalendarStore: s, GOOGLE_SYNC_AUTH_ERROR, ensureProviderToken, callEdge } = await setup(
			() => httpErr(401, "Unauthorized"),
		);
		await expect(s.getState().fetchEvents({ date: "2026-10-15", skipLoading: true })).rejects.toThrow("HTTP 401");
		expect(s.getState().error).toBe(GOOGLE_SYNC_AUTH_ERROR);
		expect(ensureProviderToken).toHaveBeenCalledWith(true);
		expect(callEdge).toHaveBeenCalledTimes(1); // refresh returned the same token -> no retry
		expect(GOOGLE_SYNC_AUTH_ERROR).toBe(
			"Google connection expired. Reconnect Google to sync Events and Tasks again.",
		);
	});

	it("retries once with a fresh token after an auth failure", async () => {
		let n = 0;
		const { useGoogleCalendarStore: s, ensureProviderToken, callEdge } = await setup(() =>
			n++ === 0 ? httpErr(401, "Unauthorized") : okRes([ev("e1", "2026-10-03")]),
		);
		ensureProviderToken.mockImplementation(async (force?: boolean) => (force ? "fresh" : "tok"));
		await s.getState().fetchEvents({ date: "2026-10-15", skipLoading: true });
		expect(callEdge.mock.calls.map((c) => c[1].token)).toEqual(["tok", "fresh"]);
		expect(s.getState().events.map((e) => e.id)).toEqual(["e1"]);
	});

	it("without a provider token: skipLoading falls back to cache, otherwise throws the auth sentinel", async () => {
		const { useGoogleCalendarStore: s, GOOGLE_SYNC_AUTH_ERROR, callEdge } = await setup(() => okRes([]), null);
		await expect(s.getState().fetchEvents({ date: "2026-10-15", skipLoading: true })).resolves.toEqual([]);
		expect(s.getState().error).toBeNull();
		await expect(s.getState().fetchEvents({ date: "2026-10-15" })).rejects.toThrow(GOOGLE_SYNC_AUTH_ERROR);
		expect(s.getState().error).toBe(GOOGLE_SYNC_AUTH_ERROR);
		expect(s.getState().loading).toBe(false);
		expect(callEdge).not.toHaveBeenCalled();
	});
});
