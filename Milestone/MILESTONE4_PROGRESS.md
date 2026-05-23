# Milestone 4 Progress Update — MorningBriefing.AI

> **Date:** 2026-06-01
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

| Key | Sprint | Task | Status | Progress to Date (May 22) |
|-----|--------|------|--------|---------------------------|
| SCRUM-26 | 4 (May 21–27) | Final UI/UX audit and resolution of front-end design inconsistencies | 🟡 In progress | Sprint 4 currently active. Smart Widget section-title fix, Smart Widget fashion search tuning, Korean hardcoding cleanup all landed since Sprint 4 started. Remaining: full audit checklist + final polish items. On schedule for May 27 completion. |

### Items actually completed beyond the schedule

- Smart Widget category dropdown UI + emoji-driven category override (2026-05-19)
- Diary Card feedback UI redesign with confirmation dialog
- Drag-and-drop reorder for stocks (`@hello-pangea/dnd`) with `createPortal` z-index fix
- 3-level Calendar header drill-down (month → year → decade) with blue-dot diary day indicators

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

| Key | Sprint | Task | Status | Progress to Date (May 22) |
|-----|--------|------|--------|---------------------------|
| SCRUM-27 | 4 (May 21–27) | Database indexing for performance; finalize secure data isolation (RLS) audits | 🟡 In progress | Indexes already in place on `keyword_score_log(user_id, logged_date)` + `user_qa(user_id, asked_date)`. RLS policies on all user-scoped tables already verified. Remaining: final audit checklist + any additional indexes identified during load testing. On schedule for May 27 completion. |

### Items actually completed beyond the schedule

- `api_cache` table with 1-hour TTL for all Edge Function responses
- `briefing_snapshots` table for time-stamped briefing history (used by lazy diary synthesis on missed days)
- `personalizationService.js` — keyword extraction + 30-day decay aggregation (`SOURCE_WEIGHTS = {personal: 2, diary: 1}` matching the spec)
- Multiple diary fix rounds (auto-diary feedback baseline, hydrate gating, UTC → local date fix, foreign-script post-processing) — see CHANGELOG.md
- Diary lazy synthesis flow (`recoverMissedDiaries` for missed days from briefing snapshots)

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

| Key | Sprint | Task | Status | Progress to Date (May 22) |
|-----|--------|------|--------|---------------------------|
| SCRUM-28 | 4 (May 21–27) | ~~Execute Vercel deployment~~ → **Execute Cloudflare Workers deployment**; set up monitoring for API usage and maintenance | ✅ Deployment Done · 🟡 Monitoring polish ongoing | **Cloudflare Workers deployment live** (`wrangler.jsonc` configured; build + deploy pipeline working — commits `934df36` + `9bf683a`). Live URL: `<DEPLOYED_URL>` _(team to provide)_. Monitoring: Supabase Dashboard logs + Cloudflare Analytics in use; dedicated alerting dashboard pending for final release. |

### Items actually completed beyond the schedule

- Stocks widget overhaul: 8 fixed indices (SP500/KOSPI/NASDAQ/USDKRW/VIX/CRUDE/DXY/DJI) + user-added tickers, strict ticker validation, `type`/`currency` metadata from Edge Function, optimistic confirm-dialog dismiss (CHANGELOG 2026-05-16)
- Tavily Korean post-processing pipeline (`translateArticlesToKorean()` + `buildLocalizedTrendTitles()` + `api_cache` translation backfill)
- Groq Edge Function `charset=utf-8` header fix for Korean text
- Briefing widget article batch summarization (`summarizeArticlesBatch` — single Groq call for up to 6 articles instead of N parallel calls)

### Items partially completed

| Item | % Complete | Notes |
|------|-----------|-------|
| API usage monitoring dashboard | ~50% | Supabase Dashboard logs + Cloudflare Analytics available now; dedicated unified dashboard with alerting deferred to post-Milestone-4 polish. |
| Stocks + Groq Edge Function manual deploy | ~80% | Local code changes complete; Supabase Dashboard upload pending for final release. Tracked in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #15 and #16. |

---

# 2. Group Progress Update

## 2.1 Overall progress assessment

**Status: ✅ On track for Milestone 4 deliverables.**

Of the 12 scheduled epics (SCRUM-16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28):

| Bucket | Count | % | Items |
|--------|-------|---|-------|
| ✅ Completed | 9 | 75% | SCRUM-16, 17, 18, 20, 21, 22, 23, 25, 28 (deployment portion) |
| 🟡 In progress (Sprint 4 active) | 2 | 17% | SCRUM-26 (UI/UX audit), SCRUM-27 (DB indexing + RLS audit) |
| 🔄 Modified (formally replaced) | 1 | 8% | SCRUM-24 (Desktop History → Smart Widget keyword learning + Briefing snapshots) |

Sprint 1, 2, and 3 are fully delivered on or ahead of schedule. Sprint 4 is currently active (today is May 22; ends May 27) and on-track for completion.

In addition to scheduled items, the team has shipped **a significant body of unscheduled work** that strengthens the product:

- **26 dated fix rounds** ([CHANGELOG.md](../CHANGELOG.md)) covering briefing regressions, diary feedback flow, calendar event modal bugs, Tavily Korean translation pipeline, stocks ticker fallback, i18n cleanup
- **Full documentation suite:** [DOCS.md](../DOCS.md) (English) + [DOCS_kor.md](../DOCS_kor.md) (Korean) + [CHANGELOG.md](../CHANGELOG.md) + [API.md](./API.md) (25 endpoints) + [SCHEDULE.md](./SCHEDULE.md) + [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) + GitHub bug/feature issue templates
- **Briefing snapshot system + lazy diary synthesis** for missed days — net-new personalization architecture
- **Smart Widget 17-category taxonomy** with per-category section planning — extends beyond the original Smart Widget scope

## 2.2 Self-assigned grade

**We assess our overall progress as: B**

**Rationale:**

- **Strengths:**
  - All three of Sprints 1–3 are substantially complete on schedule
  - The codebase is **deployed and live** on Cloudflare Workers
  - The architecture is well-documented end-to-end (DOCS.md, API.md, CHANGELOG.md, SCHEDULE.md)
  - All core widgets render correctly and personalization signal is captured and used
  - Significant additional polish work (26 fix rounds, briefing snapshots, Korean translation pipeline, Smart Widget categorization) has been shipped beyond the original scope

- **What keeps us at B vs. A:**
  1. **Sprint 4 is still in progress** — the final UI/UX audit (SCRUM-26) and the dedicated monitoring dashboard portion of SCRUM-28 are not yet complete. Both are on schedule for May 27 but cannot be claimed as done today.
  2. **Several known issues remain open** — 16 tracked in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) (Diary feedback rewrite, Smart Widget Korean "Latest Updates", Tavily token over-consumption, Diary PIN setup UI, etc.). These need to be triaged into GitHub Issues and assigned for final release.
  3. **Stocks and Groq Edge Function manual deploys** are pending Supabase Dashboard uploads, which means a small portion of the deployed app may still serve stale Edge Function code until that final upload.

- **What we will do for the final release:**
  - Complete remaining Sprint 4 items (SCRUM-26 audit, SCRUM-27 RLS audit + load testing indexes) by May 27 (Owners: Dahyun, Sungmin)
  - Triage [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — file all 16 issues into GitHub Issues, assign owners, allocate bug-fix slots in the final-release sprint (Owner: full team — synchronous review)
  - Complete Edge Function manual deploys (`stocks`, `groq`) via Supabase Dashboard (Owner: Minsoo)
  - Cross-verification pass — each completed feature verified by a team member who did not implement it (per ProjectMilestones.md); bugs found get filed as GitHub Issues

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
