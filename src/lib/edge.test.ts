import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const URL_ = "https://fake.supabase.test";
const KEY = "anon-key";

type EdgeMod = typeof import("./edge");

const load = async (opts: { env?: boolean; token?: string | null; guest?: boolean } = {}): Promise<EdgeMod> => {
	const { env = true, token = null, guest = false } = opts;
	vi.resetModules();
	if (env) {
		vi.stubEnv("VITE_SUPABASE_URL", URL_);
		vi.stubEnv("VITE_SUPABASE_ANON_KEY", KEY);
	}
	vi.doMock("./supabase", () => ({
		supabase: {
			auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
		},
	}));
	if (guest) (await import("./guest")).setGuest(true);
	return import("./edge");
};

const res = (body: string, status = 200) => new Response(body, { status });

describe("parseEdgeBody", () => {
	it("handles empty, JSON and plain text", async () => {
		const { parseEdgeBody } = await load();
		expect(parseEdgeBody("")).toBeNull();
		expect(parseEdgeBody('{"a":1}')).toEqual({ a: 1 });
		expect(parseEdgeBody("not json")).toBe("not json");
	});
});

describe("callEdge", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => vi.doUnmock("./supabase"));

	it("returns null without fetching when env is empty", async () => {
		const { callEdge } = await load({ env: false });
		expect(await callEdge("groq", {}, { timeoutMs: 100 })).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns null without fetching in guest mode", async () => {
		const { callEdge } = await load({ guest: true });
		expect(await callEdge("groq", {}, { timeoutMs: 100 })).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses the session token for Authorization and the anon key for apikey", async () => {
		fetchMock.mockResolvedValue(res("{}"));
		const { callEdge } = await load({ token: "sess-jwt" });
		await callEdge("groq", { q: 1 }, { timeoutMs: 1000 });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${URL_}/functions/v1/groq`);
		expect(init.method).toBe("POST");
		expect(init.body).toBe('{"q":1}');
		expect(init.headers).toMatchObject({ apikey: KEY, Authorization: "Bearer sess-jwt" });
	});

	it("falls back to the anon key when there is no session", async () => {
		fetchMock.mockResolvedValue(res("{}"));
		const { callEdge } = await load({ token: null });
		await callEdge("groq", {}, { timeoutMs: 1000 });
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(init.headers).toMatchObject({ apikey: KEY, Authorization: `Bearer ${KEY}` });
	});

	it("parses a 200 JSON body", async () => {
		fetchMock.mockResolvedValue(res('{"text":"hi"}'));
		const { callEdge } = await load();
		const r = await callEdge("groq", {}, { timeoutMs: 1000 });
		expect(r).toMatchObject({ ok: true, status: 200, data: { text: "hi" }, error: null, errorType: null, timedOut: false });
	});

	it("returns a string for a 200 text body", async () => {
		fetchMock.mockResolvedValue(res("plain"));
		const { callEdge } = await load();
		const r = await callEdge("groq", {}, { timeoutMs: 1000 });
		expect(r).toMatchObject({ ok: true, data: "plain", raw: "plain" });
	});

	it.each([
		[404, "http_4xx"],
		[429, "http_4xx"],
		[500, "http_5xx"],
		[503, "http_5xx"],
	])("classifies HTTP %i as %s", async (status, errorType) => {
		fetchMock.mockResolvedValue(res('{"error":"nope"}', status));
		const { callEdge } = await load();
		const r = await callEdge("groq", {}, { timeoutMs: 1000 });
		expect(r).toMatchObject({ ok: false, status, errorType, data: { error: "nope" }, timedOut: false });
		expect(r?.error).toContain(String(status));
	});

	it("reports network failures with status 0 and the cause", async () => {
		const cause = new TypeError("Failed to fetch");
		fetchMock.mockRejectedValue(cause);
		const { callEdge } = await load();
		const r = await callEdge("groq", {}, { timeoutMs: 1000 });
		expect(r).toMatchObject({ ok: false, status: 0, errorType: "network", timedOut: false, error: "Failed to fetch" });
		expect(r?.cause).toBe(cause);
	});

	it("aborts and classifies a hung request as a timeout", async () => {
		fetchMock.mockImplementation(
			(_u: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError")),
					);
				}),
		);
		const { callEdge } = await load();
		const r = await callEdge("groq", {}, { timeoutMs: 20 });
		expect(r).toMatchObject({ ok: false, status: 0, errorType: "timeout", timedOut: true, error: "timeout 20ms" });
		expect(r?.cause).toBeInstanceOf(DOMException);
	});
});
