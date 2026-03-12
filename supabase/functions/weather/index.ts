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
		const { lat = 37.5665, lon = 126.978 } = await req.json();
		const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
		if (!apiKey) throw new Error("OPENWEATHER_API_KEY not set");

		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&lang=kr&appid=${encodeURIComponent(apiKey)}`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
		const data = await res.json();

		return new Response(
			JSON.stringify({
				temp: Math.round(data.main.temp),
				feels_like: Math.round(data.main.feels_like),
				humidity: data.main.humidity,
				description: data.weather?.[0]?.description ?? "",
				icon: data.weather?.[0]?.icon ?? "01d",
				city: data.name,
			}),
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
