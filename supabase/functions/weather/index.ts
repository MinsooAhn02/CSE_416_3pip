import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const AQI_LABELS: Record<number, string> = {
	1: "Good",
	2: "Fair",
	3: "Moderate",
	4: "Poor",
	5: "Very Poor",
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const { lat = 37.5665, lon = 126.978, city } = await req.json();
		const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
		if (!apiKey) throw new Error("OPENWEATHER_API_KEY not set");

		const baseUrl = "https://api.openweathermap.org/data/2.5";

		// city 이름으로 검색하면 lat/lon은 응답에서 추출
		const weatherQuery = city
			? `q=${encodeURIComponent(city)}`
			: `lat=${lat}&lon=${lon}`;

		const weatherRes = await fetch(
			`${baseUrl}/weather?${weatherQuery}&units=metric&lang=en&appid=${apiKey}`,
		);
		if (!weatherRes.ok) throw new Error(`OpenWeather ${weatherRes.status}`);
		const data = await weatherRes.json();

		// city 검색 시 실제 좌표를 응답에서 추출해 AQI 조회
		const coordLat = data.coord?.lat ?? lat;
		const coordLon = data.coord?.lon ?? lon;

		// 날씨 + 대기질 병렬 호출
		const [, aqRes] = await Promise.all([
			Promise.resolve(),
			fetch(`${baseUrl}/air_pollution?lat=${coordLat}&lon=${coordLon}&appid=${apiKey}`),
		]);

		const aqData = aqRes.ok ? await aqRes.json() : null;

		// 대기질 (AQI 1~5)
		const aqi: number = aqData?.list?.[0]?.main?.aqi ?? 0;
		const airQuality = AQI_LABELS[aqi] ?? "Moderate";

		// 강수 확률 추정 (현재날씨 API는 확률 미제공 → 운량 + 강수량으로 추정)
		const rainVol = (data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0) as number;
		const snowVol = (data.snow?.["1h"] ?? data.snow?.["3h"] ?? 0) as number;
		const clouds = (data.clouds?.all ?? 0) as number;
		let precipitation: number;
		if (rainVol > 0 || snowVol > 0) {
			precipitation = Math.min(100, Math.round(clouds * 0.6 + 40));
		} else {
			precipitation = Math.round(clouds * 0.35);
		}

		return new Response(
			JSON.stringify({
				temp: Math.round(data.main.temp),
				feels_like: Math.round(data.main.feels_like),
				humidity: data.main.humidity,
				condition: data.weather?.[0]?.description ?? "N/A",
				icon: data.weather?.[0]?.icon ?? "01d",
				city: data.name,
				precipitation,
				airQuality,
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
