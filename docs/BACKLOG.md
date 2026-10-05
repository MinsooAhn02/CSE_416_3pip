# Backlog

Single list of open work, verified against the code on 2026-10-04 (file refs may drift).
Finished work is not kept here — see [CHANGELOG.md](../CHANGELOG.md) and `git log`.
IDs (R*, A*, B*) come from the 2026-10-04 reviews and are referenced from commits and docs.

## Next up (suggested order)

| # | Issue | Approach | Where |
|---|---|---|---|
| R2 | Server-side Google token refresh is **active** and verified, including a real session >1h (2026-10-05: `google-refresh` renewed the token on load, calendar loaded). Remaining: each existing user clicks "Reconnect Google" once; deploy the web app so users get the new client. | — | `supabase/functions/google-refresh`, `useAuthStore.ts` |

## Needs a manual (infra) step

| Item | What's left |
|---|---|
| Deploy after changes | Web: `npm run build && npx wrangler deploy`. Extension: `npm run build:extension` and redistribute the zip (not on the Web Store, no auto-update). |

## Other open issues / tech debt

| # | Issue | Where |
|---|---|---|
| R8 | `npm audit`: 5 high left, all `braces` (stack overflow on deeply nested glob patterns) via Tailwind 3's content scanner. Not exploitable here: the patterns come from our own `tailwind.config`, and it runs only at build/dev time, never in the shipped bundle. Decision 2026-10-05: no Tailwind 4 migration for this; revisit if Tailwind 3 stops getting fixes. | `package-lock.json` |
| I1 | Login background (`FloatingLines`, three.js) is a 502 kB chunk (128 kB gzip); replace with CSS or skip under `prefers-reduced-motion` / in the extension, then drop `three`. | `src/components/common/FloatingLines.tsx` |
| I2 | Most modals (Settings, diary list, …) don't close on Escape, don't trap focus and lack `role="dialog"`; some icon-only buttons have no accessible name. A shared modal hook would cover them. | `src/components/modals/*` |
| I3 | Whole-store Zustand subscriptions re-render on unrelated changes (EventPanel, TaskPanel, CalendarWidget, DiaryPanel, SettingsModal); TopNav re-renders every second for a minute clock. | those components |
| I4 | Very large files: `aiService.ts` (~3.8k lines), `useDataStore.ts` (~2.3k), `EventPanel.tsx` (~1.8k). Split by domain when next touched. | `src/services`, `src/store` |
| I5 | Diary PIN is a client-side privacy screen (unsalted SHA-256 of 4 digits in localStorage; diary text unencrypted). Real protection would need encrypting diary text with a PIN-derived key. | `useDiaryStore.ts` || B4 | 4.8 MB of course PDFs/xlsx tracked under `archive/course/` — keep or untrack (history keeps them either way). | `archive/course/` |

### GitHub issues

https://github.com/MinsooAhn02/CSE_416_3pip/issues — all bug/feature issues (#1–#15, #17–#32) are closed; only #16 (Jira migration notice) is open.

## Decisions

- **Google OAuth verification: not pursued.** The consent screen is Production / unverified (project
  CalendarTaskAPI, 11 of 100 users). Every user sees the "unverified app" warning once; removing it needs an owned
  domain, a Supabase custom auth domain and a security review. Guest mode covers portfolio visitors.
- **Smart-widget categories:** feature kept; usefulness not re-evaluated.
