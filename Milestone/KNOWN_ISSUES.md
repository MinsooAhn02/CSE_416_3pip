# Known Issues — Paste into GitHub Issues

> **Purpose:** This file is a staging area for known issues that should be filed into GitHub Issues (`https://github.com/MinsooAhn02/CSE_416_3pip/issues`). Each entry below is formatted to be copy-pasteable.
> Once an issue is filed, mark it with the GitHub issue number in the **GH#** column.
> **After all issues are filed, this file can be deleted.**
>
> **Compiled from:** `todo.md` (open items) + `DOCS.md §16` (Known Incomplete Items) as of 2026-05-22.
> **Last updated:** 2026-06-05 — items #1, #8, #15, #16 marked ✅ closed (2026-06-04 fixes); see "Closed 2026-06-04" section at bottom.

## Tracking Table

| # | GH# | Title | Severity | Suggested Owner | Source |
|---|-----|-------|----------|-----------------|--------|
| ~~1~~ | ✅ closed | ~~Smart Widget Korean mode: Latest Updates / Latest Coverage not loading~~ — **Resolved 2026-06-04** (commit `4ba0d4b`): Korean article fetch reworked; `include_domains` opened for non-news sections, low-quality domains excluded. Issue [#1](https://github.com/MinsooAhn02/CSE_416_3pip/issues/1) closed. | ~~Major~~ | — | todo.md |
| 2 | [#2](https://github.com/MinsooAhn02/CSE_416_3pip/issues/2) | Diary feedback rewrite not applying | Major | Sungmin Choo | todo.md |
| ~~3~~ | ✅ closed | ~~Tavily token overuse — too many redundant calls~~ — **Resolved 2026-05-23** (commit `86a34a8`): `api_cache` TTL extended 1 h → 6 h cuts redundant Tavily calls by ~6×. Issue [#3](https://github.com/MinsooAhn02/CSE_416_3pip/issues/3) closed retroactively. | ~~Major~~ | — | todo.md |
| 4 | [#4](https://github.com/MinsooAhn02/CSE_416_3pip/issues/4) | Briefing "Today's latest info" shows generic definitions instead of personalized search | Major | Minsoo Ahn | todo.md |
| 5 | [#5](https://github.com/MinsooAhn02/CSE_416_3pip/issues/5) | Briefing "Smart keywords: No keyword info collected yet" — unclear when it populates | Minor | Sungmin Choo | todo.md |
| 6 | [#6](https://github.com/MinsooAhn02/CSE_416_3pip/issues/6) | Google integration toggle (연동 끄기) not working; consider removing the option | Minor | Sungmin Choo | todo.md |
| 7 | [#7](https://github.com/MinsooAhn02/CSE_416_3pip/issues/7) | Verify smart widget keywords are reflected in personalization context | Minor | Sungmin Choo | todo.md |
| ~~8~~ | ✅ closed | ~~Google Calendar live API sync — frontend store still partially mock-based~~ — **Resolved 2026-06-04** (commit `b4ee88a`): `invokeGoogleWithAuth` wrapper with auto-retry on 401/403; `ensureProviderToken(forceRefresh:true)` recovers expired sessions without re-login. Issue [#8](https://github.com/MinsooAhn02/CSE_416_3pip/issues/8) closed. | ~~Major~~ | — | DOCS.md §16 |
| 9 | [#9](https://github.com/MinsooAhn02/CSE_416_3pip/issues/9) | Google Fitness live API sync — Edge Function implemented but live token connection missing | Major | Minsoo Ahn | DOCS.md §16 |
| 10 | [#10](https://github.com/MinsooAhn02/CSE_416_3pip/issues/10) | Voice feature (`voiceOn`) — state exists but no UI or TTS implementation | Minor | Dahyun Kwon | DOCS.md §16 |
| ~~11~~ | ✅ resolved | ~~`keyword_score_log` aggregation — internal batch logic unverified~~ — **Resolved 2026-05-22:** implementation verified in `src/services/personalizationService.js` (`VALID_CATEGORIES`, `SOURCE_WEIGHTS = {personal: 2, diary: 1}` matching spec). Do not file. | ~~Minor~~ | — | — |
| 12 | [#11](https://github.com/MinsooAhn02/CSE_416_3pip/issues/11) | `NewsDetailModal` file exists but unused — should be removed | Trivial | Dahyun Kwon | DOCS.md §16 |
| 13 | [#12](https://github.com/MinsooAhn02/CSE_416_3pip/issues/12) | Trends widget — no detail view / pagination implemented | Minor | Dahyun Kwon | DOCS.md §16 |
| 14 | [#13](https://github.com/MinsooAhn02/CSE_416_3pip/issues/13) | Diary PIN setup flow — save/modify in settings and self-verification question unimplemented | Major | Sungmin Choo | DOCS.md §16 |
| ~~15~~ | ✅ closed | ~~Stocks Edge Function — local changes pending manual deploy via Supabase Dashboard~~ — **Resolved 2026-06-04**: manually deployed to Supabase; universal-ticker fallback, type/currency metadata, and ticker validation now live. Issue [#14](https://github.com/MinsooAhn02/CSE_416_3pip/issues/14) closed. | ~~Major~~ | — | DOCS.md §16 |
| ~~16~~ | ✅ closed | ~~`groq` Edge Function — `charset=utf-8` header pending manual deploy~~ — **Resolved 2026-06-04**: manually deployed to Supabase; `Content-Type: application/json; charset=utf-8` header now live. Issue [#15](https://github.com/MinsooAhn02/CSE_416_3pip/issues/15) closed. | ~~Minor~~ | — | DOCS.md §16 |

---

## Issue Drafts (copy-paste into GitHub Issues)

### ~~Issue 1: Smart Widget Korean mode: Latest Updates / Latest Coverage not loading~~ ✅ CLOSED 2026-06-04

> **Resolved** by commit `4ba0d4b` (Dahyun Kwon, 2026-06-04): Korean article fetch reworked in `aiService.ts` — `include_domains` opened for non-news sections, `exclude_domains` used for low-quality domains, freshness window set to 1 year. Close GH [#1](https://github.com/MinsooAhn02/CSE_416_3pip/issues/1).

**Title:** `[BUG] Smart Widget Korean mode: Latest Updates / Latest Coverage not loading`
**Labels:** `bug`, `smart-widget`, `i18n`
**Severity:** Major

**Description:**
In Korean language mode, the Smart Widget's "Latest Updates" / "Latest Coverage" sections (mapped from `Latest Updates / Latest Coverage` in English) do not load results. English mode works correctly.

**Steps to Reproduce:**
1. Set app language to Korean
2. Add a Smart Widget with a Korean or English keyword
3. Observe the "Latest Updates" or "Latest Coverage" section

**Expected:** Korean news articles related to the keyword load.
**Actual:** Section is empty or shows "no results" message.

**Likely cause:** Korean mode uses `latest` query first, then falls back to non-recency news query. Check `aiService.js` section planning + `filterSmartResults()` flow.

**Reference:** `todo.md`, `DOCS.md §7.4 Smart Widget`

---

### Issue 2: Diary feedback rewrite not applying

**Title:** `[BUG] Diary feedback "Rewrite" button does not update the diary`
**Labels:** `bug`, `diary`, `groq`
**Severity:** Major

**Description:**
When user dislikes an AI-generated diary and submits feedback text via the "Rewrite" button, the rewritten diary does not get applied. Either the Groq call fails silently or `pendingRewrite` is not propagated to the UI.

**Steps to Reproduce:**
1. Generate an AI diary for today
2. Click "Dislike" → enter feedback (e.g., "주식 없애줘")
3. Click "재작성" / "Rewrite"

**Expected:** Preview of rewritten diary appears; "Confirm" applies it.
**Actual:** No preview appears OR confirm doesn't persist.

**Reference:** `todo.md`, `DOCS.md §11.8 Diary rewrite flow`

---

### Issue 3: Tavily token overuse

**Title:** `[BUG] Tavily API token consumption is excessive — too many redundant calls`
**Labels:** `bug`, `performance`, `cost`
**Severity:** Major

**Description:**
The app is consuming Tavily API tokens faster than expected. Investigate which paths trigger unnecessary refetches.

**Suspected paths:**
- Smart Widget: 2-stage Korean fetch (`include_domains: KO_NEWS_DOMAINS` fallback) may double-call when not needed
- News warm-up: language switch listener may force-fetch even when cache is valid
- Trends warm-up: `warmupTrendsMemCache()` skips cache when Korean payload is untranslated (intentional but possibly over-aggressive)

**Acceptance criteria:**
- Audit all `invokeEdgeDetailed("tavily", ...)` call sites
- Add request deduplication where appropriate
- Monitor token usage over 1 week and compare

**Reference:** `todo.md`

---

### Issue 4: Briefing "Today's latest info" shows generic definitions instead of personalized content

**Title:** `[BUG] AI Briefing "latest_info" section shows generic keyword definitions rather than personalized Smart Widget content`
**Labels:** `bug`, `briefing`, `smart-widget`
**Severity:** Major

**Description:**
The briefing's `latest_info` section is intended to surface personalized Smart Widget summaries for each registered keyword. Instead, it shows generic encyclopedia-style definitions of the keyword.

**Likely cause:** The Smart Widget summaries from `useWidgetStore.smartWidgetData` are not being passed into `aiService.generateDetailedBriefing()` `smartSummary` context, OR Groq is generating definitions instead of pulling from the personalized search content.

**Reference:** `todo.md`, `DOCS.md §7.3 BriefingWidget`

---

### Issue 5: Briefing "Smart keywords: No keyword info collected yet"

**Title:** `[BUG] Briefing shows "No keyword info collected yet" message indefinitely`
**Labels:** `bug`, `briefing`, `personalization`
**Severity:** Minor

**Description:**
The briefing displays "Smart keywords: No keyword info collected yet" even when the user has registered Smart Widget keywords. Unclear if this is a timing issue (waiting for batch) or a wiring bug.

**Questions:**
- Does the message clear after the next personalization batch run (midnight)?
- Is the message gated on `keyword_score_log` entries OR `keywordInterests` from `user_settings`?

**Reference:** `todo.md`, `DOCS.md §11 Personalization Logic`

---

### Issue 6: Google integration toggle (연동 끄기) not working

**Title:** `[FEATURE] Remove "Disable Google integration" toggle — leave integration always-on`
**Labels:** `enhancement`, `settings`, `tech-debt`
**Severity:** Minor

**Description:**
The "disable Google integration" option in settings doesn't work as expected. Per `todo.md`, the team has decided to remove this option entirely and make Google integration mandatory (it's already required for Calendar / Tasks / Fitness widgets to function).

**Action items:**
- Remove the toggle UI from `SettingsModal.jsx`
- Update `useSettingsStore` to remove `connectGoogle` (or equivalent) field
- Update onboarding to make Google connection mandatory

**Reference:** `todo.md`

---

### Issue 7: Verify smart widget keywords are reflected in personalization context

**Title:** `[TASK] Verify Smart Widget keywords flow into personalization context`
**Labels:** `task`, `personalization`, `verification`
**Severity:** Minor

**Description:**
Confirm that keywords added to Smart Widgets via `useWidgetStore.smartKeywords` are reaching:
- `aiService.generateDetailedBriefing()` `smartSummary` prompt
- `personaContext.buildPersonaContext()` interest list
- `fetchNews()` query construction (top-5 interests)

Add a debug log or unit test to verify the data flow.

**Reference:** `todo.md`

---

### ~~Issue 8: Google Calendar — replace mock fallback with live API~~ ✅ CLOSED 2026-06-04

> **Resolved** by commit `b4ee88a` (Sungmin Choo, 2026-06-04): `invokeGoogleWithAuth` wrapper added to `useGoogleCalendarStore`; auto-retries on 401/403 with `ensureProviderToken(forceRefresh:true)`. Sessions restored on next-day re-entry without re-login. Close GH [#8](https://github.com/MinsooAhn02/CSE_416_3pip/issues/8).

**Title:** `[BUG] Google Calendar — `useGoogleCalendarStore` still has partial mock fallback paths`
**Labels:** `bug`, `calendar`, `tech-debt`
**Severity:** Major

**Description:**
Edge Function `supabase/functions/events/index.ts` is fully implemented, but `useGoogleCalendarStore.fetchEvents()` still has mock-data fallback branches that should be replaced with proper error states.

**Reference:** `DOCS.md §16`

---

### Issue 9: Google Fitness live API sync

**Title:** `[BUG] Google Fitness — live token connection not completed`
**Labels:** `bug`, `health`, `oauth`
**Severity:** Major

**Description:**
Edge Function `supabase/functions/fitness/index.ts` is implemented but the live token connection from `useAuthStore.providerToken` to `fetchHealth()` is not verified end-to-end. Need to test with an account that has the `fitness.activity.read` scope granted.

**Reference:** `DOCS.md §16`

---

### Issue 10: Voice feature (`voiceOn`) — not implemented

**Title:** `[FEATURE] Implement Voice / TTS for AI Briefing`
**Labels:** `enhancement`, `briefing`
**Severity:** Minor

**Description:**
`useSettingsStore.voiceOn` state field exists but no UI control or TTS implementation. Decide whether to ship this feature or remove the dead state.

**Options:**
- Ship: add toggle to Settings + use Web Speech API `SpeechSynthesisUtterance` for briefing text
- Remove: delete `voiceOn` from store and DB schema

**Reference:** `DOCS.md §16`

---

### ~~Issue 11~~: ✅ Resolved — Implementation found

**Status:** Resolved 2026-05-22 during code audit. Do not file this issue.

`personalizationService.js` exists at `src/services/personalizationService.js` and implements the full 30-day decay aggregation per the design spec:
- `VALID_CATEGORIES = ["food", "place", "content", "shopping", "lifestyle", "mood", "interest"]`
- `SOURCE_WEIGHTS = { personal: 2, diary: 1 }`
- Keyword extraction via Groq with JSON-only output enforcement
- 30-day window decay formula `score = Σ(base_weight × (30 - elapsed_days) / 30)`

The previous "unverified" status in `DOCS.md §16` was outdated — DOCS.md has been corrected.

**Reference:** `src/services/personalizationService.js`, `DOCS.md §11.3`

---

### Issue 12: Remove unused `NewsDetailModal`

**Title:** `[TASK] Remove unused `NewsDetailModal.jsx``
**Labels:** `task`, `tech-debt`, `cleanup`
**Severity:** Trivial

**Description:**
`src/components/modals/NewsDetailModal.jsx` was replaced by direct URL navigation (`<a target="_blank">`) in NewsWidget. The file is no longer imported anywhere.

**Action:** Delete the file and confirm no broken imports.

**Reference:** `DOCS.md §8, §16`

---

### Issue 13: Trends widget — no detail / pagination view

**Title:** `[FEATURE] Trends widget detail view with left/right pagination`
**Labels:** `enhancement`, `trends`
**Severity:** Minor

**Description:**
News widget has `NewsAllModal` and Stocks widget has `StocksViewAllModal`, but TrendsWidget only supports inline expand (max 6 items, no pagination through full results). Add a detail modal similar to NewsAllModal with arrow-key navigation.

**Reference:** `DOCS.md §16`

---

### Issue 14: Diary PIN setup flow

**Title:** `[FEATURE] Implement PIN setup, modification, and self-verification flow`
**Labels:** `enhancement`, `diary`, `security`
**Severity:** Major

**Description:**
Diary PIN is currently hashed with SHA-256 on save (good), but there's no UI to:
- Set a PIN from scratch
- Modify an existing PIN
- Recover access via self-verification question if PIN is forgotten

**Acceptance criteria:**
- Settings > Diary tab adds "Change PIN" button → modal with old PIN + new PIN inputs
- Onboarding includes optional "Set diary PIN" step
- Forgot PIN flow: user answers their saved security question to reset

**Reference:** `DOCS.md §16, §11.4 Diary PIN`

---

### ~~Issue 15: Stocks Edge Function — manual deploy pending~~ ✅ CLOSED 2026-06-04

> **Resolved**: manually deployed to Supabase 2026-06-04. Universal-ticker fallback, type/currency metadata, and ticker validation (`price > 0`) are now live. Close GH [#14](https://github.com/MinsooAhn02/CSE_416_3pip/issues/14).

**Title:** `[DEPLOY] Stocks Edge Function changes pending deployment`
**Labels:** `deployment`, `stocks`
**Severity:** Major

**Description:**
Local `supabase/functions/stocks/index.ts` has been significantly overhauled but not yet deployed to Supabase. Current local state includes:
- Strict ticker validation (`price > 0` required; invalid tickers rejected)
- `type` + `currency` metadata fields in Edge response
- 8 hardcoded fixed indices (`fixedIndexSymbols`): SP500, KOSPI, NASDAQ, USDKRW, VIX, CRUDE, DXY, DJI
- Updated symbol mappings: VIX→^VIX, CRUDE→CL=F, DXY→DX=F (was DX-Y.NYB), DJI→^DJI
- Resolved: KOSDAQ-style invalid-ticker bug, confirm-delete-dialog non-dismiss bug, hardcoded `CURRENCY_MAP` scaling issue

**Production status:** Still running the old TwelveData→Stooq→ER-API fallback chain. Manual deploy required.

**Action:** Upload `supabase/functions/stocks/index.ts` via Supabase Dashboard.

**Acceptance criteria:**
- After deploy, fixed indices (VIX, CRUDE, DXY, DJI) show prices correctly.
- User-added invalid ticker is rejected with error state (not `--`).

**Reference:** `CHANGELOG.md 2026-05-16 Widget Round 4`, `DOCS.md §16`

---

### Issue 15b: Tomorrow-schedule timezone bug — fixed locally

**Title:** `[BUG] Briefing "Tomorrow" section empty for non-UTC users`
**Labels:** `bug`, `briefing`, `calendar`
**Severity:** Major
**Status:** ✅ Fixed in `src/store/useDataStore.js` (2026-05-24)

**Description:**
`fetchTomorrowCalendar` passed `date: tomorrowStr` to the Edge Function, which runs in UTC (Deno). For KST (UTC+9) users, events between local midnight–09:00 fell outside the UTC window and were silently dropped by Google Calendar API.

**Fix applied:**
- `fetchTomorrowCalendar`: switched to explicit `timeMin/timeMax` using local-timezone ISO strings (client-side `new Date("YYYY-MM-DDT00:00:00")` → `.toISOString()`). No Edge Function change required.
- `fetchCalendar`: same fix applied for symmetry.
- `fetchAll`: `fetchTomorrowCalendar` moved outside `visibleWidgets.includes("calendar")` gate — briefing is a fixed widget and always needs tomorrow events.

**Reference:** `DOCS.md §7.3`

---

### ~~Issue 16: groq Edge Function — manual deploy pending~~ ✅ CLOSED 2026-06-04

> **Resolved**: manually deployed to Supabase 2026-06-04. `Content-Type: application/json; charset=utf-8` header is now live; Korean text no longer garbled. Close GH [#15](https://github.com/MinsooAhn02/CSE_416_3pip/issues/15).

**Title:** `[DEPLOY] groq Edge Function `charset=utf-8` header pending deployment`
**Labels:** `deployment`, `groq`, `i18n`
**Severity:** Minor

**Description:**
Local change to `supabase/functions/groq/index.ts` adds `Content-Type: application/json; charset=utf-8` to prevent Korean text garbling. Not yet deployed.

**Action:** `supabase functions deploy groq` via CLI, OR upload via Supabase Dashboard.

**Acceptance criteria:**
- After deploy, generate a Korean AI briefing → confirm no character garbling.

**Reference:** `DOCS.md §16`

---

## Closed 2026-06-04

The following issues were fixed in code or deployed on 2026-06-04. Update GitHub Issues to close these.

| Local ref | Title | Severity | Resolution | GH# |
|-----------|-------|----------|------------|-----|
| #1 | Smart Widget Korean mode: Latest Updates not loading | Major | Commit `4ba0d4b` — Korean article fetch reworked | [#1](https://github.com/MinsooAhn02/CSE_416_3pip/issues/1) |
| #8 | Google Calendar live API sync — partial mock | Major | Commit `b4ee88a` — `invokeGoogleWithAuth` auto-retry | [#8](https://github.com/MinsooAhn02/CSE_416_3pip/issues/8) |
| #15 | Stocks Edge Function pending deploy | Major | Manually deployed to Supabase 2026-06-04 | [#14](https://github.com/MinsooAhn02/CSE_416_3pip/issues/14) |
| #16 | groq Edge Function `charset=utf-8` pending deploy | Minor | Manually deployed to Supabase 2026-06-04 | [#15](https://github.com/MinsooAhn02/CSE_416_3pip/issues/15) |

---

## Closed retroactively — 2026-05-29 doc sync

The following items were fixed in code between 2026-05-22 and 2026-05-27 but were never tracked as GitHub issues. They have been filed-and-closed retroactively for transparency / paper trail. Issue numbers will be back-filled here after the `gh` CLI run.

| Local ref | Title | Severity | Closed by commit | GH# |
|-----------|-------|----------|------------------|-----|
| A | `[FIX] Tavily token over-consumption — cache TTL extended 1 h → 6 h` | Major | `86a34a8` | [#3](https://github.com/MinsooAhn02/CSE_416_3pip/issues/3) |
| B | `[FIX] Briefing "Tomorrow" section empty for non-UTC users (timezone bug)` | Major | `5c7b7a6` | [#17](https://github.com/MinsooAhn02/CSE_416_3pip/issues/17) |
| C | `[FIX] News widget — broken image shows blank gap instead of placeholder` | Minor | `020e802` | [#18](https://github.com/MinsooAhn02/CSE_416_3pip/issues/18) |
| D | `[FIX] Last-updated timestamp shows stale "9000분 전" on re-login` | Minor | `020e802` | [#19](https://github.com/MinsooAhn02/CSE_416_3pip/issues/19) |
| E | `[FIX] Calendar "Today" button not visible from year/decade header view` | Minor | `020e802` | [#20](https://github.com/MinsooAhn02/CSE_416_3pip/issues/20) |
| F | `[FIX] Smart Widget category button — emoji + dropdown not opening` | Minor | `020e802` | [#21](https://github.com/MinsooAhn02/CSE_416_3pip/issues/21) |
| G | `[FIX] DiaryList PIN prompt — incorrect modal gating` | Minor | `5fc08b9` | [#22](https://github.com/MinsooAhn02/CSE_416_3pip/issues/22) |
| H | `[FIX] StocksWidget — invalid ticker input does not show error state` | Minor | `70ca0d0` | [#23](https://github.com/MinsooAhn02/CSE_416_3pip/issues/23) |
| I | `[FEAT] Apply font-size setting to Diary/Event/Task panels` | Trivial | `5fc08b9` | [#25](https://github.com/MinsooAhn02/CSE_416_3pip/issues/25) |

Issue body template used (consistent across all items):

```
Fixed by <COMMIT_HASH> on <DATE>.

**Symptom:** <one line>
**Root cause:** <one line>
**Fix:** <one line>

**Reference:** CHANGELOG.md, <file path(s)>
```

---

## After filing into GitHub Issues

Once all 16 issues are filed:
1. Replace the `_to file_` placeholders in the tracking table above with the actual GitHub issue numbers (e.g., `#42`)
2. Update `todo.md` to remove items now tracked in GitHub
3. Delete this file (or move it to an archive folder for future reference)
4. Update README.md "Bug Reporting" section if needed
