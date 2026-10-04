# Backlog

Single list of open work, verified against the code on 2026-10-04 (file refs may drift).
Finished work is not kept here — see [CHANGELOG.md](../CHANGELOG.md) and `git log`.
IDs (R*, A*, B*) come from the 2026-10-04 reviews and are referenced from commits and docs.

## Next up (suggested order)

| # | Issue | Approach | Where |
|---|---|---|---|
| R2 | Server-side Google token refresh is **active** (secrets set 2026-10-05; verified: encrypted row stored, refresh returns a new access token, calendar call succeeds with it). Remaining: each existing user clicks "Reconnect Google" once; deploy the web app so users get the new client; observe a real >1h session. | — | `supabase/functions/google-refresh`, `useAuthStore.ts` |

## Needs a manual (infra) step

| Item | What's left |
|---|---|
| A9 anon grants | anon holds all privileges on 9 public tables (RLS blocks rows today). Run `supabase/migrations/revoke_anon_grants.sql`, then drop the `grant select ... to anon` lines from `schema.sql`, `add_user_qa.sql`, `add_personalization.sql`. (The extension zip already drops localhost.) |
| R6 `todos` table | Created in `schema.sql`, never queried (todos mirror Google Tasks + localStorage), but holds 14 old rows (2026-10-05). Decide whether to export, then drop. |
| `smart-widget` Edge Function | Source removed from the repo (no caller). If still deployed: `npx supabase functions delete smart-widget`. |
| Deploy after changes | Web: `npm run build && npx wrangler deploy`. Extension: `npm run build:extension` and redistribute the zip (not on the Web Store, no auto-update). |

## Other open issues / tech debt

| # | Issue | Where |
|---|---|---|
| R7 | Migration files have no timestamp prefix, so `supabase db push/reset` ignores them; applied by hand (order in DOCS §10). | `supabase/migrations/` |
| R8 | `npm audit`: 5 high left after `npm audit fix` (2026-10-05), all `braces` via Tailwind 3 (build-time only). Clearing them needs Tailwind 4 (breaking). | `package-lock.json` |
| B3 | Five Edge Function call helpers (DOCS §9) could share one module; `pad2` defined 3×. Low value vs. risk. | `useDataStore.ts`, `aiService.ts`, `useGoogleCalendarStore.ts`, `useAuthStore.ts`, `personalizationService.ts` |
| B4 | 4.8 MB of course PDFs/xlsx tracked under `archive/course/` — keep or untrack (history keeps them either way). | `archive/course/` |
| R13 | Health widget shows zeros for this account: Google Fit returns 200 with no data points (likely no Fit data on the account / Fit being phased out). The UTC "today" bug is fixed. | `supabase/functions/fitness` |
| — | Event form still needs scrolling. | `EventPanel.tsx` |
| — | Tavily: one call per query; each smart widget searches separately. | `supabase/functions/tavily`, `aiService.ts` |

### GitHub issues still open

https://github.com/MinsooAhn-SBU/CSE_416_3pip/issues — #2 diary feedback rewrite not applying (Major) · #4 briefing
"latest info" shows generic definitions (Major) · #5 smart keywords "No keyword info" (Minor) · #6 Google
integration toggle unverified (Minor) · #7 smart keywords → personalization context (Minor) · #9 Google Fit live
sync (Major, see R13) · #10 `voiceOn` has no UI/TTS (Minor) · #12 Trends detail view (Minor) · #13 diary PIN
setup flow (Major). Closed: #1, #3, #8, #11, #14, #15.

## Decisions

- **Google OAuth verification: not pursued.** The consent screen is Production / unverified (project
  CalendarTaskAPI, 11 of 100 users). Every user sees the "unverified app" warning once; removing it needs an owned
  domain, a Supabase custom auth domain and a security review. Guest mode covers portfolio visitors.
- **Smart-widget categories:** feature kept; usefulness not re-evaluated.
