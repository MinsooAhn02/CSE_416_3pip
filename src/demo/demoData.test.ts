import { afterEach, describe, expect, it } from "vitest";
import { enterGuestMode, getDemoContent } from "./demoData";
import { setGuest } from "../lib/guest";
import { useAuthStore } from "../store/useAuthStore";
import { useDataStore } from "../store/useDataStore";
import { useGoogleCalendarStore } from "../store/useGoogleCalendarStore";

const en = getDemoContent("en");
const ko = getDemoContent("ko-KR");

/** 모든 문자열 leaf를 평탄화 */
const strings = (v: unknown): string[] =>
	typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

/** 문자열은 "s"로 치환해 구조(키/배열 길이)만 비교 */
const shape = (v: unknown): unknown =>
	typeof v === "string" ? "s" : Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : v;

describe("demo content", () => {
	it("selects Korean only for ko* languages", () => {
		expect(getDemoContent("ko")).toBe(ko);
		expect(getDemoContent("en")).toBe(en);
		expect(getDemoContent(undefined)).toBe(en);
	});

	it("ko and en have identical structure", () => {
		expect(shape(ko)).toEqual(shape(en));
	});

	it("ko strings are Korean (except proper nouns / empty locations)", () => {
		const allowed = new Set(["Zoom"]);
		for (const s of strings(ko)) {
			if (s === "" || allowed.has(s) || /^[a-z0-9-]+$/.test(s)) continue; // slug
			expect(s, s).toMatch(/[가-힣]/);
		}
	});
});

describe("enterGuestMode", () => {
	afterEach(() => {
		setGuest(false);
		useAuthStore.setState({ isLoggedIn: false });
	});

	const run = (lang: string) => {
		enterGuestMode(lang);
		const cal = useGoogleCalendarStore.getState();
		const d = useDataStore.getState();
		return {
			events: cal.events.map((e) => ({ id: e.id, date: e.date, start: e.start, end: e.end, title: e.title })),
			tasks: cal.tasks.map((t) => ({ id: t.id, date: t.date, title: t.title })),
			newsUrls: d.newsResults.map((n) => n.url),
			trendCount: d.trends.length,
		};
	};

	it("keeps ids/dates/counts identical across languages, only text differs", () => {
		localStorage.clear();
		const a = run("en");
		const b = run("ko");
		const ids = (r: typeof a) => ({
			events: r.events.map(({ id, date, start, end }) => ({ id, date, start, end })),
			tasks: r.tasks.map(({ id, date }) => ({ id, date })),
			newsUrls: r.newsUrls,
			trendCount: r.trendCount,
		});
		expect(ids(b)).toEqual(ids(a));
		expect(a.events).toHaveLength(5);
		expect(b.events[2].title).toBe("헬스장");
		expect(a.events[2].title).toBe("Gym");
	});

	it("writes nothing to localStorage", () => {
		localStorage.clear();
		run("ko");
		expect(localStorage.length).toBe(0);
	});
});
