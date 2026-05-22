# Project Schedule — MorningBriefing.AI

> **Last updated:** 2026-05-22
> **Live source of truth:** [Jira Scrum Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9)
> **Baseline:** Original plan finalized 2026-05-01 (Jira CSV export). Current status reflects implementation verified against the codebase as of 2026-05-22.

## Executive Summary

| Phase | Period | Planned | Completed | In Progress | Modified |
|-------|--------|---------|-----------|-------------|----------|
| Sprint 1 — Foundation | May 6–11 | 3 | **3 ✅** | 0 | 0 |
| Sprint 2 — Integration | May 12–13 | 3 | **3 ✅** | 0 | 0 |
| Sprint 3 — Feature Completion | May 14–20 | 3 | **2 ✅** | 0 | **1 🔄** |
| Sprint 4 — Final Polish & Release (current) | May 21–27 | 3 | **1 ✅** | **2 🟡** | 0 |
| **Total** | **May 6–27** | **12** | **9 ✅ (75%)** | **2 🟡 (17%)** | **1 🔄 (8%)** |

> **Bottom line:** Sprints 1–3 fully delivered on schedule. Sprint 4 currently active and on-track for May 27 completion. One originally scheduled task (SCRUM-24 Desktop History) was replaced with a functionally equivalent alternative — see Schedule Changes section.

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🟡 | In progress (current sprint) |
| 🔄 | Modified — original task replaced; see Schedule Changes |

---

## Sprint 1 — Foundation (May 6 – May 11, 2026) ✅ Completed

| Key | Owner | Task | Status | Completion Evidence |
|-----|-------|------|--------|---------------------|
| SCRUM-16 | Dahyun Kwon | Design detailed wireframes for Persona settings and Diary Cards | ✅ Completed | `OnboardingModal.jsx` (welcome → categories → permissions flow) + `DiaryCard.jsx` (PIN-gated Q&A card with personalized question generation) shipped. Persona settings simplified into 8-category interest selection — see Schedule Changes. |
| SCRUM-17 | Sungmin Choo | Optimize PostgreSQL schema for activity logging; set up RLS policies | ✅ Completed | `supabase/schema.sql` + 3 migrations (`add_personalization`, `add_user_qa`, `add_fixed_interests`). RLS policies on all user-scoped tables (38 `CREATE POLICY` statements). Explicit `GRANT` blocks for the 2026-05-30 Supabase auto-grant policy change. |
| SCRUM-18 | Minsoo Ahn | Implement Smart Widgets & Briefing sync | ✅ Completed | `SmartWidgetContent.jsx` with 17-category taxonomy; `BriefingWidget.jsx` `latest_info.latest_smart` sub-block pulls Smart Widget keyword summaries; `useBriefingContext.js` shared 14-field context builder. |

---

## Sprint 2 — Integration (May 12 – May 13, 2026) ✅ Completed

| Key | Owner | Task | Status | Completion Evidence |
|-----|-------|------|--------|---------------------|
| SCRUM-20 | Dahyun Kwon | Implement i18n logic for full Korean/English compatibility across the web | ✅ Completed | `i18next` configured with `ko.json` + `en.json`; language toggle in TopNav; per-language cache keys for news/trends/Smart Widget; final 5 i18n bugs resolved 2026-05-20 (CHANGELOG). 10+ components use `useTranslation`. |
| SCRUM-21 | Sungmin Choo | Develop integration logic to reflect Diary Card responses into the main Diary | ✅ Completed | `user_qa` table + `useDiaryStore.addAnswer()` writes Q&A; `diaryGenerationService.buildDiaryGenerationContext()` pulls Q&A into Groq prompt context; answer save triggers `bumpKeyword()` for keyword learning. |
| SCRUM-22 | Minsoo Ahn | Integrate 30-day Keyword Decay formula; ensure API stability and caching | ✅ Completed | `personalizationService.js` implements keyword extraction (`VALID_CATEGORIES`, `SOURCE_WEIGHTS = {personal:2, diary:1}` matching spec) with 30-day decay `score = Σ(base_weight × (30 - elapsed_days) / 30)`. `api_cache` table with 1-hour TTL covers all Edge Function responses (weather, stocks, tavily, calendar, health). 25s timeout on all Edge Functions with mock fallback. |

---

## Sprint 3 — Feature Completion (May 14 – May 20, 2026) ✅ 2 of 3 Completed (1 Modified)

| Key | Owner | Task | Status | Completion Evidence |
|-----|-------|------|--------|---------------------|
| SCRUM-23 | Dahyun Kwon | Implement modal portals for detail views and feedback UI | ✅ Completed | `createPortal` used in 10 components (`NewsAllModal` in NewsWidget, `StocksWidget` ticker manage modal with DnD, ConfirmDialog, EventPanel, TaskPanel, etc.); DiaryPanel Like/Dislike → Rewrite → ConfirmDialog feedback flow (`applyFeedbackRewrite` / `confirmRewrite` / `discardPendingRewrite`). |
| ~~SCRUM-24~~ | Sungmin Choo | ~~Integrate an API for Desktop History fetching and data parsing~~ → **Replaced with Smart Widget keyword learning + Briefing snapshots** | 🔄 Modified — see Schedule Changes | Replacement delivered: (a) automatic keyword extraction from Q&A and diary text via `personalizationService.extractKeywords()`; (b) 3-hour interval briefing snapshots via `useBriefingHistoryStore` capture user-context history. Together these serve the original goal (passive personalization-data collection) without requiring browser-history permissions. |
| SCRUM-25 | Minsoo Ahn | Bridge Persona settings with Groq API; implement API error/timeout handling | ✅ Completed | `personaContext.buildPersonaContext()` merges `fixedInterestIds` + `keywordInterests` + persona into a single context object; `aiService.js` injects this into Groq prompts (21 reference sites). 25s timeout per Edge Function, mock fallback on failure, `apiStatus="error"` per-widget indicator. Groq `Content-Type: application/json; charset=utf-8` fix for Korean text. |

---

## Sprint 4 — Final Polish & Release (May 21 – May 27, 2026) 🟡 Currently Active

| Key | Owner | Task | Status | Progress to Date (May 22) |
|-----|-------|------|--------|---------------------------|
| SCRUM-26 | Dahyun Kwon | Final UI/UX audit and resolution of front-end design inconsistencies | 🟡 In Progress | Smart Widget section title fix (commit `a288d8f`), Smart Widget fashion search tuning (commit `f0e2649`), Korean hardcoding cleanup (commit `56b8a3f`) all landed in Sprint 4 so far. Remaining: full audit pass + minor polish items. |
| SCRUM-27 | Sungmin Choo | Database indexing for performance; finalize secure data isolation (RLS) audits | 🟡 In Progress | Indexes already in place on `keyword_score_log(user_id, logged_date)` + `user_qa(user_id, asked_date)`. RLS policies on all user-scoped tables already verified. Remaining: final audit checklist + any additional indexes identified during load testing. |
| SCRUM-28 | Minsoo Ahn | ~~Execute Vercel deployment~~ → **Execute Cloudflare Workers deployment**; set up monitoring for API usage and maintenance | ✅ Deployment Done · 🟡 Monitoring polish ongoing | **Cloudflare Workers deployment live** (`wrangler.jsonc` configured; build + deploy pipeline working — commits `934df36` + `9bf683a`). Live URL: `<DEPLOYED_URL>` _(team to provide)_. Monitoring: Supabase Dashboard logs + Cloudflare Analytics in use; dedicated alerting dashboard pending. |

---

## Schedule Changes (modifications from original design document)

ProjectMilestones.md requires modifications to be clearly noted. The following intentional changes have been made since the May 1st baseline:

### 🔄 SCRUM-28: Deployment platform — Vercel → Cloudflare Workers

- **Original plan:** Deploy via Vercel.
- **Implemented:** Deploy via **Cloudflare Workers** using `wrangler.jsonc` at the repo root.
- **Reason:** Cloudflare Workers offers (a) first-class SPA routing through `not_found_handling: "single-page-application"` which correctly handles our OAuth callbacks (`/?code=xxx`) and deep links, (b) lower cold-start latency for our global user base, and (c) tighter integration with the existing Cloudflare DNS used by the team's domain.
- **Outcome:** ✅ Deployment is live; no user-facing functional difference. README.md and DOCS.md §14.4 reflect the new deploy flow.

### 🔄 SCRUM-16 / SCRUM-25: "Persona settings" → 8-category personalization

- **Original plan:** Dedicated Persona selection UI in onboarding/settings, with persona feeding the Groq context.
- **Implemented:** Persona context is fed from the **8 fixed interest categories** the user selects during onboarding (`fixedInterestIds`: news, tech, fashion, finance, health, food, entertainment, sports). The backend (`persona` field, `setPersona()`, `buildPersonaContext()`) is fully wired and ready to receive an explicit persona value if a future UI exposes one; for now the default `'default'` is used and category-based interest signal carries the personalization weight.
- **Reason:** During implementation we found that category selection produces stronger personalization signal than persona selection alone (top-5 interests injected into news query + Groq context). Removing the redundant persona picker simplifies onboarding (3 steps instead of 4) without losing personalization quality. The Smart Widget keyword learning system + Q&A `bumpKeyword()` further refines per-user interests beyond the static persona model.
- **Outcome:** ✅ SCRUM-16 deliverables (wireframes for Persona settings + Diary Cards) shipped as the category-selection onboarding + Diary Card. SCRUM-25 deliverables (Groq persona context + error handling) shipped via `personaContext.js`. Persona-as-selector can be re-enabled in a future release if needed without backend changes.

### 🔄 SCRUM-24: Desktop History fetching → Smart Widget keyword learning + Briefing snapshots

- **Original plan:** Integrate an API for Desktop History fetching to drive personalization.
- **Implemented:** Functionally replaced by two systems:
  1. **Smart Widget keyword learning** — `personalizationService.extractKeywords()` runs at midnight (`useMidnightTrigger → runPersonalizationBatch`), pulling keywords from Q&A answers and diary text, scoring them with the 30-day decay formula, and writing to `user_settings.keyword_interests`.
  2. **Briefing snapshots** — `useBriefingHistoryStore` captures 3-hour-interval briefings (text + sections), used downstream for lazy diary synthesis on missed days.
- **Reason:** Desktop browser-history access requires a Chrome Extension permission (`chrome.history`) that is incompatible with the current SPA architecture deployed on Cloudflare Workers. The hybrid extension build (`npm run build:extension`) would be required, and adoption of that variant has been deferred to v2. The two replacement systems collect comparable personalization signal from in-app activity without requiring sensitive browser-history permissions.
- **Outcome:** ✅ Functional replacement delivered. Original SCRUM-24 task removed from the active sprint table; tracked here for transparency.

---

## Additional accomplishments beyond the original schedule

The team also shipped the following work that was not in the May 1st plan but materially improves the product. These are tracked in [CHANGELOG.md](../CHANGELOG.md):

| Area | Item | Reference |
|------|------|-----------|
| Diary | Diary auto-generation for missed days (lazy synthesis from briefing snapshots) | `useMidnightTrigger`, `diaryGenerationService.js` |
| Diary | Like/Dislike + Rewrite feedback loop with `pendingRewrite` preview and confirmation | DiaryPanel + `useDiaryStore.applyFeedbackRewrite/confirmRewrite` |
| Smart Widget | 17-category content taxonomy with per-category section planning | `aiService.js` + `SmartWidgetContent.jsx` |
| i18n | Tavily Korean post-processing pipeline (`translateArticlesToKorean`, `buildLocalizedTrendTitles`) + `api_cache` translation backfill | `useDataStore.js` |
| Stocks | Universal index ticker support — TwelveData → Stooq → ER-API fallback chain with `^${symbol}` auto-retry | `supabase/functions/stocks/index.ts` |
| Briefing | Single-batch Groq summarization (`summarizeArticlesBatch`) for up to 6 articles per briefing | `aiService.js` |
| Calendar | 3-level header drill-down (month → year → decade) + blue-dot diary day indicators | `CalendarWidget.jsx` |
| Documentation | Full developer reference suite: DOCS.md (EN), DOCS_kor.md (KO), API.md (25 endpoints), CHANGELOG.md (26 fix rounds), KNOWN_ISSUES.md, ISSUE_TEMPLATEs | `/`, `/.github/ISSUE_TEMPLATE/` |
| Quality | 26 dated fix rounds covering briefing, diary, calendar event modal, Tavily, stocks ticker, i18n | [CHANGELOG.md](../CHANGELOG.md) |

---

## Next Steps for Final Release

1. **Complete Sprint 4 by May 27**
   - SCRUM-26: finish UI/UX audit checklist
   - SCRUM-27: final RLS audit pass + any additional indexes
   - SCRUM-28: replace `<DEPLOYED_URL>` placeholder once team confirms the live link
2. **Triage [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** — file all 16 issues into GitHub Issues; assign owners; reserve ~20% Sprint 5 capacity for bug fixes.
3. **Cross-verification pass** — each completed feature verified by a team member who did not implement it (per ProjectMilestones.md); bugs found get filed as GitHub Issues.
4. **Final release tag** — once Sprint 4 closes, tag a v1.0 release on GitHub.

The Jira board remains the live source of truth; this file is the milestone snapshot for grading.

---

## Related Documents

- [README.md](../README.md) — Setup, build, test, and bug reporting
- [DOCS.md](../DOCS.md) — Architecture reference (English)
- [DOCS_kor.md](../DOCS_kor.md) — Korean architecture reference
- [API.md](./API.md) — API design (25 endpoints, matches `MorningBriefingAI_API_Design.xlsx` structure)
- [CHANGELOG.md](../CHANGELOG.md) — Dated change log
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — Open bugs to file
- [MILESTONE4_PROGRESS.md](./MILESTONE4_PROGRESS.md) — Per-team-member progress + self-grade
- [ProjectMilestones.md](./ProjectMilestones.md) — Course assignment specification
