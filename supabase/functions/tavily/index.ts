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
			mode = "trends", // "trends" | "news"
			max_results: maxResults,
			location = null, // { country, city } — news 모드에서 지역 정보
		} = await req.json();

		const apiKey = Deno.env.get("TAVILY_API_KEY");
		if (!apiKey) throw new Error("TAVILY_API_KEY not set");

		const isNews = mode === "news";
		const resultCount = maxResults ?? (isNews ? 10 : 7);

		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey,
				query,
				topic: "news",
				search_depth: "advanced",
				max_results: resultCount,
				include_answer: true,
				include_images: isNews, // 뉴스 모드에서만 이미지 포함
			}),
		});

		if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
		const data = await res.json();

		if (isNews) {
			// 뉴스 모드: 제목 + URL + 이미지 URL 추출
			const topImages: string[] = Array.isArray(data.images)
				? data.images.slice(0, 10)
				: [];

			const results = (data.results ?? []).map(
				(
					item: {
						title?: string;
						url?: string;
						content?: string;
						published_date?: string;
					},
					i: number,
				) => ({
					title: item.title ?? "",
					url: item.url ?? "",
					content: item.content ?? "",
					published_date: item.published_date ?? null,
					image: topImages[i] ?? null,
				}),
			);

			return new Response(
				JSON.stringify({
					answer: data.answer ?? null,
					results,
					location: location ?? null,
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		// 트렌드 모드 (기존 동작 유지)
		const trends = Array.from(
			new Set(
				(data.results || [])
					.flatMap(
						(item: { title?: string; content?: string }) => [
							item.title,
							item.content,
						],
					)
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
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return new Response(JSON.stringify({ error: msg }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
