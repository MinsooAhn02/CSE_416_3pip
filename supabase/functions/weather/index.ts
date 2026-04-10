import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const AQI_LABELS: Record<number, string> = {
	1: "좋음",
	2: "보통",
	3: "보통",
	4: "나쁨",
	5: "매우 나쁨",
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const { lat = 37.5665, lon = 126.978 } = await req.json();
		const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
		if (!apiKey) throw new Error("OPENWEATHER_API_KEY not set");

		const baseUrl = "https://api.openweathermap.org/data/2.5";

		// 날씨 + 대기질 병렬 호출
		const [weatherRes, aqRes] = await Promise.all([
			fetch(
				`${baseUrl}/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${apiKey}`,
			),
			fetch(`${baseUrl}/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`),
		]);

		if (!weatherRes.ok) throw new Error(`OpenWeather ${weatherRes.status}`);
		const data = await weatherRes.json();
		const aqData = aqRes.ok ? await aqRes.json() : null;

		// 대기질 (AQI 1~5)
		const aqi: number = aqData?.list?.[0]?.main?.aqi ?? 0;
		const airQuality = AQI_LABELS[aqi] ?? "보통";

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
				condition: data.weather?.[0]?.description ?? "정보 없음",
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
