import i18n, { getCurrentLanguage } from "../../l10n/i18n";
import { handleApiError } from "../../utils/errorHandler";
import { callEdge } from "../../lib/edge";
import type { LangConfig } from "./types";

export const bs = (key: string, lng: string) => i18n.t(`briefing_sections.${key}`, { lng }) as string;

export const getLangConfig = (): LangConfig => {
	const raw = String(getCurrentLanguage() || "en").toLowerCase();
	const lang = raw.startsWith("ko") ? "ko" : "en";
	return {
		lang,
		langInstruction: lang === "ko"
			? "Respond formally and politely in Korean (한국어)."
			: "Respond formally and politely in English.",
		noneLabel: lang === "ko" ? "없음" : "None",
	};
};

export const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const AI_TIMEOUT_MS = 20000;
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Edge Function이 로그인 사용자만 허용 → callEdge가 세션 토큰 전송 (없으면 anon → 401)
export const invokeFunction = async (name: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
	const r = await callEdge(name, body, { timeoutMs: AI_TIMEOUT_MS });
	if (!r) return null;
	if (r.ok) {
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${r.elapsedMs}ms`);
		}
		return r.data as Record<string, unknown> | null;
	}
	if (r.errorType === "http_4xx" || r.errorType === "http_5xx") {
		handleApiError({ message: r.error }, `ai:${name}`, { httpStatus: r.status });
	} else {
		handleApiError(r.cause, `ai:${name}`);
	}
	return null;
};
