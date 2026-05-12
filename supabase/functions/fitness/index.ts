import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
	});

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	const authHeader = req.headers.get("Authorization") ?? "";
	const jwt = authHeader.replace("Bearer ", "");
	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
	);
	const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
	if (authError || !user) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { token } = await req.json();
		if (!token) throw new Error("Google OAuth token required");

		const now = new Date();
		const startOfDay = new Date(now);
		startOfDay.setHours(0, 0, 0, 0);

		// Google Fit REST — aggregate steps, calories, heart rate, sleep
		const body = {
			aggregateBy: [
				{ dataTypeName: "com.google.step_count.delta" },
				{ dataTypeName: "com.google.calories.expended" },
				{ dataTypeName: "com.google.heart_rate.bpm" },
				{ dataTypeName: "com.google.sleep.segment" },
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

		if (!res.ok) {
			const errText = await res.text();
			const error = new Error(`Google Fit ${res.status}: ${errText}`);
			// @ts-ignore propagate upstream status for clearer client errors
			error.status = res.status;
			throw error;
		}

		const data = await res.json();
		let steps = 0,
			calories = 0,
			heartRate = 0,
			sleepMinutes = 0;

		for (const bucket of data.bucket || []) {
			for (const ds of bucket.dataset || []) {
				for (const pt of ds.point || []) {
					const typeName = pt.dataTypeName;
					for (const val of pt.value || []) {
						if (typeName === "com.google.step_count.delta")
							steps += val.intVal || 0;
						if (typeName === "com.google.calories.expended")
							calories += val.fpVal || 0;
						if (typeName === "com.google.heart_rate.bpm" && val.fpVal)
							heartRate = Math.round(val.fpVal);
						if (typeName === "com.google.sleep.segment") {
							const start = parseInt(pt.startTimeNanos) / 1e6;
							const end = parseInt(pt.endTimeNanos) / 1e6;
							sleepMinutes += (end - start) / 60000;
						}
					}
				}
			}
		}

		return new Response(
			JSON.stringify({
				steps,
				calories: Math.round(calories),
				heartRate,
				sleep: +(sleepMinutes / 60).toFixed(1),
			}),
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: e?.status || 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
