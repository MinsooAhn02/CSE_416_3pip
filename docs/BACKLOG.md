# Backlog

Single list of open work. Replaces the old root `todo.md`, `tasks/todo.md` (stocks) and the open items of
`archive/course/Milestone/KNOWN_ISSUES.md`. Status verified against code on 2026-10-04; file:line refs may drift.

## Needs a manual (infra) step

| Item | What's left |
|---|---|
| Stocks indices via Yahoo | Code done (`supabase/functions/stocks/index.ts`: `YAHOO_SYMBOL_MAP`, `fetchYahooQuote`; TwelveData kept for USD/KRW only). Deploy: `npx supabase functions deploy stocks`, then force-refresh the Stocks widget and check SP500/KOSPI/NASDAQ levels. |
| `briefing_snapshots` table | Run `supabase/migrations/add_briefing_snapshots.sql` in the SQL editor. Until then snapshot sync to Supabase silently no-ops (localStorage still works). |
| `smart-widget` Edge Function | Source removed from the repo (no frontend caller). If still deployed, delete it: `npx supabase functions delete smart-widget`. |

## Bugs / risks found during the 2026-10-04 review

| # | Issue | Where |
|---|---|---|
| R1 | Every page reload clears `mb_last_access_time` and calls `fetchAll({useExistingCache:false})`, bypassing the 6h cache → Tavily/Groq calls on every reload. | `src/App.tsx` (runFullInit) |
| R2 | Google reconnect is fragile: `providerRefreshToken` lives in memory only (lost on reload); login uses `prompt:"select_account"` so Google may not return a refresh token; `google-refresh` needs `GOOGLE_CLIENT_ID/SECRET` secrets and has no JWT check. | `src/store/useAuthStore.ts`, `supabase/functions/google-refresh` |
| R3 | Resize handler closes over stale `panelOpen` (`[]` deps): below 1200px every resize closes the panel; widening never reopens. | `src/components/layout/DashboardLayout.tsx` (resize effect) |
| R4 | Smart widget component is recreated each render → loses local state (edit mode, open menu). | `DashboardLayout.tsx` (smart widget render) |
| R5 | `ExtensionInstallBanner` has `EXTENSION_ID = null` and a placeholder store URL, so extension detection never runs. | `src/components/banners/ExtensionInstallBanner.tsx` |
| R6 | `todos` table is created in `schema.sql` but never queried (todos mirror Google Tasks + localStorage). Drop or use. | `supabase/schema.sql` |
| R7 | Migration files have no timestamp prefix, so `supabase db push/reset` ignores them; they are applied by hand (order in AGENTS.md). | `supabase/migrations/` |
| R8 | `npm audit` reports 15 vulnerabilities (1 critical) in dependencies — not triaged. | `package-lock.json` |

## Partially done (from old todo.md)

| # | Item | State |
|---|---|---|
| 1 | Top news and trends show the same items | News URLs are de-duplicated from trends only when trends derive from news; falls back to the full (duplicated) list if < 3 remain. Briefing logic unchanged. `useDataStore.ts` (trends dedup) |
| 2 | Smart widget category display mismatch | Menu uses `categoryOverride ?? data.category`, but the button still shows stale `data.emoji`. `SmartWidgetContent.tsx` |
| 9 | Event form needs scrolling | Wider/taller now, still `overflow-y-auto`. `EventPanel.tsx` |
| 13 | Is smart-widget category feature useful? | Design decision pending; feature kept. |
| 17 | Tavily efficiency | Batch endpoint exists but still one Tavily call per query; each smart widget searches separately. `supabase/functions/tavily/index.ts`, `aiService.ts` |
| 18 | Google reconnect | Retry-on-401/403 + `google-refresh` added; not confirmed working — see R2. |

Done and verified in code: old todo #3–8, #10–12, #14–16.

## Open known issues (from KNOWN_ISSUES.md / GitHub issues)

| GH# | Issue | Severity |
|---|---|---|
| #2 | Diary feedback rewrite not applying (`DiaryPanel.tsx` pendingRewrite) | Major |
| #4 | Briefing "Today's latest info" shows generic definitions instead of personalized search | Major |
| #5 | Briefing "Smart keywords: No keyword info collected yet" — unclear when it populates | Minor |
| #6 | Google integration toggle — moved to Profile tab, behavior not verified | Minor |
| #7 | Verify smart widget keywords reach personalization context | Minor |
| #9 | Google Fit live sync — Edge Function exists, live token path missing | Major |
| #10 | `voiceOn` setting has no UI / TTS | Minor |
| #12 | Trends widget has no detail view / pagination | Minor |
| #13 | Diary PIN setup flow — modify in settings / self-verification question | Major |

GitHub issue numbers refer to https://github.com/MinsooAhn-SBU/CSE_416_3pip/issues (closed: #1, #3, #8, #11 NewsDetailModal — file removed 2026-10-04, #14, #15).
