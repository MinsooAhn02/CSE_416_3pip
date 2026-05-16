# Task: AI Briefing Round 4 — News enrichment + Trends + Market removal

## Decisions (locked)
- **Market snapshot**: completely removed (no more `finance` interest gating)
- **News rendering**: each Top-3 news item displays as
  - Title (clickable hyperlink → `url`, opens new tab)
  - 1-sentence AI summary (Groq, using Tavily `content` snippet, no extra API call)
  - Source label (`source` or hostname)
- **Trends section**: NEW section added — top 3 trends with title + clickable link + 1-sentence AI summary (mirrors news structure)
- **Interests section**: NOT added (out of scope this round)
- **No extra API calls**: rely on `content` field Tavily already returns; one merged Groq call summarizes both news + trends in a single JSON response to keep token cost flat
- **Plan with Opus, execute with Sonnet**: user must switch model before implementation; this doc is the Sonnet handoff

## Section order after refactor
1. Today (date + weather, one line)
2. Schedule (morning: today / afternoon-evening: remaining today + tomorrow)
3. Yesterday (Groq diary rewrite)
4. Today's latest info
   - sub-block: Smart keywords (existing summary)
   - sub-block: **Top 3 news** — title + link + 1-sentence AI summary + source
   - sub-block: **Trends Top 3** (NEW) — title + link + 1-sentence AI summary + source
5. ~~Market snapshot~~ (REMOVED)

## Implementation steps

### `src/services/aiService.js`
- [ ] Add helper `summarizeArticlesBatch({ articles, lang, langInstruction, kind })`
  - Input: up to N `{title, url, content}` items
  - Single Groq call, JSON output `{ summaries: [{ index, summary }] }`
  - Each summary: 1 short sentence (≤120 chars), language-aware, fact-only guard
  - Fallback on parse error: empty array (UI shows title+link only)
- [ ] In `generateDetailedBriefing`:
  - Run third Groq call in parallel: `summarizeArticlesBatch` over `[...newsResults.slice(0,3), ...trendsResults.slice(0,3)]` (or two parallel calls — decide based on token budget; prefer one merged call)
  - Build `latest_news` sub-block lines: `{ title, url, summary, source }` shape (richer than current plain string)
  - Add `latest_trends` sub-block with same shape from `trendsResults.slice(0,3)`
- [ ] Delete entire `// ── 7) (조건부) 시장 동향 ──` block (lines ~1066-1084)
- [ ] Update JSDoc section-order comment (lines ~896-906)

### `src/components/widgets/BriefingWidget.jsx`
- [ ] Sub-block rendering: detect when `line` is an object `{ title, url, summary, source }` vs plain string
  - Object: render `<a href={url} target="_blank" rel="noopener noreferrer">{title}</a>` + summary line below + source label
  - String: render as currently (unchanged)
- [ ] Pass `trendsResults` (already present in component scope, just add to `context` object)
- [ ] Keep dashboard preview line (`section.subBlocks.flatMap(...)`) functional — concatenate `title — summary` for objects

### `aiService.js` shape contract
News/trends sub-block `lines` becomes:
```js
[
  { title: "Apple announces new iPhone", url: "https://...", summary: "애플이 ...", source: "apple.com" },
  ...
]
```
String fallback (`smart keywords`, "no news collected") remains plain strings — render path must handle both.

## Verification
- [ ] `npm run build` (vite build) passes with no errors
- [ ] Dev server: open briefing modal — verify news section shows title as link, 1-sentence summary, source label
- [ ] Dev server: verify trends section appears with same structure
- [ ] Dev server: verify market section is gone even when finance interest is selected
- [ ] Toggle KO/EN — summaries regenerate in correct language
- [ ] Dashboard preview line still readable (no `[object Object]`)

## Out of scope (future rounds)
- Interests (관심사) standalone section
- Tavily extract API for full article body
- Per-language news cache invalidation tweaks
