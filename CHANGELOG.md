# CHANGELOG

> Newest first. Architecture: [DOCS.md](./DOCS.md) · open work: [docs/BACKLOG.md](./docs/BACKLOG.md).
> Course-period entries (2026-05, Fix 1–26 and Milestone docs) are archived in [archive/course/CHANGELOG-2026-05.md](./archive/course/CHANGELOG-2026-05.md).

---

## 2026-10-05

### [Fix] Smart widget relevance, health widget empty state
- Smart widgets: an article appears in only one section (the first in display order); "Key info" drops Wikipedia pages for a different sense of the keyword ("Games (film)", "WarGames" for "Games").
- Health: when Google Fit has no records for today (everything 0), the widget says so instead of showing a 0/10,000 dashboard.
### [Fix] Fewer calls on page load, single Edge Function client, DB cleanup (BACKLOG B3, R6, R7, A9)
- Google Tasks/Calendar: concurrent fetches share one request, so a page load calls `tasks` 2× and `events` 1× (was 6× and 2× in dev).
- AI briefing: a briefing whose Groq summary failed is cached for 5 minutes, so reloads during a rate limit don't call Groq again; the weather temperature is no longer part of the cache key (it changed on every weather refresh). A normal reload makes 0 Groq calls.
- All Edge Function calls go through `callEdge` in `src/lib/edge.ts`; the five helpers are thin wrappers with unchanged behavior. `google-refresh` and keyword extraction now time out (25 s) and make no network call in guest mode. `pad2` has one definition.
- Migrations are timestamped (`supabase/schema.sql` → `20260501000000_base_schema.sql`) and recorded on the linked project, so setup is `supabase link` + `supabase db push`.
- Dropped the unused `todos` table (rows backed up locally); removed anon grants from the SQL files.
### [Fix] Widget state, weather flash, news/trends duplicates, event form, dependency updates (BACKLOG R4, R8, A9)
- Smart widgets keep their local state (open category menu, keyword edit) when the dashboard re-renders; they used to remount.
- The weather widget shows "Loading" instead of "No weather data available" until the first load finishes.
- Live Trends no longer repeats the News widget: the trend list is no longer built from the news results, and trend articles already shown in News are dropped (kept if fewer than 3 would remain).
- The smart widget's category button shows the chosen category's emoji after a manual category change.
- The event form uses two columns on wide screens, so it fits without scrolling (583 px tall at 1366×768).
- News fetches Korea/US + world headlines in one batched `tavily` call instead of two.
- Summaries that are a site's `+`-separated section menu (CNN) are dropped.
- The packaged extension zip no longer allows `http://localhost:3000` in `externally_connectable` (`dist/` keeps it for local development).
- `npm audit fix` (non-breaking): vite 6.4.3, tar, ws, postcss, nanoid, browserslist, @babel/core. 5 high remain, all via Tailwind 3's build-time glob (`braces`); fixing needs Tailwind 4.
- New migration `revoke_anon_grants.sql` revokes anon table privileges (applied 2026-10-05).
### [Fix] Google sync after 1 hour, per-account data, guest leaks, news quality (BACKLOG R2, A8, R10, R11, R13)
- Google refresh tokens are now kept server-side (new `google_tokens` table, AES-GCM encrypted, Edge Functions only) and `google-refresh` renews the 1-hour access token from them. Needs the secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`; existing users reconnect once. "Reconnect Google" now asks for consent so Google issues a refresh token. Expired session tokens (>~55 min after sign-in) are no longer reused.
- The reconnect banner only appears for users with calendar/health permission.
- Logging out, or a different account signing in on the same browser, clears that account's local data (diary, PIN, briefing cache/history, daily question, task/calendar caches, API caches) and reloads.
- Guest mode no longer writes anything to localStorage (sample data used to leak through diary/widget/task saves).
- News, trends and smart widgets drop section/listing pages ("Opinion - Economy - The New York Times") and Wikipedia meta pages, and blank summaries that are site menu text.
- Health: "today" starts at the user's local midnight (the server used UTC midnight, missing records before 09:00 KST).
- Fewer auth round-trips: the app reads the user from the local session instead of calling `/auth/v1/user` (21 call sites), and no longer calls `refreshSession()` while looking for a Google token — both took the cross-tab auth lock (multi-tab "lock stolen" errors).
- Init: the no-user fallback load runs only without Supabase; waiting for user settings is capped at 8 s.
- Stocks: an invalid symbol is skipped instead of failing the whole request. Groq completion cap raised to 8192.

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
