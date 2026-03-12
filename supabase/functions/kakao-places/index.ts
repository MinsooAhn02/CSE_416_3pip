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
			query,
			lat = 37.5665,
			lon = 126.978,
			radius = 1000,
		} = await req.json();
		const apiKey = Deno.env.get("KAKAO_REST_KEY");
		if (!apiKey) throw new Error("KAKAO_REST_KEY not set");

		// 키워드 검색 (카테고리: 음식점 FD6)
		const params = new URLSearchParams({
			query: query || "맛집",
			x: String(lon),
			y: String(lat),
			radius: String(radius),
			category_group_code: "FD6",
			size: "15",
			sort: "accuracy",
		});

		const res = await fetch(
			`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
			{
				headers: { Authorization: `KakaoAK ${apiKey}` },
			},
		);
		if (!res.ok) throw new Error(`Kakao API ${res.status}`);
		const data = await res.json();

		const places = (data.documents || []).map((d: any) => ({
			id: d.id,
			name: d.place_name,
			category: d.category_name,
			address: d.road_address_name || d.address_name,
			phone: d.phone,
			url: d.place_url,
			distance: d.distance,
			lat: d.y,
			lon: d.x,
		}));

		return new Response(JSON.stringify(places), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
