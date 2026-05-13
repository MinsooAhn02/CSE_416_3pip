# Task 26: AI Briefing Refactor

## Decisions (locked)
- **Strategy**: Deterministic shell + AI enrichment (Option A)
- **Tomorrow events**: Add `tomorrowEvents` to `useDataStore`
- **Stocks section**: Include only if `fixedInterestIds.includes("finance")`
- **Q&A**: Excluded from today's briefing (already merged into next-day's diary)
- **Modal layout**: Section blocks with bold headers + dividers

## Section order (deterministic)
1. **Date** — JS (`Intl.DateTimeFormat`)
2. **Weather** — JS (from weather store)
3. **Schedule**:
   - Morning (<12h): today's events
   - Afternoon (≥12h): today's remaining events + tomorrow's events
4. **Yesterday** — Groq call #1 (rewrite diary to 1–2 line past-tense fact)
5. **Interests** — JS (list interest keywords)
6. **Latest info** — Groq call #2 (1–2 line natural summary of smart widget data)
7. **Market** (conditional) — JS, only when `finance` is in interests

## Steps
- [x] Add `tomorrowEvents` state + fetcher in `useDataStore.js`
- [x] Replace `generateDetailedBriefing` in `aiService.js`:
  - Build deterministic sections array
  - Two narrow Groq calls (yesterday, smart summary) — temperature 0.1
  - Return `{ summary, detail, sections, timeMode }`
- [x] Update `BriefingWidget.jsx`:
  - Render sections with bold headers + dividers
  - Pass `tomorrowEvents` + `fixedInterestIds` in context
- [x] `vite build` passes — no compile errors

## Follow-up fix (round 2)
- [x] Combine Date + Weather into single `header` section: `날짜: ... | 날씨: ☀️ ...` with weather emoji
- [x] Add `generateInterestSentences` Groq helper — for fixed interests (news/tech/finance/health/food/entertainment), one factual sentence per interest using existing data (newsResults / stocks / trends / smartSummaries)
- [x] Restructure `오늘 최신 정보` section with `subBlocks`: 관심 키워드 (smart summary) + 주요 뉴스 Top 3 (newsResults[0..2] with source from URL hostname)
- [x] Extend `BriefingWidget.jsx` modal renderer to handle `section.subBlocks` (sub-headers slightly smaller, indented)
- [x] All prompts + titles language-aware via `getLangConfig()` → matches user's Ko/En setting
- [x] `vite build` passes

- [ ] (Manual) Verify modal layout visually in dev server
- [ ] (Manual) Verify weather emoji shows for various conditions
- [ ] (Manual) Verify per-interest sentence appears for each fixed interest
- [ ] (Manual) Verify language switch refreshes content in chosen language

## Follow-up fix (round 3)
- [x] Briefing must follow current `i18n.language` after toggle:
  - Added `useEffect` watching `i18n.language` in `BriefingWidget.jsx` → clears `briefingVersions` cache + forces `generateBriefingVersion(BRIEFING_LENGTH, true)` so the briefing always matches the user's current language (refresh button still works the same).
- [x] Modal text brightness:
  - Added `modalBodyText` constant (`text-morning-dark-text/90` in dark mode, `text-morning-light-text/85` in light mode) — used for section lines, sub-block lines, and legacy `detailLines` fallback. Dashboard preview + footer keep using `muted`.
- [x] `vite build` passes (9.73s, no errors)
