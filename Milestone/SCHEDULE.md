# Project Schedule — MorningBriefing.AI

> **Last updated:** 2026-05-22
> **Live source of truth:** [Jira Scrum Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9)
> **Baseline:** This file was generated from the Jira CSV export dated 2026-05-22 (original plan finalized on May 1st, 2026). The "Status" column reflects the **planned** state; current actual status will be filled in when the updated Jira board is exported.

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🟡 | In progress |
| 🔄 | Modified from original plan (see "Schedule Changes" below) |
| ⚪ | Not started / unknown (placeholder — to be updated) |

---

## Sprint 1 — Foundation (May 6 – May 11, 2026)

| Key | Owner | Task | Original Status (May 1) | Current Status |
|-----|-------|------|--------------------------|----------------|
| SCRUM-16 | Dahyun Kwon | Design detailed wireframes for Persona settings and Diary Cards | To Do | ⚪ _to be updated_ |
| SCRUM-17 | Sungmin Choo | Optimize PostgreSQL schema for activity logging; set up RLS policies | To Do | ⚪ _to be updated_ |
| SCRUM-18 | Minsoo Ahn | Implement Smart Widgets & Briefing sync | To Do | ⚪ _to be updated_ |

---

## Sprint 2 — Integration (May 12 – May 13, 2026)

| Key | Owner | Task | Original Status (May 1) | Current Status |
|-----|-------|------|--------------------------|----------------|
| SCRUM-20 | Dahyun Kwon | Implement i18n logic for full Korean/English compatibility across the web | To Do | ⚪ _to be updated_ |
| SCRUM-21 | Sungmin Choo | Develop integration logic to reflect Diary Card responses into the main Diary | To Do | ⚪ _to be updated_ |
| SCRUM-22 | Minsoo Ahn | Integrate 30-day Keyword Decay formula; ensure API stability and caching | To Do | ⚪ _to be updated_ |

---

## Sprint 3 — Feature Completion (May 14 – May 20, 2026)

| Key | Owner | Task | Original Status (May 1) | Current Status |
|-----|-------|------|--------------------------|----------------|
| SCRUM-23 | Dahyun Kwon | Implement modal portals for detail views and Persona feedback UI | To Do | ⚪ _to be updated_ |
| SCRUM-24 | Sungmin Choo | Integrate an API for Desktop History fetching and data parsing | To Do | ⚪ _to be updated_ |
| SCRUM-25 | Minsoo Ahn | Bridge Persona settings with Groq API; implement API error/timeout handling | To Do | ⚪ _to be updated_ |

---

## Sprint 4 — Final Polish & Release (May 21 – May 27, 2026)

| Key | Owner | Task | Original Status (May 1) | Current Status |
|-----|-------|------|--------------------------|----------------|
| SCRUM-26 | Dahyun Kwon | Final UI/UX audit and resolution of front-end design inconsistencies | To Do | ⚪ _to be updated_ |
| SCRUM-27 | Sungmin Choo | Database indexing for performance; finalize secure data isolation (RLS) audits | To Do | ⚪ _to be updated_ |
| SCRUM-28 | Minsoo Ahn | Execute Vercel deployment; set up monitoring for API usage and maintenance | To Do | 🔄 **Modified** — see Schedule Changes |

---

## Schedule Changes (modifications from original design document)

ProjectMilestones.md requires modifications to be clearly noted and described. The following changes have been made since the original May 1st schedule:

### 🔄 SCRUM-28: Deployment platform — Vercel → Cloudflare Workers

- **Original plan:** Deploy via Vercel.
- **Actual implementation:** Deploy via **Cloudflare Workers** using `wrangler.jsonc` at the repo root.
- **Reason:** _(to be filled in by team — common reasons include: better SPA routing with `not_found_handling: "single-page-application"`, lower cost, fewer cold-start latency issues, or integration with existing Cloudflare DNS.)_
- **Impact:** Deployment commands changed from `vercel deploy` to `npm run build && npx wrangler deploy`. README.md and DOCS.md §14.4 reflect the new flow. No user-facing functionality change.

### _(Add additional changes here as the team identifies them)_

Examples of changes that may need to be documented (to be confirmed when the updated board is exported):

- [ ] Was "Desktop History fetching" (SCRUM-24) actually implemented? If dropped or replaced, document the alternative.
- [ ] Any features added beyond the original 11 epics (e.g., Smart Widget category system, diary feedback rewrite flow, briefing snapshots)?
- [ ] Any features deferred to a future release (e.g., Voice TTS, trends pagination, PIN setup flow)?

---

## Next Steps

When the updated Jira board is available:

1. Replace each `⚪ _to be updated_` cell with the appropriate status emoji (✅ / 🟡 / 🔄 / ⚪)
2. Add any new tasks that were created after May 1st to the appropriate sprint section
3. Expand the "Schedule Changes" section with full details on each modification
4. Update the "Last updated" date at the top of this file

The Jira board remains the live source of truth; this file is a milestone snapshot for grading and historical reference.

---

## Related Documents

- [README.md](./README.md) — Setup and bug reporting
- [DOCS.md](./DOCS.md) — Architecture reference (English)
- [DOCS_kor.md](./DOCS_kor.md) — Korean architecture reference
- [CHANGELOG.md](./CHANGELOG.md) — Dated change log
- [ProjectMilestones.md](./ProjectMilestones.md) — Course assignment specification
