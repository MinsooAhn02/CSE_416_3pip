# CHANGELOG

> Changes are listed in reverse chronological order.
> For architecture reference, see [DOCS.md](./DOCS.md).

> **Purpose:** Record of cross-verification testing per Milestones requirement.
> Each completed feature must be verified by a team member who did **not** implement it.
> Bugs found during verification should be filed in [GitHub Issues](https://github.com/MinsooAhn-SBU/CSE_416_3pip/issues).
>

---

## 2026-10-04

### [Fix] Audit fixes: diaries, Edge Function auth, duplicate AI calls, bundle
- Diaries now actually save to Supabase: the live table lacked `ai_generated_diary`/`edited_diary` (every write failed silently). Columns added, 38 legacy `diary_text` rows backfilled, hydrate and personalization read the new columns, diary writes throw on DB errors.
- All Edge Functions require a logged-in user (`supabase/functions/_shared/auth.ts`); groq/tavily/stocks/weather got input caps. Clients send the session JWT (`invokeFunction`, google-refresh).
- Groq: renewed key; `llama-3.3-70b-versatile` was retired → default model `openai/gpt-oss-120b`.
- Fewer Groq calls: first-login modal generates once after data load (was once per data arrival); user settings/personalization load once per user instead of on every auth event; a settings load error no longer resets the user to onboarding.
- Main bundle 1,326 KB → 822 KB (three.js lazy-loaded for the login background); ~1,100 lines of dead code removed; `noUnusedLocals` enabled.
- Weather widget shows the "city not found" error (it was set but never rendered).
- Created `briefing_snapshots` table on the live DB.

### [Fix] Briefing and Stocks widget
- AI Briefing card generated as soon as any one data source arrived and never regenerated, so weather/news/trends stayed "No data". It now waits for the first `fetchAll` to finish (`useDataStore.initialFetchDone`).
- Stocks widget no longer lists KOSPI/S&P 500 twice (default user symbols overlapped the fixed index slots).

### [Build] Clean-clone setup fixes
- `index.html` loads `/src/main.tsx` (pointed at the deleted `main.jsx`; only worked through Vite's extension fallback).
- `public/manifest.json` icons point at `images/MorningBriefing.AI_logo.png` (`icons/*.png` never existed → Chrome refused to load the unpacked extension).
- `build:extension`: added `archiver` devDependency, ported `scripts/zip-extension.js` to the archiver v8 API, and made it fail with the real error (previously every error was reported as "archiver missing") and when `dist/manifest.json` is absent (previously produced an empty zip and exited 0).
- `package-lock.json` is now committed; `.gitignore` no longer ignores `claude.md` (case-insensitive match would hide `CLAUDE.md` on Windows).
- Added `.env.example` and `supabase/migrations/add_briefing_snapshots.sql` (the table was used by `useBriefingHistoryStore` but never defined).

### [Chore] Repo cleanup
- Removed unused `NewsDetailModal.tsx`, `src/l10n/index.ts`, empty `src/mock/`, the `smart-widget` Edge Function (no frontend caller) and the unused `playwright` dependency.
- Untracked `dist/` and `supabase/.temp/` (already gitignored).
- Moved course deliverables to `archive/course/` (`Documents/`, `Milestone/`, `final.md`, final report PDF, old notes, DOCS §16–17).
- Merged `todo.md`, `tasks/todo.md` and open KNOWN_ISSUES into `docs/BACKLOG.md`.

### [Docs] Agent-ready docs
- Added `AGENTS.md` (commands, layout, architecture, conventions, pitfalls); `CLAUDE.md` imports it.
- `README.md`: repo URL → `MinsooAhn-SBU`, dev port 3000, `npx supabase` deploy list (dropped smart-widget, added google-refresh), full secrets list, migration order incl. `add_briefing_snapshots.sql`, fixed documentation table.
- `DOCS.md`: corrected init flow (`useExistingCache:false`, 6h TTL, 3h briefing interval), the five Edge Function call paths, `errorHandler` API, RLS policy table, `todos` unused, env/secrets/OAuth scopes, `provider_token` storage.

---

## 2026-05-29

### [Docs] Milestone 4 doc sync — post-Sprint-4

- `README.md`: TypeScript stack note updated (`.ts`/`.tsx`, `tsconfig.json strict:false`); `errorHandler.ts` and `useOnboardingStore` noted in Tech Stack; Documentation table expanded with `ARCHITECTURE.md`, Milestone folder link, and `docs/security/localStorage-audit.md`; testing checklist extended with 3 new verification items (news image fallback #12, login-timestamp reset #13, SmartWidget category dropdown #14); bug tracking history rewritten to reflect `CHANGELOG.md`/`todo.md` workflow with team-role attribution.
- `Milestone/SCHEDULE.md`: Sprint 4 marked ✅ Completed (`3 ✅`); executive summary totals updated to `11 ✅ (92%) / 0 🟡 / 1 🔄 (8%)`; Additional Accomplishments section added covering TypeScript migration (`365b392`), error-handling standardization (`7bb92c0`), performance −27.9 % bundle, `ARCHITECTURE.md` + localStorage audit (`86d7847`), Tavily cache TTL fix (`86a34a8`), briefing timezone fix (`5c7b7a6`).
- `Milestone/API.md`: Cache TTL corrected from 60 min → 360 min / 6 h in all three locations (weather section, §11 Read API Cache, caching table); "Updates 2026-05-29" entry added to Change Log Against Template.
- `Milestone/KNOWN_ISSUES.md`: Item #3 (Tavily cost) marked ✅ closed; "Closed retroactively" subsection added with 9 filed-and-closed GitHub issues (#3, #17–#23, #25) linking to actual issue numbers.
- `Milestone/MILESTONE4_PROGRESS.md`: SCRUM-26/27/28 flipped to ✅ Completed with commit-level evidence; group progress raised to 92%; self-grade raised to A−.
- `DOCS.md`: TypeScript migration reflected in §2 Tech Stack and §3 Directory Structure; `useOnboardingStore` added as §5.10; §16 resolved items (#3 Tavily, #15b timezone) removed; §17 Sprint 4 marked ✅; ARCHITECTURE.md reference added near top.
- **9 retroactive GitHub issues filed-and-closed** (MinsooAhn02/CSE_416_3pip #17–#23, #25) for bug-tracking transparency covering fixes shipped 2026-05-23 through 2026-05-27.

---

## 2026-05-24

### [Docs] Cross-verification: BUG-15b entry added

- `Milestone/todo_test.md`: Minsoo Ahn added BUG-15b (Tomorrow-schedule timezone bug fix) verification entry — 4-step test plan covering afternoon/morning mode and visibility-gate separation. Closes [KNOWN_ISSUES #15b](./archive/course/Milestone/KNOWN_ISSUES.md).

**BUG-15b test steps (Implementer: Minsoo Ahn · Tester: TBD):**

- [ ] 오후 모드 (12시 이후): 브리핑 "Tomorrow" 섹션에 내일 Google Calendar 일정 표시 확인
- [ ] 내일 00:00~09:00 KST 일정도 포함되는지 확인 (timezone fix 핵심 검증)
- [ ] 오전 모드 (12시 이전): "Tomorrow" 섹션 미표시 확인 (morning-mode 정책 유지)
- [ ] 설정에서 Calendar 위젯 숨김 → 새로고침 → 브리핑 "Tomorrow" 섹션 여전히 표시 (visibility gate 분리 검증)

---

## 2026-05-23

### [Docs] Cross-verification log created + Jira → GitHub task migration

- `Milestone/todo_test.md` created by Sungmin Choo — 9 features assigned for cross-verification (SCRUM-16, 17, 18, 20, 21, 22, 23, 25, 28) with implementer + tester pairs.
- Filed 15 GitHub Issues (#1–#15) mirroring the Jira sprint backlog so the bug-tracking surface lives on GitHub for Milestone 4 grading. See GitHub [issue #16](https://github.com/MinsooAhn-SBU/CSE_416_3pip/issues/16) for the migration notice.

**Verification Assignments:**

| SCRUM | Feature | Implementer | Tester |
|-------|---------|-------------|--------|
| SCRUM-16 | Onboarding (category selection) + DiaryCard Q&A | Dahyun Kwon | Sungmin Choo |
| SCRUM-17 | PostgreSQL schema + RLS policies | Sungmin Choo | Dahyun Kwon |
| SCRUM-18 | Smart Widgets & Briefing sync | Minsoo Ahn | Dahyun Kwon |
| SCRUM-20 | i18n (Korean/English full compatibility) | Dahyun Kwon | Minsoo Ahn |
| SCRUM-21 | Diary Card responses → Diary integration | Sungmin Choo | Minsoo Ahn |
| SCRUM-22 | 30-day keyword decay + API caching | Minsoo Ahn | Dahyun Kwon |
| SCRUM-23 | Modal portals + Diary feedback UI | Dahyun Kwon | Minsoo Ahn |
| SCRUM-25 | Persona → Groq API bridge + error handling | Minsoo Ahn | Sungmin Choo |
| SCRUM-28 | Cloudflare Workers deployment (live) | Minsoo Ahn | Sungmin Choo |

**Detailed test steps:**

**SCRUM-16 — Onboarding + DiaryCard**
Implementer: Dahyun Kwon · Tester: Sungmin Choo

- [ ] First login → onboarding modal appears with category selection (8 categories)
- [ ] Select 2+ categories → proceed to permissions step → finish onboarding → dashboard renders
- [ ] DiaryCard shows a personalized Q&A question based on selected categories
- [ ] Answer Q&A → save → reload → answer retained (PIN-gated)
- [ ] DiaryCard question language matches app language setting

**SCRUM-17 — PostgreSQL Schema + RLS**
Implementer: Sungmin Choo · Tester: Dahyun Kwon

- [ ] Log in with two different Google accounts in separate browsers
- [ ] Account A adds a widget, todo, and diary entry
- [ ] Switch to Account B → verify Account A's data is NOT visible
- [ ] Check Supabase Dashboard → RLS policies exist on all user-scoped tables
- [ ] Run `supabase/schema.sql` on a fresh project → no errors

**SCRUM-18 — Smart Widgets & Briefing Sync**
Implementer: Minsoo Ahn · Tester: Dahyun Kwon

- [ ] Add a Smart Widget keyword (e.g., "camera") → content loads within 30s
- [ ] Add 2nd keyword → both widgets display correctly
- [ ] Remove a keyword → widget disappears from layout
- [ ] Open AI Briefing detail modal → "Smart keywords" subBlock shows one hyperlinked article per keyword
- [ ] Click smart keyword article link → opens correct URL in new tab
- [ ] Switch language → smart widget content reloads in correct language

**SCRUM-20 — i18n (Korean / English)**
Implementer: Dahyun Kwon · Tester: Minsoo Ahn

- [ ] Toggle language to Korean → TopNav, widget titles, settings modal labels all in Korean
- [ ] Toggle language to English → all labels revert to English
- [ ] Korean mode: news widget shows Korean articles only (no English articles mixed in)
- [ ] Korean mode: smart widget section titles show "맞춤 검색" (not "Personalized Search")
- [ ] Settings modal → Diary tab → Korean mode shows "생성 언어" heading
- [ ] Trends widget: Korean mode shows Korean trend titles

**SCRUM-21 — Diary Card → Diary Integration**
Implementer: Sungmin Choo · Tester: Minsoo Ahn

- [ ] Answer DiaryCard Q&A → save
- [ ] Open DiaryPanel for today → AI-generated diary references Q&A content naturally
- [ ] Answer is stored and visible after page reload
- [ ] Keywords from the answer are reflected in personalization (check Settings → keyword interests after midnight batch, or manually trigger)

**SCRUM-22 — Keyword Decay + API Caching**
Implementer: Minsoo Ahn · Tester: Dahyun Kwon

- [ ] Add stock symbols in Settings → StocksWidget updates
- [ ] Refresh StocksWidget manually → loading indicator → fresh data
- [ ] Refresh NewsWidget → new articles load; check Supabase `api_cache` table — row updated
- [ ] Force-refresh twice within 6 hours → second refresh uses cached data (no new Tavily call)
- [ ] Check `src/services/personalizationService.js` exists and has `VALID_CATEGORIES` + `SOURCE_WEIGHTS`

**SCRUM-23 — Modal Portals + Diary Feedback UI**
Implementer: Dahyun Kwon · Tester: Minsoo Ahn

- [ ] NewsWidget "More" → NewsAllModal opens as overlay (portal) → close button works
- [ ] StocksWidget "+" icon → manage modal opens → add/reorder/delete ticker works → ConfirmDialog appears on delete
- [ ] DiaryPanel: Like/Dislike buttons visible when diary exists
- [ ] Dislike → enter feedback text → "Rewrite" → (verify GH #2 status)
- [ ] EventPanel: create event → modal closes after save → event appears in calendar

**SCRUM-25 — Persona → Groq API Bridge + Error Handling**
Implementer: Minsoo Ahn · Tester: Sungmin Choo

- [ ] AI Briefing generates within ~15s on first load
- [ ] Briefing includes all sections: header / schedule / yesterday / today's latest info
- [ ] BriefingWidget shows `apiStatus` indicator (green dot = ok, red = error)
- [ ] Disconnect internet → refresh widget → mock/fallback data displayed (no crash)
- [ ] Korean mode briefing: no character garbling in generated text
- [ ] `BriefSettingsModal` tone/length change → next briefing reflects the setting

**SCRUM-28 — Cloudflare Workers Deployment**
Implementer: Minsoo Ahn · Tester: Sungmin Choo

- [ ] Open https://morningbriefing.dksalstn0621.workers.dev in a browser → login screen loads
- [ ] Sign in with Google → OAuth redirect back to app → dashboard renders (no 404)
- [ ] Hard-refresh the page (Ctrl+F5) → still loads correctly (SPA routing works)
- [ ] Open a deep link path directly → redirects to login correctly
- [ ] All widgets load data (not stuck in demo mode)

---

## 2026-05-22

### [Docs] Schedule and progress doc sync against codebase

- `Milestone/SCHEDULE.md` rewritten with verified completion status per SCRUM item (9 ✅ / 2 🟡 / 1 🔄), Executive Summary table, per-task Completion Evidence column, and 3 formally documented Schedule Changes:
  - SCRUM-28: Vercel → Cloudflare Workers (deployment live)
  - SCRUM-16/25: Persona settings UI → 8-category personalization (backend persona context retained)
  - SCRUM-24: Desktop History fetching → Smart Widget keyword learning + Briefing snapshots (browser-history permission incompatibility)
- `Milestone/MILESTONE4_PROGRESS.md` updated to match SCHEDULE.md decisions; removed all `[VERIFY]` flags; SCRUM-28 deployment marked done
- `DOCS.md §16` corrected: removed outdated "`keyword_score_log` aggregation unverified" entry (implementation confirmed in `personalizationService.js`); Diary PIN status clarified
- `DOCS.md §17` updated: SCHEDULE.md "remaining placeholder cells" item removed; deployment risk removed from blocker watchlist
- `Milestone/KNOWN_ISSUES.md` Issue #11 marked resolved — `personalizationService.js` implements the 30-day decay aggregation per spec

### [Docs] Milestone 4 deliverables

- `README.md` rewritten with Windows setup, build/deploy, testing, bug reporting sections; backend description corrected from FastAPI/Python/Gemini to Supabase Edge Functions/Deno/Groq
- `SCHEDULE.md` created from May 1st Jira baseline (11 epics × 4 sprints) with Schedule Changes section
- `API.md` created with 25 endpoints (8 Edge Functions + 16 REST + 3 Auth); 7 corrections applied vs. the `MorningBriefingAI_API_Design.xlsx` template, 12 endpoints added
- `MILESTONE4_PROGRESS.md` drafted per ProjectMilestones.md requirements (individual + group + self-grade B + process adjustments)
- `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md` added
- `KNOWN_ISSUES.md` created with 16 issues ready to file into GitHub Issues
- DOCS.md §17 updated from "Compliance Gaps" to "Compliance Status" — all 5 deliverables marked done

### [Docs] Documentation restructure

- `DOCS.md` (1,854 lines) split into three files:
  - `DOCS.md` — rewritten in English, concise architecture reference (970 lines)
  - `DOCS_kor.md` — cleaned Korean reference, fix rounds removed (1,166 lines)
  - `CHANGELOG.md` — all dated fix-round entries extracted here (this file)
- Section 1 duplicate "Smart Widget Notes" removed from top of original DOCS.md; content consolidated into DOCS.md §7.4 (Smart Widget) and §8 (Edge Functions)
- Milestone 4 compliance gaps documented in DOCS.md §17
- README.md backend description discrepancy flagged (README says FastAPI/Python/Gemini; actual code is Supabase Edge Functions/Deno/Groq)

---

## 2026-05-20

### [Fix 26] Stocks Widget bug fixes (2 items)

**Files:** `src/components/widgets/StocksWidget.jsx`, `src/components/common/ConfirmDialog.jsx`

**Fix 1: Remove currency symbols from index tickers ($, ₩)**

- KOSPI, NASDAQ, and S&P 500 are point-based indices, but `CURRENCY_MAP` was mapping them to "KRW"/"USD", causing ₩/$ to display incorrectly.
- Changed `CURRENCY_MAP` values for KOSPI/NASDAQ/SP500 to `"Index"`. The symbol derivation logic returns an empty string for "Index", so no symbol displays.

**Fix 2: Keep main modal open after "remove ticker?" confirmation**

- ConfirmDialog backdrop click was causing React synthetic event bubbling up to StocksWidget main modal, closing it unintentionally.
- Changed ConfirmDialog backdrop `onClick={onCancel}` → `onClick={(e) => { e.stopPropagation(); onCancel(); }}`.

---

### [Fix 25] Diary generation improved: briefing snapshot integration + enhanced prompts

**Files:** `DiaryPanel.jsx`, `diaryGenerationService.js`, `aiService.js`, `scripts/test-diary-generation.mjs` (new)

**Issues:**
1. Missing briefing snapshot on manual generation — `generateAndSaveDiaryForDate` called without `briefingSnapshots`
2. Unnecessary stocks data included in `promptContext`
3. Feedback continuity problem — previous day's feedback disappearing two days later

**Solution:**
- `DiaryPanel.jsx`: Fetch snapshots with `useBriefingHistoryStore.getState().getSnapshotsForDate(selectedDate)` before passing
- `diaryGenerationService.js`: Remove `stocks`, reduce `interests` slice from 10 → 8
- `aiService.js`: Remove `stocks` from `generateDiary()` parameters, enhance prompt rules
  - `previousDayDiary` used for style/tone/voice reference only — never include previous day's events/content in today's diary
  - If `previousDayFeedback` exists, apply those preferences (include/exclude items) to today's diary

**Feedback continuity design:**
```
Day 1 diary (with stocks) + feedback "remove stocks"
  ↓
Day 2: previousDayDiary(style ref) + previousDayFeedback(no stocks) → diary without stocks
  ↓
Day 3: previousDayDiary = Day 2 diary(no-stock style) → style maintained even without feedback
```

---

## 2026-05-18

### [Fix 24] Tavily Korean news/trends sources + translation cache normalization

**File:** `src/store/useDataStore.js`

**Issue:** In Korean mode, Tavily retrieves Korean news site URLs correctly, but when the original article title is in English, the title displays in English. When existing cache stores the original English payload, subsequent cache hits re-expose the English title.

**Solution:**
- Pass `include_domains: KO_NEWS_DOMAINS` for Korean news/trends requests
- Use `filterByAllowedDomains()` as a hard domain filter, not just for sorting
- Apply Korean normalization with `translateArticlesToKorean()` before displaying `title`/`content`
- Add `buildLocalizedTrendTitles()` — compose real-time trend display titles from Korean article titles or translated fallback titles
- Enhance `needsKoreanTranslation()` — detect cases like `Trump tariff fight - 연합뉴스` (English headline with Korean source) as translation targets
- On DB cache read, if original English payload found, backfill translated payload to `api_cache`
- `warmupTrendsMemCache()`: Skip loading original payloads into memory cache if backfill is needed for Korean cache

**Cache policy:**
- News: `news_${lang}_${interestFingerprint}`
- Trends: `trends_full_${lang}`
- Korean cache payload stores translated `results[].title`, `results[].content`, `trends[]`

---

## 2026-05-17

### [Fix 23 / Round 11] Event create/edit modal closing bug fixed

**Files:** `EventPanel.jsx`, `en.json`, `ko.json`

**Symptoms:**
1. Create new event — save succeeds but modal stays open
2. Edit event — save fails and modal stays open
3. Cancel button — no response on click

**Root cause:** `setShowAddForm(false)` in `handleSubmit` only executes conditionally after await addEvent/updateEvent. Internal `fetchEvents` call triggers extra re-render, causing timing collision → modal stays open.

**Solution (Optimistic Close pattern):**
- Add `handleCloseAddForm` helper (bundles `setShowAddForm(false)` + `resetForm()`)
- Refactor `handleSubmit`: call `handleCloseAddForm()` after payload build, before await (guarantees close)
- Add toast feedback for missing time (early-return) with `toast.event_time_required`
- Replace inline close handlers on backdrop / X / Cancel with single `handleCloseAddForm` call
- i18n: Add `toast.event_time_required` key (EN/KO)

---

### [Fix 22 / AI Briefing Round 5] News AI summary+link / Trends section / Market trends removed

**Files:** `src/services/aiService.js`, `src/components/widgets/BriefingWidget.jsx`

| Item | Before | After |
|------|--------|-------|
| Market trends section | Conditionally shown if `finance` interest exists | Completely removed |
| News Top 3 display | Title + source label (plain text) | Title (click → open in new tab) + AI 1-sentence summary + source |
| Trends Top 3 | Not shown | New sub-block — same structure as news |

**Changes in detail:**
- Delete `// ── 7) (conditional) market trends ──` block (19 lines)
- Add `summarizeArticlesBatch` helper: up to 6 items of `{title, url, content}` → single Groq call, output JSON `{ summaries: [{ index, summary }] }`
- `generateDetailedBriefing`: 2 parallel → 3 parallel (`diaryRewrite`, `smartSummary`, `articleSummaries`)
- `section.lines` polymorphic: `string` (existing plain text) | `{ title, url, summary, source }` (news/trends articles)
- `latest_info` sub-block: `latest_smart`, `latest_news`, `latest_trends` (3 items)
- Fix dashboard preview serialization: `.join(" · ")` → `toPlainLine` helper

---

### [Fix Round 10] Event modal + Google Calendar sync error surfacing

**Files:** `EventPanel.jsx`, `CalendarWidget.jsx`, `useGoogleCalendarStore.js`, `useAuthStore.js`, `en.json`, `ko.json`

**1. Edit event modal not closing / save not persisting**
- When Google sync fails, `updateEvent` throws → `handleSubmit` catch block only logs to console → modal stays open
- Solution: Add `toast.error()` in catch block (red toast on error, modal remains open)

**2. Google Calendar sync error surfacing (4 silent catch blocks fixed)**

| File | Location | Change |
|------|----------|--------|
| `CalendarWidget.jsx` | line 93 | `.catch(() => {})` → `[gcal]` log + auth-error-excluding toast |
| `useGoogleCalendarStore.js` | line 481 | `.catch(() => FALLBACK_TASK_LISTS)` → add log then same fallback |
| `useGoogleCalendarStore.js` | line 567 | `catch {}` → `catch (err)` + `[gcal]` log |
| `useAuthStore.js` | line 151 | `catch { return null; }` → `catch (err)` + `[gcal]` log |

**Diagnosis:** `[gcal] ensureProviderToken failed:` console log indicates Supabase OAuth `provider_token` expiration is the cause

---

### [Fix Round 9] Past diary regeneration: fix spurious "no app activity" sentence

**File:** `src/services/diaryGenerationService.js`

**Issue:** Regenerating a past-date diary (e.g., May 15) includes "There is no app activity record, so only auto-collected data is organized." sentence. `wasActiveDay` incorrectly inferred as `false`.

**Root causes (2):**
1. `ACTIVE_KEY`("mb_last_access_date") is a single string slot → after May 17 login, `wasActiveOn("2026-05-15")` always returns `false`
2. `inferredWasActiveDay` OR chain missing "diary already exists" signal

**Solution:** Add one line to `inferredWasActiveDay` OR chain in `buildDiaryGenerationContext`:
```js
!!(existingEntry?.diary || "").trim() ||
```

---

### [Fix Round 8] Diary generation language enforcement + foreign character validation / Briefing font size setting

**Files:** `src/services/aiService.js`, `src/components/widgets/BriefingWidget.jsx`

**1. Enforce strict language on diary generation**
- AI was generating diary titles/summaries in wrong languages: "五月十五日" (Chinese characters), "스트 назначить" (Korean+Russian)
- Branch system prompts by `resolvedLanguage` (Korean/English), explicitly list forbidden characters
- Add `containsForeignScripts(text, targetLang)` helper: detect foreign chars, replace with deterministic fallback

**2. Apply font size setting to AI Briefing dashboard view**
- Add `useFontSize` hook import
- Remove hardcoded size classes from all dashboard text elements → apply `style={...Style}`
- 4 style variables: `bodyStyle`(×1.0), `titleStyle`(×1.0), `sectionTitleStyle`(×0.75), `contentLineStyle`(×0.92), `footerHintStyle`(×0.83)

---

### [Fix Round 7] Diary regeneration: fix missing schedule section bug

**File:** `src/services/diaryGenerationService.js`

**Issue:** Generating today's diary for the first time shows Google Calendar events correctly, but clicking **Regenerate** causes the schedule section to show "No events".

**Root causes (3):**
1. `useDataStore.fetchCalendar` caches only today's events with `todayOnly: true` → can be empty array at regeneration time
2. All-day events (`start = "2026-05-17"`) parsed as UTC → date shifts by one day depending on timezone
3. Secondary fallback Edge Function call format mismatch → always fails

**Solution:** Use `useGoogleCalendarStore.events` as canonical source
- `filterEventsForDate`: direct `event.date === dateStr` comparison first → fallback to `isSameLocalDate`
- `fetchCalendarEventsForDate`: read from `useGoogleCalendarStore.getState().events`, lazy-fetch with `fetchEvents({ date: dateStr, skipLoading: true })` if missing

---

### [Fix Round 6]

**1. Sync AI Briefing first-login modal ↔ widget detail modal**
- `src/hooks/useBriefingContext.js` (new): subscribe all stores + return `buildContext()` function
- `src/components/widgets/BriefingSectionsView.jsx` (new): structured section renderer
- `BriefingWidget.jsx`, `FirstLoginBriefingModal.jsx`: refactor to use `useBriefingContext` hook + `BriefingSectionsView`

**2. Restore calendar diary blue-dot indicator**
- `CalendarWidget.jsx`: add `useDiaryStore` import, compute `diaryDateSet` (Set) + `hasDiaryOnDate()` function + restore blue-dot indicator

**3. Fix settings UI**
- Move smart keyword input to top section (right after header)
- Remove AI Briefing toggle: filter `briefing` in widget-management tab — AI Briefing always enabled

---

## 2026-05-16

### [Fix 21] News/Trends logic documentation alignment

No code changes. Rewrote `DOCS.md` §5.3 to 1:1 match actual code (`src/store/useDataStore.js`).

| DOCS.md description | Actual code |
|---|---|
| `interest: kw1, kw2` | `interest topics: kw1, kw2` / `Focus topics: ...` |
| Korean mode `include_domains: KO_NEWS_DOMAINS` | Pass empty array `[]` — workaround for sparse Tavily Korean domain index |
| `filterByAllowedDomains` hard filter | Changed to sorting-only |

---

### [Fix 20] AI Briefing: fix fake calendar events exposure bug

**File:** `src/store/useDataStore.js`

**Symptom:** AI Briefing "Today's schedule" section always shows same fake events (`CSE 416 team meeting`, `lunch appointment`, `library study`, `gym workout`).

**Cause:** `mockCalendarEvents` fallback from `src/mock/data.js` sets `calEvents` for users without Google OAuth token. Mock items have `endTime=undefined` → pass BriefingWidget defense filter → injected into LLM prompt.

**Solution:** Replace 4 mock fallback branches in `fetchCalendar` with empty array.

---

### [Fix 19] Briefing/Diary automation bug fixes (Fix A–E)

**Fix A: Remove BriefingWidget `ensureYesterdayDiaryForMorning`**
- Delete entire `ensureYesterdayDiaryForMorning` function. Previous-day diary auto-generation now only runs via `useMidnightTrigger` path.

**Fix B: Execute `useMidnightTrigger` after hydrate completes**
- Add `hydrateComplete` boolean state. Set `setHydrateComplete(true)` right after `hydrateFromDB` completes.
- Gate with `useMidnightTrigger(isLoggedIn && hydrateComplete)`.

**Fix C: Fix `useBriefingHistoryStore` date UTC→local**
- Replace `const todayStr = () => new Date().toISOString().slice(0, 10)` with `formatLocalDate()`

**Fix D: Fix `BriefingWidget.yesterdayDateStr` UTC→local**
- Replace with `const yesterdayDateStr = shiftDateString(formatLocalDate(), -1)`

**Fix E: Convert `initialGenDoneRef` → `useState`**
- Change `useRef(false)` → `useState(false)`: ref mutations don't trigger re-renders, so 1-hour interval useEffect wasn't registering.

**Files modified:** `BriefingWidget.jsx`, `App.jsx`, `useBriefingHistoryStore.js`

---

### [Fix 18 / Widget Round 4] News / Stocks / AI Briefing

**News: Strict Korean mode domain filter**
- Remove "result count 0 → unfiltered fallback" logic from `filterByAllowedDomains`. Return empty array if KO_NEWS_DOMAINS filter is empty in `lang=ko`.
- Remove `fallbackLocalResults` / `fallbackGlobalResults` paths from `fetchNews`.

**News: Modal view list layout**
- Replace `grid grid-cols-3 aspect-square` grid in `showAllModal` with vertical scrolling list. Left thumbnail (80×56 px) + right title 2-line clamp + source label.

**Stocks: Unified modal (settings panel + order management + view-all → single modal)**
- Replace header ⚙ with `+` icon. Unified modal: header + ticker input + DnD card grid + X delete button.
- Remove unused i18n keys: `symbol_settings`, `select_symbols`, `manage_order`, `remove_symbol`
- Add new i18n keys: `confirm_delete_title`, `confirm_delete_message`

**Stocks: Generic index ticker support (Edge Function)**
- `fetchYahooQuote`: auto-retry with `^${symbol}` if primary ticker fails
- `fetchStooqPrice`: expand fallback candidates to `[sym.us, ^sym, sym]`
- Requires redeploy: `supabase functions deploy stocks`

**AI Briefing: Remove interests section**
- Delete `generateInterestSentences` function (~107 lines)
- Remove `generateInterestSentences` from `Promise.all` parallel call

**AI Briefing: Dashboard preview section splitting (CSS line-clamp)**
- Iterate `displayBriefing.sections` → render `divide-y` section structure. Each: 9px uppercase title + 11px content (`-webkit-line-clamp: 2`).
- Remove: `dashboardDetailText` useMemo, `dashboardDetailPreview` useState, `fitDashboardDetailPreview` useCallback, etc.

---

*이전 Fix Rounds 1–5는 이 날짜 이전 커밋 참조.*
