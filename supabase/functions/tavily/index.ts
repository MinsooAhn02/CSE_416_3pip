import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rejectIfNoUser } from "../_shared/auth.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

// 쿼터 보호 상한 (search_depth: advanced라 쿼리당 비용이 큼)
const MAX_BATCH_QUERIES = 10;
const MAX_RESULTS = 20; // Tavily 자체 최대치
const MAX_QUERY_CHARS = 400;

/** Remove common article-title noise: "- Site Name", "| Category", brackets, markdown */
const cleanTitle = (raw: string): string =>
	raw
		.replace(/\s*[-–|]\s*[^-–|]{2,35}$/, "") // trailing "- Site" or "| Category"
		.replace(/\[.*?\]/g, "")                  // [brackets]
		.replace(/["'`*_#]/g, "")                 // markdown chars / hashtags
		.replace(/\s{2,}/g, " ")
		.trim();

interface TavilyQuery {
	query: string;
	mode?: string;
	max_results?: number;
	location?: unknown;
	include_domains?: string[];
	exclude_domains?: string[];
	search_topic?: string;
	time_range?: string;
}

const runTavilySearch = async (params: TavilyQuery, apiKey: string): Promise<unknown> => {
	const {
		query,
		mode = "trends",
		max_results: maxResults,
		location = null,
		include_domains = [],
		exclude_domains = [],
		search_topic = null,
		time_range = null,
	} = params;

	if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_CHARS) {
		throw new Error("invalid query");
	}
	const isNews = mode === "news";
	const isSearch = mode === "search";
	const resultCount = Math.min(MAX_RESULTS, Math.max(1, Number(maxResults) || (isNews || isSearch ? 10 : 8)));

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
	if (Array.isArray(exclude_domains) && exclude_domains.length > 0) {
		tavilyBody.exclude_domains = exclude_domains;
	}
	if (typeof time_range === "string" && time_range.trim()) {
		tavilyBody.time_range = time_range.trim();
	}
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

		return {
			answer: data.answer ?? null,
			results,
			location: location ?? null,
		};
	}

	// 트렌드 모드
	const trends = Array.from(
		new Set(
			(data.results ?? [])
				.map((item: { title?: string }) => cleanTitle(item.title ?? ""))
				.filter((t: string) => t.length >= 5 && t.length <= 80),
		),
	).slice(0, 8);

	return {
		trends,
		answer: data.answer ?? null,
		results: data.results ?? [],
	};
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	const unauthorized = await rejectIfNoUser(req, corsHeaders);
	if (unauthorized) return unauthorized;

	try {
		const apiKey = Deno.env.get("TAVILY_API_KEY");
		if (!apiKey) throw new Error("TAVILY_API_KEY not set");

		const body = await req.json();

		// 배치 모드: { queries: TavilyQuery[] }
		if (Array.isArray(body.queries)) {
			if (body.queries.length > MAX_BATCH_QUERIES) throw new Error("too many queries");
			const queries = body.queries as TavilyQuery[];
			const results = await Promise.all(
				queries.map((q) =>
					runTavilySearch(q, apiKey).catch((e: unknown) => ({
						error: e instanceof Error ? e.message : String(e),
						results: [],
						answer: null,
					})),
				),
			);
			return new Response(
				JSON.stringify({ batch: results }),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		// 단일 쿼리 모드 (기존 호환)
		const result = await runTavilySearch(body as TavilyQuery, apiKey);
		return new Response(
			JSON.stringify(result),
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
