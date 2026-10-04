# Backlog

Single list of open work, verified against the code on 2026-10-04 (file refs may drift).
Finished work is not kept here — see [CHANGELOG.md](../CHANGELOG.md) and `git log`.
IDs (R*, A*, B*) come from the 2026-10-04 reviews and are referenced from commits and docs.

## Next up (suggested order)

| # | Issue | Approach | Where |
|---|---|---|---|
| R2 | Google token refresh is implemented server-side (`google-refresh` + encrypted `google_tokens`), but **inactive until the secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` are set**. After that, each existing user must click "Reconnect Google" once (consent) so Google issues a refresh token to store. | Set secrets (README §5), then verify: wait >1h after sign-in, calendar still syncs. | `supabase/functions/google-refresh`, `useAuthStore.ts` |

## Needs a manual (infra) step

| Item | What's left |
|---|---|
| A9 anon grants | `grant select ... to anon` on 8 tables (RLS blocks rows today). Revoke in the SQL editor and drop the lines from `schema.sql` / migrations. Also remove `http://localhost:3000/*` from the production extension's `externally_connectable`. |
| R6 `todos` table | Created in `schema.sql`, never queried (todos mirror Google Tasks + localStorage). Drop it. |
| `smart-widget` Edge Function | Source removed from the repo (no caller). If still deployed: `npx supabase functions delete smart-widget`. |
| Deploy after changes | Web: `npm run build && npx wrangler deploy`. Extension: `npm run build:extension` and redistribute the zip (not on the Web Store, no auto-update). |

## Other open issues / tech debt

| # | Issue | Where |
|---|---|---|
| R4 | Smart widget component is recreated each render → loses local state (edit mode, open menu). | `DashboardLayout.tsx` |
| R7 | Migration files have no timestamp prefix, so `supabase db push/reset` ignores them; applied by hand (order in DOCS §10). | `supabase/migrations/` |
| R8 | `npm audit`: 15 vulnerabilities (1 critical), not triaged. Start with non-breaking `npm audit fix`. | `package-lock.json` |
| B3 | Five Edge Function call helpers (DOCS §9) could share one module; `pad2` defined 3×. Low value vs. risk. | `useDataStore.ts`, `aiService.ts`, `useGoogleCalendarStore.ts`, `useAuthStore.ts`, `personalizationService.ts` |
| B4 | 4.8 MB of course PDFs/xlsx tracked under `archive/course/` — keep or untrack (history keeps them either way). | `archive/course/` |
| R13 | Health widget shows zeros for this account: Google Fit returns 200 with no data points (likely no Fit data on the account / Fit being phased out). The UTC "today" bug is fixed. | `supabase/functions/fitness` |
| — | Weather widget briefly shows "No weather data available" on reload while the cache loads. | `WeatherWidget.tsx` |
| — | Top news and trends can show the same items (dedup only when trends derive from news). | `useDataStore.ts` (trends dedup) |
| — | Smart widget button shows stale `data.emoji` after a category override. | `SmartWidgetContent.tsx` |
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
