# CHANGELOG

> Newest first. Architecture: [DOCS.md](./DOCS.md) · open work: [docs/BACKLOG.md](./docs/BACKLOG.md).
> Course-period entries (2026-05, Fix 1–26 and Milestone docs) are archived in [archive/course/CHANGELOG-2026-05.md](./archive/course/CHANGELOG-2026-05.md).

---

## 2026-10-05

### [Fix] Stay under the Groq rate limit (BACKLOG R12, A3)
- Briefings are cached for 60 minutes per input (date, time of day, language, tone, weather, events, news/trend titles, yesterday's diary) and concurrent requests share one run, so reloads and the first-login modal + widget no longer regenerate it. The briefing refresh button bypasses the cache. Briefings where the Groq summary failed are not cached.
- The daily question is kept per date and language, so a reload doesn't ask Groq again; answering still moves to the next question. A failed Groq call no longer triggers a second attempt.
- Fixed a load race that made news and today's events change on every reload: the "tab became visible" handler fired on page load and started `fetchAll` before interests and calendar permissions were loaded, and the initial load joined that run. Visibility/poll refreshes now wait for the initial load, and the initial load waits for user settings.
- Interest changes reuse the 6h news cache for the new interests instead of forcing Tavily.
- Measured: after one warm-up reload, reloads make 0 Groq and 0 Tavily calls; an article-summary call used 321 tokens (20 reasoning).
- `groq` Edge Function: `reasoning_effort: "low"` (gpt-oss reasoning tokens count toward the per-minute limit), returns `429` + `Retry-After` instead of `400` when rate-limited, and includes `usage` in the response.

## 2026-10-04

### [Fix] Tell the user when Google needs reconnecting
- When the Google access token (1h) can no longer be refreshed, calendar/tasks/health used to fall back to the local cache with no sign. A banner now says the data may be out of date and offers "Reconnect Google" (dismissible). Not shown in guest mode.

### [Fix] Fewer API calls on reload, small UX fixes
- Reloading no longer bypasses the 6h cache: a forced refetch happens only right after Google sign-in. A reload now makes ~4 Groq calls instead of ~20 Edge Function calls (Tavily, weather, stocks, calendar, fitness).
- `fetchAll` calls that overlap (init, 5-minute poll, tab focus) share one run; news is refetched only when the set of top interests changes, not their order.
- Settings that fail to sync to the account show an error toast instead of failing silently.
- Dates use local time everywhere (UTC made "today" yesterday before 09:00 KST in diary/settings/personalization).
- Side panel auto-closes/opens only when the window crosses 1200px, so a panel opened on a narrow screen stays open.
- "Install Chrome Extension" banner is hidden until the extension is published (it linked to a placeholder URL).

### [Feature] Guest mode ("Explore without signing in")
- Login screen button opens the dashboard with sample data (weather, stocks, news, trends, calendar, tasks, health, diary, a Formula 1 smart widget) and a banner linking to Google sign-in. For portfolio/recruiter visits.
- Zero network: `src/lib/guest.ts` flag short-circuits the three Edge Function helpers and the data fetchers; sample data (`src/demo/demoData.ts`, lazy chunk) is injected with `setState` only, and briefing snapshots / todo cache / daily-reset stamp are not written, so nothing leaks into a real user's localStorage. Reload returns to the login screen.
- Login-screen notice no longer says the app is in Google "Testing" mode (it is in Production, unverified).

### [Fix] Audit fixes: diaries, Edge Function auth, duplicate AI calls, bundle
- Diaries now actually save to Supabase: the live table lacked `ai_generated_diary`/`edited_diary` (every write failed silently). Columns added, 38 legacy `diary_text` rows backfilled, hydrate and personalization read the new columns, diary writes throw on DB errors.
- All Edge Functions require a logged-in user (`supabase/functions/_shared/auth.ts`); groq/tavily/stocks/weather got input caps. Clients send the session JWT (`invokeFunction`, google-refresh).
- Groq: renewed key; `llama-3.3-70b-versatile` was retired → default model `openai/gpt-oss-120b`.
- Fewer Groq calls: first-login modal generates once after data load (was once per data arrival); user settings/personalization load once per user instead of on every auth event; a settings load error no longer resets the user to onboarding.
- Main bundle 1,326 KB → 822 KB (three.js lazy-loaded for the login background); ~1,100 lines of dead code removed; `noUnusedLocals` enabled.
- Weather widget shows the "city not found" error (it was set but never rendered).
- Created `briefing_snapshots` table on the live DB.

### [Fix] Briefing and Stocks widget
- AI Briefing card generated as soon as any one data source arrived and never regenerated, so weather/news/trends stayed "No data". It now waits for the first `fetchAll` to finish (`useDataStore.initialFetchDone`).
- Stocks widget no longer lists KOSPI/S&P 500 twice (default user symbols overlapped the fixed index slots).

### [Build] Clean-clone setup fixes
- `index.html` loads `/src/main.tsx` (pointed at the deleted `main.jsx`; only worked through Vite's extension fallback).
- `public/manifest.json` icons point at `images/MorningBriefing.AI_logo.png` (`icons/*.png` never existed → Chrome refused to load the unpacked extension).
- `build:extension`: added `archiver` devDependency, ported `scripts/zip-extension.js` to the archiver v8 API, and made it fail with the real error (previously every error was reported as "archiver missing") and when `dist/manifest.json` is absent (previously produced an empty zip and exited 0).
- `package-lock.json` is now committed; `.gitignore` no longer ignores `claude.md` (case-insensitive match would hide `CLAUDE.md` on Windows).
- Added `.env.example` and `supabase/migrations/add_briefing_snapshots.sql` (the table was used by `useBriefingHistoryStore` but never defined).

### [Chore] Repo cleanup
- Removed unused `NewsDetailModal.tsx`, `src/l10n/index.ts`, empty `src/mock/`, the `smart-widget` Edge Function (no frontend caller) and the unused `playwright` dependency.
- Untracked `dist/` and `supabase/.temp/` (already gitignored).
- Moved course deliverables to `archive/course/` (`Documents/`, `Milestone/`, `final.md`, final report PDF, old notes, DOCS §16–17).
- Merged `todo.md`, `tasks/todo.md` and open KNOWN_ISSUES into `docs/BACKLOG.md`.

### [Docs] Agent-ready docs
- Added `AGENTS.md` (commands, layout, architecture, conventions, pitfalls); `CLAUDE.md` imports it.
- `README.md`: repo URL → `MinsooAhn-SBU`, dev port 3000, `npx supabase` deploy list (dropped smart-widget, added google-refresh), full secrets list, migration order incl. `add_briefing_snapshots.sql`, fixed documentation table.
- `DOCS.md`: corrected init flow (`useExistingCache:false`, 6h TTL, 3h briefing interval), the five Edge Function call paths, `errorHandler` API, RLS policy table, `todos` unused, env/secrets/OAuth scopes, `provider_token` storage.

---
