# MorningBriefing.AI

> **Live demo:** `<DEPLOYED_URL>` _(Cloudflare Workers; replace with actual deployment URL)_
> **Repository:** `<REPO_URL>` _(replace with actual GitHub URL)_

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
- **Language:** JavaScript (JSX)
- **Framework:** React 18.3
- **Build tool:** Vite 6
- **Styling:** Tailwind CSS 3.4
- **State management:** Zustand 5
- **Drag-and-drop:** @hello-pangea/dnd
- **Animation:** framer-motion
- **i18n:** i18next / react-i18next (English, Korean)
- **Icons:** Lucide React
- **Toasts:** react-hot-toast

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
git clone <REPO_URL>
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

---

## 🧪 Testing

This project does not yet have an automated test suite. Verification is currently manual.

### Test development environment

After completing setup (above), verify the dev environment with this checklist:

1. **Login flow:** Click "Continue with Google" on the login screen → OAuth consent → redirect back → dashboard renders
2. **Widget rendering:** All default widgets (Briefing, Diary, Calendar, Weather, Stocks, Trends, News, Health) appear within 3 seconds
3. **Manual refresh:** Click the refresh icon on any widget → loading indicator → fresh data
4. **Language toggle:** Click language toggle in TopNav → news, trends, smart widget content reloads in selected language
5. **Settings persistence:** Change theme/temperature unit/stock symbols → reload page → settings retained
6. **Calendar:** Add an event via EventPanel → event appears on the calendar
7. **Diary:** Answer today's Q&A → save → reload → answer retained (PIN-gated)
8. **AI Briefing:** Wait for briefing to generate → click for detail modal → all sections (header / schedule / yesterday / latest_info) render

If any check fails, see `todo.md` for known issues or file a bug (see below).

### Test data and accounts

For local testing, you can register with any Google account. User data is isolated by `auth.uid()` via Row-Level Security — no cross-user data leakage.

---

## 🐞 Bug Reporting

### Where to find open bugs

Open issues are tracked in the **GitHub Issues** tab of this repository: `<REPO_URL>/issues`

Browse all open bugs there to see what's known. If your issue matches an existing one, please add a comment with reproduction details rather than filing a duplicate.

### How to report a new bug

1. Go to `<REPO_URL>/issues/new`
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
| [DOCS.md](./DOCS.md) | Architecture reference — stores, caching, widgets, Edge Functions, DB schema, personalization |
| [CHANGELOG.md](./CHANGELOG.md) | Dated change log (fix rounds, feature releases) |
| [ProjectMilestones.md](./ProjectMilestones.md) | CSE 416 course assignment specification (milestones 1–4) |
| `todo.md` | Working notes and manual test checklist |

---

## 👥 Team Members

- **Ahn Minsoo** — Infrastructure & DevOps
- **Choo Sungmin** — Backend Developer
- **Kwon Dahyun** — Frontend Developer & UI/UX Designer

## 📋 Project Management

This project is managed using **Jira**.

- Scrum Board: [Jira Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9)
