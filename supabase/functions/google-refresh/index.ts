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
		const { refresh_token } = await req.json();
		if (!refresh_token) {
			return new Response(JSON.stringify({ error: "refresh_token required" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
		const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
		if (!clientId || !clientSecret) {
			return new Response(JSON.stringify({ error: "Google credentials not configured" }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const params = new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token,
			grant_type: "refresh_token",
		});

		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});

		const tokenData = await tokenRes.json();

		if (!tokenRes.ok || !tokenData.access_token) {
			return new Response(
				JSON.stringify({ error: tokenData.error_description ?? "Token refresh failed" }),
				{ status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				access_token: tokenData.access_token,
				expires_in: tokenData.expires_in ?? 3600,
			}),
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
