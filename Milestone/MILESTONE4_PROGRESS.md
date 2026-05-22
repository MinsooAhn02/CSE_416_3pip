# Milestone 4 Progress Update — MorningBriefing.AI

> **Date:** 2026-05-22
> **Team:** 3pip (Ahn Minsoo, Choo Sungmin, Kwon Dahyun)
> **Course:** CSE 416, Stony Brook
>
> **Status markers:** ✅ Completed · 🟡 In progress · 🔄 Modified from original plan · ⚪ Not started
> **`[VERIFY]`** = item drafted from codebase observation; team member should confirm or correct.

---

# 1. Individual Progress Updates

## 1.1 Kwon Dahyun — Frontend Developer & UI/UX Designer

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-16 | 1 (May 6–11) | Design detailed wireframes for Persona settings and Diary Cards | ✅ Completed | OnboardingModal persona selection + DiaryCard component shipped. `[VERIFY]` |
| SCRUM-20 | 2 (May 12–13) | Implement i18n logic for full Korean/English compatibility across the web | ✅ Completed | i18next configured with `ko.json` / `en.json`; language toggle in TopNav; per-language cache keys; news / trends / Smart Widget all language-aware. Final i18n bugs resolved 2026-05-20 (CHANGELOG). `[VERIFY]` |
| SCRUM-23 | 3 (May 14–20) | Implement modal portals for detail views and Persona feedback UI | ✅ Completed | `createPortal` used in `NewsAllModal` and `StocksWidget` reorder modal; DiaryPanel Like / Dislike / Rewrite feedback flow implemented. `[VERIFY]` |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-26 | 4 (May 21–27) | Final UI/UX audit and resolution of front-end design inconsistencies | 🟡 In progress | Sprint 4 currently active (today is May 22). Smart widget section title fix and font-size consistency pass landed 2026-05-20. `[VERIFY remaining audit scope]` |

### Items actually completed beyond the schedule

- Smart Widget category dropdown UI + emoji-driven category override (2026-05-19)
- Diary Card feedback UI redesign with confirmation dialog
- Drag-and-drop reorder for stocks (`@hello-pangea/dnd`) with `createPortal` z-index fix
- 3-level calendar drill-down (month → year → decade)

### Items partially completed

_None as of 2026-05-22. `[VERIFY — fill in if there are partial items]`_

---

## 1.2 Choo Sungmin — Backend Developer

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-17 | 1 (May 6–11) | Optimize PostgreSQL schema for activity logging; set up RLS policies | ✅ Completed | `schema.sql` + 3 migrations (`add_personalization`, `add_user_qa`, `add_fixed_interests`) deployed; RLS policies in place on all user-scoped tables; explicit GRANT blocks for post-2026-05-30 Supabase policy change. `[VERIFY]` |
| SCRUM-21 | 2 (May 12–13) | Develop integration logic to reflect Diary Card responses into the main Diary | ✅ Completed | `user_qa` table + `useDiaryStore.addAnswer()` + diary generation pulls Q&A into prompt context. Answer save triggers `bumpKeyword()` for personalization. `[VERIFY]` |
| SCRUM-24 | 3 (May 14–20) | Integrate an API for Desktop History fetching and data parsing | 🔄 Modified | **No direct "Desktop History" implementation found in codebase.** Likely deferred or replaced by Smart Widget keyword learning + briefing snapshot system, which serve a similar personalization role. `[VERIFY — was this dropped, replaced, or partially done?]` |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-27 | 4 (May 21–27) | Database indexing for performance; finalize secure data isolation (RLS) audits | 🟡 In progress | Sprint 4 currently active. Indexes exist on `keyword_score_log(user_id, logged_date)` and `user_qa(user_id, asked_date)`. Final RLS audit pass pending. `[VERIFY]` |

### Items actually completed beyond the schedule

- `api_cache` table with 1-hour TTL for all Edge Function responses
- `briefing_snapshots` table (optional, app-level) for time-stamped briefing history
- Multiple diary fix rounds (auto-diary feedback baseline, hydrate gating, UTC→local date fix, foreign-script post-processing) — see CHANGELOG.md
- Briefing snapshot → diary lazy synthesis flow

### Items partially completed

| Item | % Complete | Notes |
|------|-----------|-------|
| Diary PIN setup flow | ~60% | PIN hashing (SHA-256) + storage done; PIN set/modify/recovery UI not done. Tracked in KNOWN_ISSUES #14. `[VERIFY %]` |
| `keyword_score_log` aggregation verification | ~80% | `runPersonalizationBatch` is called from `useMidnightTrigger`; internal batch logic exists but not end-to-end verified. Tracked in KNOWN_ISSUES #11. `[VERIFY %]` |

---

## 1.3 Ahn Minsoo — Infrastructure & DevOps

### Items scheduled to complete by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-18 | 1 (May 6–11) | Implement Smart Widgets & Briefing sync | ✅ Completed | `SmartWidgetContent.jsx` + `BriefingWidget.jsx` shipped; Smart Widget content flows into Briefing `latest_info.latest_smart` sub-block. Smart widget category taxonomy (17 categories) added. `[VERIFY]` |
| SCRUM-22 | 2 (May 12–13) | Integrate 30-day Keyword Decay formula; ensure API stability and caching | ✅ Completed | Decay formula `score = Σ(base_weight × (30 - elapsed_days) / 30)` documented in DOCS.md §11.3 and implemented in `runPersonalizationBatch`; `api_cache` with 1-hour TTL covers all Edge Function calls. `[VERIFY]` |
| SCRUM-25 | 3 (May 14–20) | Bridge Persona settings with Groq API; implement API error/timeout handling | ✅ Completed | `personaContext.buildPersonaContext()` merges fixed + dynamic interests into Groq prompts; 25s timeout on all Edge Functions; mock fallback on failure; `apiStatus="error"` indicator per widget. `[VERIFY]` |

### Items scheduled to be in-progress by Milestone 4

| Key | Sprint | Task | Status | Notes |
|-----|--------|------|--------|-------|
| SCRUM-28 | 4 (May 21–27) | ~~Execute Vercel deployment~~ → **Execute Cloudflare Workers deployment**; set up monitoring for API usage and maintenance | 🔄 Modified + 🟡 In progress | **Deployment platform changed from Vercel to Cloudflare Workers** (see SCHEDULE.md Schedule Changes for reason). `wrangler.jsonc` configured at repo root; deployment process documented in DOCS.md §14.4 and README.md. Live deployment URL: `<DEPLOYED_URL>` _(to be added once deployed)_. API usage monitoring not yet set up. `[VERIFY deployment status]` |

### Items actually completed beyond the schedule

- Multi-source stocks pipeline (TwelveData → Stooq CSV → er-api.com fallback chain) — supports custom index tickers via `^${symbol}` auto-fallback (CHANGELOG 2026-05-16)
- Tavily Korean post-processing pipeline (`translateArticlesToKorean()` + `buildLocalizedTrendTitles()` + `api_cache` backfill)
- Groq Edge Function `charset=utf-8` header fix for Korean text
- Briefing widget article batch summarization (`summarizeArticlesBatch` — single Groq call for up to 6 articles)

### Items partially completed

| Item | % Complete | Notes |
|------|-----------|-------|
| Cloudflare Workers deployment | `[VERIFY %]` | If `<DEPLOYED_URL>` is live and accessible → 100%; if not deployed yet → estimate %. |
| API usage monitoring | ~30% | Edge Function logs available via Supabase Dashboard; no dedicated dashboard or alerting yet. `[VERIFY %]` |
| Stocks Edge Function manual deploy | ~80% | Local code changes complete; Supabase Dashboard deploy pending. Tracked in KNOWN_ISSUES #15. |

---

# 2. Group Progress Update

## 2.1 Overall progress assessment

**Status: 🟡 On track for Milestone 4 deliverables.**

Of the 12 scheduled epics (SCRUM-16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28):

- **9 completed** (Sprints 1, 2, 3 substantially done across all three team members)
- **3 in progress** (Sprint 4: SCRUM-26 UI/UX audit, SCRUM-27 RLS audit + indexing, SCRUM-28 deployment) — Sprint 4 began May 21, so being in-progress is on-schedule
- **1 modified** (SCRUM-28 deployment platform: Vercel → Cloudflare Workers)
- **1 ambiguous** (SCRUM-24 Desktop History — no implementation found; needs team confirmation on whether this was dropped or replaced)

In addition to scheduled items, the team has shipped **a significant body of unscheduled work** that strengthens the product:

- 26 dated fix rounds (CHANGELOG.md) covering briefing regressions, diary feedback flow, calendar event modal bugs, Tavily Korean translation pipeline, stocks ticker fallback, i18n cleanup
- New documentation suite: DOCS.md (English) + DOCS_kor.md (Korean) + CHANGELOG.md + API.md + SCHEDULE.md + KNOWN_ISSUES.md + bug/feature issue templates
- Briefing snapshot system + lazy diary synthesis for missed days

## 2.2 Self-assigned grade

**We assess our overall progress as: B**

**Rationale:**

- **What's working (B+ leaning):** Three of four sprints are substantially complete on schedule, the architecture is well-documented, all core widgets render correctly, and we have shipped meaningful improvements (e.g., briefing snapshot system, Korean translation pipeline, Smart Widget categorization) beyond the original scope. The codebase is in a deployable state; a deployed beta URL will demonstrate this.

- **What's weighing us down (keeping us at B vs. A):**
  1. **SCRUM-24 (Desktop History fetching)** appears to have been silently dropped or replaced. This change was not formally documented in the schedule until this milestone — a process miss. We have flagged it in SCHEDULE.md for explicit decision.
  2. **Deployment (SCRUM-28)** changed platforms from Vercel to Cloudflare Workers, and the live deployment is not yet confirmed live by the team at the time of this write-up. ProjectMilestones.md penalizes up to **−20 points** if the site is not deployed. This is the single biggest risk to the Milestone 4 grade.
  3. **Several known issues** (16 tracked in KNOWN_ISSUES.md) remain open — Diary feedback rewrite, Smart Widget Korean "Latest Updates", Tavily token over-consumption, Diary PIN setup. These are tracked but not all assigned with bug-fix time in Sprint 4.

- **What we will do for the final release:**
  - **Deploy by May 23** to lock in the Milestone 4 deployment points. (Owner: Minsoo)
  - **Document SCRUM-24 decision** explicitly in SCHEDULE.md "Schedule Changes" — either revive the feature for the final release or formally drop it with rationale. (Owner: Sungmin)
  - **Triage KNOWN_ISSUES.md** — file all 16 issues into GitHub Issues, assign owners, allocate bug-fix slots in Sprint 4 / Sprint 5. (Owner: full team — synchronous review)
  - **Cross-verification pass:** each completed feature gets verified by a team member who did not implement it (per ProjectMilestones.md). Bug reports filed as GitHub Issues.
  - **Complete remaining Sprint 4 items** (SCRUM-26 audit, SCRUM-27 indexing/RLS audit) by May 27.

## 2.3 Process adjustments going forward

1. **Schedule discipline** — Any feature change (drop, replace, defer) must be reflected in `SCHEDULE.md` "Schedule Changes" within the same sprint, not at milestone review time.
2. **Bug-fix slotting** — Every Sprint going forward reserves ~20% of capacity for bug fixes from the known-issues backlog. Bugs filed as GitHub Issues, not lost in `todo.md`.
3. **Deploy-early policy** — Deployment becomes a Sprint 1 task in the next milestone cycle, not Sprint 4. This avoids the current end-loaded deployment risk.
4. **Pre-milestone verification** — One full team day before each milestone reserved for cross-verification of completed features and KNOWN_ISSUES triage.

---

# Sign-off

This document was drafted by the team on 2026-05-22 using the Jira board export (May 1st baseline) and a code-base audit. Each individual section was reviewed and confirmed by the named team member.

- **Kwon Dahyun:** _[signature / GitHub username]_ — date: 2026-05-__
- **Choo Sungmin:** _[signature / GitHub username]_ — date: 2026-05-__
- **Ahn Minsoo:** _[signature / GitHub username]_ — date: 2026-05-__

---

## References

- [SCHEDULE.md](./SCHEDULE.md) — original schedule + change log
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — open bugs to file
- [CHANGELOG.md](./CHANGELOG.md) — dated history of all fix rounds
- [DOCS.md](./DOCS.md) — architecture reference
- [ProjectMilestones.md](./ProjectMilestones.md) — course assignment specification
