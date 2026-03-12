import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const groqModel = "llama-3.3-70b-versatile";

type RouteName =
	| "weather"
	| "stocks"
	| "calendar"
	| "fitness"
	| "trends"
	| "restaurants"
	| "none";

type PersonaContext = {
	persona?: string | null;
	age?: number | string | null;
	job?: string | null;
	interests?: string[] | null;
};

const callGroqJson = async (
	apiKey: string,
	messages: { role: string; content: string }[],
) => {
	const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: groqModel,
			temperature: 0.3,
			response_format: { type: "json_object" },
			messages,
		}),
	});

	if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
	const data = await res.json();
	const text = data.choices?.[0]?.message?.content ?? "{}";
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Groq JSON parse failed: ${text}`);
	}
};

const callTavily = async (apiKey: string, query: string) => {
	const res = await fetch("https://api.tavily.com/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			api_key: apiKey,
			query,
			topic: "general",
			search_depth: "advanced",
			max_results: 3,
			include_answer: true,
		}),
	});

	if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
	return await res.json();
};

const routeSet = new Set<RouteName>([
	"weather",
	"stocks",
	"calendar",
	"fitness",
	"trends",
	"restaurants",
	"none",
]);

const asRoute = (value: unknown): RouteName => {
	const v = typeof value === "string" ? value.toLowerCase() : "none";
	return routeSet.has(v as RouteName) ? (v as RouteName) : "none";
};

const callWeather = async (apiKey: string, lat: number, lon: number) => {
	const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&lang=kr&appid=${encodeURIComponent(apiKey)}`;
	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`OpenWeather ${res.status}: ${await res.text()}`);
	const data = await res.json();
	return {
		temp: Math.round(data.main?.temp ?? 0),
		feelsLike: Math.round(data.main?.feels_like ?? 0),
		humidity: data.main?.humidity ?? 0,
		description: data.weather?.[0]?.description ?? "",
		city: data.name ?? "",
	};
};

const callStocks = async (apiKey: string) => {
	const symbolMap: Record<string, string> = {
		KOSPI: "EWY",
		NASDAQ: "QQQ",
		SP500: "SPY",
		USDKRW: "USD/KRW",
	};
	const symbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"];

	const results = await Promise.all(
		symbols.map(async (sym) => {
			const tdSymbol = symbolMap[sym] || sym;
			const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
			const res = await fetch(url);
			const data = await res.json();
			const price = Number(data?.close ?? 0);
			const change = Number(data?.change ?? 0);
			const percentChange = String(data?.percent_change ?? "0%");
			return {
				symbol: sym,
				price: Number.isFinite(price) ? price : 0,
				change: Number.isFinite(change) ? change : 0,
				changePercent: percentChange,
			};
		}),
	);

	return results;
};

const callCalendar = async (token: string) => {
	const now = new Date();
	const params = new URLSearchParams({
		timeMin: now.toISOString(),
		singleEvents: "true",
		orderBy: "startTime",
		maxResults: "10",
	});

	const res = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!res.ok)
		throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
	const data = await res.json();
	return (data.items ?? []).map(
		(e: {
			summary?: string;
			start?: { dateTime?: string; date?: string };
		}) => ({
			title: e.summary ?? "(제목 없음)",
			start: e.start?.dateTime ?? e.start?.date ?? null,
		}),
	);
};

const callFitness = async (token: string) => {
	const now = new Date();
	const startOfDay = new Date(now);
	startOfDay.setHours(0, 0, 0, 0);

	const body = {
		aggregateBy: [
			{ dataTypeName: "com.google.step_count.delta" },
			{ dataTypeName: "com.google.calories.expended" },
		],
		bucketByTime: { durationMillis: 86400000 },
		startTimeMillis: startOfDay.getTime(),
		endTimeMillis: now.getTime(),
	};

	const res = await fetch(
		"https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		},
	);
	if (!res.ok) throw new Error(`Google Fit ${res.status}: ${await res.text()}`);
	const data = await res.json();

	let steps = 0;
	let calories = 0;
	for (const bucket of data.bucket ?? []) {
		for (const ds of bucket.dataset ?? []) {
			for (const pt of ds.point ?? []) {
				for (const val of pt.value ?? []) {
					if (pt.dataTypeName === "com.google.step_count.delta") {
						steps += val.intVal ?? 0;
					}
					if (pt.dataTypeName === "com.google.calories.expended") {
						calories += val.fpVal ?? 0;
					}
				}
			}
		}
	}

	return { steps, calories: Math.round(calories) };
};

const callKakaoPlaces = async (
	apiKey: string,
	query: string,
	lat: number,
	lon: number,
) => {
	const params = new URLSearchParams({
		query,
		x: String(lon),
		y: String(lat),
		radius: "1200",
		category_group_code: "FD6",
		size: "8",
		sort: "accuracy",
	});

	const res = await fetch(
		`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
		{ headers: { Authorization: `KakaoAK ${apiKey}` } },
	);
	if (!res.ok) throw new Error(`Kakao ${res.status}: ${await res.text()}`);
	const data = await res.json();
	return (data.documents ?? []).map(
		(d: {
			place_name?: string;
			category_name?: string;
			distance?: string;
			place_url?: string;
		}) => ({
			name: d.place_name ?? "",
			category: d.category_name ?? "",
			distance: d.distance ?? "",
			url: d.place_url ?? null,
		}),
	);
};

const summarizeRouteWidget = async (
	groqApiKey: string,
	params: {
		keyword: string;
		route: RouteName;
		apiPrompt?: string;
		persona: PersonaContext;
		apiData: unknown;
	},
) => {
	const result = await callGroqJson(groqApiKey, [
		{
			role: "system",
			content:
				"당신은 대시보드 위젯 포맷터입니다. 반드시 JSON만 반환하세요. 형식: { emoji: string, sections: [{ type: 'summary', title: string, bullets: string[] }, { type: 'trend', title: string, tags: string[] }, { type: 'news', title: string, items: [{ title: string, source: string, time: string, url: string }] }, { type: 'price', title: string, items: [{ name: string, source: string, price: string, change: string }] }] }. 데이터에 맞는 섹션만 포함하고, summary bullets는 정확히 3개로 작성하세요.",
		},
		{
			role: "user",
			content: JSON.stringify(params, null, 2),
		},
	]);

	return {
		emoji: result.emoji || "🔍",
		sections: Array.isArray(result.sections) ? result.sections : [],
	};
};

const searchAndSummarize = async (
	groqApiKey: string,
	tavilyApiKey: string,
	params: {
		keyword: string;
		persona: PersonaContext;
		points: { label: string; query: string; reason?: string }[];
	},
) => {
	const searchResults = await Promise.all(
		params.points.map(async (point) => {
			const result = await callTavily(tavilyApiKey, point.query);
			return {
				label: point.label,
				query: point.query,
				answer: result.answer ?? "",
				results: (result.results ?? [])
					.slice(0, 3)
					.map(
						(item: {
							title?: string;
							url?: string;
							content?: string;
							source?: string;
							published_date?: string;
						}) => ({
							title: item.title ?? "제목 없음",
							url: item.url ?? null,
							content: item.content ?? "",
							source: item.source ?? "web",
							publishedAt: item.published_date ?? null,
						}),
					),
			};
		}),
	);

	const finalWidget = await callGroqJson(groqApiKey, [
		{
			role: "system",
			content:
				"당신은 스마트 대시보드 위젯 포맷터입니다. 반드시 JSON만 반환하세요. 형식: { emoji: string, sections: [{ type: 'summary', title: string, bullets: string[] }, { type: 'trend', title: string, tags: string[] }, { type: 'news', title: string, items: [{ title: string, source: string, time: string, url: string }] }] }. summary bullets는 정확히 3개, trend tags는 3~6개, news는 최대 6개로 제한하세요.",
		},
		{
			role: "user",
			content: JSON.stringify({ ...params, searchResults }, null, 2),
		},
	]);

	return {
		emoji: finalWidget.emoji || "🔍",
		sections: Array.isArray(finalWidget.sections) ? finalWidget.sections : [],
		searchResults,
	};
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const {
			keyword,
			persona = {},
			token = null,
			lat = 37.5665,
			lon = 126.978,
		} = await req.json();
		if (!keyword) throw new Error("keyword is required");

		const groqApiKey = Deno.env.get("GROQ_API_KEY");
		if (!groqApiKey) throw new Error("GROQ_API_KEY not set");

		// Step 0: API Routing
		const routeDecision = await callGroqJson(groqApiKey, [
			{
				role: "system",
				content:
					"당신은 요청 라우터입니다. 키워드가 내부 API(weather, stocks, calendar, fitness, trends, restaurants)로 직접 처리 가능한지 판단하세요. 반드시 JSON만 반환하세요. 형식: { route: 'weather'|'stocks'|'calendar'|'fitness'|'trends'|'restaurants'|'none', apiPrompt: string, reason: string }",
			},
			{
				role: "user",
				content: JSON.stringify({ keyword, persona }, null, 2),
			},
		]);

		const route = asRoute(routeDecision.route);
		if (route !== "none") {
			let apiData: unknown = null;
			const weatherKey = Deno.env.get("OPENWEATHER_API_KEY");
			const stockKey = Deno.env.get("TWELVEDATA_API_KEY");
			const kakaoKey = Deno.env.get("KAKAO_REST_KEY");
			const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");

			if (route === "weather" && weatherKey) {
				apiData = await callWeather(weatherKey, Number(lat), Number(lon));
			}
			if (route === "stocks" && stockKey) {
				apiData = await callStocks(stockKey);
			}
			if (route === "calendar" && token) {
				apiData = await callCalendar(token);
			}
			if (route === "fitness" && token) {
				apiData = await callFitness(token);
			}
			if (route === "trends" && tavilyApiKey) {
				apiData = await callTavily(
					tavilyApiKey,
					routeDecision.apiPrompt || `${keyword} 최신 트렌드`,
				);
			}
			if (route === "restaurants" && kakaoKey) {
				apiData = await callKakaoPlaces(
					kakaoKey,
					routeDecision.apiPrompt || keyword,
					Number(lat),
					Number(lon),
				);
			}

			if (apiData) {
				const widget = await summarizeRouteWidget(groqApiKey, {
					keyword,
					route,
					apiPrompt: routeDecision.apiPrompt,
					persona,
					apiData,
				});

				return new Response(
					JSON.stringify({
						keyword,
						emoji: widget.emoji,
						lastUpdated: "방금 전",
						sections: widget.sections,
						debug: {
							step0: { route, reason: routeDecision.reason ?? "" },
							pipeline: "step0-routed",
						},
					}),
					{
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					},
				);
			}
		}

		// Step 1: Persona Extraction
		const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
		if (!tavilyApiKey) throw new Error("TAVILY_API_KEY not set");

		const personaPlan = await callGroqJson(groqApiKey, [
			{
				role: "system",
				content:
					"당신은 사용자 맞춤 리서치 플래너입니다. 반드시 JSON만 반환하세요. 형식: { personaSummary: string, points: [{ label: string, query: string, reason: string }], tags: string[] }. points는 정확히 3개를 반환하세요.",
			},
			{
				role: "user",
				content: JSON.stringify({ keyword, persona }, null, 2),
			},
		]);

		const points = Array.isArray(personaPlan.points)
			? personaPlan.points
					.filter(
						(p: { label?: string; query?: string }) =>
							typeof p?.label === "string" && typeof p?.query === "string",
					)
					.slice(0, 3)
			: [];
		if (points.length === 0) throw new Error("No search points generated");

		// Step 2: Tavily Search & Summarize
		const finalWidget = await searchAndSummarize(groqApiKey, tavilyApiKey, {
			keyword,
			persona,
			points,
		});

		const payload = {
			keyword,
			emoji: finalWidget.emoji || "🔍",
			lastUpdated: "방금 전",
			sections: finalWidget.sections,
			debug: {
				step0: { route: "none", reason: routeDecision.reason ?? "" },
				step1: {
					personaSummary: personaPlan.personaSummary ?? "",
					points,
					tags: Array.isArray(personaPlan.tags) ? personaPlan.tags : [],
				},
				pipeline: "step1-step2-search",
			},
		};

		return new Response(JSON.stringify(payload), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
