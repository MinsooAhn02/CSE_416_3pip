import { beforeEach, describe, expect, it, vi } from "vitest";

const callEdge = vi.fn();
const handleApiError = vi.fn();

const load = async () => {
	vi.resetModules();
	vi.doMock("../../lib/edge", () => ({ callEdge }));
	vi.doMock("../../utils/errorHandler", () => ({ handleApiError }));
	return import("./client");
};

const fail = (over: Record<string, unknown>) => ({
	ok: false, status: 0, data: null, raw: "", error: null, errorType: null, timedOut: false, elapsedMs: 1, ...over,
});

describe("invokeFunction", () => {
	beforeEach(() => {
		callEdge.mockReset();
		handleApiError.mockReset();
	});

	it("returns data on success and forwards name/body", async () => {
		callEdge.mockResolvedValue({ ...fail({}), ok: true, status: 200, data: { text: "hi" } });
		const { invokeFunction } = await load();
		expect(await invokeFunction("groq", { prompt: "p" })).toEqual({ text: "hi" });
		expect(callEdge).toHaveBeenCalledWith("groq", { prompt: "p" }, { timeoutMs: 20000 });
		expect(handleApiError).not.toHaveBeenCalled();
	});

	it.each([
		["http_4xx", 429],
		["http_5xx", 502],
	])("reports %s with area and httpStatus and returns null", async (errorType, status) => {
		callEdge.mockResolvedValue(fail({ status, errorType, error: `HTTP ${status}: x` }));
		const { invokeFunction } = await load();
		expect(await invokeFunction("groq", {})).toBeNull();
		expect(handleApiError).toHaveBeenCalledWith({ message: `HTTP ${status}: x` }, "ai:groq", { httpStatus: status });
	});

	it("reports network/timeout causes without httpStatus", async () => {
		const cause = new TypeError("down");
		callEdge.mockResolvedValue(fail({ errorType: "network", cause }));
		const { invokeFunction } = await load();
		expect(await invokeFunction("tavily", {})).toBeNull();
		expect(handleApiError).toHaveBeenCalledWith(cause, "ai:tavily");
	});

	it("returns null silently when callEdge returns null (guest / no env)", async () => {
		callEdge.mockResolvedValue(null);
		const { invokeFunction } = await load();
		expect(await invokeFunction("groq", {})).toBeNull();
		expect(handleApiError).not.toHaveBeenCalled();
	});
});
