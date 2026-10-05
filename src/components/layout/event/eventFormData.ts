import i18n from "../../../l10n/i18n";
import type { CalendarEvent } from "../../../store/useGoogleCalendarStore";
import { formDataFromRepeat } from "../../../utils/eventRepeat";

export const EMPTY_FORM = {
	title: "",
	allDay: false,
	startTime: "",
	endTime: "",
	description: "",
	location: "",
	guestEmailsText: "",
	addGoogleMeet: false,
	visibility: "default",
	availability: "busy",
	reminderMode: "none",
	reminderMinutes: "30",
	sendUpdates: true,
	...formDataFromRepeat(null),
};

export const getRoundedDefaultEventStartTime = (baseDate = new Date()) => {
	const rounded = new Date(baseDate);
	rounded.setSeconds(0, 0);
	const roundedMinutes = Math.ceil(rounded.getMinutes() / 30) * 30;
	if (roundedMinutes === 60) {
		rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
	} else {
		rounded.setMinutes(roundedMinutes, 0, 0);
	}
	return `${String(rounded.getHours()).padStart(2, "0")}:${String(
		rounded.getMinutes(),
	).padStart(2, "0")}`;
};

export const getDefaultEventEndTime = (startTime: string) => {
	if (!startTime) return "";
	const [hoursRaw, minutesRaw] = String(startTime).split(":");
	const hours = Number(hoursRaw);
	const minutes = Number(minutesRaw || 0);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
	const end = new Date();
	end.setHours(hours, minutes, 0, 0);
	end.setMinutes(end.getMinutes() + 60);
	return `${String(end.getHours()).padStart(2, "0")}:${String(
		end.getMinutes(),
	).padStart(2, "0")}`;
};

export const getEmptyForm = () => {
	const startTime = getRoundedDefaultEventStartTime();
	return {
		...EMPTY_FORM,
		startTime,
		endTime: getDefaultEventEndTime(startTime),
	};
};

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const parseGuestEmailsText = (rawText: unknown) =>
	Array.from(
		new Set(
			String(rawText || "")
				.split(/[\n,;]/)
				.map((entry) => entry.trim())
				.filter((entry) => EMAIL_PATTERN.test(entry)),
		),
	).map((email) => ({ email }));

export const formatReminderMinutes = (minutes: unknown, language = "en") => {
	const lng = language;
	const value = Number(minutes || 0);
	if (!Number.isFinite(value) || value <= 0) {
		return i18n.t("events.reminder_custom", { lng });
	}
	if (value === 1440) return i18n.t("events.reminder_1day", { lng });
	if (value % 60 === 0) {
		const hours = value / 60;
		return i18n.t("events.reminder_hours", { count: hours, lng });
	}
	return i18n.t("events.reminder_minutes", { count: value, lng });
};

export const getReminderFormState = (event: CalendarEvent | null | undefined) => {
	if (event?.remindersUseDefault !== false) {
		return {
			reminderMode: "default",
			reminderMinutes: "30",
		};
	}

	const firstOverride = Array.isArray(event?.reminderOverrides)
		? event.reminderOverrides[0]
		: null;

	if (!firstOverride) {
		return {
			reminderMode: "none",
			reminderMinutes: "30",
		};
	}

	return {
		reminderMode: "custom",
		reminderMinutes: String(firstOverride.minutes || 30),
	};
};

export const formatReminderLabel = (event: CalendarEvent | null | undefined, language = "en") => {
	const lng = language;
	if (event?.remindersUseDefault !== false) {
		return i18n.t("events.calendar_default", { lng });
	}
	if (!Array.isArray(event?.reminderOverrides) || event.reminderOverrides.length === 0) {
		return i18n.t("events.no_reminder", { lng });
	}
	return formatReminderMinutes(event.reminderOverrides[0].minutes, language);
};

export const getLocaleTag = (language: string) => (language === "ko" ? "ko-KR" : "en-US");

export const formatTimeLabel = (timeStr: unknown, language = "en"): string => {
	if (!timeStr) return "";
	const [hoursRaw, minutesRaw] = String(timeStr).split(":");
	const hours = Number(hoursRaw);
	if (Number.isNaN(hours)) return String(timeStr);
	const minutes = Number(minutesRaw || 0);
	if (Number.isNaN(minutes)) return String(timeStr);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date.toLocaleTimeString(getLocaleTag(language), {
		hour: "numeric",
		minute: "2-digit",
	});
};

export const formatEventTimeLabel = (event: CalendarEvent | null | undefined, language = "en") => {
	if (event?.allDay) return i18n.t("common.all_day", { lng: language });
	if (event?.startTime && event?.endTime) {
		return `${formatTimeLabel(event.startTime, language)} - ${formatTimeLabel(
			event.endTime,
			language,
		)}`;
	}
	return formatTimeLabel(event?.startTime || event?.endTime || "", language);
};

export const getDisplayEventTitle = (eventOrTitle: CalendarEvent | string | null | undefined, noTitleLabel = "(no title)") => {
	const rawTitle =
		typeof eventOrTitle === "string" ? eventOrTitle : eventOrTitle?.title;
	const title = String(rawTitle ?? "").trim();
	return title || noTitleLabel;
};

export const formatMeetLinkLabel = (url: unknown) => {
	const normalized = String(url || "").trim();
	if (!normalized) return "";
	return normalized.replace(/^https?:\/\//i, "");
};

export const formDataFromEvent = (event: CalendarEvent) => {
	const reminderState = getReminderFormState(event);
	return {
		title: event.title || "",
		allDay: !!event.allDay,
		startTime: event.startTime || "",
		endTime: event.endTime || "",
		description: event.description || "",
		location: event.location || "",
		guestEmailsText: (event.attendees || [])
			.map((attendee) => attendee.email)
			.filter(Boolean)
			.join(", "),
		addGoogleMeet: !!event.addGoogleMeet,
		visibility: event.visibility || "default",
		availability: event.availability || "busy",
		reminderMode: reminderState.reminderMode,
		reminderMinutes: reminderState.reminderMinutes,
		sendUpdates: event.sendUpdates ?? true,
		...formDataFromRepeat(event.repeat || null),
	};
};

export type EventFormData = ReturnType<typeof getEmptyForm>;

/** CalendarEvent extended with local UI-only fields */
export type CalendarEventDetail = CalendarEvent & {
	seriesStartDate?: string;
};
