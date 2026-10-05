// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isLowQualityResult as bad, cleanSnippet, isRelevantWikiResult as rel, dedupeItemsAcrossSections } from "./articleQuality";

describe("isLowQualityResult", () => {
	it.each([
		["Opinion - Economy - The New York Times", "https://www.nytimes.com/section/opinion/economy"],
		["Technology | Latest News & Updates | BBC News", "https://www.bbc.com/news/technology"],
		["Video Games - The New York Times", "https://www.nytimes.com/topic/subject/video-games"],
		["Wikipedia:Manual of Style/Video games - Wikipedia", "https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Video_games"],
		["World News", "https://www.wsj.com/world"],
	])("filters section page %j", (title, url) => {
		expect(bad({ title, url })).toBe(true);
	});

	it.each([
		["Trump threatens to double tariffs on South Korea if they do not invest", "https://www.theguardian.com/us-news/2026/oct/04/trump-tariffs-south-korea"],
		["Live Updates: Job Growth Cools and Unemployment Ticks Higher - The New York Times", "https://www.nytimes.com/live/2026/10/03/business/jobs-report"],
		["Games (film) - Wikipedia", "https://en.wikipedia.org/wiki/Games_(film)"],
		["US economy posts solid 2.2% Q2 growth as spending and AI investment surge | AP News", "https://apnews.com/article/economy-gdp-growth-3f2a1b"],
		["환율 급등 - 한국경제", "https://www.hankyung.com/article/2026100512345"],
		["60% vs 65% vs 75% vs TKL: Keyboard Sizes Chart [2026]", "https://tech-insider.org/keyboard-sizes-chart"],
	])("keeps real article %j", (title, url) => {
		expect(bad({ title, url })).toBe(false);
	});
});

describe("isRelevantWikiResult", () => {
	const wiki = (t: string, kw: string) => rel({ title: t, url: "https://en.wikipedia.org/wiki/x" }, kw);

	it.each([
		["Games (film) - Wikipedia", "Games"],
		["WarGames - Wikipedia", "Games"],
		["Mercury (planet) - Wikipedia", "Mercury"],
		["Computer keyboard - Wikipedia", "Keyboard"],
		["게임 (영화) - 위키백과", "게임"],
	])("rejects %j for %j", (t, kw) => {
		expect(wiki(t, kw)).toBe(false);
	});

	it.each([
		["Games - Wikipedia", "games"],
		["Video game - Wikipedia", "Video game"],
		["Video game genre - Wikipedia", "Video game"],
		["Keyboard (computing) - Wikipedia", "Keyboard (computing)"],
		["Keyboard layout - Wikipedia", "Keyboard"],
		["게임 - 위키백과", "게임"],
	])("accepts %j for %j", (t, kw) => {
		expect(wiki(t, kw)).toBe(true);
	});

	it("does not affect non-wiki results", () => {
		expect(rel({ title: "Games (film)", url: "https://example.com/a" }, "Games")).toBe(true);
	});
});

describe("dedupeItemsAcrossSections", () => {
	const sections = () => dedupeItemsAcrossSections([
		{ items: [{ url: "https://www.Tech-Insider.org/chart/?utm=1#x" }, { url: "" }] },
		{ items: [{ url: "https://tech-insider.org/chart" }, { url: "https://a.com/b" }] },
		{ items: [{ url: "https://tech-insider.org/chart/" }] },
		{ items: [{ url: "https://www.youtube.com/watch?v=1" }, { url: "https://www.youtube.com/watch?v=2" }] },
	]);

	it("keeps first occurrence and keeps url-less items", () => {
		expect(sections()[0].items).toHaveLength(2);
	});
	it("drops duplicates after normalizing www/case/query/hash/trailing slash", () => {
		const dd = sections();
		expect(dd[1].items.map((i) => i.url)).toEqual(["https://a.com/b"]);
		expect(dd[2].items).toHaveLength(0);
	});
	it("treats YouTube videos with different v param as distinct", () => {
		expect(sections()[3].items).toHaveLength(2);
	});
});

describe("cleanSnippet", () => {
	it.each([
		"Religion TOP STORIES Pope Leo seeks status update of Francis' divisive opening",
		"Tech SECTIONS Artificial IntelligenceSocial Media",
		"World + Africa + Americas + Asia + Australia + China + Europe US Politics + Trump + Facts First",
		"",
	])("empties menu junk %j", (s) => {
		expect(cleanSnippet(s)).toBe("");
	});

	it.each([
		"Most auto executives agree that electric vehicles will eventually replace conventional cars.",
		"Shares rose 2% as A + B testing results came in",
	])("keeps real text %j", (s) => {
		expect(cleanSnippet(s)).toBe(s);
	});
});
