# AGENTS.md

Working guide for AI coding agents (Codex, Claude Code) and contributors. Keep it short and true;
deep detail lives in [DOCS.md](./DOCS.md), open work in [docs/BACKLOG.md](./docs/BACKLOG.md).

## What this is

MorningBriefing.AI — a personal morning dashboard that is both a web app (Cloudflare Workers, static SPA)
and a Chrome new-tab extension. React 18 + Vite 6 + TypeScript (`strict: true`) + Zustand 5 + Tailwind 3
+ i18next (en/ko). Backend is Supabase: Auth (Google OAuth), Postgres with RLS, and Deno Edge Functions
that proxy Groq, Tavily, OpenWeather, Twelve Data/Yahoo and Google Calendar/Tasks/Fit.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` (lockfile is committed) |
| Dev server | `npm run dev` → http://localhost:3000 (port fixed, `strictPort`) |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` (`tsc -b && vite build` → `dist/`) |
| Extension zip | `npm run build:extension` → `morningbriefing-extension-v<version>.zip` |
| Deploy web | `npm run build && npx wrangler deploy` |
| Deploy an Edge Function | `npx supabase functions deploy <name>` |

There is no automated test suite and no linter. Before calling a change done, run `npm run typecheck`
and `npm run build`; for UI changes also open the dev server. `scripts/test-diary-generation.mjs` is a
manual script that calls the live `groq` function.

Setup from scratch: `.env.example` → `.env`, then the SQL and secrets steps in README §4–5.
Without `.env`, `supabase` is `null` and the app boots in Demo mode.
Separately, the login screen's "Explore without signing in" enters **guest mode** (`src/lib/guest.ts`,
`src/demo/demoData.ts`): sample data, no network. New fetchers or Edge Function calls must respect `isGuest()`
and must not `save()` sample data to localStorage.

## Layout

```
src/
  main.tsx, App.tsx      entry; App does auth bootstrap + post-login init
  store/                 Zustand stores (one hook per file, useXStore.ts); data/ = useDataStore helpers (apiCache, articles, translate, normalize, …)
  services/              aiService.ts (barrel) → ai/ (client, briefing, dailyQuestion, smartWidget*, diary), diaryGenerationService, personalizationService
  components/            layout/ (dashboard, panels, login), widgets/, modals/, common/, banners/
  hooks/ utils/ constants/ types/ lib/ (supabase client, googleMaps loader)
  l10n/                  i18n.ts + en.json + ko.json
supabase/
  migrations/<timestamp>_*.sql   whole schema (first file = base schema); `npx supabase db push` (DOCS §10)
  functions/<name>/index.ts      Deno Edge Functions
public/                  manifest.json + background.js for the extension, images, privacy policy
archive/course/          old course deliverables — historical, do not treat as current
```

## Architecture in brief

- **Init** (`src/App.tsx`): `getSession()` + `onAuthStateChange` → `useAuthStore.handleAuthChange`.
  Once `user.id` exists, `runFullInit` (guarded by `initPhaseRef`) hydrates 5 stores from Supabase,
  then `useDataStore.fetchAll({ useExistingCache: false })`. Afterwards `visibilitychange` and a
  5-minute poll call `fetchAll({ useExistingCache: true })` (6h TTL, `CACHE_THRESHOLD_MS`).
- **Stores** (`src/store`, plain `create<T>()((set, get) => …)`, no persist middleware):
  `useAuthStore` session/OAuth/`ensureProviderToken` · `useSettingsStore` user_settings, interests ·
  `useWidgetStore` visibility, layouts, smart keywords · `useDataStore` (largest) weather/stocks/news/
  trends/health/calendar fetch + `api_cache` · `useGoogleCalendarStore` Calendar/Tasks CRUD ·
  `useTodoStore` todos mirrored from Google Tasks · `useDiaryStore` diaries, PIN, Q&A ·
  `useBriefingHistoryStore` briefing snapshots · `useOnboardingStore` · `useQuickLinksStore`.
- **Edge Functions → callers**: weather, stocks, fitness → `useDataStore`; groq, tavily → `aiService`
  and `useDataStore` (groq also `personalizationService`); events → `useGoogleCalendarStore` and
  `useDataStore`; tasks → `useGoogleCalendarStore`; google-refresh → `useAuthStore`.
  All calls go through `callEdge` (`src/lib/edge.ts`) via thin per-area wrappers — see DOCS §9 before adding a new call.

## Conventions

- Errors: route through `handleApiError(err, "<area>:<detail>", { httpStatus, userVisible })`
  (areas in use: `edge:`, `ai:`, `diary:`, `cache_read:`, `cache_write:`)
  from `src/utils/errorHandler.ts`. Edge helpers never throw into the UI — they return `null`
  (or `{ ok: false, … }` from `invokeEdgeDetailed`);
  widgets track status with `setApiStatus` / `markFetched`.
- localStorage: use `load()` / `save()` from `src/utils/storage.ts`; keys are prefixed `mb_`.
- Dates: use `src/utils/date.ts` (`formatLocalDate`), never `toISOString().slice(0, 10)` — that is the
  UTC date and is "yesterday" in Korea before 09:00. (All legacy spots were fixed 2026-10-04.)
- i18n: user-facing text goes through `t("…")`; add every key to **both** `en.json` and `ko.json`.
- `supabase` from `src/lib/supabase.ts` can be `null` — guard every use.
- Code comments are mostly Korean; docs are English. Either is fine, match the surrounding file.
- New tables: `npx supabase migration new <name>` (timestamped file) with explicit `GRANT`s (authenticated/service_role, never anon) and RLS policies (Supabase stopped auto-grants), then `npx supabase db push`.

## Pitfalls

- `VITE_*` values are baked in at build time — rebuild after changing `.env`.
- Port 3000 is referenced by Supabase auth `site_url` and the extension's `externally_connectable`.
- Edge Function changes are not live until deployed with `npx supabase functions deploy <name>`;
  check docs/BACKLOG.md for pending deploys.
- `provider_refresh_token` is stripped from localStorage on purpose (`secureStorage` in `src/lib/supabase.ts`); right
  after sign-in it is sent to `google-refresh {action:"store"}` and kept encrypted in `google_tokens` (server only).
  `provider_token` (1h) is persisted. See docs/security/localStorage-audit.md.
- Diary text may be end-to-end encrypted (`src/lib/diaryCrypto.ts`, `useDiaryStore.encryptionStatus`). Never read
  `diaries` text columns directly and send them anywhere without `decryptDiaryField`, and never write plaintext while locked.
  The same applies to `user_qa` and `briefing_snapshots` — use `src/lib/diaryKeyState.ts` (`sealText`/`sealJson`/`openText`/`openJson`).
  Don't put calendar/health data in the server `api_cache` (`isPrivateKey` in `store/data/apiCache.ts`).
- Reloads read the 6h `api_cache`; only the page opened by the Google OAuth callback forces a refetch
  (`openedFromOAuthRedirect`). Don't reintroduce unconditional cache clearing in `runFullInit`.
- Google access tokens last 1h; `ensureProviderToken` refreshes them through `google-refresh` (needs the
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_TOKEN_ENC_KEY` secrets). Without a stored refresh token the user
  sees the reconnect banner (`googleReconnectNeeded`), which re-runs OAuth with `prompt=consent`.
- Identify the user with `getSessionUser()` (`src/lib/supabase.ts`), not `supabase.auth.getUser()` — the latter is a
  network call that takes the cross-tab auth lock.
- Per-user localStorage keys must be listed in `USER_DATA_KEYS` (`src/utils/storage.ts`); they are cleared on
  logout and when a different account signs in on the same browser.
- Groq free tier: `openai/gpt-oss-120b` allows 8,000 tokens/min for the whole project — avoid adding
  Groq calls on page load. The briefing (`generateDetailedBriefing`, 60-min cache in `mb_briefing_cache`) and the
  daily question (`mb_daily_question`) are cached for that reason.
- Every Edge Function requires a logged-in user (`supabase/functions/_shared/auth.ts`); call them with the
  session JWT, never just the anon key.
- Don't commit `dist/`, `.env`, `supabase/.temp/` or extension zips (all gitignored).

## Docs to keep in sync

Update `DOCS.md` when architecture changes, `docs/BACKLOG.md` when an item is fixed or found,
and `CHANGELOG.md` with a dated entry for user-visible changes.
