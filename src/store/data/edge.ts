import { callEdge } from "../../lib/edge";
import { handleApiError } from "../../utils/errorHandler";

export const EDGE_TIMEOUT_MS = 25000;

/* ── Edge Function 호출 헬퍼: 공용 코어 callEdge(src/lib/edge.ts) 위의 얇은 래퍼 ── */
export interface EdgeResult {
	ok: boolean;
	data: unknown;
	error: string | null;
	errorType: string | null;
	timedOut: boolean;
	elapsedMs: number;
}

export const invokeEdgeDetailed = async (fnName: string, body: Record<string, unknown> = {}): Promise<EdgeResult | null> => {
	const r = await callEdge(fnName, body, { timeoutMs: EDGE_TIMEOUT_MS });
	if (!r) return null;
	const area = `edge:${fnName}`;
	if (r.ok) {
		return { ok: true, data: r.data, error: null, errorType: null, timedOut: false, elapsedMs: r.elapsedMs };
	}
	if (r.errorType === "http_4xx" || r.errorType === "http_5xx") {
		handleApiError({ message: r.error }, area, { httpStatus: r.status });
	} else if (r.timedOut) {
		handleApiError(r.cause, area, { userVisible: true });
	} else {
		handleApiError(r.cause, area);
	}
	return {
		ok: false,
		data: null,
		error: r.error,
		errorType: r.errorType,
		timedOut: r.timedOut,
		elapsedMs: r.elapsedMs,
	};
};

export const invokeEdge = async (fnName: string, body: Record<string, unknown> = {}): Promise<unknown> => {
	const result = await invokeEdgeDetailed(fnName, body);
	return result?.ok ? result.data : null;
};
