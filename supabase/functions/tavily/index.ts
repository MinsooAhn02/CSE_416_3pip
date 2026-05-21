import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

/** Remove common article-title noise: "- Site Name", "| Category", brackets, markdown */
const cleanTitle = (raw: string): string =>
	raw
		.replace(/\s*[-–|]\s*[^-–|]{2,35}$/, "") // trailing "- Site" or "| Category"
		.replace(/\[.*?\]/g, "")                  // [brackets]
		.replace(/["'`*_#]/g, "")                 // markdown chars / hashtags
		.replace(/\s{2,}/g, " ")
		.trim();

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const {
			query = "대한민국 실시간 이슈, 기술, 경제, 라이프스타일 트렌드 7개",
			mode = "trends", // "trends" | "news" | "search"
			max_results: maxResults,
			location = null,
			include_domains = [],
			search_topic = null,
			time_range = null,
		} = await req.json();

		const apiKey = Deno.env.get("TAVILY_API_KEY");
		if (!apiKey) throw new Error("TAVILY_API_KEY not set");

		const isNews = mode === "news";
		const isSearch = mode === "search";
		const resultCount = maxResults ?? (isNews || isSearch ? 10 : 8);

		const tavilyBody: Record<string, unknown> = {
			api_key: apiKey,
			query,
			topic: search_topic ?? (isSearch ? "general" : "news"),
			search_depth: "advanced",
			max_results: resultCount,
			include_answer: true,
			include_images: isNews || isSearch,
		};
		if (Array.isArray(include_domains) && include_domains.length > 0) {
			tavilyBody.include_domains = include_domains;
		}
		if (typeof time_range === "string" && time_range.trim()) {
			tavilyBody.time_range = time_range.trim();
		}
		// 위치 정보가 있으면 Tavily에 전달 (지역 뉴스 관련성 향상)
		if (location && typeof location === "object" &&
			typeof (location as Record<string, unknown>).lat === "number" &&
			typeof (location as Record<string, unknown>).lon === "number") {
			const loc = location as { lat: number; lon: number };
			tavilyBody.location = `${loc.lat},${loc.lon}`;
		}

		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(tavilyBody),
		});

		if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
		const data = await res.json();

		if (isNews || isSearch) {
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
						score?: number;
					},
					i: number,
				) => ({
					title: item.title ?? "",
					url: item.url ?? "",
					content: item.content ?? "",
					published_date: item.published_date ?? null,
					score: typeof item.score === "number" ? item.score : null,
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

		// 트렌드 모드 — 기사 제목을 그대로 트렌드 키워드로 사용
		const trends = Array.from(
			new Set(
				(data.results ?? [])
					.map((item: { title?: string }) => cleanTitle(item.title ?? ""))
					.filter((t: string) => t.length >= 5 && t.length <= 80),
			),
		).slice(0, 8);

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
