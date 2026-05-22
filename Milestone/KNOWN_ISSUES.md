# Known Issues — Paste into GitHub Issues

> **Purpose:** This file is a staging area for known issues that should be filed into GitHub Issues (`<REPO_URL>/issues`). Each entry below is formatted to be copy-pasteable.
> Once an issue is filed, mark it with the GitHub issue number in the **GH#** column.
> **After all issues are filed, this file can be deleted.**
>
> **Compiled from:** `todo.md` (open items) + `DOCS.md §16` (Known Incomplete Items) as of 2026-05-22.

## Tracking Table

| # | GH# | Title | Severity | Suggested Owner | Source |
|---|-----|-------|----------|-----------------|--------|
| 1 | _to file_ | Smart Widget Korean mode: Latest Updates / Latest Coverage not loading | Major | Minsoo Ahn | todo.md |
| 2 | _to file_ | Diary feedback rewrite not applying | Major | Sungmin Choo | todo.md |
| 3 | _to file_ | Tavily token overuse — too many redundant calls | Major | Minsoo Ahn | todo.md |
| 4 | _to file_ | Briefing "Today's latest info" shows generic definitions instead of personalized search | Major | Minsoo Ahn | todo.md |
| 5 | _to file_ | Briefing "Smart keywords: No keyword info collected yet" — unclear when it populates | Minor | Sungmin Choo | todo.md |
| 6 | _to file_ | Google integration toggle (연동 끄기) not working; consider removing the option | Minor | Sungmin Choo | todo.md |
| 7 | _to file_ | Verify smart widget keywords are reflected in personalization context | Minor | Sungmin Choo | todo.md |
| 8 | _to file_ | Google Calendar live API sync — frontend store still partially mock-based | Major | Sungmin Choo | DOCS.md §16 |
| 9 | _to file_ | Google Fitness live API sync — Edge Function implemented but live token connection missing | Major | Minsoo Ahn | DOCS.md §16 |
| 10 | _to file_ | Voice feature (`voiceOn`) — state exists but no UI or TTS implementation | Minor | Dahyun Kwon | DOCS.md §16 |
| ~~11~~ | ✅ resolved | ~~`keyword_score_log` aggregation — internal batch logic unverified~~ — **Resolved 2026-05-22:** implementation verified in `src/services/personalizationService.js` (`VALID_CATEGORIES`, `SOURCE_WEIGHTS = {personal: 2, diary: 1}` matching spec). Do not file. | ~~Minor~~ | — | — |
| 12 | _to file_ | `NewsDetailModal` file exists but unused — should be removed | Trivial | Dahyun Kwon | DOCS.md §16 |
| 13 | _to file_ | Trends widget — no detail view / pagination implemented | Minor | Dahyun Kwon | DOCS.md §16 |
| 14 | _to file_ | Diary PIN setup flow — save/modify in settings and self-verification question unimplemented | Major | Sungmin Choo | DOCS.md §16 |
| 15 | _to file_ | Stocks Edge Function — local changes pending manual deploy via Supabase Dashboard | Major | Minsoo Ahn | DOCS.md §16 |
| 16 | _to file_ | `groq` Edge Function — `charset=utf-8` header pending manual deploy | Minor | Minsoo Ahn | DOCS.md §16 |

---

## Issue Drafts (copy-paste into GitHub Issues)

### Issue 1: Smart Widget Korean mode: Latest Updates / Latest Coverage not loading

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

### Issue 8: Google Calendar — replace mock fallback with live API

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

### Issue 15: Stocks Edge Function — manual deploy pending

**Title:** `[DEPLOY] Stocks Edge Function changes pending deployment`
**Labels:** `deployment`, `stocks`
**Severity:** Major

**Description:**
Local changes to `supabase/functions/stocks/index.ts` (universal index ticker support via `^${symbol}` fallback for Yahoo/Stooq) are committed but not deployed to Supabase. Until deployed, custom index symbols (VIX, DJI, RUT, etc.) still return `--`.

**Action:** `supabase functions deploy stocks` via CLI, OR upload via Supabase Dashboard.

**Acceptance criteria:**
- After deploy, add VIX or DJI as a custom symbol in StocksWidget → confirm price displays correctly.

**Reference:** `CHANGELOG.md 2026-05-16 Widget Round 4`, `DOCS.md §16`

---

### Issue 16: groq Edge Function — manual deploy pending

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

## After filing into GitHub Issues

Once all 16 issues are filed:
1. Replace the `_to file_` placeholders in the tracking table above with the actual GitHub issue numbers (e.g., `#42`)
2. Update `todo.md` to remove items now tracked in GitHub
3. Delete this file (or move it to an archive folder for future reference)
4. Update README.md "Bug Reporting" section if needed
