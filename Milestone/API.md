# MorningBriefing.AI — API Design

> **Last updated:** 2026-05-22
> **Format:** Matches the structure of `MorningBriefingAI_API_Design.xlsx` (Status / Method / Name / URL / Input / Output / Flow / Notes), with corrections applied against actual source code and missing endpoints added.
> **See also:** [DOCS.md §9](./DOCS.md#9-edge-functions) for narrative architecture, and `supabase/functions/*/index.ts` for source-of-truth implementations.

## Authentication legend

| Symbol | Meaning |
|--------|---------|
| 🔓 | No auth required (public Edge Function — secrets handled server-side) |
| 🔒 | Supabase JWT required (`Authorization: Bearer {session.access_token}`) |
| 🔑 | Supabase JWT + Google OAuth provider token in request body |

## Overview

| # | Method | Name | URL | Auth | Status |
|---|--------|------|-----|------|--------|
| 1 | POST | Fetch Weather | `/functions/v1/weather` | 🔓 | ACTIVE |
| 2 | POST | Fetch Stocks | `/functions/v1/stocks` | 🔓 | ACTIVE |
| 3 | POST | Fetch Trends | `/functions/v1/tavily` (mode=trends) | 🔓 | ACTIVE |
| 4 | POST | Fetch News | `/functions/v1/tavily` (mode=news) | 🔓 | ACTIVE |
| 5 | POST | Tavily Generic Search | `/functions/v1/tavily` (mode=search) | 🔓 | ACTIVE |
| 6 | POST | Generate Groq Completion | `/functions/v1/groq` | 🔓 | ACTIVE |
| 7 | POST | Fetch / Manage Events | `/functions/v1/events` | 🔑 | ACTIVE |
| 8 | POST | Fetch / Manage Tasks | `/functions/v1/tasks` | 🔑 | ACTIVE |
| 9 | POST | Fetch Health | `/functions/v1/fitness` | 🔑 | ACTIVE |
| 10 | POST | Smart Widget Query | `/functions/v1/smart-widget` | 🔒 | ACTIVE |
| 11 | GET | Read API Cache | `/rest/v1/api_cache` | 🔒 | ACTIVE |
| 12 | POST | Write API Cache (UPSERT) | `/rest/v1/api_cache` | 🔒 | ACTIVE |
| 13 | GET | Get User Settings | `/rest/v1/user_settings` | 🔒 | ACTIVE |
| 14 | POST | Upsert User Settings | `/rest/v1/user_settings` | 🔒 | ACTIVE |
| 15 | GET | Get Widget Layouts | `/rest/v1/widget_layouts` | 🔒 | ACTIVE |
| 16 | POST | Upsert Widget Layouts | `/rest/v1/widget_layouts` | 🔒 | ACTIVE |
| 17 | GET/POST/PATCH/DELETE | Manage Todos | `/rest/v1/todos` | 🔒 | ACTIVE |
| 18 | GET/POST/DELETE | Manage Smart Keywords | `/rest/v1/smart_keywords` | 🔒 | ACTIVE |
| 19 | GET/POST/PATCH | Manage Diaries | `/rest/v1/diaries` | 🔒 | ACTIVE |
| 20 | GET/POST | Manage Q&A | `/rest/v1/user_qa` | 🔒 | ACTIVE |
| 21 | GET/POST | Manage Briefing Snapshots | `/rest/v1/briefing_snapshots` | 🔒 | ACTIVE |
| 22 | POST/DELETE | Keyword Score Log | `/rest/v1/keyword_score_log` | 🔒 | ACTIVE |
| 23 | — | Sign in with Google (OAuth) | `supabase.auth.signInWithOAuth()` | — | ACTIVE |
| 24 | — | Get / Refresh Session | `supabase.auth.getSession()` / `refreshSession()` | — | ACTIVE |
| 25 | — | Sign Out | `supabase.auth.signOut()` | 🔒 | ACTIVE |

---

# Edge Functions

## 1. Fetch Weather

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/weather` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  lat: number,    // latitude (rounded to 0.1 client-side for cache reuse)
  lon: number     // longitude
}
```

**Output:**
```ts
{
  temp: number,           // temperature in Celsius
  feels_like: number,
  humidity: number,       // 0–100
  condition: string,      // e.g. "Clear", "Rain"
  icon: string,           // OpenWeatherMap icon code
  city: string,
  precipitation: number,  // mm
  airQuality: string      // "Good" | "Moderate" | "Bad" | "Very Bad"
}
```

**Flow / Reason:**
`useDataStore.fetchWeather()` → Edge Function `weather/index.ts` → OpenWeatherMap "current weather" API + Air Pollution API (called in parallel).

**Notes:**
- Coordinates rounded to 0.1 precision client-side for cache reuse.
- AQI mapping: `1=Good`, `2-3=Moderate`, `4=Bad`, `5=Very Bad`.
- Timeout: 25s.
- Cache key: `weather_{rLat}_{rLon}` (1-hour TTL).

---

## 2. Fetch Stocks

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/stocks` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  symbols: string[]   // e.g. ["KOSPI", "NASDAQ", "SP500", "USDKRW", "AAPL", ...]
}
```

**Output:**
```ts
[
  {
    symbol: string,
    price: number,
    change: number,         // absolute change
    changePercent: number   // percent change
  },
  ...
]
```

**Flow / Reason:**
`useDataStore.fetchStocks({symbols})` → Edge Function `stocks/index.ts` → Twelve Data API (primary). On failure or `price <= 0`, falls back to Stooq CSV; for `USDKRW` specifically, also falls back to `open.er-api.com`.

**Notes:**
- Symbols normalized to uppercase.
- Twelve Data symbol map: `KOSPI→KS11/XKOS`, `NASDAQ→IXIC`, `SP500→SPX`, `USDKRW→USD/KRW`.
- Stooq fallback: tries `sym.us` → `^sym` → bare `sym` (first positive price wins).
- `open.er-api.com` fallback timeout: 7s.
- ⚠️ Edge Function changes require **manual redeploy** via Supabase Dashboard.

---

## 3. Fetch Trends

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/tavily` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  mode: "trends",
  query: string,                  // e.g. "English-language major trending news headlines today..."
  max_results?: number,           // default 8 for trends
  include_domains?: string[],     // KO_NEWS_DOMAINS / EN_NEWS_DOMAINS
  time_range?: string             // optional Tavily time filter
}
```

**Output:**
```ts
{
  answer: string | null,
  results: [
    {
      title: string,
      url: string,
      content: string,
      published_date: string | null,
      score: number | null,
      image: string | null
    },
    ...
  ],
  // trends mode also returns:
  trends: string[]                // article titles for fallback display
}
```

**Flow / Reason:**
`useDataStore.fetchTrends()` → Edge Function `tavily/index.ts` with `mode=trends` → Tavily Search API (advanced depth).

**Notes:**
- Returns ~8 results by default for trends mode.
- Korean mode: full client-side post-processing via `translateArticlesToKorean()` and `buildLocalizedTrendTitles()`.
- Backfills translated payload into `api_cache` so subsequent cache hits return Korean text.
- Cache key: `trends_full_{lang}`.

---

## 4. Fetch News

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/tavily` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  mode: "news",
  query: string,                  // includes user's top-5 interest keywords
  max_results?: number,           // default 10 for news
  location?: { lat: number, lon: number },   // optional, omitted in current client
  include_domains?: string[]      // KO_NEWS_DOMAINS in Korean mode
}
```

**Output:**
```ts
{
  answer: string | null,
  results: [
    {
      title: string,
      url: string,
      content: string,
      published_date: string | null,
      image: string | null,
      score: number | null
    },
    ...
  ],
  location: string | null
}
```

**Flow / Reason:**
`useDataStore.fetchNews()` → 2 parallel calls (local + global) → Edge Function `tavily/index.ts` with `mode=news` → Tavily News API. Top-5 interest keywords from `keywordInterests + fixedInterestIds` are injected into the query.

**Notes:**
- Parallel local + global queries, results merged (max 10 total).
- Cache key: `news_{lang}_{interestFingerprint}` where `interestFingerprint = topKeywords.join("+") || "base"`.
- Korean mode: client-side `translateArticlesToKorean()` post-processing + backfill into `api_cache`.
- Korean article filter: `scoreArticleForLanguage()` + `filterByAllowedDomains()` (hard domain filter).
- Timeout: 25s.

---

## 5. Tavily Generic Search

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/tavily` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  mode: "search",
  query: string,
  max_results?: number,
  include_domains?: string[],
  search_topic?: string,     // overrides default "general"
  time_range?: string
}
```

**Output:** Same shape as `mode=news` (answer + results array with images).

**Flow / Reason:**
Used internally by `aiService.js` and `smart-widget` Edge Function for keyword-specific Tavily searches (e.g., shopping product lookups, brand pages, restaurant data).

**Notes:**
- Same Tavily endpoint as news/trends, parameterized by `mode`.
- `search_topic` defaults to `"general"` when `mode=search` (vs `"news"` for `mode=news`).

---

## 6. Generate Groq Completion

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/groq` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  prompt: string,                 // required — user message content
  system?: string,                // system message
  model?: string,                 // default "llama-3.3-70b-versatile"
  temperature?: number            // default 0.4
}
```

**Output:**
```ts
{
  text: string                    // assistant message content
}
```

> ⚠️ **Template correction:** Previously documented as `{ content: string }`. The actual implementation (`supabase/functions/groq/index.ts` line 46) returns `{ text }`.

**Flow / Reason:**
- `aiService.generateBriefing()` / `generateDetailedBriefing()` — briefing copy (temperature 0.1 for facts, 0.4 default)
- `aiService.generateDiary()` — diary generation with language-strict prompts
- `aiService.rewriteDiaryWithFeedback()` — diary rewrites from user feedback
- `aiService.summarizeArticlesBatch()` — batch summarization of news/trends articles (single Groq call for up to 6 articles)
- Keyword extraction for personalization batch

**Notes:**
- Response `Content-Type: application/json; charset=utf-8` (explicit, prevents UTF-8 garbling for Korean text).
- Error responses include `{ error: string }` with HTTP 400.
- ⚠️ Edge Function changes require manual redeploy via Supabase Dashboard.

---

## 7. Fetch / Manage Events

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/events` |
| **Auth** | 🔑 Supabase JWT + Google OAuth provider token |

**Input:**
```ts
{
  token: string,         // Google OAuth provider_token (from supabase.auth.getSession())
  action?: "list" | "read" | "create" | "update" | "delete",   // default "list"

  // For list action:
  timeMin?: string,      // ISO datetime
  timeMax?: string,      // ISO datetime
  todayOnly?: boolean,
  date?: string,         // YYYY-MM-DD for single-day list

  // For create/update:
  title?: string,
  startTime?: string,    // ISO datetime or YYYY-MM-DD (all-day)
  endTime?: string,
  location?: string,
  description?: string,

  // For read/update/delete:
  eventId?: string
}
```

**Output:**
```ts
// action: "list"
[
  {
    id: string,
    summary: string,         // title
    start: string,           // ISO datetime or YYYY-MM-DD
    end: string,
    location: string | null,
    description: string | null,
    attendees: string[] | null
  },
  ...
]

// action: "create" | "update"  → single event object (same shape)
// action: "delete"             → { success: true }
```

**Flow / Reason:**
`useGoogleCalendarStore.fetchEvents() / addEvent() / updateEvent() / deleteEvent()` → token from `supabase.auth.getSession().provider_token` → Edge Function `events/index.ts` → Google Calendar API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/calendar`
- Single endpoint multiplexed by `action` parameter (list/read/create/update/delete).
- `todayOnly: true` uses `timeMin: now.toISOString()` (excludes past events).
- JWT validation: server checks `supabase.auth.getUser(jwt)` → 401 on failure.
- Timeout: 25s.

---

## 8. Fetch / Manage Tasks

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/tasks` |
| **Auth** | 🔑 Supabase JWT + Google OAuth provider token |

**Input:**
```ts
{
  token: string,         // Google OAuth provider_token
  action?: "list" | "create" | "update" | "delete" | "move" | "clearCompleted",
  taskListId?: string,   // defaults to "@default"
  taskId?: string,
  title?: string,
  notes?: string,
  due?: string,          // ISO datetime
  completed?: boolean,

  // For move action:
  previousId?: string,
  parentId?: string
}
```

**Output:**
```ts
// action: "list"
[
  {
    id: string,
    title: string,
    notes: string | null,
    due: string | null,
    status: "needsAction" | "completed",
    completed: boolean,
    taskListId: string
  },
  ...
]

// action: "create" | "update" | "move"  → single task object
// action: "delete" | "clearCompleted"   → { success: true }
```

**Flow / Reason:**
`useGoogleCalendarStore.fetchTasks() / addTask() / updateTask() / deleteTask()` → token from `supabase.auth.getSession().provider_token` → Edge Function `tasks/index.ts` → Google Tasks API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/tasks`
- Single endpoint multiplexed by `action`.
- ⚠️ **Template correction:** Legacy `[MB_META]...[/MB_META]` metadata in `notes` is **stripped on read but no longer written** (per DOCS.md §5.8).
- Timeout: 25s.

---

## 9. Fetch Health

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/fitness` |
| **Auth** | 🔑 Supabase JWT + Google OAuth provider token |

**Input:**
```ts
{
  token: string         // Google OAuth provider_token
}
```

**Output:**
```ts
{
  steps: number,
  sleep: number,        // hours
  calories: number,
  heartRate: number     // bpm (resting)
}
```

**Flow / Reason:**
`useDataStore.fetchHealth()` → token from `supabase.auth.getSession()` → Edge Function `fitness/index.ts` → Google Fitness aggregate API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/fitness.activity.read` (restricted scope — annual CASA review required).
- Aggregated in 86,400s bucket (1 day).
- Returns zeros on 403 (graceful fallback when scope is missing).
- Timeout: 25s.

---

## 10. Smart Widget Query

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/smart-widget` |
| **Auth** | 🔒 Supabase JWT |

**Input:**
```ts
{
  keyword: string,              // user-defined widget keyword
  persona?: string,             // user's selected persona (from user_settings)
  age?: number | string,
  job?: string,
  interests?: string[],         // top fixed + dynamic interest keywords
  location?: { lat: number, lon: number },
  language?: "ko" | "en",
  token?: string                // optional, for Google data enrichment
}
```

> ⚠️ **Template correction:** Previously documented as `{ lat, lon, userInput }`. The actual input is richer: keyword, persona context, interests, language, etc.

**Output:**
```ts
{
  category: string,             // classified category (shopping, food, tech, etc.)
  sections: [
    {
      type: "summary" | "news" | "blog" | "video",
      title: string,
      items: [
        { title: string, url: string, image?: string, source?: string, content?: string },
        ...
      ]
    },
    ...
  ],
  weather?: { ... }             // included when category implies outdoor activity
}
```

**Flow / Reason:**
Invoked from `useWidgetStore.loadSmartWidget()` or after Q&A submission → Edge Function `smart-widget/index.ts` → (1) Groq classification + section planning (JSON mode, `temperature: 0.3`) → (2) Tavily search per planned section → (3) optional OpenWeatherMap call for outdoor activity context.

**Notes:**
- Groq `response_format: { type: "json_object" }` enforced.
- Category classification covers 17 categories (see DOCS.md §7.4).
- Cache key: `${keyword}_${lang}` (stored client-side in `useWidgetStore.smartWidgetData`).
- Korean mode: 2-stage Tavily fetch with `include_domains: KO_NEWS_DOMAINS` fallback if <2 Korean results.

---

# Supabase REST API (Database Tables)

All REST endpoints are accessed via the auto-generated PostgREST interface at `/rest/v1/{table}` with RLS enforced (users can only access rows where `auth.uid() = user_id` / `id`).

## 11. Read API Cache

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET |
| **URL** | `https://<project>.supabase.co/rest/v1/api_cache?id=eq.{cacheKey}` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Input (query params):**
- `id = "u:{userId}:{cacheKey}"` e.g. `"u:abc-123:weather_37.5_126.9"`

**Output:**
```ts
[
  {
    id: string,
    data: object,           // arbitrary JSON payload
    fetched_at: string      // ISO timestamp
  }
]
```

**Flow / Reason:** `useDataStore.readApiCache()` → Supabase REST SELECT → check 1-hour TTL against `fetched_at` → cache hit returns state; cache miss proceeds to real API call.

**Notes:**
- Key format: `u:{userId}:{cacheKey}`.
- TTL: 60 minutes (enforced app-side, not DB).
- RLS: users can only access their own rows.

---

## 12. Write API Cache (UPSERT)

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/rest/v1/api_cache` (header: `Prefer: resolution=merge-duplicates`) |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Input:**
```ts
{
  id: string,           // u:{userId}:{cacheKey}
  user_id: string,      // from auth
  data: object,         // payload to cache
  fetched_at: string    // ISO timestamp
}
```

**Output:** Empty body on success (HTTP 201).

**Notes:**
- UPSERT via `Prefer: resolution=merge-duplicates` header.
- `user_id` extracted from auth context server-side.

---

## 13. Get User Settings

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET |
| **URL** | `https://<project>.supabase.co/rest/v1/user_settings?id=eq.{userId}` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Output (single row):**
```ts
{
  id: string,
  persona: string,
  theme: "dark" | "light",
  tone: string,
  briefing_length: string,
  voice_on: boolean,
  clock_style: string,
  bg_image: string | null,
  vis: object,                  // { [widgetId]: boolean }
  stock_symbols: string[],
  priority_order: string[],
  show_first_login_briefing: boolean,
  last_briefing_shown: string,
  keyword_interests: Array<{ keyword: string, category: string, score: number }>,
  keyword_interests_updated: string,
  fixed_interests: string[],
  onboarding_perms: { fit: boolean, cal: boolean },
  pin_lock_mode: "immediate" | "off" | "timed",
  created_at: string,
  updated_at: string
}
```

**Flow / Reason:** `useDataStore.fetchAll()` → Supabase REST SELECT → determines visible widgets and user preferences. RLS enforced.

---

## 14. Upsert User Settings

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/rest/v1/user_settings` (header: `Prefer: resolution=merge-duplicates`) |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Input:** Partial of `user_settings` row (all setters call this in background).

**Notes:** UPSERT triggered by all setter actions in `useSettingsStore`, `useAuthStore.finishOB()`, etc.

---

## 15. Get Widget Layouts

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET |
| **URL** | `https://<project>.supabase.co/rest/v1/widget_layouts?id=eq.{userId}` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Output:**
```ts
{
  id: string,
  layouts: { lg: array, md: array, sm: array },   // react-grid-layout positions per breakpoint
  layout_version: number
}
```

**Notes:** Stores multi-breakpoint grid positions; smart widget IDs are parsed from layout entries.

---

## 16. Upsert Widget Layouts

POST to `/rest/v1/widget_layouts` with `Prefer: resolution=merge-duplicates`. Triggered by `useWidgetStore.handleLayoutChange / saveDraggedLayout / resetLayout`.

---

## 17. Manage Todos *(NEW — missing from template)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / PATCH / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/todos` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  id: uuid,
  user_id: uuid,
  text: string,
  done: boolean,
  completed: boolean,
  is_fixed: boolean,
  is_recurring: boolean         // generated column from is_fixed
}
```

**Flow:** `useTodoStore` — optimistic local update (temp ID) → DB upsert → temp ID replaced with real UUID.

---

## 18. Manage Smart Keywords *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/smart_keywords` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:** `{ id: uuid, user_id: uuid, keyword: string }` (UNIQUE on `user_id + keyword`).

**Flow:** `useWidgetStore` — keyword changes trigger DELETE all + INSERT new (full replace).

---

## 19. Manage Diaries *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / PATCH |
| **URL** | `https://<project>.supabase.co/rest/v1/diaries` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  user_id: uuid,
  date: date,           // UNIQUE with user_id
  diary_text: string,
  memo: string,
  answers: jsonb,       // [{question, answer}] array
  updated_at: timestamptz   // auto-updated by trigger
}
```

**Flow:** `useDiaryStore.saveDiary() / saveGeneratedDiary() / saveMemo() / confirmRewrite()` → UPSERT on `(user_id, date)`.

---

## 20. Manage Q&A *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST |
| **URL** | `https://<project>.supabase.co/rest/v1/user_qa` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:** `{ user_id: uuid, question: string, answer: string, asked_date: date }` (indexed on `(user_id, asked_date)`).

**Flow:** `useDiaryStore.addAnswer()` → INSERT new Q&A row.

---

## 21. Manage Briefing Snapshots *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE (optional — table created at app level) |
| **Method** | GET / POST |
| **URL** | `https://<project>.supabase.co/rest/v1/briefing_snapshots` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  user_id: uuid,
  date: date,
  captured_at: timestamptz,
  source: "auto" | "refresh",
  payload: jsonb              // { text, summary, sections }
}
```

**Flow:** `useBriefingHistoryStore.addSnapshot()` → INSERT on 3-hour interval or manual refresh; INSERT silently no-ops if table doesn't exist.

---

## 22. Keyword Score Log *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/keyword_score_log` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  user_id: uuid,
  keyword: string,
  category: "food" | "place" | "content" | "shopping" | "lifestyle" | "mood" | "interest",
  source: "personal" | "diary",
  base_weight: number,        // 2 for personal Q&A, 1 for diary
  logged_date: date
}
```

**Flow:** Midnight batch (`runPersonalizationBatch`) → INSERT new keyword extractions, DELETE rows older than 30 days. Aggregated up to `user_settings.keyword_interests`.

---

# Supabase Auth *(NEW — missing from template)*

## 23. Sign in with Google (OAuth)

**Client API:** `supabase.auth.signInWithOAuth({ provider: "google", options: {...} })`

**Options used:**
```ts
{
  provider: "google",
  options: {
    queryParams: {
      prompt: "select_account",     // not "consent" — avoids forcing full consent every login
      access_type: "offline"        // request refresh token on first consent
    },
    scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/fitness.activity.read",
    redirectTo: window.location.origin
  }
}
```

**Output:** Browser redirect to Google consent → callback to `redirectTo` with `?code=...` → Supabase exchanges code for session.

---

## 24. Get / Refresh Session

**Client APIs:**
- `supabase.auth.getSession()` — returns `{ data: { session }, error }` (reads from local Supabase auth state)
- `supabase.auth.refreshSession()` — explicit refresh; updates `provider_token` if Google access token expired

**Used by:** `useAuthStore.ensureProviderToken()` — memory cache first → `getSession()` → `refreshSession()` chain.

**Output (session):**
```ts
{
  access_token: string,         // Supabase JWT (sent as Authorization: Bearer to Edge Functions)
  refresh_token: string,
  expires_at: number,
  user: { id, email, user_metadata: { ... } },
  provider_token: string,       // Google OAuth access token (memory-only, never persisted to localStorage)
  provider_refresh_token: string
}
```

**Security note:** `provider_token` is **never written to localStorage** — only held in Zustand memory state to prevent XSS token theft.

---

## 25. Sign Out

**Client API:** `supabase.auth.signOut()` — clears local auth state and revokes session on Supabase.

**Flow:** `useAuthStore.logout()` — clears local Zustand state immediately, then awaits `signOut()` to revoke server-side.

---

# Cross-Cutting Concerns

## Caching

| Layer | Storage | TTL | Used by |
|-------|---------|-----|---------|
| Memory | Module-level Map | 5 min (geo) | `_geoCache`, `_trendsMemCache` |
| localStorage | `mb_cache_{key}` | App-checked | Fallback when DB unavailable |
| DB | `api_cache` table | 60 min | All Edge Function calls (weather, stocks, tavily, etc.) |

Cache keys are language-aware where appropriate: `news_{lang}_{interestFingerprint}`, `trends_full_{lang}`, `${keyword}_${lang}` (Smart Widget).

## Error Handling

- All Edge Functions: 25-second timeout (15s for `groq`).
- HTTP 4xx/5xx → client falls back to mock data + sets `apiStatus="error"` for the affected widget.
- Korean text: `groq` Edge Function explicitly sets `Content-Type: application/json; charset=utf-8` to prevent garbling.

## Row-Level Security (RLS)

All user-scoped tables (`user_settings`, `widget_layouts`, `todos`, `smart_keywords`, `diaries`, `user_qa`, `briefing_snapshots`, `keyword_score_log`, `api_cache`) enforce:
```sql
USING (auth.uid() = user_id)   -- or auth.uid() = id for user_settings
WITH CHECK (auth.uid() = user_id)
```
SELECT, INSERT, UPDATE, DELETE policies are set explicitly. From 2026-05-30, Supabase requires explicit `GRANT` blocks for new tables — these are included in `schema.sql` and `migrations/*.sql`.

---

# Change Log Against Template

This section documents the corrections made to `MorningBriefingAI_API_Design.xlsx` based on source code verification (2026-05-22).

### Corrections

| # | API | Field | Template said | Actual (verified in source) |
|---|-----|-------|---------------|------------------------------|
| 6 | Generate Groq | Output | `{ content: STR }` | `{ text: string }` (`groq/index.ts:46`) |
| 6 | Generate Groq | Input | missing `temperature` | `temperature?: number` (default 0.4) |
| 7 | Events | URL note | "Google Calendar A" (truncated) | "Google Calendar API" |
| 8 | Tasks | Notes | "App metadata in notes as [MB_META]" | Legacy — stripped on read, no longer written (DOCS.md §5.8) |
| 10 | Smart Widget | Input | `{ lat, lon, userInput }` | `{ keyword, persona, age, job, interests, location, language, token }` |
| 3 | Fetch Trends | Notes | "Returns 7 results" | Default 8 for trends; varies by `max_results` |
| 3 | Fetch Trends | Output | News-shape only | Also returns `trends: string[]` for fallback display |

### Additions

Endpoints 5, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 were not in the original template. Added: Tavily generic search mode, Upsert User Settings, Upsert Widget Layouts, all 6 missing Supabase REST tables (todos, smart_keywords, diaries, user_qa, briefing_snapshots, keyword_score_log), and 3 Supabase Auth client API calls.
