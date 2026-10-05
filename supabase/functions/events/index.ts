import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleErrorSummary } from "../_shared/googleError.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const CALENDAR_BASE_URL =
	"https://www.googleapis.com/calendar/v3/calendars/primary/events";

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: {
			...corsHeaders,
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});

const addDays = (dateStr: string, days: number) => {
	const next = new Date(`${dateStr}T00:00:00Z`);
	next.setUTCDate(next.getUTCDate() + days);
	return next.toISOString().slice(0, 10);
};

const formatUtcTime = (date: Date) =>
	`${String(date.getUTCHours()).padStart(2, "0")}:${String(
		date.getUTCMinutes(),
	).padStart(2, "0")}`;

const addHourFromStart = (dateStr: string, timeStr: string) => {
	const [hours = "9", minutes = "0"] = timeStr.split(":");
	const base = new Date(`${dateStr}T00:00:00Z`);
	base.setUTCHours(Number(hours), Number(minutes), 0, 0);
	base.setUTCHours(base.getUTCHours() + 1);
	return {
		date: base.toISOString().slice(0, 10),
		time: formatUtcTime(base),
	};
};

const formatEvent = (event: any) => ({
	id: event.id,
	title: event.summary ?? "",
	start: event.start?.dateTime || event.start?.date,
	end: event.end?.dateTime || event.end?.date,
	allDay: !!event.start?.date,
	location: event.location || null,
	description: event.description || null,
	attendees: Array.isArray(event.attendees)
		? event.attendees.map((attendee: any) => ({
				email: attendee.email || null,
				displayName: attendee.displayName || null,
				responseStatus: attendee.responseStatus || "needsAction",
				optional: !!attendee.optional,
			}))
		: [],
	visibility: event.visibility || "default",
	availability: event.transparency === "transparent" ? "free" : "busy",
	meetLink:
		event.hangoutLink ||
		event.conferenceData?.entryPoints?.find(
			(entryPoint: any) => entryPoint.entryPointType === "video",
		)?.uri ||
		null,
	addGoogleMeet: !!(
		event.hangoutLink ||
		event.conferenceData?.createRequest ||
		event.conferenceData?.entryPoints?.length
	),
	conferenceStatus:
		event.conferenceData?.createRequest?.status?.statusCode || null,
	remindersUseDefault: event.reminders?.useDefault !== false,
	reminderOverrides: Array.isArray(event.reminders?.overrides)
		? event.reminders.overrides.map((override: any) => ({
				method: override.method || "popup",
				minutes: Number(override.minutes || 0),
			}))
		: [],
	recurrence: Array.isArray(event.recurrence) ? event.recurrence : [],
	recurringEventId: event.recurringEventId || null,
	originalStartTime:
		event.originalStartTime?.dateTime || event.originalStartTime?.date || null,
});

const parseAttendees = (payload: Record<string, unknown>) => {
	const attendees = Array.isArray(payload.attendees) ? payload.attendees : [];
	return attendees
		.map((attendee) => {
			if (typeof attendee === "string") {
				const email = attendee.trim();
				return email ? { email } : null;
			}

			if (!attendee || typeof attendee !== "object") return null;

			const email = String((attendee as Record<string, unknown>).email || "").trim();
			if (!email) return null;

			return {
				email,
				displayName:
					String(
						(attendee as Record<string, unknown>).displayName || "",
					).trim() || undefined,
				optional: Boolean(
					(attendee as Record<string, unknown>).optional || false,
				),
				responseStatus:
					String(
						(attendee as Record<string, unknown>).responseStatus ||
							"needsAction",
					).trim() || "needsAction",
			};
		})
		.filter(Boolean);
};

const parseReminderOverrides = (payload: Record<string, unknown>) => {
	const overrides = Array.isArray(payload.reminderOverrides)
		? payload.reminderOverrides
		: [];

	return overrides
		.map((override) => {
			if (!override || typeof override !== "object") return null;
			const method =
				String((override as Record<string, unknown>).method || "popup").trim() ||
				"popup";
			const minutes = Number(
				(override as Record<string, unknown>).minutes ?? NaN,
			);
			if (!Number.isFinite(minutes) || minutes < 0) return null;
			return {
				method: method === "email" ? "email" : "popup",
				minutes,
			};
		})
		.filter(Boolean);
};

const buildEventPayload = (payload: Record<string, unknown>) => {
	const title = String(payload.title || "").trim();
	const date = String(payload.date || "").trim();
	const location = String(payload.location || "").trim() || undefined;
	const description = String(payload.description || "").trim() || undefined;
	const startTime = String(payload.startTime || "").trim();
	const endTime = String(payload.endTime || "").trim();
	const timeZone = String(payload.timeZone || "UTC").trim() || "UTC";
	const allDay = Boolean(payload.allDay) || (!startTime && !endTime);
	const attendees = parseAttendees(payload);
	const visibility = String(payload.visibility || "default").trim() || "default";
	const availability =
		String(payload.availability || "busy").trim() === "free"
			? "transparent"
			: "opaque";
	const remindersUseDefault = payload.remindersUseDefault !== false;
	const reminderOverrides = parseReminderOverrides(payload);
	const addGoogleMeet = Boolean(payload.addGoogleMeet);
	const clearConference = Boolean(payload.clearConference);
	const recurrence = Array.isArray(payload.recurrence)
		? payload.recurrence
				.map((item) => String(item || "").trim())
				.filter(Boolean)
		: [];
	const hasExistingConference =
		Boolean(payload.meetLink) || Boolean(payload.conferenceStatus);

	const basePayload: Record<string, unknown> = {
		summary: title,
		location,
		description,
		visibility,
		transparency: availability,
	};

	if (Array.isArray(payload.attendees)) {
		basePayload.attendees = attendees;
	}

	if ("recurrence" in payload) {
		basePayload.recurrence = recurrence;
	}

	if (remindersUseDefault) {
		basePayload.reminders = { useDefault: true };
	} else {
		basePayload.reminders = {
			useDefault: false,
			overrides: reminderOverrides,
		};
	}

	if (clearConference) {
		basePayload.conferenceData = null;
	} else if (addGoogleMeet && !hasExistingConference) {
		basePayload.conferenceData = {
			createRequest: {
				requestId: crypto.randomUUID(),
				conferenceSolutionKey: {
					type: "hangoutsMeet",
				},
			},
		};
	}

	if (!date) {
		throw new Error("Event date is required");
	}

	if (allDay) {
		return {
			...basePayload,
			start: { date },
			end: { date: addDays(date, 1) },
		};
	}

	const safeStartTime = startTime || "09:00";
	const startDateTime = `${date}T${safeStartTime}:00`;

	let safeEndTime = endTime || safeStartTime;
	let endDate = date;
	if (safeEndTime <= safeStartTime) {
		const fallbackEnd = addHourFromStart(date, safeStartTime);
		safeEndTime = fallbackEnd.time;
		endDate = fallbackEnd.date;
	}

	return {
		...basePayload,
		start: { dateTime: startDateTime, timeZone },
		end: { dateTime: `${endDate}T${safeEndTime}:00`, timeZone },
	};
};

const buildEventQuery = (payload: Record<string, unknown>) => {
	const query: Record<string, string> = {};
	const hasGuests =
		Array.isArray(payload.attendees) && payload.attendees.length > 0;
	const wantsConference =
		Boolean(payload.addGoogleMeet) || Boolean(payload.clearConference);
	const shouldSendUpdates = Boolean(payload.sendUpdates);

	if (wantsConference) {
		query.conferenceDataVersion = "1";
	}

	if (hasGuests) {
		query.sendUpdates = shouldSendUpdates ? "all" : "none";
	}

	return query;
};

const getListRange = (payload: Record<string, unknown>) => {
	const now = new Date();
	const date = typeof payload.date === "string" ? payload.date : null;
	const todayOnly = Boolean(payload.todayOnly);
	const timeMinInput =
		typeof payload.timeMin === "string" ? payload.timeMin : null;
	const timeMaxInput =
		typeof payload.timeMax === "string" ? payload.timeMax : null;

	if (timeMinInput && timeMaxInput) {
		return { timeMin: timeMinInput, timeMax: timeMaxInput };
	}

	if (date) {
		const startOfDay = new Date(`${date}T00:00:00`);
		const endOfDay = new Date(startOfDay);
		endOfDay.setHours(23, 59, 59, 999);
		return {
			timeMin: startOfDay.toISOString(),
			timeMax: endOfDay.toISOString(),
		};
	}

	if (todayOnly) {
		const endOfDay = new Date(now);
		endOfDay.setHours(23, 59, 59, 999);
		return {
			timeMin: now.toISOString(),
			timeMax: endOfDay.toISOString(),
		};
	}

	const nextWeek = new Date(now);
	nextWeek.setDate(nextWeek.getDate() + 7);
	return {
		timeMin: now.toISOString(),
		timeMax: nextWeek.toISOString(),
	};
};


const googleFetch = async (
	token: string,
	path = "",
	init: RequestInit = {},
	query: Record<string, string> = {},
) => {
	const headers = new Headers(init.headers || {});
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("Content-Type", "application/json");

	const params = new URLSearchParams(query);
	const querySuffix = params.toString() ? `?${params.toString()}` : "";

	const response = await fetch(`${CALENDAR_BASE_URL}${path}${querySuffix}`, {
		...init,
		headers,
	});

	if (!response.ok) {
		throw new Error(await googleErrorSummary("Google Calendar", response, "events"));
	}

	if (response.status === 204) {
		return null;
	}

	return await response.json();
};

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

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
		const body = await req.json();
		const { token } = body;
		const action = body.action || "list";
		if (!token) throw new Error("Google OAuth token required");

		if (action === "create") {
			const created = await googleFetch(token, "", {
				method: "POST",
				body: JSON.stringify(buildEventPayload(body)),
			}, buildEventQuery(body));
			return json(formatEvent(created));
		}

		if (action === "update") {
			const eventId = String(body.eventId || "").trim();
			if (!eventId) throw new Error("eventId is required for update");

			const updated = await googleFetch(
				token,
				`/${encodeURIComponent(eventId)}`,
				{
					method: "PATCH",
					body: JSON.stringify(buildEventPayload(body)),
				},
				buildEventQuery(body),
			);
			return json(formatEvent(updated));
		}

		if (action === "read") {
			const eventId = String(body.eventId || "").trim();
			if (!eventId) throw new Error("eventId is required for read");

			const event = await googleFetch(
				token,
				`/${encodeURIComponent(eventId)}`,
				{},
				{ conferenceDataVersion: "1" },
			);
			return json(formatEvent(event));
		}

		if (action === "delete") {
			const eventId = String(body.eventId || "").trim();
			if (!eventId) throw new Error("eventId is required for delete");

			await googleFetch(token, `/${encodeURIComponent(eventId)}`, {
				method: "DELETE",
			});
			return json({ success: true, id: eventId });
		}

		const { timeMin, timeMax } = getListRange(body);
		const params = new URLSearchParams({
			timeMin,
			timeMax,
			singleEvents: "true",
			orderBy: "startTime",
			maxResults: "100",
			conferenceDataVersion: "1",
		});
		const data = await googleFetch(token, `?${params.toString()}`);
		const events = (data?.items || []).map(formatEvent);

		return json(events);
	} catch (e) {
		return json(
			{ error: e.message },
			{
				status: 400,
			},
		);
	}
});
