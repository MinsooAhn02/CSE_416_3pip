// 기사 품질 필터 자가 점검 (실제로 관찰된 Tavily 결과 기반). 실행: node scripts/check-article-quality.mjs
// Node 22.6+ 의 TypeScript 타입 제거 기능으로 .ts를 직접 import
import assert from "node:assert/strict";
import { isLowQualityResult as bad, cleanSnippet } from "../src/utils/articleQuality.ts";

// 걸러야 하는 것
assert.ok(bad({ title: "Opinion - Economy - The New York Times", url: "https://www.nytimes.com/section/opinion/economy" }));
assert.ok(bad({ title: "Technology | Latest News & Updates | BBC News", url: "https://www.bbc.com/news/technology" }));
assert.ok(bad({ title: "Video Games - The New York Times", url: "https://www.nytimes.com/topic/subject/video-games" }));
assert.ok(bad({ title: "Wikipedia:Manual of Style/Video games - Wikipedia", url: "https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Video_games" }));
assert.ok(bad({ title: "World News", url: "https://www.wsj.com/world" }));

// 통과해야 하는 것
assert.ok(!bad({ title: "Trump threatens to double tariffs on South Korea if they do not invest", url: "https://www.theguardian.com/us-news/2026/oct/04/trump-tariffs-south-korea" }));
assert.ok(!bad({ title: "Live Updates: Job Growth Cools and Unemployment Ticks Higher - The New York Times", url: "https://www.nytimes.com/live/2026/10/03/business/jobs-report" }));
assert.ok(!bad({ title: "Games (film) - Wikipedia", url: "https://en.wikipedia.org/wiki/Games_(film)" }));
assert.ok(!bad({ title: "US economy posts solid 2.2% Q2 growth as spending and AI investment surge | AP News", url: "https://apnews.com/article/economy-gdp-growth-3f2a1b" }));
assert.ok(!bad({ title: "환율 급등 - 한국경제", url: "https://www.hankyung.com/article/2026100512345" }));
assert.ok(!bad({ title: "60% vs 65% vs 75% vs TKL: Keyboard Sizes Chart [2026]", url: "https://tech-insider.org/keyboard-sizes-chart" }));

// 요약 정리
assert.equal(cleanSnippet("Religion TOP STORIES Pope Leo seeks status update of Francis' divisive opening"), "");
assert.equal(cleanSnippet("Tech SECTIONS Artificial IntelligenceSocial Media"), "");
assert.equal(
	cleanSnippet("Most auto executives agree that electric vehicles will eventually replace conventional cars."),
	"Most auto executives agree that electric vehicles will eventually replace conventional cars.",
);
assert.equal(cleanSnippet(""), "");

console.log("article quality checks: OK");
