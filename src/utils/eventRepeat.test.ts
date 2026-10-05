import { describe, it, expect } from "vitest";
import {
	buildEventRecurrence, parseEventRepeat, buildRepeatObject, formDataFromRepeat, getRepeatOptions, getRepeatLabel,
	type EventRepeat,
} from "./eventRepeat";

// 2026-10-06 is a Tuesday, 1st Tuesday of the month. 2026-10-15 is a Thursday (3rd), 10-29 the 5th Thursday.
const TUE = "2026-10-06";

describe("buildEventRecurrence", () => {
	it.each<[EventRepeat, string, string[]]>([
		[{ type: "daily" }, TUE, ["RRULE:FREQ=DAILY"]],
		[{ type: "weekly" }, TUE, ["RRULE:FREQ=WEEKLY;BYDAY=TU"]],
		[{ type: "monthly" }, TUE, ["RRULE:FREQ=MONTHLY;BYDAY=1TU"]],
		[{ type: "monthly" }, "2026-10-15", ["RRULE:FREQ=MONTHLY;BYDAY=3TH"]],
		[{ type: "monthly" }, "2026-10-29", ["RRULE:FREQ=MONTHLY;BYDAY=5TH"]],
		[{ type: "yearly" }, TUE, ["RRULE:FREQ=YEARLY"]],
		[{ type: "weekdays" }, TUE, ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]],
		[{ type: "custom", frequency: "weekly", interval: 2, daysOfWeek: ["MO", "FR"] }, TUE, ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR"]],
		[{ type: "custom", frequency: "weekly" }, TUE, ["RRULE:FREQ=WEEKLY;BYDAY=TU"]],
		[{ type: "custom", frequency: "monthly", interval: 3 }, TUE, ["RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=6"]],
		[{ type: "custom", frequency: "daily", interval: 1 }, TUE, ["RRULE:FREQ=DAILY"]],
	])("%j on %s", (repeat, date, expected) => {
		expect(buildEventRecurrence(repeat, date)).toEqual(expected);
	});

	it.each<[EventRepeat | null | undefined, string | null]>([
		[null, TUE],
		[undefined, TUE],
		[{ type: "none" }, TUE],
		[{ type: "daily" }, ""],
		[{ type: "daily" }, null],
		[{ type: "daily" }, "not-a-date"],
		[{ type: "bogus" }, TUE],
	])("returns [] for invalid input %j / %j", (repeat, date) => {
		expect(buildEventRecurrence(repeat, date)).toEqual([]);
	});
});

describe("parseEventRepeat", () => {
	it.each<[EventRepeat]>([
		[{ type: "daily" }],
		[{ type: "weekly" }],
		[{ type: "monthly" }],
		[{ type: "yearly" }],
		[{ type: "weekdays" }],
	])("round-trips %j", (repeat) => {
		expect(parseEventRepeat(buildEventRecurrence(repeat, TUE), TUE)).toEqual(repeat);
	});

	it("round-trips custom weekly with interval and days", () => {
		const r = { type: "custom", frequency: "weekly", interval: 2, daysOfWeek: ["MO", "FR"] };
		expect(parseEventRepeat(buildEventRecurrence(r, TUE), TUE)).toEqual(r);
	});

	it("parses interval>1 daily/yearly and non-ordinal monthly as custom", () => {
		expect(parseEventRepeat(["RRULE:FREQ=DAILY;INTERVAL=3"])).toEqual({ type: "custom", frequency: "daily", interval: 3, daysOfWeek: [] });
		expect(parseEventRepeat(["RRULE:FREQ=YEARLY;INTERVAL=2"])).toEqual({ type: "custom", frequency: "yearly", interval: 2, daysOfWeek: [] });
		expect(parseEventRepeat(["RRULE:FREQ=MONTHLY;BYMONTHDAY=6"])).toEqual({ type: "custom", frequency: "monthly", interval: 1, daysOfWeek: [] });
	});

	it("ignores non-RRULE lines and invalid input", () => {
		expect(parseEventRepeat(["EXDATE:20261007"])).toBeNull();
		expect(parseEventRepeat([])).toBeNull();
		expect(parseEventRepeat(undefined)).toBeNull();
		expect(parseEventRepeat(null as never)).toBeNull();
		expect(parseEventRepeat(["RRULE:FREQ=SECONDLY"], "")).toBeNull();
		expect(parseEventRepeat(["RRULE:FREQ=SECONDLY"], TUE)).toMatchObject({ type: "custom" });
	});

	it("treats a bad INTERVAL as 1", () => {
		expect(parseEventRepeat(["RRULE:FREQ=DAILY;INTERVAL=abc"])).toEqual({ type: "daily" });
		expect(parseEventRepeat(["RRULE:FREQ=DAILY;INTERVAL=-2"])).toEqual({ type: "daily" });
	});
});

describe("form <-> repeat object", () => {
	it("buildRepeatObject", () => {
		expect(buildRepeatObject({ repeatType: "none" })).toBeNull();
		expect(buildRepeatObject({ repeatType: "daily" })).toEqual({ type: "daily" });
		expect(buildRepeatObject({ repeatType: "custom", customFreq: "weekly", customInterval: "0", customDays: ["MO"] }))
			.toEqual({ type: "custom", frequency: "weekly", interval: 1, daysOfWeek: ["MO"] });
		expect(buildRepeatObject({ repeatType: "custom", customFreq: "daily", customInterval: "4" })?.interval).toBe(4);
	});
	it("formDataFromRepeat", () => {
		expect(formDataFromRepeat(null)).toEqual({ repeatType: "none", customFreq: "weekly", customInterval: "1", customDays: [] });
		expect(formDataFromRepeat({ type: "custom", frequency: "daily", interval: 3 }))
			.toEqual({ repeatType: "custom", customFreq: "daily", customInterval: "3", customDays: [] });
	});
});

describe("labels", () => {
	it("options fall back to only 'none' for bad dates", () => {
		expect(getRepeatOptions("garbage")).toHaveLength(1);
		expect(getRepeatOptions(null)[0].value).toBe("none");
		expect(getRepeatOptions(TUE).map((o) => o.value)).toEqual(["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"]);
	});
	it("getRepeatLabel is empty for none and non-empty for daily", () => {
		expect(getRepeatLabel(null, TUE)).toBe("");
		expect(getRepeatLabel({ type: "none" }, TUE)).toBe("");
		expect(getRepeatLabel({ type: "daily" }, TUE)).not.toBe("");
		expect(getRepeatLabel({ type: "daily" }, "garbage")).toBe("");
	});
});
