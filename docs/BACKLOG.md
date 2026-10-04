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
| `smart-widget` Edge Function | Source removed from the repo (no caller). If still deployed: `npx supabase functions delete smart-widget`. |
| Deploy after changes | Web: `npm run build && npx wrangler deploy`. Extension: `npm run build:extension` and redistribute the zip (not on the Web Store, no auto-update). |

## Other open issues / tech debt

| # | Issue | Where |
|---|---|---|
| R8 | `npm audit`: 5 high left, all `braces` (stack overflow on deeply nested glob patterns) via Tailwind 3's content scanner. Not exploitable here: the patterns come from our own `tailwind.config`, and it runs only at build/dev time, never in the shipped bundle. Decision 2026-10-05: no Tailwind 4 migration for this; revisit if Tailwind 3 stops getting fixes. | `package-lock.json` |
| B4 | 4.8 MB of course PDFs/xlsx tracked under `archive/course/` — keep or untrack (history keeps them either way). | `archive/course/` |
| R13 | Health widget shows zeros for this account: Google Fit returns 200 with no data points (likely no Fit data on the account / Fit being phased out). The UTC "today" bug is fixed. | `supabase/functions/fitness` |

### GitHub issues

https://github.com/MinsooAhn02/CSE_416_3pip/issues — all bug/feature issues (#1–#15, #17–#32) are closed; only #16 (Jira migration notice) is open.

## Decisions

- **Google OAuth verification: not pursued.** The consent screen is Production / unverified (project
  CalendarTaskAPI, 11 of 100 users). Every user sees the "unverified app" warning once; removing it needs an owned
  domain, a Supabase custom auth domain and a security review. Guest mode covers portfolio visitors.
- **Smart-widget categories:** feature kept; usefulness not re-evaluated.
