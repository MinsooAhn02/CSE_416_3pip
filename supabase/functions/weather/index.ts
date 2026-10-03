import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rejectIfNoUser } from "../_shared/auth.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	const unauthorized = await rejectIfNoUser(req, corsHeaders);
	if (unauthorized) return unauthorized;

	try {
		const body = await req.json();
		const { city, lang = "en" } = body;
		// URL에 그대로 들어가므로 숫자로 강제 (파라미터 주입 방지)
		const lat = Number(body.lat ?? 37.5665);
		const lon = Number(body.lon ?? 126.978);
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
			throw new Error("invalid coordinates");
		}
		const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
		if (!apiKey) throw new Error("OPENWEATHER_API_KEY not set");

		const baseUrl = "https://api.openweathermap.org/data/2.5";
		const geoUrl = "https://api.openweathermap.org/geo/1.0";

		const weatherQuery = city
			? `q=${encodeURIComponent(city)}`
			: `lat=${lat}&lon=${lon}`;

		// 날씨는 항상 영어로 받음 — 번역은 클라이언트에서 처리
		const weatherRes = await fetch(
			`${baseUrl}/weather?${weatherQuery}&units=metric&lang=en&appid=${apiKey}`,
		);
		if (!weatherRes.ok) throw new Error(`OpenWeather ${weatherRes.status}`);
		const data = await weatherRes.json();

		const coordLat = data.coord?.lat ?? lat;
		const coordLon = data.coord?.lon ?? lon;

		// AQ + 한국어 도시명 역지오코딩 병렬 호출
		const [aqRes, geoRes] = await Promise.all([
			fetch(`${baseUrl}/air_pollution?lat=${coordLat}&lon=${coordLon}&appid=${apiKey}`),
			lang === "ko"
				? fetch(`${geoUrl}/reverse?lat=${coordLat}&lon=${coordLon}&limit=1&appid=${apiKey}`)
				: Promise.resolve(null),
		]);

		const aqData = aqRes.ok ? await aqRes.json() : null;
		const geoData = geoRes?.ok ? await geoRes.json() : null;

		// 한국어 도시명: Geocoding local_names.ko 우선, 없으면 영어 그대로
		const cityName = (lang === "ko" && Array.isArray(geoData) && geoData[0]?.local_names?.ko)
			? geoData[0].local_names.ko
			: data.name;

		const airQualityIndex: number = aqData?.list?.[0]?.main?.aqi ?? 0;

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
				conditionId: data.weather?.[0]?.id ?? null,
				icon: data.weather?.[0]?.icon ?? "01d",
				city: cityName,
				precipitation,
				airQualityIndex,
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
