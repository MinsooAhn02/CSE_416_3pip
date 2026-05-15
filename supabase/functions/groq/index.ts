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
		const {
			prompt,
			system,
			model = "llama-3.3-70b-versatile",
			temperature = 0.4,
		} = await req.json();
		const apiKey = Deno.env.get("GROQ_API_KEY");
		if (!apiKey) throw new Error("GROQ_API_KEY not set");
		if (!prompt) throw new Error("prompt is required");

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
				model,
				temperature,
				messages,
			}),
		});

		if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

		const data = await res.json();
		const text = data.choices?.[0]?.message?.content ?? "";

		return new Response(JSON.stringify({ text }), {
			headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
