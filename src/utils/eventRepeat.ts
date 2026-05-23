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

const getRepeatLocale = (language = "en"): RepeatLocale =>
	language === "ko"
		? {
				dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
				monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
				ordinals: ["첫째", "둘째", "셋째", "넷째", "다섯째"],
				weekDaysShort: [
					{ code: "MO", label: "월" }, { code: "TU", label: "화" }, { code: "WE", label: "수" },
					{ code: "TH", label: "목" }, { code: "FR", label: "금" }, { code: "SA", label: "토" },
					{ code: "SU", label: "일" },
				],
				repeatNone: "반복 안 함",
				repeatDaily: "매일",
				repeatWeekly: (dayName) => `매주 ${dayName}`,
				repeatMonthly: (ordinal, dayName) => `매월 ${ordinal} ${dayName}`,
				repeatYearly: (monthName, day) => `매년 ${monthName} ${day}일`,
				repeatWeekdays: "매주 평일",
				repeatCustom: "사용자 지정...",
				customIntervalLabel: (freq, interval, days = []) => {
					if (freq === "weekly" && days.length > 0) {
						return `${interval === 1 ? "매주" : `매 ${interval}주`} ${days.join(", ")}`;
					}
					if (freq === "daily") return interval === 1 ? "매일" : `매 ${interval}일`;
					if (freq === "weekly") return interval === 1 ? "매주" : `매 ${interval}주`;
					if (freq === "monthly") return interval === 1 ? "매월" : `매 ${interval}개월`;
					return interval === 1 ? "매년" : `매 ${interval}년`;
				},
			}
		: {
				dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
				monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
				ordinals: ["first", "second", "third", "fourth", "fifth"],
				weekDaysShort: [
					{ code: "MO", label: "Mon" }, { code: "TU", label: "Tue" }, { code: "WE", label: "Wed" },
					{ code: "TH", label: "Thu" }, { code: "FR", label: "Fri" }, { code: "SA", label: "Sat" },
					{ code: "SU", label: "Sun" },
				],
				repeatNone: "Does not repeat",
				repeatDaily: "Daily",
				repeatWeekly: (dayName) => `Weekly on ${dayName}`,
				repeatMonthly: (ordinal, dayName) => `Monthly on the ${ordinal} ${dayName}`,
				repeatYearly: (monthName, day) => `Annually on ${monthName} ${day}`,
				repeatWeekdays: "Every weekday (Monday to Friday)",
				repeatCustom: "Custom...",
				customIntervalLabel: (freq, interval, days = []) => {
					if (freq === "weekly" && days.length > 0) {
						return `Every ${interval > 1 ? `${interval} weeks` : "week"} on ${days.join(", ")}`;
					}
					const unit =
						freq === "daily" ? "day"
						: freq === "weekly" ? "week"
						: freq === "monthly" ? "month"
						: "year";
					return `Every ${interval > 1 ? `${interval} ${unit}s` : unit}`;
				},
			};

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
