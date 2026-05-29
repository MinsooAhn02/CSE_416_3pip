# Milestone 4 Progress Update — MorningBriefing.AI

> **Date:** 2026-05-29 (Sprint 4 closed 2026-05-27; document refreshed for the final-release sprint)
> **Team:** Ahn Minsoo, Choo Sungmin, Kwon Dahyun
> **Course:** CSE 416, Stony Brook
>
> **Status markers:** ✅ Completed · 🟡 In progress · 🔄 Modified from original plan (see [SCHEDULE.md](./SCHEDULE.md) Schedule Changes)

---

# 1. Individual Progress Updates

## 1.1 Kwon Dahyun — Frontend Developer & UI/UX Designer

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence |
|-----|--------|------|--------|---------------------|
| SCRUM-16 | 1 (May 6–11) | Design detailed wireframes for Persona settings and Diary Cards | ✅ Completed | `OnboardingModal.jsx` (welcome → 8-category interest selection → permissions → done) + `DiaryCard.jsx` (PIN-gated Q&A card with personalized question generation). Persona settings simplified into category-based personalization — see SCHEDULE.md Schedule Changes. |
| SCRUM-20 | 2 (May 12–13) | Implement i18n logic for full Korean/English compatibility across the web | ✅ Completed | `i18next` configured with `ko.json` + `en.json`; language toggle in TopNav; per-language cache keys for news / trends / Smart Widget; final 5 i18n bugs resolved 2026-05-20 (CHANGELOG). 10+ components use `useTranslation`. |
| SCRUM-23 | 3 (May 14–20) | Implement modal portals for detail views and feedback UI | ✅ Completed | `createPortal` used in 10 components (`NewsAllModal`, `StocksWidget` ticker modal with DnD, `ConfirmDialog`, `EventPanel`, `TaskPanel`, etc.). DiaryPanel Like / Dislike → Rewrite → ConfirmDialog feedback flow shipped. |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence (May 29) |
|-----|--------|------|--------|---------------------------|
| SCRUM-26 | 4 (May 21–27) | Final UI/UX audit and resolution of front-end design inconsistencies | ✅ Completed | Sprint 4 closed 2026-05-27. Smart Widget section-title fix, Smart Widget fashion search tuning, Korean hardcoding cleanup, plus the late-sprint polish round: panel font-size unification (Diary/Event/Task), DiaryPanel rewrite UX (button below textarea, disabled when empty), DiaryList PIN prompt fix, removal of redundant rewrite confirm dialog, news image fallback (Newspaper placeholder), Calendar Today button from year/decade view, SmartWidget category override button, login-timestamp reset, permission UI blue refresh. |

### Items actually completed beyond the schedule

- Smart Widget category dropdown UI + emoji-driven category override (2026-05-19)
- Diary Card feedback UI redesign with confirmation dialog
- Drag-and-drop reorder for stocks (`@hello-pangea/dnd`) with `createPortal` z-index fix
- 3-level Calendar header drill-down (month → year → decade) with blue-dot diary day indicators
- TypeScript migration across the full codebase (`365b392`, 2026-05-24) — Dahyun co-owned the widget conversion pass
- Font-size setting threaded through Diary / Event / Task panels (`5fc08b9`, 2026-05-26)
- Enable-permission UI refresh: button + icon colors → blue (`068d618` / `91a6b4a`, 2026-05-27)

### Items partially completed

_None as of 2026-05-22._

---

## 1.2 Choo Sungmin — Backend Developer & UI/UX Designer

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence |
|-----|--------|------|--------|---------------------|
| SCRUM-17 | 1 (May 6–11) | Optimize PostgreSQL schema for activity logging; set up RLS policies | ✅ Completed | `schema.sql` + 3 migrations (`add_personalization`, `add_user_qa`, `add_fixed_interests`); RLS policies on all user-scoped tables (38 `CREATE POLICY` statements); explicit `GRANT` blocks for the 2026-05-30 Supabase auto-grant policy change. |
| SCRUM-21 | 2 (May 12–13) | Develop integration logic to reflect Diary Card responses into the main Diary | ✅ Completed | `user_qa` table + `useDiaryStore.addAnswer()` writes Q&A; `diaryGenerationService.buildDiaryGenerationContext()` pulls Q&A into Groq prompt context; answer save triggers `bumpKeyword()` for personalization (score +5 per keyword). |
| ~~SCRUM-24~~ | 3 (May 14–20) | ~~Desktop History fetching API~~ → **Smart Widget keyword learning + Briefing snapshots** | 🔄 Modified — replaced | Replaced with two functionally equivalent systems: (a) `personalizationService.extractKeywords()` runs at midnight and writes to `keyword_score_log` with 30-day decay, (b) `useBriefingHistoryStore` captures 3-hour-interval briefing snapshots for lazy diary synthesis. Together these collect comparable personalization signal from in-app activity without requiring browser-history permissions (incompatible with the current SPA deployment on Cloudflare Workers). |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence (May 29) |
|-----|--------|------|--------|---------------------------|
| SCRUM-27 | 4 (May 21–27) | Database indexing for performance; finalize secure data isolation (RLS) audits | ✅ Completed | RLS audit re-verified — all 9 user-scoped tables (`user_settings`, `widget_layouts`, `todos`, `smart_keywords`, `diaries`, `user_qa`, `briefing_snapshots`, `keyword_score_log`, `api_cache`) enforce `auth.uid()` policies across SELECT/INSERT/UPDATE/DELETE. Indexes on `keyword_score_log(user_id, logged_date)` + `user_qa(user_id, asked_date)` confirmed sufficient under load; no additional indexes needed. `perms.cal` / `perms.fit` permission gates added to data fetches (`a591f89`, 2026-05-26). |

### Items actually completed beyond the schedule

- `api_cache` table — TTL extended **1 h → 6 h** on 2026-05-23 (`86a34a8`) to cut Tavily token consumption (closes [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #3)
- `briefing_snapshots` table for time-stamped briefing history (used by lazy diary synthesis on missed days)
- `personalizationService.ts` — keyword extraction + 30-day decay aggregation (`SOURCE_WEIGHTS = {personal: 2, diary: 1}` matching the spec)
- Multiple diary fix rounds (auto-diary feedback baseline, hydrate gating, UTC → local date fix, foreign-script post-processing) — see CHANGELOG.md
- Diary lazy synthesis flow (`recoverMissedDiaries` for missed days from briefing snapshots)
- Briefing tomorrow-schedule timezone fix (`5c7b7a6`, 2026-05-24) — closes [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #15b
- Standardized error handling utility (`src/utils/errorHandler.ts`, `7bb92c0`, 2026-05-24) — applied across `useDataStore.ts`, `aiService.ts`, `diaryGenerationService.ts`

### Items partially completed

| Item | % Complete | Notes |
|------|-----------|-------|
| Diary PIN setup flow | ~60% | PIN hashing (SHA-256) + storage + verification done; PIN set/modify/recovery UI not exposed in settings yet. Tracked in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #14. |

---

## 1.3 Ahn Minsoo — Infrastructure & DevOps & Backend Developer

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence |
|-----|--------|------|--------|---------------------|
| SCRUM-18 | 1 (May 6–11) | Implement Smart Widgets & Briefing sync | ✅ Completed | `SmartWidgetContent.jsx` with 17-category taxonomy; `BriefingWidget.jsx` `latest_info.latest_smart` sub-block pulls Smart Widget keyword summaries; `useBriefingContext.js` shared 14-field context builder used by both BriefingWidget and FirstLoginBriefingModal. |
| SCRUM-22 | 2 (May 12–13) | Integrate 30-day Keyword Decay formula; ensure API stability and caching | ✅ Completed | Decay formula `score = Σ(base_weight × (30 - elapsed_days) / 30)` implemented in `personalizationService.js`; `VALID_CATEGORIES` + `SOURCE_WEIGHTS = {personal: 2, diary: 1}` matching spec. `api_cache` with 1-hour TTL covers all Edge Function calls; 25s timeout + mock fallback on all calls. |
| SCRUM-25 | 3 (May 14–20) | Bridge Persona settings with Groq API; implement API error/timeout handling | ✅ Completed | `personaContext.buildPersonaContext()` merges `fixedInterestIds` + `keywordInterests` + persona into a single Groq context object (21 reference sites in `aiService.js`); 25s timeout on all Edge Functions; mock fallback on failure; `apiStatus="error"` indicator per widget. Groq Edge Function `Content-Type: application/json; charset=utf-8` fix for Korean text. |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Completion Evidence (May 29) |
|-----|--------|------|--------|---------------------------|
| SCRUM-28 | 4 (May 21–27) | ~~Execute Vercel deployment~~ → **Execute Cloudflare Workers deployment**; set up monitoring for API usage and maintenance | ✅ Completed | **Cloudflare Workers deployment live** (`wrangler.jsonc` configured; build + deploy pipeline working — commits `934df36` + `9bf683a`). Live URL: `https://morningbriefing.dksalstn0621.workers.dev`. Monitoring closed out: Supabase Dashboard logs + Cloudflare Analytics in active use; dedicated unified alerting dashboard formally deferred to post-v1.0 polish (scope-bounded acknowledgement). |

### Items actually completed beyond the schedule

- Stocks widget overhaul: 8 fixed indices (SP500/KOSPI/NASDAQ/USDKRW/VIX/CRUDE/DXY/DJI) + user-added tickers, strict ticker validation, `type`/`currency` metadata from Edge Function, optimistic confirm-dialog dismiss (CHANGELOG 2026-05-16); invalid-input error handling improvements (`70ca0d0`, 2026-05-23)
- Tavily Korean post-processing pipeline (`translateArticlesToKorean()` + `buildLocalizedTrendTitles()` + `api_cache` translation backfill)
- Groq Edge Function `charset=utf-8` header fix for Korean text
- Briefing widget article batch summarization (`summarizeArticlesBatch` — single Groq call for up to 6 articles instead of N parallel calls)
- **TypeScript migration** across the full codebase (`365b392`, 2026-05-24) — Minsoo co-owned the services + Edge Function conversion pass
- **Performance optimization**: bundle **-27.9 %** (1,025.94 kB → 739.50 kB), `React.memo` on all 9 widgets, `useShallow` on Weather/Health/Trends/News/Stocks, `React.lazy` + `Suspense` on widgets & modals, `fetchAll` dedup via `initPhaseRef` gate (`tasks/todo.md` Goal 3)
- **ARCHITECTURE.md + `docs/security/localStorage-audit.md`** added (`86d7847`, 2026-05-24) — 30-minute end-to-end onboarding overview with mermaid diagrams + audit of localStorage XSS surface and `provider_token` handling
- **`useOnboardingStore.ts`** extracted from auth/settings stores (`5f192e9`, 2026-05-24) — cleaner ownership of onboarding wizard state

### Items partially completed

| Item | % Complete | Notes |
|------|-----------|-------|
| API usage monitoring dashboard | ~50% | Supabase Dashboard logs + Cloudflare Analytics available now; dedicated unified dashboard with alerting deferred to post-Milestone-4 polish. |
| Stocks + Groq Edge Function manual deploy | ~80% | Local code changes complete; Supabase Dashboard upload pending for final release. Tracked in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #15 and #16. |

---

# 2. Group Progress Update

## 2.1 Overall progress assessment

**Status: ✅ All 12 epics delivered. Project is in final-release polish.**

Of the 12 scheduled epics (SCRUM-16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28):

| Bucket | Count | % | Items |
|--------|-------|---|-------|
| ✅ Completed | 11 | 92% | SCRUM-16, 17, 18, 20, 21, 22, 23, 25, 26, 27, 28 |
| 🔄 Modified (formally replaced) | 1 | 8% | SCRUM-24 (Desktop History → Smart Widget keyword learning + Briefing snapshots) |

Sprints 1, 2, 3, and 4 are all fully delivered. Sprint 4 closed on schedule (2026-05-27) with the full UI/UX audit, RLS audit, and deployment-monitoring items complete.

In addition to scheduled items, the team has shipped **a significant body of unscheduled work** that strengthens the product:

- **27 dated fix rounds** ([CHANGELOG.md](../CHANGELOG.md)) covering briefing regressions, diary feedback flow, calendar event modal bugs, Tavily Korean translation pipeline, stocks ticker fallback, i18n cleanup, post-Sprint-4 polish
- **Full documentation suite:** [DOCS.md](../DOCS.md) (English) + [DOCS_kor.md](../DOCS_kor.md) (Korean) + [ARCHITECTURE.md](../ARCHITECTURE.md) (30-min onboarding overview) + [CHANGELOG.md](../CHANGELOG.md) + [API.md](./API.md) (25 endpoints) + [SCHEDULE.md](./SCHEDULE.md) + [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) + [docs/security/localStorage-audit.md](../docs/security/localStorage-audit.md) + GitHub bug/feature issue templates
- **TypeScript migration** — 77 files, full `.js`/`.jsx` → `.ts`/`.tsx` conversion; `tsconfig.json` with `strict:false`; `tsc --noEmit` exits 0; `npm run build` succeeds
- **Performance optimization** — bundle -27.9 % (1,025.94 kB → 739.50 kB), `React.memo` on all 9 widgets, `useShallow` on 5 widgets, `React.lazy` + `Suspense` on widgets + modals
- **Tavily cost reduction** — `api_cache` TTL extended 1 h → 6 h (~6× fewer Tavily calls; resolves KNOWN_ISSUES #3)
- **Briefing snapshot system + lazy diary synthesis** for missed days — net-new personalization architecture
- **Smart Widget 17-category taxonomy** with per-category section planning — extends beyond the original Smart Widget scope

## 2.2 Self-assigned grade

**We assess our overall progress as: A−**

**Rationale (updated 2026-05-29, post-Sprint-4 close):**

- **Strengths:**
  - All four of Sprints 1–4 are fully complete on schedule
  - The codebase is **deployed and live** on Cloudflare Workers
  - The architecture is well-documented end-to-end (ARCHITECTURE.md, DOCS.md, API.md, CHANGELOG.md, SCHEDULE.md)
  - All core widgets render correctly and personalization signal is captured and used
  - Significant additional polish work (27 fix rounds, briefing snapshots, Korean translation pipeline, Smart Widget categorization, full TypeScript migration, -27.9 % bundle size) has been shipped beyond the original scope
  - Two previously open issues (#3 Tavily cost, #15b briefing timezone) are now resolved and closed on GitHub

- **What keeps us at A− vs. A:**
  1. **Cross-verification not yet complete** — per ProjectMilestones.md, each completed feature should be verified by a team member who did not implement it. The `Milestone/todo_test.md` checklist is in place but still partially unfilled.
  2. **10 known issues remain open** ([KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #1, #2, #4–#10, #12–#14) plus 2 deployment items (#15 stocks Edge Function, #16 groq Edge Function). Open issues are tracked on GitHub for the v1.0 release.
  3. **Stocks and Groq Edge Function manual deploys** are pending Supabase Dashboard uploads, which means a small portion of the deployed app may still serve stale Edge Function code until that final upload.

- **What we will do for the final release:**
  - Cross-verification pass — each completed feature verified by a team member who did not implement it (Owner: full team)
  - Continue triage on [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — assign owners, allocate bug-fix slots in the final-release sprint
  - Complete Edge Function manual deploys (`stocks`, `groq`) via Supabase Dashboard (Owner: Minsoo)
  - Tag `v1.0` on GitHub once cross-verification is clean

## 2.3 Process adjustments going forward

1. **Schedule discipline** — Any feature change (drop, replace, defer) reflected in [SCHEDULE.md](./SCHEDULE.md) "Schedule Changes" within the same sprint, not at milestone review time. (Lesson from how SCRUM-24's Desktop History replacement was discovered only at Milestone 4 review; now formalized.)
2. **Bug-fix slotting** — Every sprint going forward reserves ~20% of capacity for bug fixes from the [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) backlog. Bugs filed as GitHub Issues, not lost in `todo.md`.
3. **Deploy-early policy** — Deployment validated end-to-end in Sprint 1 in future cycles, not Sprint 4. Avoids the end-loaded deployment risk we navigated this cycle.
4. **Pre-milestone verification** — One full team day before each milestone reserved for cross-verification of completed features and KNOWN_ISSUES triage.

---

# Sign-off

This document was drafted by the team on 2026-05-22 using the Jira board export (May 1st baseline) and a code-base audit. Each individual section was reviewed and confirmed by the named team member.

- **Kwon Dahyun:** _[signature / GitHub username]_ — date: 2026-05-__
- **Choo Sungmin:** _[signature / GitHub username]_ — date: 2026-05-__
- **Ahn Minsoo:** _[signature / GitHub username]_ — date: 2026-05-__

---

## References

- [SCHEDULE.md](./SCHEDULE.md) — sprint-by-sprint schedule + Schedule Changes
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — open bugs to file
- [API.md](./API.md) — API design (25 endpoints)
- [CHANGELOG.md](../CHANGELOG.md) — dated history of all fix rounds
- [DOCS.md](../DOCS.md) — architecture reference (English)
- [DOCS_kor.md](../DOCS_kor.md) — architecture reference (Korean)
- [ProjectMilestones.md](./ProjectMilestones.md) — course assignment specification
