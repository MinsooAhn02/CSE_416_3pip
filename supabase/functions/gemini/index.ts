import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const { mode, prompt, context } = await req.json();
		const apiKey = Deno.env.get("GEMINI_API_KEY");
		if (!apiKey) throw new Error("GEMINI_API_KEY not set");

		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

		const systemInstructions: Record<string, string> = {
			briefing:
				"당신은 사용자의 모닝 브리핑 AI입니다. 오늘 날씨, 일정, 뉴스 트렌드를 종합해서 한국어로 간결하게 브리핑하세요.",
			trends:
				'한국 실시간 트렌드를 JSON 배열로만 반환하세요. [{"rank":1,"keyword":"...","change":"new"}] 형태.',
			chat: "사용자의 질문에 친절하고 간결하게 한국어로 답변하세요.",
		};

		const body = {
			contents: [
				{
					role: "user",
					parts: [
						{
							text: `${systemInstructions[mode] || ""}\n\n${context ? `컨텍스트: ${JSON.stringify(context)}\n\n` : ""}${prompt}`,
						},
					],
				},
			],
			generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
		};

		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
		const data = await res.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

		// trends 모드에서는 JSON 파싱 시도
		if (mode === "trends") {
			try {
				const jsonMatch = text.match(/\[[\s\S]*\]/);
				if (jsonMatch)
					return new Response(
						JSON.stringify({ trends: JSON.parse(jsonMatch[0]) }),
						{
							headers: { ...corsHeaders, "Content-Type": "application/json" },
						},
					);
			} catch {
				/* fall through to raw text */
			}
		}

		return new Response(JSON.stringify({ text }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
