# Project Schedule — MorningBriefing.AI

> **Last updated:** 2026-05-29
> **Live source of truth:** [Jira Scrum Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9)
> **Baseline:** Original plan finalized 2026-05-01 (Jira CSV export). Current status reflects implementation verified against the codebase as of 2026-05-29 — Sprint 4 has closed; project is in final-release polish.

## Executive Summary

| Phase | Period | Planned | Completed | In Progress | Modified |
|-------|--------|---------|-----------|-------------|----------|
| Sprint 1 — Foundation | May 6–11 | 3 | **3 ✅** | 0 | 0 |
| Sprint 2 — Integration | May 12–13 | 3 | **3 ✅** | 0 | 0 |
| Sprint 3 — Feature Completion | May 14–20 | 3 | **2 ✅** | 0 | **1 🔄** |
| Sprint 4 — Final Polish & Release | May 21–27 | 3 | **3 ✅** | 0 | 0 |
| **Total** | **May 6–27** | **12** | **11 ✅ (92%)** | **0 🟡 (0%)** | **1 🔄 (8%)** |

> **Bottom line:** Sprints 1–4 fully delivered. Sprint 4 closed on 2026-05-27 with all UI/UX audit, RLS audit/indexing, and deployment-monitoring polish items complete. One originally scheduled task (SCRUM-24 Desktop History) was replaced with a functionally equivalent alternative — see Schedule Changes section. Project is now in **final-release polish** (cross-verification + v1.0 tag).

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

## Sprint 4 — Final Polish & Release (May 21 – May 27, 2026) ✅ Completed

| Key | Owner | Task | Status | Completion Evidence |
|-----|-------|------|--------|---------------------|
| SCRUM-26 | Dahyun Kwon | Final UI/UX audit and resolution of front-end design inconsistencies | ✅ Completed | Full Sprint-4 audit landed: panel font-size unification across Diary/Event/Task (`5fc08b9`), DiaryList PIN prompt gating fix (`5fc08b9`), Rewrite-button UX (below textarea, disabled-when-empty) (`bbda5f2`), removal of redundant rewrite confirm dialog (`5fc08b9`), permission UI refresh to blue (`068d618` / `91a6b4a`), news image fallback (`Newspaper` icon placeholder) (`020e802`), Calendar Today button visibility from year/decade header view (`020e802`), Smart Widget category override button (`020e802`), login-timestamp reset on re-login (`020e802`). Earlier-sprint items (Smart Widget section title, fashion search tuning, Korean hardcoding cleanup) also included. |
| SCRUM-27 | Sungmin Choo | Database indexing for performance; finalize secure data isolation (RLS) audits | ✅ Completed | RLS audit re-verified — all user-scoped tables (`user_settings`, `widget_layouts`, `todos`, `smart_keywords`, `diaries`, `user_qa`, `briefing_snapshots`, `keyword_score_log`, `api_cache`) enforce `auth.uid() = user_id` (or `= id`) with SELECT/INSERT/UPDATE/DELETE policies. Existing indexes on `keyword_score_log(user_id, logged_date)` + `user_qa(user_id, asked_date)` confirmed sufficient under load testing; no additional indexes required. `perms.cal` / `perms.fit` enforcement added to all data fetches (`a591f89`). |
| SCRUM-28 | Minsoo Ahn | ~~Execute Vercel deployment~~ → **Execute Cloudflare Workers deployment**; set up monitoring for API usage and maintenance | ✅ Completed | **Cloudflare Workers deployment live** (`wrangler.jsonc` configured; build + deploy pipeline working — commits `934df36` + `9bf683a`). Live URL: `https://morningbriefing.dksalstn0621.workers.dev`. Monitoring closed out: Supabase Dashboard logs + Cloudflare Analytics in active use; dedicated unified alerting dashboard formally deferred to post-v1.0 polish (acknowledged as scope-bounded). |

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
| Diary | Diary auto-generation for missed days (lazy synthesis from briefing snapshots) | `useMidnightTrigger`, `diaryGenerationService.ts` |
| Diary | Like/Dislike + Rewrite feedback loop with `pendingRewrite` preview and confirmation | DiaryPanel + `useDiaryStore.applyFeedbackRewrite/confirmRewrite` |
| Smart Widget | 17-category content taxonomy with per-category section planning | `aiService.ts` + `SmartWidgetContent.tsx` |
| i18n | Tavily Korean post-processing pipeline (`translateArticlesToKorean`, `buildLocalizedTrendTitles`) + `api_cache` translation backfill | `useDataStore.ts` |
| Stocks | 8 fixed indices (SP500/KOSPI/NASDAQ/USDKRW/VIX/CRUDE/DXY/DJI) + user-added tickers split into widget (2+4) and modal (8+N) sections. Strict ticker validation, auto-detect index/stock/currency via Edge Function `type`/`currency` metadata, optimistic confirm-dialog dismiss. | `supabase/functions/stocks/index.ts`, `StocksWidget.tsx` |
| Briefing | Single-batch Groq summarization (`summarizeArticlesBatch`) for up to 6 articles per briefing | `aiService.ts` |
| Calendar | 3-level header drill-down (month → year → decade) + blue-dot diary day indicators | `CalendarWidget.tsx` |
| **TypeScript migration** | Full codebase converted from `.js` / `.jsx` to `.ts` / `.tsx` (77 files); `tsconfig.json` with `strict:false`; `tsc --noEmit` passes; `npm run build` succeeds | commit `365b392` (2026-05-24) |
| **Error handling** | Centralized `errorHandler.ts` (`ApiError`, `handleApiError(err, context)` with `userVisible` toggle, 25s AbortError → toast); applied across `useDataStore.ts`, `aiService.ts`, `diaryGenerationService.ts` | commit `7bb92c0` (2026-05-24) |
| **Performance** | Bundle size **-27.9 %** (1,025.94 kB → 739.50 kB); `React.memo` on all 9 widgets; `useShallow` on Weather/Health/Trends/News/Stocks (data-field N subscriptions → 1 shallow subscription); `React.lazy` + `Suspense` on widgets and modals; `fetchAll` dedup via `initPhaseRef` gate | `tasks/todo.md` Goal 3 |
| **Tavily cost reduction** | DB `api_cache` TTL extended 4 h → 6 h; improved `latest_smart` block with hyperlinks; news/trends headlines extracted into diary prompt | commit `86a34a8` (2026-05-23) — closes [KNOWN_ISSUES.md #3](./KNOWN_ISSUES.md) |
| **Briefing timezone fix** | `fetchTomorrowCalendar` / `fetchCalendar` switched from UTC `date` param to local `timeMin/timeMax` ISO strings — "Tomorrow" section now populates correctly for non-UTC users | commit `5c7b7a6` (2026-05-24) — closes [KNOWN_ISSUES.md #15b](./KNOWN_ISSUES.md) |
| **Architecture docs** | New `ARCHITECTURE.md` (30-minute onboarding overview with mermaid auth-flow, onboarding flow, store dependency map, fetch pipeline) + `docs/security/localStorage-audit.md` | commit `86d7847` (2026-05-24) |
| **Onboarding store extraction** | `useOnboardingStore.ts` split from `useAuthStore` / `useSettingsStore` — clearer ownership of onboarding wizard state | commit `5f192e9` (2026-05-24) |
| Documentation | Full developer reference suite: DOCS.md (EN), DOCS_kor.md (KO), ARCHITECTURE.md, API.md (25 endpoints), CHANGELOG.md (27 fix rounds), KNOWN_ISSUES.md, ISSUE_TEMPLATEs | `/`, `/.github/ISSUE_TEMPLATE/` |
| Quality | 27 dated fix rounds covering briefing, diary, calendar event modal, Tavily, stocks ticker, i18n, recent Sprint-4 polish | [CHANGELOG.md](../CHANGELOG.md) |

---

## Next Steps for Final Release (post-Sprint-4, as of 2026-05-29)

Sprint 4 is closed. The remaining items for the v1.0 final release are:

1. **Cross-verification pass** — each completed feature verified by a team member who did not implement it (per [ProjectMilestones.md](./ProjectMilestones.md)). Use `Milestone/todo_test.md` as the checklist; any bugs found get filed as GitHub Issues.
2. **KNOWN_ISSUES.md triage continuation** — 10 issues remain open (#1, #2, #4–#10, #12–#14) plus 2 deployment items (#15 stocks, #16 groq). Resolved on 2026-05-29 doc sync: #3 (Tavily cost) and #15b (timezone) closed retroactively with 9 new tracking issues filed for transparency.
3. **Edge Function manual deploys** — `stocks` and `groq` index.ts uploads via Supabase Dashboard (KNOWN_ISSUES #15, #16).
4. **Final release tag** — tag `v1.0` on GitHub once cross-verification is clean.

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
