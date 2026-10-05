// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { googleErrorSummary } from "./googleError";

afterEach(() => vi.restoreAllMocks());

const SECRET = "SECRET-TOKEN-ya29.abc123 user@example.com";
const run = async (body: string, status: number) => {
	const spy = vi.spyOn(console, "error").mockImplementation(() => {});
	const out = await googleErrorSummary("Google Calendar", new Response(body, { status }), "events");
	return { out, spy };
};

describe("googleErrorSummary", () => {
	it("uses errors[0].reason", async () => {
		const { out } = await run(JSON.stringify({ error: { errors: [{ reason: "insufficientPermissions", message: SECRET }] } }), 403);
		expect(out).toBe("Google Calendar 403 insufficientPermissions");
		expect(out).not.toContain("SECRET");
	});

	it("falls back to error.status", async () => {
		const { out } = await run(JSON.stringify({ error: { status: "UNAUTHENTICATED", message: SECRET } }), 401);
		expect(out).toBe("Google Calendar 401 UNAUTHENTICATED");
	});

	it("non-JSON body gives no reason and never leaks the body", async () => {
		const { out } = await run(`<html>${SECRET}</html>`, 502);
		expect(out).toBe("Google Calendar 502");
		expect(out).not.toContain("SECRET");
	});

	it("drops free-text reasons with spaces/digits/too long", async () => {
		for (const reason of [`bad ${SECRET}`, "has-dash", "x".repeat(41), "abc123"]) {
			const { out } = await run(JSON.stringify({ error: { errors: [{ reason }] } }), 400);
			expect(out).toBe("Google Calendar 400");
		}
	});

	it("handles JSON without an error object and empty body", async () => {
		expect((await run("{}", 500)).out).toBe("Google Calendar 500");
		expect((await run("null", 500)).out).toBe("Google Calendar 500");
		expect((await run("", 500)).out).toBe("Google Calendar 500");
	});

	it("logs the upstream body server-side (truncated to 500)", async () => {
		const { spy } = await run(SECRET + "x".repeat(1000), 500);
		expect(spy).toHaveBeenCalledTimes(1);
		const args = spy.mock.calls[0];
		expect(args[0]).toBe("[events] Google Calendar 500:");
		expect(String(args[1])).toContain("SECRET-TOKEN");
		expect(String(args[1]).length).toBe(500);
	});

	it("keeps client-side matchers working (lowercased)", async () => {
		const a = (await run(JSON.stringify({ error: { errors: [{ reason: "accessNotConfigured" }] } }), 403)).out.toLowerCase();
		expect(a).toContain("403");
		expect(a).toContain("accessnotconfigured");
		const b = (await run(JSON.stringify({ error: { status: "authError" } }), 401)).out.toLowerCase();
		expect(b).toContain("401");
		expect(b).toContain("autherror");
	});
});
