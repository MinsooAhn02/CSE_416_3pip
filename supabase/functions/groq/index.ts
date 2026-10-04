import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rejectIfNoUser } from "../_shared/auth.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Expose-Headers": "retry-after",
};

// llama-3.3-70b-versatile은 Groq에서 제공 종료 (2026-10 model_not_found 확인)
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const ALLOWED_MODELS = new Set([DEFAULT_MODEL, "openai/gpt-oss-20b"]);
const MAX_PROMPT_CHARS = 60_000; // 스마트위젯 합성 프롬프트(검색 결과 포함)가 길어서 여유 있게
const MAX_SYSTEM_CHARS = 10_000;
// gpt-oss는 reasoning 토큰도 이 한도에 포함 → 너무 낮으면 응답이 잘림
const MAX_COMPLETION_TOKENS = 8192; // 스마트위젯 섹션 JSON(최대 5섹션)이 잘리지 않게 여유

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	const unauthorized = await rejectIfNoUser(req, corsHeaders);
	if (unauthorized) return unauthorized;

	try {
		const { prompt, system, model, temperature = 0.4 } = await req.json();
		const apiKey = Deno.env.get("GROQ_API_KEY");
		if (!apiKey) throw new Error("GROQ_API_KEY not set");
		if (typeof prompt !== "string" || !prompt) throw new Error("prompt is required");
		if (prompt.length > MAX_PROMPT_CHARS) throw new Error("prompt too long");
		if (system != null && (typeof system !== "string" || system.length > MAX_SYSTEM_CHARS)) {
			throw new Error("system too long");
		}

		const messages = [];
		if (system) messages.push({ role: "system", content: system });
		messages.push({ role: "user", content: prompt });

		const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL,
				temperature: Math.min(1.5, Math.max(0, Number(temperature) || 0)),
				max_completion_tokens: MAX_COMPLETION_TOKENS,
				// gpt-oss의 추론 토큰도 분당 한도(TPM)에 포함 → 요약/분류 위주라 low로 충분
				reasoning_effort: "low",
				messages,
			}),
		});

		if (!res.ok) {
			const detail = await res.text();
			// 429(한도 초과)는 그대로 전달 — 클라이언트가 일반 오류와 구분하도록
			if (res.status === 429) {
				return new Response(JSON.stringify({ error: `Groq 429: ${detail}` }), {
					status: 429,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
						"Retry-After": res.headers.get("retry-after") ?? "10",
					},
				});
			}
			throw new Error(`Groq ${res.status}: ${detail}`);
		}

		const data = await res.json();
		const text = data.choices?.[0]?.message?.content ?? "";

		// usage: 토큰 사용량 측정용 (클라이언트는 text만 사용)
		return new Response(JSON.stringify({ text, usage: data.usage ?? null }), {
			headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
