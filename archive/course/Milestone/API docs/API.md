# MorningBriefing.AI — API Design

> **Last updated:** 2026-06-10
> **Format:** Matches the structure of `MorningBriefingAI_API_Design.xlsx` (Status / Method / Name / URL / Input / Output / Flow / Notes), with corrections applied against actual source code and missing endpoints added.
> **See also:** [DOCS.md §9](../DOCS.md#9-edge-functions) for narrative architecture, [ARCHITECTURE.md §6](../ARCHITECTURE.md#6-supabase-edge-functions) for the end-to-end fetch pipeline diagram, and `supabase/functions/*/index.ts` for source-of-truth implementations.
>
> **File-extension note:** The codebase migrated `.js`/`.jsx` → `.ts`/`.tsx` on 2026-05-24 (commit `365b392`). Any source-file reference below ending in `.js` should be read as the equivalent `.ts` — the endpoints themselves are language-neutral and unchanged.

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
| 11 | POST | Refresh Google Token | `/functions/v1/google-refresh` | 🔓 | ACTIVE |
| 12 | GET | Read API Cache | `/rest/v1/api_cache` | 🔒 | ACTIVE |
| 13 | POST | Write API Cache (UPSERT) | `/rest/v1/api_cache` | 🔒 | ACTIVE |
| 14 | GET | Get User Settings | `/rest/v1/user_settings` | 🔒 | ACTIVE |
| 15 | POST | Upsert User Settings | `/rest/v1/user_settings` | 🔒 | ACTIVE |
| 16 | GET | Get Widget Layouts | `/rest/v1/widget_layouts` | 🔒 | ACTIVE |
| 17 | POST | Upsert Widget Layouts | `/rest/v1/widget_layouts` | 🔒 | ACTIVE |
| 18 | GET/POST/PATCH/DELETE | Manage Todos | `/rest/v1/todos` | 🔒 | ACTIVE |
| 19 | GET/POST/DELETE | Manage Smart Keywords | `/rest/v1/smart_keywords` | 🔒 | ACTIVE |
| 20 | GET/POST/PATCH | Manage Diaries | `/rest/v1/diaries` | 🔒 | ACTIVE |
| 21 | GET/POST/DELETE | Manage Q&A | `/rest/v1/user_qa` | 🔒 | ACTIVE |
| 22 | GET/POST | Manage Briefing Snapshots | `/rest/v1/briefing_snapshots` | 🔒 | ACTIVE |
| 23 | POST/DELETE | Keyword Score Log | `/rest/v1/keyword_score_log` | 🔒 | ACTIVE |
| 24 | — | Sign in with Google (OAuth) | `supabase.auth.signInWithOAuth()` | — | ACTIVE |
| 25 | — | Get / Refresh Session | `supabase.auth.getSession()` / `refreshSession()` | — | ACTIVE |
| 26 | — | Sign Out | `supabase.auth.signOut()` | 🔒 | ACTIVE |

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
  lat?: number,       // latitude (default 37.5665); rounded to 0.1 client-side for cache reuse
  lon?: number,       // longitude (default 126.978)
  city?: string,      // city name — overrides lat/lon when provided
  lang?: "ko" | "en"  // default "en"; "ko" triggers Korean city name via reverse geocoding
}
```

**Output:**
```ts
{
  temp: number,               // temperature in Celsius
  feels_like: number,
  humidity: number,           // 0–100
  condition: string,          // OpenWeatherMap weather description (e.g. "light rain")
  conditionId: number | null, // OpenWeatherMap condition id (for icon/category logic client-side)
  icon: string,               // OpenWeatherMap icon code (e.g. "10d")
  city: string,               // Korean name if lang="ko" and geocoding available, otherwise English
  precipitation: number,      // 0–100 probability (computed from cloud cover + rain/snow volume)
  airQualityIndex: number     // raw AQI from OpenWeatherMap Air Pollution API: 1–5
}
```

**Flow / Reason:**
`useDataStore.fetchWeather()` → Edge Function `weather/index.ts` → OpenWeatherMap "current weather" API + Air Pollution API (called in parallel). When `lang=ko`, also calls OpenWeatherMap Geocoding reverse API to resolve Korean city name.

**Notes:**
- Coordinates rounded to 0.1 precision client-side for cache reuse.
- AQI mapping (1–5) is done **client-side** in `useDataStore` (1=Good, 2–3=Moderate, 4=Bad, 5=Very Bad). Raw index returned to allow custom mapping.
- `precipitation` is a 0–100 probability computed from cloud cover and rain/snow volume — not raw mm.
- Timeout: 25s.
- Cache key: `weather_{rLat}_{rLon}` (6-hour TTL — see Caching section).

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
    change: number,          // absolute change
    changePercent: string,   // percent change string, e.g. "+1.23%" or "-0.50%"
    type: string,            // "index" | "stock" | "etf" | "currency" | "commodity" | "unknown"
    currency: string,        // ISO code (e.g. "USD", "KRW") or ""
    error?: string           // present on failed/zero-price symbols; row still included with zeros
  },
  ...
]
```

**Flow / Reason:**
`useDataStore.fetchStocks({symbols})` → Edge Function `stocks/index.ts` → **TwelveData** (primary, for currencies and individual tickers; requires `TWELVEDATA_API_KEY` — returns HTTP 500 if unset) or **Yahoo Finance v8 chart API** (for indices and commodities defined in `YAHOO_SYMBOL_MAP`). `type` and `currency` auto-detected from response metadata.

**Notes:**
- Symbols normalized to uppercase.
- Yahoo symbol map (indices/commodities): `SP500→^GSPC`, `KOSPI→^KS11`, `NASDAQ→^IXIC`, `VIX→^VIX`, `DJI→^DJI`, `DXY→DX-Y.NYB`, `CRUDE→CL=F`.
- TwelveData handles: `USDKRW→USD/KRW` and all individual stock/ETF tickers.
- Failed or zero-price symbols return a zero-value row with an `error: string` field (not removed from the results array).
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
  exclude_domains?: string[],     // domains to exclude from results
  time_range?: string             // optional Tavily time filter
}
```

**Output:**
```ts
{
  answer: string | null,
  results: [                      // raw Tavily result objects (no image mapping in trends mode)
    {
      title: string,
      url: string,
      content: string,
      published_date: string | null,
      score: number | null
    },
    ...
  ],
  trends: string[]                // cleaned + deduped article titles (max 8) for fallback display
}
```

**Flow / Reason:**
`useDataStore.fetchTrends()` → Edge Function `tavily/index.ts` with `mode=trends` → Tavily Search API (advanced depth).

**Notes:**
- Returns up to 8 cleaned + deduped titles in `trends[]`; raw Tavily objects in `results[]` (no image field in trends mode).
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
  include_domains?: string[],     // KO_NEWS_DOMAINS in Korean mode
  exclude_domains?: string[]      // domains to exclude
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
      image: string | null,        // top images from Tavily response, mapped by index position
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

**Input (single query):**
```ts
{
  mode: "search",
  query: string,
  max_results?: number,
  include_domains?: string[],
  exclude_domains?: string[],
  search_topic?: string,     // overrides default "general"
  time_range?: string
}
```

**Input (batch):**
```ts
{
  queries: Array<{
    mode?: string,
    query: string,
    max_results?: number,
    include_domains?: string[],
    exclude_domains?: string[],
    search_topic?: string,
    time_range?: string
  }>
}
```

**Output (single):** Same shape as `mode=news` (answer + results array with images).

**Output (batch):**
```ts
{ batch: Array</* same shape as single output, or { error: string, results: [], answer: null } on per-query failure */> }
```

**Flow / Reason:**
Used internally by `aiService.ts` and `smart-widget` Edge Function for keyword-specific Tavily searches. Batch mode runs all queries in parallel server-side.

**Notes:**
- Same Tavily endpoint as news/trends, parameterized by `mode`.
- `search_topic` defaults to `"general"` when `mode=search` (vs `"news"` for `mode=news`).
- Batch mode: send `{ queries: [...] }` instead of a single query object → returns `{ batch: [...] }`.

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
  timeMin?: string,      // ISO datetime (explicit range; takes priority over date/todayOnly)
  timeMax?: string,      // ISO datetime
  todayOnly?: boolean,   // sets timeMin=now, timeMax=end of today
  date?: string,         // YYYY-MM-DD — single-day range (also used as event date in create/update)

  // For create / update:
  startTime?: string,    // HH:MM (24-hour); omit for all-day event
  endTime?: string,      // HH:MM; auto-set to startTime+1h if ≤ startTime
  timeZone?: string,     // IANA timezone string, default "UTC"
  allDay?: boolean,      // derived from absent startTime/endTime when not explicitly set
  title?: string,
  location?: string,
  description?: string,
  attendees?: Array<string | {
    email: string,
    displayName?: string,
    optional?: boolean,
    responseStatus?: string
  }>,
  visibility?: "default" | "public" | "private" | "confidential",
  availability?: "busy" | "free",
  remindersUseDefault?: boolean,   // default true
  reminderOverrides?: Array<{ method: "popup" | "email", minutes: number }>,
  addGoogleMeet?: boolean,         // creates a Google Meet link
  clearConference?: boolean,       // removes existing conference/Meet link
  recurrence?: string[],           // RRULE strings, e.g. ["RRULE:FREQ=WEEKLY"]
  sendUpdates?: boolean,           // notify guests on create/update (default false)

  // For read / update / delete:
  eventId?: string
}
```

**Output:**
```ts
// action: "list" → array; "create" | "update" | "read" → single object (same shape)
{
  id: string,
  title: string,
  start: string,                   // ISO datetime or YYYY-MM-DD (all-day)
  end: string,
  allDay: boolean,
  location: string | null,
  description: string | null,
  attendees: Array<{
    email: string | null,
    displayName: string | null,
    responseStatus: string,        // "accepted" | "declined" | "tentative" | "needsAction"
    optional: boolean
  }>,
  visibility: string,
  availability: string,            // "busy" | "free"
  meetLink: string | null,         // Google Meet URL if present
  addGoogleMeet: boolean,
  conferenceStatus: string | null, // conference creation status code
  remindersUseDefault: boolean,
  reminderOverrides: Array<{ method: string, minutes: number }>,
  recurrence: string[],
  recurringEventId: string | null,
  originalStartTime: string | null
}

// action: "delete" → { success: true, id: string }
```

**Flow / Reason:**
`useGoogleCalendarStore.fetchEvents() / addEvent() / updateEvent() / deleteEvent()` → token from `supabase.auth.getSession().provider_token` → Edge Function `events/index.ts` → Google Calendar API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/calendar`
- Single endpoint multiplexed by `action` parameter.
- `date` (YYYY-MM-DD) is required for `create`/`update`; `startTime`/`endTime` are `HH:MM` strings (not ISO datetime).
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
  token: string,             // Google OAuth provider_token
  action?: "list" | "create" | "update" | "delete" | "move" | "clearCompleted"
         | "listTaskLists" | "createTaskList",   // default "list"
  taskListId?: string,       // defaults to "@default"
  taskId?: string,
  title?: string,
  notes?: string,
  due?: string,              // ISO datetime
  status?: "needsAction" | "completed",
  completed?: boolean,

  // For move action (moves task between task lists):
  sourceTaskListId?: string,        // source list (default "@default")
  destinationTaskListId?: string,   // destination list

  // For list action:
  allTaskLists?: boolean,    // if true, fetches tasks from all task lists and merges
  showCompleted?: boolean,   // default true
  showHidden?: boolean       // default true
}
```

**Output:**
```ts
// action: "list" (or allTaskLists: true)
[
  {
    id: string,
    title: string,
    notes: string,
    due: string | null,
    status: "needsAction" | "completed",
    completed: boolean,
    completedAt: string | null,   // ISO datetime when task was completed
    updated: string | null,       // ISO datetime of last update
    hidden: boolean,
    deleted: boolean,
    taskListId: string
  },
  ...
]

// action: "create" | "update" | "move"  → single task object (same shape)
// action: "delete" | "clearCompleted"   → { success: true, id?: string }
// action: "listTaskLists"               → [{ id: string, title: string, updated: string | null }]
// action: "createTaskList"              → { id: string, title: string, updated: string | null }
```

**Flow / Reason:**
`useGoogleCalendarStore.fetchTasks() / addTask() / updateTask() / deleteTask()` → token from `supabase.auth.getSession().provider_token` → Edge Function `tasks/index.ts` → Google Tasks API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/tasks`
- `move` moves a task **between task lists** (not reordering within a list); uses `sourceTaskListId` / `destinationTaskListId`.
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
  sleep: number,        // hours (1 decimal place)
  calories: number,
  heartRate: number     // bpm (resting; 0 if no data)
}
```

**Flow / Reason:**
`useDataStore.fetchHealth()` → token from `supabase.auth.getSession()` → Edge Function `fitness/index.ts` → Google Fitness aggregate API.

**Notes:**
- Required Google OAuth scope: `https://www.googleapis.com/auth/fitness.activity.read` (restricted scope — annual CASA review required).
- Aggregated in 86,400s bucket (1 day, from midnight to now).
- On Google Fit error (e.g. 403 scope missing): Edge Function **throws** with the upstream HTTP status code. Client (`useDataStore`) applies graceful zeros fallback.
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
  keyword: string,         // user-defined widget keyword (required)
  persona?: {              // user context object (all fields optional)
    persona?: string,      // selected persona slug (from user_settings)
    age?: number | string,
    job?: string,
    interests?: string[]   // top fixed + dynamic interest keywords
  },
  token?: string,          // optional Google OAuth token (enables calendar/fitness routing)
  lat?: number,            // latitude (default 37.5665, for weather routing)
  lon?: number             // longitude (default 126.978)
}
```

> ⚠️ **Template correction:** Previously documented as `{ lat, lon, userInput }` then `{ keyword, persona, age, job, interests, location, language, token }`. Actual: `persona` is a **nested object**; location is flat `lat`/`lon`; no `language` field.

**Output:**
```ts
{
  keyword: string,
  emoji: string,           // representative emoji chosen by Groq
  lastUpdated: string,     // always "방금 전" (no server-side caching)
  sections: Array<
    | { type: "summary", title: string, bullets: string[] }       // exactly 3 bullets
    | { type: "trend",   title: string, tags: string[] }          // 3–6 tags
    | { type: "news",    title: string, items: Array<{ title: string, source: string, time: string, url: string }> }  // max 6
    | { type: "price",   title: string, items: Array<{ name: string, source: string, price: string, change: string }> }
  >,
  debug: {
    step0: { route: string, reason: string },
    step1?: { personaSummary: string, points: Array<{ label: string, query: string, reason: string }>, tags: string[] },
    pipeline: "step0-routed" | "step1-step2-search"
  }
}
```

**Flow / Reason:**
Invoked from `useWidgetStore.loadSmartWidget()`. Edge Function `smart-widget/index.ts` runs a 2-step pipeline:

1. **Step 0 — Route classification** (Groq JSON, `temperature: 0.3`): classifies keyword into one of 7 routes — `weather | stocks | calendar | fitness | trends | restaurants | none`.
   - Route ≠ `none`: calls the matching internal API → Groq formats result as sections → returns `pipeline: "step0-routed"`.
   - Route = `none`: falls through to Step 1.
2. **Step 1 — Research planning** (Groq JSON): generates 2 persona-tailored search points `{ label, query, reason }`.
3. **Step 2 — Tavily search + summarize** (Groq JSON): 2 parallel Tavily searches → Groq formats all results as sections → returns `pipeline: "step1-step2-search"`.

**Notes:**
- Groq `response_format: { type: "json_object" }` enforced at every step.
- No server-side caching; cache key `${keyword}` stored client-side in `useWidgetStore.smartWidgetData`.
- 7 routable types (not "17 categories"): `weather`, `stocks`, `calendar`, `fitness`, `trends`, `restaurants`, `none`.

---

## 11. Refresh Google Token *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/functions/v1/google-refresh` |
| **Auth** | 🔓 No auth required |

**Input:**
```ts
{
  refresh_token: string   // Google OAuth refresh token
}
```

**Output:**
```ts
{
  access_token: string,
  expires_in: number      // seconds until expiry (typically 3600)
}
```

**Flow / Reason:**
Used by `useAuthStore.ensureProviderToken()` as the final fallback in the 4-step token refresh chain:
1. Memory cache (`get().providerToken`)
2. `supabase.auth.getSession()` → check `provider_token`
3. `supabase.auth.refreshSession()` → check refreshed `provider_token`
4. **This endpoint** — calls Google's `oauth2.googleapis.com/token` server-side with `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars.

**Notes:**
- Secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) held server-side — never exposed to client.
- Returns HTTP 401 if Google rejects the refresh token (revoked or expired beyond refresh window).
- Returns HTTP 500 if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` env vars are not set.

---

# Supabase REST API (Database Tables)

All REST endpoints are accessed via the auto-generated PostgREST interface at `/rest/v1/{table}` with RLS enforced (users can only access rows where `auth.uid() = user_id` / `id`).

## 12. Read API Cache

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

**Flow / Reason:** `useDataStore.readApiCache()` → Supabase REST SELECT → check 6-hour TTL against `fetched_at` → cache hit returns state; cache miss proceeds to real API call.

**Notes:**
- Key format: `u:{userId}:{cacheKey}`.
- TTL: 360 minutes (6 h, enforced app-side via `CACHE_THRESHOLD_MS`, not DB).
- RLS: users can only access their own rows.

---

## 13. Write API Cache (UPSERT)

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

## 14. Get User Settings

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

## 15. Upsert User Settings

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST |
| **URL** | `https://<project>.supabase.co/rest/v1/user_settings` (header: `Prefer: resolution=merge-duplicates`) |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Input:** Partial of `user_settings` row (all setters call this in background).

**Notes:** UPSERT triggered by all setter actions in `useSettingsStore`, `useAuthStore.finishOB()`, etc.

---

## 16. Get Widget Layouts

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

## 17. Upsert Widget Layouts

POST to `/rest/v1/widget_layouts` with `Prefer: resolution=merge-duplicates`. Triggered by `useWidgetStore.handleLayoutChange / saveDraggedLayout / resetLayout`.

---

## 18. Manage Todos *(NEW — missing from template)*

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
  is_recurring: boolean,        // generated column (always equals is_fixed)
  created_at: timestamptz
}
```

**Flow:** `useTodoStore` — optimistic local update (temp ID) → DB upsert → temp ID replaced with real UUID.

---

## 19. Manage Smart Keywords *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/smart_keywords` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:** `{ id: uuid, user_id: uuid, keyword: string, created_at: timestamptz }` (UNIQUE on `user_id + keyword`).

**Flow:** `useWidgetStore` — keyword changes trigger DELETE all + INSERT new (full replace).

---

## 20. Manage Diaries *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / PATCH |
| **URL** | `https://<project>.supabase.co/rest/v1/diaries` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  id: uuid,
  user_id: uuid,
  date: date,                    // UNIQUE with user_id
  ai_generated_diary: text,      // AI-generated diary text (current write path)
  edited_diary: text,            // user-edited version (current write path)
  diary_text: text,              // legacy column — current client reads but does not write this
  memo: text,
  answers: jsonb,                // legacy [{question, answer}] array — current client reads but does not write this
  created_at: timestamptz,
  updated_at: timestamptz        // auto-updated by trigger
}
```

> ⚠️ **Code inconsistency:** `useDiaryStore` writes to `ai_generated_diary` / `edited_diary` but reads from the legacy `diary_text` / `answers` columns (`useDiaryStore.ts:695`). Both column sets exist in the live DB. New rows will have null `diary_text`.

**Flow:** `useDiaryStore.saveDiary() / saveGeneratedDiary() / saveMemo() / confirmRewrite()` → UPSERT on `(user_id, date)`.

---

## 21. Manage Q&A *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | GET / POST / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/user_qa` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:** `{ id: uuid, user_id: uuid, question: string, answer: string, asked_date: date, created_at: timestamptz }` (indexed on `(user_id, asked_date)`).

**Flow:** `useDiaryStore.addAnswer()` → INSERT new Q&A row.

---

## 22. Manage Briefing Snapshots *(NEW)*

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

## 23. Keyword Score Log *(NEW)*

| Field | Value |
|-------|-------|
| **Status** | ACTIVE |
| **Method** | POST / DELETE |
| **URL** | `https://<project>.supabase.co/rest/v1/keyword_score_log` |
| **Auth** | 🔒 Supabase JWT (RLS) |

**Row shape:**
```ts
{
  id: uuid,
  user_id: uuid,
  keyword: string,
  category: "food" | "place" | "content" | "shopping" | "lifestyle" | "mood" | "interest",
  source: "personal" | "diary",
  base_weight: number,        // 2 for personal Q&A, 1 for diary
  logged_date: date,
  created_at: timestamptz
}
```

**Flow:** Midnight batch (`runPersonalizationBatch`) → INSERT new keyword extractions, DELETE rows older than 30 days. Aggregated up to `user_settings.keyword_interests`.

---

# Supabase Auth *(NEW — missing from template)*

## 24. Sign in with Google (OAuth)

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

## 25. Get / Refresh Session

**Client APIs:**
- `supabase.auth.getSession()` — returns `{ data: { session }, error }` (reads from local Supabase auth state)
- `supabase.auth.refreshSession()` — explicit refresh; updates `provider_token` if Google access token expired

**Used by:** `useAuthStore.ensureProviderToken()` — 4-step chain: memory cache → `getSession()` → `refreshSession()` → Edge Function `#11 google-refresh`.

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

## 26. Sign Out

**Client API:** `supabase.auth.signOut()` — clears local auth state and revokes session on Supabase.

**Flow:** `useAuthStore.logout()` — clears local Zustand state immediately, then awaits `signOut()` to revoke server-side.

---

# Cross-Cutting Concerns

## Caching

| Layer | Storage | TTL | Used by |
|-------|---------|-----|---------|
| Memory | Module-level Map | 5 min (geo) | `_geoCache`, `_trendsMemCache` |
| localStorage | `mb_cache_{key}` | App-checked | Fallback when DB unavailable |
| DB | `api_cache` table | **6 h** (raised from 4 h — `CACHE_THRESHOLD_MS = 6 * 60 * 60 * 1000` per `useDataStore.ts:19`) | All Edge Function calls (weather, stocks, tavily, etc.) |

Cache keys are language-aware where appropriate: `news_{lang}_{interestFingerprint}`, `trends_full_{lang}`, `${keyword}` (Smart Widget).

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

This section documents the corrections made to `MorningBriefingAI_API_Design.xlsx` based on source code verification.

### Corrections (2026-05-22)

| # | API | Field | Template said | Actual (verified in source) |
|---|-----|-------|---------------|------------------------------|
| 6 | Generate Groq | Output | `{ content: STR }` | `{ text: string }` (`groq/index.ts:46`) |
| 6 | Generate Groq | Input | missing `temperature` | `temperature?: number` (default 0.4) |
| 7 | Events | URL note | "Google Calendar A" (truncated) | "Google Calendar API" |
| 8 | Tasks | Notes | "App metadata in notes as [MB_META]" | Legacy — stripped on read, no longer written (DOCS.md §5.8) |
| 10 | Smart Widget | Input | `{ lat, lon, userInput }` | `{ keyword, persona(object), token, lat, lon }` |
| 3 | Fetch Trends | Notes | "Returns 7 results" | Default 8 for trends; varies by `max_results` |
| 3 | Fetch Trends | Output | News-shape only | Also returns `trends: string[]` for fallback display |

### Additions (2026-05-22)

Endpoints 5, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 were not in the original template. Added: Tavily generic search mode, Upsert User Settings, Upsert Widget Layouts, all 6 missing Supabase REST tables (todos, smart_keywords, diaries, user_qa, briefing_snapshots, keyword_score_log), and 3 Supabase Auth client API calls.

### Updates 2026-05-29

| Area | Change | Reference |
|------|--------|-----------|
| Caching — DB layer | `api_cache` TTL extended to 6 h to cut Tavily token consumption. Cache key formats unchanged. | commit `86a34a8` (2026-05-23) |
| Briefing flow | `fetchTomorrowCalendar` / `fetchCalendar` switched to explicit local-time `timeMin` / `timeMax` ISO strings. No Edge Function signature change. | commit `5c7b7a6` (2026-05-24) |
| Source file extensions | Codebase-wide migration `.js`/`.jsx` → `.ts`/`.tsx`. All endpoint signatures unchanged. | commit `365b392` (2026-05-24) |
| Error handling | All Edge Function fetch wrappers now route through `src/utils/errorHandler.ts`. 25 s `AbortError` classified as transient timeout. | commit `7bb92c0` (2026-05-24) |

### Updates 2026-06-10

| Area | Change | Source |
|------|--------|--------|
| #1 Weather | Input: added `city?` and `lang?`. Output: `airQuality: string` → `airQualityIndex: number` (raw 1–5); new `conditionId: number\|null`; `precipitation` is 0–100 probability, not mm. AQI mapping moved client-side. | `weather/index.ts` |
| #2 Stocks | TwelveData is primary (not Yahoo); Yahoo only for indices/commodities. `changePercent` type: `number` → `string`. `type` adds `"commodity"`. Symbol map corrected: `DXY→DX-Y.NYB`, `USDKRW→USD/KRW` via TwelveData. Failed symbols return zero-row + `error` field. | `stocks/index.ts` |
| #3–5 Tavily | Added batch mode: `{ queries: TavilyQuery[] } → { batch: [...] }`. Added `exclude_domains?` param. Clarified `results` has no image mapping in trends mode. | `tavily/index.ts` |
| #7 Events | Input fully rewritten: `startTime`/`endTime` are `HH:MM` strings (not ISO); `date` required for create/update; 10 new fields. Output: `title` (not `summary`); attendees are objects; 11 new output fields including `allDay`, `meetLink`, `recurrence`, etc. | `events/index.ts` |
| #8 Tasks | Added actions: `listTaskLists`, `createTaskList`, `allTaskLists` flag. `move` corrected: between task lists (not reordering). Output adds `completedAt`, `updated`, `hidden`, `deleted`. | `tasks/index.ts` |
| #9 Fitness | Notes corrected: Edge Function throws on error; zeros fallback is client-side only. | `fitness/index.ts` |
| #10 Smart Widget | Fully rewritten. `persona` is a nested object. Output: `{keyword, emoji, lastUpdated, sections, debug}` — no `category`/`weather`. Section types: `summary/trend/news/price`. 7-route dispatcher pipeline (not "17 categories"). | `smart-widget/index.ts` |
| #11 NEW | Added `google-refresh` Edge Function. Used as final step in `useAuthStore.ensureProviderToken()`. | `google-refresh/index.ts` |
| #20 Diaries | Row shape corrected: `ai_generated_diary`/`edited_diary` are the current write columns; `diary_text`/`answers` are legacy read-only. Code inconsistency documented. | `schema.sql` + `useDiaryStore.ts` |
| #21 Q&A | Method updated: added DELETE (RLS policy exists). Added `created_at` to row shape. | `add_user_qa.sql` |
| Overview table | Renumbered: REST/Auth #11–25 → #12–26 to insert `google-refresh` as #11. | — |
| Caching TTL | History corrected: TTL raised from **4 h** (per `useDataStore.ts:19` code comment), not 60 min as previously stated. | `useDataStore.ts:19` |
