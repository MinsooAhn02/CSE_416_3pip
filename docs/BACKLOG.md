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
| A9 leftover | anon privileges revoked on the live DB (2026-10-05, `revoke_anon_grants.sql`, verified 0 grants). The `grant select ... to anon` lines are still in `schema.sql`, `add_user_qa.sql`, `add_personalization.sql` (harmless on a fresh setup because `revoke_anon_grants.sql` runs last); delete them when convenient. |
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
| — | Page load calls the `tasks` Edge Function 6× and `events` 2× (observed 2026-10-05 in dev); likely overlapping task-list/range fetches. Not investigated. | `useGoogleCalendarStore.ts`, `useTodoStore.ts` |

### GitHub issues

https://github.com/MinsooAhn02/CSE_416_3pip/issues — all bug/feature issues (#1–#15, #17–#32) are closed; only #16 (Jira migration notice) is open.

## Decisions

- **Google OAuth verification: not pursued.** The consent screen is Production / unverified (project
  CalendarTaskAPI, 11 of 100 users). Every user sees the "unverified app" warning once; removing it needs an owned
  domain, a Supabase custom auth domain and a security review. Guest mode covers portfolio visitors.
- **Smart-widget categories:** feature kept; usefulness not re-evaluated.
