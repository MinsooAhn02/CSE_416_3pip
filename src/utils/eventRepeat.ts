import i18n from "../l10n/i18n";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR"];

interface WeekDayShort { code: string; label: string }

interface RepeatLocale {
	dayNames: string[];
	monthNames: string[];
	ordinals: string[];
	weekDaysShort: WeekDayShort[];
	repeatNone: string;
	repeatDaily: string;
	repeatWeekly: (dayName: string) => string;
	repeatMonthly: (ordinal: string, dayName: string) => string;
	repeatYearly: (monthName: string, day: number) => string;
	repeatWeekdays: string;
	repeatCustom: string;
	customIntervalLabel: (freq: string, interval: number, days?: string[]) => string;
}

const tr = (key: string, opts?: Record<string, unknown>, lang = "en"): string =>
	i18n.t(`event_repeat.${key}`, { lng: lang, ...opts }) as string;

const getRepeatLocale = (language = "en"): RepeatLocale => ({
	dayNames: [0,1,2,3,4,5,6].map((i) => tr(`day_${i}`, {}, language)),
	monthNames: [0,1,2,3,4,5,6,7,8,9,10,11].map((i) => tr(`month_${i}`, {}, language)),
	ordinals: [0,1,2,3,4].map((i) => tr(`ordinal_${i}`, {}, language)),
	weekDaysShort: [
		{ code: "MO", label: tr("weekday_short_MO", {}, language) },
		{ code: "TU", label: tr("weekday_short_TU", {}, language) },
		{ code: "WE", label: tr("weekday_short_WE", {}, language) },
		{ code: "TH", label: tr("weekday_short_TH", {}, language) },
		{ code: "FR", label: tr("weekday_short_FR", {}, language) },
		{ code: "SA", label: tr("weekday_short_SA", {}, language) },
		{ code: "SU", label: tr("weekday_short_SU", {}, language) },
	],
	repeatNone: tr("repeat_none", {}, language),
	repeatDaily: tr("repeat_daily", {}, language),
	repeatWeekly: (dayName) => tr("repeat_weekly", { dayName }, language),
	repeatMonthly: (ordinal, dayName) => tr("repeat_monthly", { ordinal, dayName }, language),
	repeatYearly: (monthName, day) => tr("repeat_yearly", { monthName, day }, language),
	repeatWeekdays: tr("repeat_weekdays", {}, language),
	repeatCustom: tr("repeat_custom", {}, language),
	customIntervalLabel: (freq, interval, days = []) => {
		if (freq === "weekly" && days.length > 0) {
			const key = interval === 1 ? "custom_weekly_days_1" : "custom_weekly_days_n";
			return tr(key, { count: interval, days: days.join(", ") }, language);
		}
		const freqKey = freq === "daily" ? "daily" : freq === "weekly" ? "weekly" : freq === "monthly" ? "monthly" : "yearly";
		const key = interval === 1 ? `custom_${freqKey}_1` : `custom_${freqKey}_n`;
		return tr(key, { count: interval }, language);
	},
});

const pad2 = (value: number): string => String(value).padStart(2, "0");

const safeParseDate = (dateStr: string | null | undefined): Date | null => {
	if (!dateStr) return null;
	const date = new Date(`${dateStr}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
};

const getWeekOfMonth = (date: Date): number => Math.ceil(date.getDate() / 7);

const getOrdinalDayCode = (date: Date): string =>
	`${Math.min(getWeekOfMonth(date), 5)}${DAY_CODES[date.getDay()]}`;

const parseRuleParts = (line = ""): Record<string, string> =>
	Object.fromEntries(
		String(line || "")
			.replace(/^RRULE:/, "")
			.split(";")
			.map((part) => {
				const [key, value] = part.split("=");
				return [key, value] as [string, string];
			})
			.filter(([key, value]) => key && value),
	);

const normalizeInterval = (value: unknown): number => {
	const parsed = Number(value || 1);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

export { DAY_CODES };

export const getWeekDaysShort = (language = "en"): WeekDayShort[] =>
	getRepeatLocale(language).weekDaysShort;

export interface RepeatOption { value: string; label: string }

export const getRepeatOptions = (dateStr: string | null | undefined, language = "en"): RepeatOption[] => {
	const locale = getRepeatLocale(language);
	const fallback = [{ value: "none", label: locale.repeatNone }];
	const date = safeParseDate(dateStr ?? null);
	if (!date) return fallback;

	const dayName = locale.dayNames[date.getDay()];
	const monthName = locale.monthNames[date.getMonth()];
	const ordinal = locale.ordinals[Math.min(getWeekOfMonth(date) - 1, 4)];

	return [
		{ value: "none", label: locale.repeatNone },
		{ value: "daily", label: locale.repeatDaily },
		{ value: "weekly", label: locale.repeatWeekly(dayName) },
		{ value: "monthly", label: locale.repeatMonthly(ordinal, dayName) },
		{ value: "yearly", label: locale.repeatYearly(monthName, date.getDate()) },
		{ value: "weekdays", label: locale.repeatWeekdays },
		{ value: "custom", label: locale.repeatCustom },
	];
};

export interface EventRepeat {
	type: string;
	frequency?: string;
	interval?: number;
	daysOfWeek?: string[];
}

export const getRepeatLabel = (
	repeat: EventRepeat | null | undefined,
	dateStr: string | null | undefined,
	language = "en",
): string => {
	const locale = getRepeatLocale(language);
	if (!repeat || !repeat.type || repeat.type === "none") return "";

	if (repeat.type === "custom") {
		const freq = repeat.frequency || "weekly";
		const interval = normalizeInterval(repeat.interval);
		const days = Array.isArray(repeat.daysOfWeek) ? repeat.daysOfWeek : [];
		if (freq === "weekly" && days.length > 0) {
			const labels = days.map((code) => {
				return locale.weekDaysShort.find((day) => day.code === code)?.label || code;
			});
			return locale.customIntervalLabel(freq, interval, labels);
		}
		return locale.customIntervalLabel(freq, interval);
	}

	return (
		getRepeatOptions(dateStr, language).find((option) => option.value === repeat.type)?.label ||
		""
	);
};

export interface RepeatFormData {
	repeatType: string;
	frequency?: string;
	interval?: number;
	daysOfWeek?: string[];
}

export const buildRepeatObject = (formData: {
	repeatType: string;
	customFreq?: string;
	customInterval?: string | number;
	customDays?: string[];
}): EventRepeat | null => {
	if (formData.repeatType === "none") return null;
	if (formData.repeatType !== "custom") return { type: formData.repeatType };
	return {
		type: "custom",
		frequency: formData.customFreq,
		interval: normalizeInterval(formData.customInterval),
		daysOfWeek: formData.customDays,
	};
};

export const formDataFromRepeat = (repeat: EventRepeat | null | undefined): {
	repeatType: string;
	customFreq: string;
	customInterval: string;
	customDays: string[];
} => {
	let repeatType = "none";
	let customFreq = "weekly";
	let customInterval = "1";
	let customDays: string[] = [];

	if (repeat && repeat.type) {
		repeatType = repeat.type;
		if (repeat.type === "custom") {
			customFreq = repeat.frequency || "weekly";
			customInterval = String(normalizeInterval(repeat.interval));
			customDays = repeat.daysOfWeek || [];
		}
	}

	return { repeatType, customFreq, customInterval, customDays };
};

export const buildEventRecurrence = (
	repeat: EventRepeat | null | undefined,
	dateStr: string | null | undefined,
): string[] => {
	const date = safeParseDate(dateStr ?? null);
	if (!repeat?.type || repeat.type === "none" || !date) return [];

	let rule = "";

	switch (repeat.type) {
		case "daily":
			rule = "FREQ=DAILY";
			break;
		case "weekly":
			rule = `FREQ=WEEKLY;BYDAY=${DAY_CODES[date.getDay()]}`;
			break;
		case "monthly":
			rule = `FREQ=MONTHLY;BYDAY=${getOrdinalDayCode(date)}`;
			break;
		case "yearly":
			rule = "FREQ=YEARLY";
			break;
		case "weekdays":
			rule = `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES.join(",")}`;
			break;
		case "custom": {
			const freq = String(repeat.frequency || "weekly").toUpperCase();
			const interval = normalizeInterval(repeat.interval);
			const parts = [`FREQ=${freq}`];
			if (interval > 1) parts.push(`INTERVAL=${interval}`);

			if (freq === "WEEKLY") {
				const days =
					Array.isArray(repeat.daysOfWeek) && repeat.daysOfWeek.length > 0
						? repeat.daysOfWeek
						: [DAY_CODES[date.getDay()]];
				parts.push(`BYDAY=${days.join(",")}`);
			}

			if (freq === "MONTHLY") {
				parts.push(`BYMONTHDAY=${date.getDate()}`);
			}

			rule = parts.join(";");
			break;
		}
		default:
			rule = "";
	}

	return rule ? [`RRULE:${rule}`] : [];
};

export const parseEventRepeat = (
	recurrence: string[] = [],
	anchorDate = "",
): EventRepeat | null => {
	const rrule = (Array.isArray(recurrence) ? recurrence : []).find((line) =>
		String(line || "").startsWith("RRULE:"),
	);
	if (!rrule) return null;

	const rule = parseRuleParts(rrule);
	const freq = String(rule.FREQ || "").toUpperCase();
	const interval = normalizeInterval(rule.INTERVAL);
	const byDay = String(rule.BYDAY || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

	if (freq === "DAILY" && interval === 1) return { type: "daily" };

	if (freq === "WEEKLY") {
		if (
			interval === 1 &&
			byDay.length === WEEKDAY_CODES.length &&
			WEEKDAY_CODES.every((code, index) => byDay[index] === code)
		) {
			return { type: "weekdays" };
		}

		if (interval === 1 && byDay.length === 1 && /^[A-Z]{2}$/.test(byDay[0])) {
			return { type: "weekly" };
		}

		return {
			type: "custom",
			frequency: "weekly",
			interval,
			daysOfWeek: byDay.map((value) => value.slice(-2)),
		};
	}

	if (freq === "MONTHLY") {
		if (interval === 1 && byDay.length === 1 && /^[1-5][A-Z]{2}$/.test(byDay[0])) {
			return { type: "monthly" };
		}
		return { type: "custom", frequency: "monthly", interval, daysOfWeek: [] };
	}

	if (freq === "YEARLY") {
		if (interval === 1) return { type: "yearly" };
		return { type: "custom", frequency: "yearly", interval, daysOfWeek: [] };
	}

	if (freq === "DAILY") {
		return { type: "custom", frequency: "daily", interval, daysOfWeek: [] };
	}

	return anchorDate ? { type: "custom", frequency: "weekly", interval, daysOfWeek: [] } : null;
};

export const getRepeatSummaryDate = (dateStr = ""): string => {
	const date = safeParseDate(dateStr);
	if (!date) return "";
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
