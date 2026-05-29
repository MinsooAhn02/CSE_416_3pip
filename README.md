# MorningBriefing.AI

> **Live demo:** https://morningbriefing.dksalstn0621.workers.dev (Cloudflare Workers)
> **Repository:** https://github.com/MinsooAhn02/CSE_416_3pip

## 🚩 Problem Statement

In the modern information age, individuals are overwhelmed by a constant flood of news, trends, and data from countless sources. Rather than staying informed, many people experience "information fatigue", a state in which the sheer volume of content makes it difficult to distinguish what is relevant, reliable, or truthful.

Despite this overload, the world continues to demand that people stay aware of current events, economic shifts, and daily lifestyle factors. Busy professionals and students, in particular, lack a simple, unified tool to receive the information that actually matters to them, without sorting through noise.

## ✅ Solutions

MorningBriefing.AI eliminates the need for users to search for information through a **New Tab Dashboard** that automatically appears every time they open their browser.

- **Ultra-Integral Accessibility:** Simply opening a new tab instantly launches the briefing, without requiring any additional service access.
- **Intelligent Data Integration:** By combining the user's real-time status (sleep, schedule, activity level) collected through Google Fit and Google Calendar with external indicators (stocks, weather, news, trends), MorningBriefing.AI delivers a personal-assistant-style briefing with context, not a simple list.
- **Custom Widget Layout:** Personalized dashboard and widget layout optimized for the user's interests (investment, exercise, study, etc.).

> Hybrid: web app + Chrome new-tab extension. Built on React + Vite + Supabase.

---

## 🛠️ Technology Stack

### Frontend
- **Language:** TypeScript (`.ts` / `.tsx`) — full migration completed 2026-05-24 (`tsconfig.json` with `strict:false`)
- **Framework:** React 18.3
- **Build tool:** Vite 6
- **Styling:** Tailwind CSS 3.4
- **State management:** Zustand 5 (10 stores including the recently extracted `useOnboardingStore`)
- **Drag-and-drop:** @hello-pangea/dnd
- **Animation:** framer-motion
- **i18n:** i18next / react-i18next (English, Korean)
- **Icons:** Lucide React
- **Toasts:** react-hot-toast
- **Error handling:** centralized `src/utils/errorHandler.ts` (`ApiError` + `handleApiError`)

### Backend / Infrastructure
- **Auth + Database:** Supabase (PostgreSQL with Row-Level Security, OAuth via Supabase Auth)
- **Serverless API:** Supabase Edge Functions (TypeScript / Deno)
- **LLM:** Groq API (briefing generation, diary generation, keyword extraction)
- **Hosting:** Cloudflare Workers (static SPA deployment)

### External APIs
- OpenWeatherMap (weather data)
- Twelve Data (stock quotes) with Stooq CSV fallback
- Tavily (news search and trends)
- Google Calendar API (events + tasks)
- Google Fitness API (steps, sleep, heart rate)
- Google Maps / Places (location autocomplete)

For full architecture details, see [DOCS.md](./DOCS.md) (English) or [DOCS_kor.md](./DOCS_kor.md) (Korean).

---

## 🚀 Setup Instructions

> **Supported OS:** Windows 10 / 11 (PowerShell). The team's primary development environment is Windows. The commands below assume PowerShell 7+. Cross-platform contributors should adapt PowerShell-specific commands (`$env:VAR = "value"`) to their shell.

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ (LTS recommended) | [nodejs.org](https://nodejs.org/) |
| npm | 9+ (bundled with Node.js) | — |
| Git | any recent | [git-scm.com](https://git-scm.com/) |
| Supabase project | active | [supabase.com](https://supabase.com/) — required for auth/DB |

### 1. Clone the source code

The latest stable code lives on the `main` branch.

```powershell
git clone https://github.com/MinsooAhn02/CSE_416_3pip
cd CSE_416_3pip
```

To check out a specific tagged release (when one exists):
```powershell
git fetch --tags
git checkout <tag-name>
```

### 2. Install dependencies

```powershell
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root with the following keys (do **not** commit `.env` — it's gitignored):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_GOOGLE_MAPS_API_KEY=<your-google-maps-key>
```

**Where to get each value:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Project Settings → API
- `VITE_GOOGLE_MAPS_API_KEY`: Google Cloud Console → APIs & Services → Credentials. Restrict by HTTP referrer.

**Optional debug variable:**
```env
VITE_DEBUG_FLOW=1
```

If `.env` is missing or empty, the app boots in **Demo mode** (the login screen displays a notice and Supabase features are disabled).

### 4. Database setup

The required tables are defined in `supabase/schema.sql` and migrations in `supabase/migrations/`.

In the Supabase Dashboard → SQL Editor, run the following files in order:
1. `supabase/schema.sql` — base tables (`user_settings`, `widget_layouts`, `todos`, `smart_keywords`, `api_cache`)
2. `supabase/migrations/add_personalization.sql` — `diaries`, `keyword_score_log`, personalization columns
3. `supabase/migrations/add_fixed_interests.sql` — `fixed_interests`, `onboarding_perms` columns
4. `supabase/migrations/add_user_qa.sql` — `user_qa` table

> **Note:** From 2026-05-30, Supabase will stop auto-granting permissions on new tables. The SQL files already include explicit `GRANT` blocks.

### 5. Edge Functions deployment

Deploy the serverless functions via the Supabase CLI or the Dashboard. The functions live in `supabase/functions/`:

```powershell
supabase functions deploy weather
supabase functions deploy stocks
supabase functions deploy tavily
supabase functions deploy groq
supabase functions deploy events
supabase functions deploy tasks
supabase functions deploy fitness
supabase functions deploy smart-widget
```

Set the required secrets in Supabase Dashboard → Project Settings → Edge Functions:
- `OPENWEATHER_API_KEY`
- `GROQ_API_KEY`
- `TAVILY_API_KEY`
- `TWELVEDATA_API_KEY`

### 6. Run the dev server

```powershell
npm run dev
```

Open `http://localhost:5173` (Vite default port). The dashboard should load with the login screen.

---

## 🏗️ Build & Deploy

### Build for production

```powershell
npm run build
```

This generates the production bundle in `dist/`. The `VITE_*` environment variables are **hardcoded into the bundle at build time** — re-build after changing `.env`.

### Deploy to Cloudflare Workers

```powershell
npm run build
npx wrangler deploy
```

The deployment uses `wrangler.jsonc` at the repo root. The `not_found_handling: "single-page-application"` setting ensures OAuth callbacks (`/?code=xxx`) and deep links serve `index.html`.

> ⚠️ **Always run `npm run build` before `wrangler deploy`** — otherwise a stale bundle is deployed and the app may run in Demo mode.

### Build the Chrome extension

```powershell
npm run build:extension
```

Generates `dist/` plus a zipped extension archive for the Chrome Web Store.

### Type checking (TypeScript)

```powershell
npm run typecheck
```

Runs `tsc --noEmit` — reports type errors without emitting any files. Run before committing to catch type issues early.

---

## 🧪 Testing

This project does not yet have an automated test suite. Verification is currently manual.

### Test development environment

After completing setup (above), verify the dev environment with this checklist:

1. **Login flow:** Click "Continue with Google" on the login screen → OAuth consent → redirect back → dashboard renders
2. **Widget rendering:** All default widgets (Briefing, Diary, Calendar, Weather, Stocks, Trends, News, Health) appear within 3 seconds
3. **Last-updated time:** After login, all widget headers show "방금" or ≤2분 전 — not a stale timestamp from a previous session
4. **Manual refresh:** Click the refresh icon on any widget → loading indicator → fresh data
5. **Language toggle:** Click language toggle in TopNav → news, trends, smart widget content reloads in selected language
6. **Settings persistence:** Change theme/temperature unit/stock symbols → reload page → settings retained
7. **Calendar:** Add an event via EventPanel → event appears on the calendar; clicking the month/year header enters the year picker → **오늘** button remains visible and clicking it returns to today's month
8. **News images:** News widget (news/grid view) → images load correctly; broken images show the newspaper icon placeholder without a blank gap
9. **Smart Widget:** Category button shows `[≡ + emoji + ▾]` — clicking opens the category dropdown; pencil icon edits the keyword
10. **Diary:** Answer today's Q&A → save → reload → answer retained (PIN-gated)
11. **AI Briefing:** Wait for briefing to generate → click for detail modal → all sections (header / schedule / yesterday / latest_info) render
12. **News image fallback:** Force a broken image URL in DevTools → confirm a `Newspaper` icon placeholder shows in place of a blank gap
13. **Login timestamp reset:** Log out → wait a few minutes → log back in → confirm widget "last-updated" labels read "방금" / "just now", not a stale "9000분 전"
14. **SmartWidget category override:** On any Smart Widget header, click the `[≡ + emoji + ▾]` button → dropdown opens → manual category override applies

If any check fails, check the [GitHub Issues](https://github.com/MinsooAhn02/CSE_416_3pip/issues) for known issues or file a bug (see below).

### Test data and accounts

For local testing, you can register with any Google account. User data is isolated by `auth.uid()` via Row-Level Security — no cross-user data leakage.

### Google sign-in warning ("App not verified")

When signing in for the first time, Google may display a warning:
**"Google hasn't verified this app"**

This is expected. The app is in GCP **Testing** mode — full OAuth verification (which requires a CASA security assessment for the Fitness scope) has not been pursued for this academic project.

**To proceed:** click **Advanced** → **Continue to [app name] (unsafe)**. This bypasses the warning and grants the requested permissions normally. The warning is a Google policy gate for unverified apps, not an indicator of any security issue with this application.

> Note: In Testing mode, OAuth tokens may expire after 7 days. If you are signed out unexpectedly, simply sign in again.

---

## 🐞 Bug Reporting

### Bug tracking history

Bugs were tracked in **Jira** throughout development (Sprint 1–4, May 6–27, 2026). Issues were migrated to GitHub Issues on 2026-05-23 to comply with the CSE 416 Milestone 4 submission format. The original Jira board remains the live source of truth for sprint history: [Jira Scrum Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1). See GitHub [issue #16](https://github.com/MinsooAhn02/CSE_416_3pip/issues/16) for the full migration notice including original discovery dates.

### Where to find open bugs

Open issues are tracked in the **GitHub Issues** tab of this repository: `https://github.com/MinsooAhn02/CSE_416_3pip/issues`

Browse all open bugs there to see what's known. If your issue matches an existing one, please add a comment with reproduction details rather than filing a duplicate.

### How to report a new bug

1. Go to `https://github.com/MinsooAhn02/CSE_416_3pip/issues/new`
2. Use the title format: `[BUG] <short description>`
3. Include:
   - **Steps to reproduce** (numbered list)
   - **Expected behavior**
   - **Actual behavior**
   - **Environment:** OS, browser, Node version
   - **Screenshots or console errors** (if applicable)
4. Add labels: `bug` and the relevant area (`widget`, `auth`, `diary`, `briefing`, etc.)

For security-sensitive issues, do not open a public issue — contact the team directly.

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 30-minute end-to-end onboarding overview (auth flow, store map, fetch pipeline) — added 2026-05-24 |
| [DOCS.md](./DOCS.md) | Architecture reference — stores, caching, widgets, Edge Functions, DB schema, personalization |
| [DOCS_kor.md](./DOCS_kor.md) | Korean translation of `DOCS.md` |
| [CHANGELOG.md](./CHANGELOG.md) | Dated change log (fix rounds, feature releases) |
| [Milestone/ProjectMilestones.md](./Milestone/ProjectMilestones.md) | CSE 416 course assignment specification (milestones 1–4) |
| [Milestone/SCHEDULE.md](./Milestone/SCHEDULE.md) | Sprint-by-sprint schedule + Schedule Changes |
| [Milestone/API.md](./Milestone/API.md) | API design (25 endpoints) |
| [Milestone/KNOWN_ISSUES.md](./Milestone/KNOWN_ISSUES.md) | Open bug list (staging for GitHub Issues) |
| [Milestone/MILESTONE4_PROGRESS.md](./Milestone/MILESTONE4_PROGRESS.md) | Per-team-member progress + group self-grade |
| [docs/security/localStorage-audit.md](./docs/security/localStorage-audit.md) | Audit of localStorage usage (XSS surface, `provider_token` handling) — added 2026-05-24 |
| `todo.md` | Working notes and manual test checklist |

---

## 👥 Team Members

- **Ahn Minsoo** — Infrastructure & DevOps
- **Choo Sungmin** — Backend Developer
- **Kwon Dahyun** — Frontend Developer & UI/UX Designer

## 📋 Project Management

This project is managed using **Jira**.

- Scrum Board: [Jira Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9) | [Jira Timeline](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1/timeline)
