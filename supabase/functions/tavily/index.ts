import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const toHashtag = (value: string) => {
	const compact = value
		.replace(/["'`]/g, "")
		.replace(/\s+/g, "_")
		.replace(/[^\p{L}\p{N}_#-]/gu, "")
		.trim();
	if (!compact) return null;
	return compact.startsWith("#") ? compact : `#${compact}`;
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const {
			query = "대한민국 실시간 이슈, 기술, 경제, 라이프스타일 트렌드 7개",
		} = await req.json();
		const apiKey = Deno.env.get("TAVILY_API_KEY");
		if (!apiKey) throw new Error("TAVILY_API_KEY not set");

		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: apiKey,
				query,
				topic: "news",
				search_depth: "advanced",
				max_results: 7,
				include_answer: true,
			}),
		});

		if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);

		const data = await res.json();
		const trends = Array.from(
			new Set(
				(data.results || [])
					.flatMap((item: { title?: string; content?: string }) => [
						item.title,
						item.content,
					])
					.filter(Boolean)
					.flatMap((text: string) => text.split(/[\n,|]/))
					.map((item: string) => item.trim())
					.filter((item: string) => item.length >= 2)
					.map(toHashtag)
					.filter(Boolean),
			),
		).slice(0, 7);

		return new Response(
			JSON.stringify({
				trends,
				answer: data.answer ?? null,
				results: data.results ?? [],
			}),
			{
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
