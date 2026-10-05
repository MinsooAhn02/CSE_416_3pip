// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { pad2, formatLocalDate, parseDateString, shiftDateString, isSameLocalDate } from "./date";

afterEach(() => vi.useRealTimers());

describe("date utils (TZ Asia/Seoul)", () => {
	it("pad2 pads numbers and strings", () => {
		expect(pad2(5)).toBe("05");
		expect(pad2("7")).toBe("07");
		expect(pad2(12)).toBe("12");
	});

	it("formatLocalDate at 08:30 KST is the local date, not the UTC date", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-05T23:30:00Z")); // 2026-10-06 08:30 KST
		expect(new Date().toISOString().slice(0, 10)).toBe("2026-10-05"); // the trap
		expect(formatLocalDate()).toBe("2026-10-06");
	});

	it("formatLocalDate accepts Date and does not mutate it", () => {
		const d = new Date("2026-03-09T15:30:00Z"); // 03-10 00:30 KST
		expect(formatLocalDate(d)).toBe("2026-03-10");
		expect(d.toISOString()).toBe("2026-03-09T15:30:00.000Z");
	});

	it("parseDateString gives local midnight", () => {
		const d = parseDateString("2026-02-03");
		expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 3, 0]);
	});

	it("shiftDateString crosses month and year boundaries and leap day", () => {
		expect(shiftDateString("2026-01-31", 1)).toBe("2026-02-01");
		expect(shiftDateString("2026-12-31", 1)).toBe("2027-01-01");
		expect(shiftDateString("2026-01-01", -1)).toBe("2025-12-31");
		expect(shiftDateString("2028-02-28", 1)).toBe("2028-02-29");
		expect(shiftDateString("2026-02-28", 1)).toBe("2026-03-01");
		expect(shiftDateString("2026-05-10", 0)).toBe("2026-05-10");
		expect(shiftDateString("2026-01-01", 365)).toBe("2027-01-01");
	});

	it("isSameLocalDate compares local dates", () => {
		expect(isSameLocalDate(new Date("2026-10-05T23:30:00Z"), "2026-10-06")).toBe(true);
		expect(isSameLocalDate(new Date("2026-10-05T23:30:00Z"), "2026-10-05")).toBe(false);
	});
});
