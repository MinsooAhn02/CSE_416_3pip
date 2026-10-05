// @vitest-environment node
import { describe, it, expect } from "vitest";
import { doesTaskOccurOnDate, isTaskCompletedOnDate, materializeTasksForDate, getTaskDisplayDate } from "./taskRecurrence";

// Tasks are single-date (Google Tasks has no recurrence); the date comes from date > due > occurrenceDate > seriesStartDate.
describe("taskRecurrence", () => {
	it("occurs only on its own date", () => {
		const t = { date: "2026-10-06" };
		expect(doesTaskOccurOnDate(t, "2026-10-06")).toBe(true);
		expect(doesTaskOccurOnDate(t, "2026-10-07")).toBe(false);
		expect(doesTaskOccurOnDate(t, "")).toBe(false);
	});

	it("does not recur daily/weekly/monthly even if hinted by extra fields", () => {
		const t = { date: "2026-10-06", repeat: "daily", recurrence: ["RRULE:FREQ=WEEKLY"] };
		expect(doesTaskOccurOnDate(t, "2026-10-07")).toBe(false);
		expect(doesTaskOccurOnDate(t, "2026-10-13")).toBe(false);
		expect(doesTaskOccurOnDate(t, "2026-11-06")).toBe(false);
	});

	it("resolves date by priority and trims an RFC3339 due to 10 chars", () => {
		expect(getTaskDisplayDate({ date: "2026-01-01", due: "2026-02-02" })).toBe("2026-01-01");
		expect(getTaskDisplayDate({ due: "2026-02-02T00:00:00.000Z" })).toBe("2026-02-02");
		expect(getTaskDisplayDate({ occurrenceDate: "2026-03-03" })).toBe("2026-03-03");
		expect(getTaskDisplayDate({ seriesStartDate: " 2026-04-04 " })).toBe("2026-04-04");
		expect(getTaskDisplayDate({})).toBe("");
	});

	it("an undated task never matches a real date", () => {
		expect(doesTaskOccurOnDate({}, "2026-10-06")).toBe(false);
	});

	it("isTaskCompletedOnDate requires same date and completed", () => {
		expect(isTaskCompletedOnDate({ date: "2026-10-06", completed: true }, "2026-10-06")).toBe(true);
		expect(isTaskCompletedOnDate({ date: "2026-10-06", completed: false }, "2026-10-06")).toBe(false);
		expect(isTaskCompletedOnDate({ date: "2026-10-06" }, "2026-10-06")).toBe(false);
		expect(isTaskCompletedOnDate({ date: "2026-10-06", completed: true }, "2026-10-07")).toBe(false);
	});

	it("materializeTasksForDate filters, stamps dates and coerces completed", () => {
		const out = materializeTasksForDate(
			[
				{ id: "a", due: "2026-10-06T00:00:00Z", completed: true },
				{ id: "b", date: "2026-10-06" },
				{ id: "c", date: "2026-10-07", completed: true },
			],
			"2026-10-06",
		);
		expect(out.map((t) => t.id)).toEqual(["a", "b"]);
		expect(out[0]).toMatchObject({ occurrenceDate: "2026-10-06", seriesStartDate: "2026-10-06", completed: true });
		expect(out[1].completed).toBe(false);
	});

	it("materializeTasksForDate tolerates empty/invalid input and does not mutate", () => {
		expect(materializeTasksForDate(undefined, "2026-10-06")).toEqual([]);
		expect(materializeTasksForDate(null as never, "2026-10-06")).toEqual([]);
		const src = { id: "x", date: "2026-10-06" };
		materializeTasksForDate([src], "2026-10-06");
		expect(src).toEqual({ id: "x", date: "2026-10-06" });
	});
});
