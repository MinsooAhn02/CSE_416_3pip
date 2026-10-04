import { supabase } from "./supabase";
import { isGuest } from "./guest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface EdgeResponse {
	ok: boolean;
	/** HTTP status. 0 = no response (timeout / network failure). */
	status: number;
	/** 응답 본문: JSON 파싱 성공 시 객체, 실패 시 원문 텍스트, 빈 본문이면 null */
	data: unknown;
	/** 응답 본문 원문 (에러 메시지 구성용) */
	raw: string;
	error: string | null;
	errorType: "http_4xx" | "http_5xx" | "timeout" | "network" | null;
	timedOut: boolean;
	elapsedMs: number;
	/** fetch가 던진 원본 에러 (handleApiError 분류용). HTTP 에러/성공이면 undefined */
	cause?: unknown;
}

export const parseEdgeBody = (text: string): unknown => {
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

/**
 * Edge Function 단일 호출 코어. handleApiError는 호출하지 않음 — 각 호출자가 자기 error area를 유지.
 * VITE_SUPABASE_URL/ANON_KEY 미설정 또는 게스트 모드면 네트워크 없이 null.
 * 세션 토큰이 있으면 Bearer로, 없으면 anon key.
 */
export const callEdge = async (
	name: string,
	body: Record<string, unknown> = {},
	{ timeoutMs }: { timeoutMs: number },
): Promise<EdgeResponse | null> => {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY || isGuest()) return null;
	const startedAt = Date.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const base = { data: null, raw: "", error: null, errorType: null, timedOut: false } as const;

	try {
		const session = supabase ? (await supabase.auth.getSession()).data.session : null;
		const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const raw = await res.text().catch(() => "");
		const data = parseEdgeBody(raw);
		const elapsedMs = Date.now() - startedAt;
		if (res.ok) return { ...base, ok: true, status: res.status, data, raw, elapsedMs };
		return {
			...base,
			ok: false,
			status: res.status,
			data,
			raw,
			error: `HTTP ${res.status}: ${raw}`,
			errorType: res.status >= 500 ? "http_5xx" : "http_4xx",
			elapsedMs,
		};
	} catch (e) {
		const err = e as Error;
		const timedOut = err?.name === "AbortError";
		return {
			...base,
			ok: false,
			status: 0,
			error: timedOut ? `timeout ${timeoutMs}ms` : err?.message || "Edge invoke failed",
			errorType: timedOut ? "timeout" : "network",
			timedOut,
			elapsedMs: Date.now() - startedAt,
			cause: e,
		};
	} finally {
		clearTimeout(timer);
	}
};
