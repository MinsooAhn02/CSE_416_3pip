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
		const { token, todayOnly = false } = await req.json();
		if (!token) throw new Error("Google OAuth token required");

		const now = new Date();
		const timeMin = now.toISOString();
		const endOfDay = new Date(now);
		endOfDay.setHours(23, 59, 59, 999);

		let timeMax: Date;
		if (todayOnly) {
			// 오늘 일정만
			timeMax = endOfDay;
		} else {
			// 오늘 + 다음 7일까지 이벤트
			timeMax = new Date(now);
			timeMax.setDate(timeMax.getDate() + 7);
		}

		const params = new URLSearchParams({
			timeMin,
			timeMax: timeMax.toISOString(),
			singleEvents: "true",
			orderBy: "startTime",
			maxResults: "20",
		});

		const res = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		if (!res.ok)
			throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
		const data = await res.json();

		const events = (data.items || []).map((e: any) => ({
			id: e.id,
			title: e.summary || "(제목 없음)",
			start: e.start?.dateTime || e.start?.date,
			end: e.end?.dateTime || e.end?.date,
			allDay: !!e.start?.date,
			location: e.location || null,
			description: e.description || null,
		}));

		return new Response(JSON.stringify(events), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
