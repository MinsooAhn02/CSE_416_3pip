# MorningBriefing.AI — Developer Reference

> Last updated: 2026-05-22
> Single source of truth for architecture. Change log → [CHANGELOG.md](./CHANGELOG.md). Korean version → [DOCS_kor.md](./DOCS_kor.md).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [App Initialization Flow](#4-app-initialization-flow)
5. [State Management](#5-state-management)
6. [Caching Strategy](#6-caching-strategy)
7. [Widget System](#7-widget-system)
8. [Modals](#8-modals)
9. [Edge Functions](#9-edge-functions)
10. [Database Schema](#10-database-schema)
11. [Personalization Logic](#11-personalization-logic)
12. [Utilities / Hooks / Constants](#12-utilities--hooks--constants)
13. [Internationalization](#13-internationalization)
14. [Supabase Setup](#14-supabase-setup)
15. [Operations Checklist](#15-operations-checklist)
16. [Known Incomplete Items](#16-known-incomplete-items)
17. [Milestone 4 Compliance Gaps](#17-milestone-4-compliance-gaps)

---

## 1) Project Overview

**MorningBriefing.AI** is a browser new-tab dashboard that aggregates a user's daily context (weather, stocks, news, trends, calendar, health, diary/Q&A) into an AI briefing and a personal diary flow.

**Core goals:**
1. Surface relevant information on a single screen
2. Cache-first rendering to minimize perceived load time
3. Securely store per-user settings and data (RLS-isolated)
4. Personalized news + AI briefing based on user interests

**Core principles:**
1. API failures fall back to mock data — no UX breakage
2. User data isolation via Supabase Row-Level Security
3. Secret keys managed exclusively in Supabase Secrets (never in client code)

---

## 2) Tech Stack

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18 | UI framework |
| Vite | 6 | Build tool |
| Tailwind CSS | 3 | Styling |
| Zustand | 5 | State management |
| framer-motion | — | Animation |
| @hello-pangea/dnd | — | Drag-and-drop |
| i18next / react-i18next | — | Korean / English i18n |

### Backend / Infra

| Service | Purpose |
|---------|---------|
| Supabase (Auth, Postgres, Edge Functions) | Auth, DB, serverless API |
| OpenWeatherMap + Groq | Weather data |
| Twelve Data | Stock quotes |
| Tavily | News and trends |
| Google Calendar API | Calendar events and tasks |
| Google Fitness API | Health data (steps, sleep, calories) |
| Groq (LLM) | AI briefing generation, diary generation, keyword extraction |

---

## 3) Directory Structure

```text
src/
  App.jsx                         # App entry point, auth bootstrap, initialization
  constants/
    index.js                      # CATEGORIES, WIDGET_LIST, DEFAULT_VIS, DEFAULT_LAYOUTS
  components/
    common/
      ConfirmDialog.jsx
      DragHandle.jsx
      GooglePlacesLocationField.jsx
      TimeInput.jsx
      Toggle.jsx
      WidgetCard.jsx              # Shared card wrapper for all widgets
    layout/
      DashboardLayout.jsx         # 1:3:3 column layout with slide panel
      DatePanelContainer.jsx      # Events/Tasks/Diary container for selected date
      DiaryPanel.jsx
      EventPanel.jsx
      FixedButtons.jsx
      LoginScreen.jsx
      QuickLinks.jsx
      TaskPanel.jsx
      TopNav.jsx                  # Language toggle, settings button, profile
    modals/
      BriefSettingsModal.jsx
      DiaryListModal.jsx
      FirstLoginBriefingModal.jsx
      NewsDetailModal.jsx         # Currently unused — replaced by direct URL navigation
      OnboardingModal.jsx
      PINModal.jsx
      SettingsModal.jsx
      WidgetSettingsModal.jsx
    widgets/
      BriefingWidget.jsx
      CalendarWidget.jsx
      DiaryCard.jsx
      HealthWidget.jsx
      NewsWidget.jsx
      SmartWidgetContent.jsx
      StocksWidget.jsx
      TrendsWidget.jsx
      WeatherWidget.jsx
  hooks/
    useBriefingContext.js         # Shared briefing context builder (14 fields)
    useMidnightTrigger.js         # Runs once on login: diary synthesis + todo reset
    useTheme.js                   # Theme CSS class utilities
  l10n/
    i18n.js                       # i18next config, language-change event emission
    ko.json
    en.json
  lib/
    supabase.js                   # Supabase client initialization
  mock/
    data.js                       # Fallback data for API failures
  services/
    aiService.js                  # Groq LLM calls (briefing, diary generation, diary rewrite)
    diaryGenerationService.js     # Diary context builder + generateAndSaveDiaryForDate
  store/
    useAuthStore.js
    useBriefingHistoryStore.js    # Time-stamped briefing snapshots (localStorage + Supabase)
    useDataStore.js
    useDiaryStore.js
    useGoogleCalendarStore.js     # Google Calendar/Tasks sync + local fallback
    useQuickLinksStore.js
    useSettingsStore.js
    useTodoStore.js
    useWidgetStore.js
  utils/
    contentUtils.js               # cleanContent() — strips markdown/hashtags/SNS boilerplate
    date.js                       # formatLocalDate(), shiftDateString() — local-time date utils
    interests.js                  # Fixed + dynamic interest management utilities
    personaContext.js             # buildPersonaContext() for Groq prompts
    storage.js                    # load() / save() localStorage wrappers
    taskRecurrence.js             # Task date filtering and materialization

supabase/
  schema.sql                      # Base table definitions
  migrations/
    add_personalization.sql       # diaries, keyword_score_log, keyword_interests columns
    add_fixed_interests.sql       # fixed_interests, onboarding_perms columns
    add_user_qa.sql               # user_qa table
  functions/
    calendar/  events/  fitness/  groq/  smart-widget/
    stocks/    tasks/   tavily/   weather/
    kakao-places/                 # Unused (planned)
```

---

## 4) App Initialization Flow

### Phase 1 — Auth Bootstrap

```
mount
  └─ getSession() explicit call        ← prevents race condition
  └─ onAuthStateChange subscription
  └─ handleAuthChange(session)
  └─ authBootstrapDone = true
```

### Phase 2 — Post-Login Data Initialization

Condition: `isLoggedIn=true && user.id` present

```
hydrateFromDB() → parallel load of settings/widgets/todos/diary/briefingHistory
  └─ fetchAll({ useExistingCache: true })   ← cache-first, fast first render
  └─ AI follow-up (generateAiTodoOnLoad, etc.)
  └─ useMidnightTrigger → runs once: lazy diary synthesis for missed days + todo reset
```

Fallback: if `user.id` is delayed, runs `fetchAll()` solo after 1200ms timeout.

### Phase 3 — Periodic Refresh

| Trigger | Target | Mechanism |
|---------|--------|-----------|
| Tab visibility return | All | `visibilitychange` event (1-hour stale check) |
| 5-minute poll | All | `setInterval` (visible tab only) |
| Manual refresh | Individual widget | `force=true` bypasses cache |
| Language change | News + Trends + Smart Widget | `i18n.on("languageChanged")` module-level listener |
| Interest change | News only | `useSettingsStore.subscribe()` fingerprint diff |
| Midnight | Auto-diary synthesis | `useMidnightTrigger` — runs once on login |
| 1-hour auto | AI Briefing | `setInterval(60min)` in `BriefingWidget` |

---

## 5) State Management

Nine Zustand stores. All use localStorage for persistence unless noted.

### 5.1 useAuthStore

| Field | Type | Storage |
|-------|------|---------|
| `isLoggedIn` | boolean | localStorage |
| `onboarded` | boolean | localStorage |
| `user` | `{id, email, displayName, avatarUrl}` | memory |
| `providerToken` | string \| null | **memory only** (never localStorage — XSS risk) |
| `selCats` | string[] | DB (`user_settings.fixed_interests`) |
| `perms` | `{fit, cal}` | DB (`user_settings.onboarding_perms`) |
| `persona` | string | DB (`user_settings.persona`) |

**Key actions:** `login()` (Google OAuth, `prompt:"select_account"`, `access_type:"offline"`), `logout()`, `handleAuthChange(session)`, `ensureProviderToken()` (memory cache → `getSession()` → `refreshSession()`), `loadUserSettings()`, `finishOB()`.

---

### 5.2 useSettingsStore

| Field | Type | Storage |
|-------|------|---------|
| `theme` | `"dark"\|"light"` | localStorage |
| `bgImage` | string \| null | localStorage |
| `clockStyle` | `"digital"\|"analog"` | localStorage |
| `tempUnit` | `"c"\|"f"` | localStorage |
| `stockSymbols` | string[] | localStorage | User-added custom tickers (default `["KOSPI","NASDAQ","SP500","USDKRW"]`). |
| `fixedIndexSymbols` | string[] | localStorage | 8 hardcoded indices (`["SP500","KOSPI","NASDAQ","USDKRW","VIX","CRUDE","DXY","DJI"]`); user can drag-reorder in the modal but cannot add or remove. |
| `tone` | `"friendly"\|"formal"\|"casual"` | localStorage |
| `bLen` | `"short"\|"medium"\|"long"` | localStorage |
| `priorityOrder` | string[] | localStorage |
| `fixedInterestIds` | string[] | DB (`user_settings.fixed_interests`) |
| `keywordInterests` | `[{keyword, category, score}]` | DB (`user_settings.keyword_interests`) |
| `diaryLanguage` | `"app"\|"ko"\|"en"` | localStorage (`"app"` = follow i18n language) |
| `pinLockMode` | `"immediate"\|"off"\|"timed"` | localStorage + DB |

**Key actions:** `hydrateFromDB()`, `addKeywordInterest()`, `removeKeywordInterest()`, `bumpKeyword(keyword, category, delta)` (silent background, +delta to score; called on note save and Q&A answer save), `dismissFirstLoginModal()`. All setters → localStorage + DB upsert (`syncSettings()`).

---

### 5.3 useDataStore

| Field | Type | Description |
|-------|------|-------------|
| `weather` | `{temp, city, condition, precipitation, airQuality, humidity}` | null |
| `stocks` | `[{name, value, change, up}]` | Normalized stock data |
| `trends` | string[] | Fallback title cache for trends widget |
| `trendsResults` | `[{title, url, content}]` | Actual trend article data |
| `newsAnswer` | string \| null | Tavily news summary (briefing fallback) |
| `newsResults` | `[{title, url, content, image, published_date}]` | News data |
| `calEvents` | array | Today's calendar events |
| `healthData` | `{steps, stepsGoal, sleep, sleepGoal, calories, caloriesGoal, heartRate}` | |
| `fetchedLanguage` | `{news, trends}` | Language of last fetch |

**Fetch functions and cache keys:**

| Function | Endpoint | Cache Key |
|----------|----------|-----------|
| `fetchWeather(lat, lon, userId, force)` | `weather` | `weather_{rLat}_{rLon}` |
| `fetchStocks(symbols, userId, force)` | `stocks` | `stocks_{sym1}_{sym2}...` |
| `fetchTrends(userId, force)` | `tavily` | `trends_full_{lang}` |
| `fetchNews(userId, force)` | `tavily` × 2 (parallel) | `news_{lang}_{interestFingerprint}` |
| `fetchCalendar(userId, force)` | `calendar` | `calendar_today` |
| `fetchHealth(userId, force)` | `fitness` | `health_default` |
| `fetchTomorrowCalendar(userId, force)` | `events` (date param) | `calendar_{YYYY-MM-DD}` |

**News fetch detail:**
- 5 local + 5 global articles fetched in parallel and merged (max 10)
- Cache key: `news_${lang}_${interestFingerprint}`
- Top-5 interests inserted into query: EN `"Focus topics: kw1, kw2..."`, KO `"관심 주제: kw1, kw2..."`
- Korean mode: `include_domains: KO_NEWS_DOMAINS`, then `translateArticlesToKorean()` post-processes titles/content; translated payload backfilled to `api_cache`

**Korean article language filter:**
- `scoreArticleForLanguage(item, "ko")`: Hangul in title → high score; Hangul in content → medium score; KO domain host → bonus; none → -1 (rejected)
- `filterByAllowedDomains(items, lang)`: Hard domain filter — KO mode: `KO_NEWS_DOMAINS` only; EN mode: `EN_NEWS_DOMAINS` only

**Language-change listener (module level):**
```js
i18n.on("languageChanged", () => {
  clearFeedForLanguageSwitch();  // empties newsResults/trendsResults, sets loading=true
  fetchNews(userId, true);
  fetchTrends(userId, true);
});
```

---

### 5.4 useWidgetStore

| Field | Type | Storage |
|-------|------|---------|
| `vis` | `{[widgetId]: boolean}` | localStorage + DB |
| `layouts` | `{[breakpoint]: array}` | localStorage + DB |
| `smartKeywords` | string[] | localStorage + DB |
| `smartWidgetData` | `{[keyword_lang]: data}` (e.g., `"camera_en"`, `"카메라_ko"`) | localStorage |
| `widgetSettings` | `{[widgetId]: {viewType, interestsEnabled}}` | localStorage |
| `globalFontSize` | `"small"\|"medium"\|"large"` | localStorage |

**Key actions:** `loadSmartWidget(kw, force)`, `addSmartWidget / removeSmartWidget / refreshSmartWidget`, `setWidgetSetting()`, `setGlobalFontSize()`, `handleLayoutChange / saveDraggedLayout / resetLayout`.

Language change → all `smartKeywords` run `loadSmartWidget(kw, false)` (cache-first).

---

### 5.5 useDiaryStore

| Field | Type | Storage |
|-------|------|---------|
| `entries` | `{[date]: {diary, aiGeneratedDiary, editedDiary, notes, memo, feedback}}` | localStorage + DB |
| `diaryAnswers` | `{[date]: string[]}` | DB |
| `todayQA` | `[{question, answer}]` | DB |
| `pinSet` | boolean | localStorage |
| `isPinAuthenticated` | boolean | session memory |

**`feedback` field structure:**
```js
{
  rating: "like" | "dislike" | null,
  history: [{ at: ISO, text: string }],  // cumulative feedback
  pendingRewrite: string | null,          // pre-confirmation rewrite preview
  confirmedAt: ISO | null,
}
```

**Key actions:** `setPIN / verifyPIN` (Web Crypto SHA-256 hash), `saveGeneratedDiary(date, text)` (sets `aiGeneratedDiary` + `diary`, clears `editedDiary`), `applyFeedbackRewrite(date, feedbackText, language)` → Groq → `pendingRewrite`, `confirmRewrite(date)` (irreversible — overwrites `diary` + DB sync), `discardPendingRewrite(date)`.

---

### 5.6 useBriefingHistoryStore

**Snapshot structure:**
```js
{ capturedAt: ISO, source: "auto"|"refresh", text: string, summary: string, sections: array }
```

**Save policy (`shouldSave`):** `source === "refresh"` → always save; first save of the day → save; ≥3 hours since last save → save.

**Key actions:** `addSnapshot()` (localStorage + Supabase `briefing_snapshots`), `getSnapshotsForDate(date)`, `clearDate(date)` (called after diary synthesis completes).

---

### 5.7 useTodoStore

**State:** `todos: [{id, text, completed, isFixed}]` (localStorage + DB)

**Key actions:** `ensureDailyReset()` (deletes non-fixed todos on date boundary, resets fixed todos to incomplete), `addAiTodos(aiTodos)` (bulk add with lowercase dedup), optimistic update (local-first → DB upsert with UUID swap).

---

### 5.8 useGoogleCalendarStore

**State:** `events`, `tasks`, `taskLists`, `selectedDate`, `loading`, `error`

**Key actions:** `fetchEvents()` (month-scoped, fails → local cache fallback), `fetchTasks()`, `addTask / updateTask / deleteTask` (Google Tasks API — `title`, `notes`, `due`, `completed`, `taskListId`).

Legacy `[MB_META]...[/MB_META]` task metadata is stripped on read; no longer written.

---

### 5.9 useQuickLinksStore

**State:** `links: [{id, name, url, icon, color}]` (localStorage). Defaults: Naver, YouTube, Instagram, Google.

---

## 6) Caching Strategy

### Cache layers

```
1. Memory cache  : Geolocation (GEO_CACHE_MS = 5 min)
                   Trends in-memory map (_trendsMemCache) — checked before DB
2. localStorage  : mb_cache_{key} (fallback when DB unavailable)
3. DB cache      : api_cache table (6-hour TTL, app-level check via CACHE_THRESHOLD_MS)
```

### Cache key patterns

| Data | Cache Key |
|------|-----------|
| Weather | `weather_{rLat}_{rLon}` |
| Stocks | `stocks_{sym1}_{sym2}_...` |
| Trends | `trends_full_{lang}` |
| News | `news_{lang}_{interestFingerprint}` |
| Calendar | `calendar_today` |
| Health | `health_default` |
| Smart Widget | `${keyword}_${lang}` (e.g., `camera_en`) |

`interestFingerprint` = top-5 interest keywords joined with `"+"`, or `"base"` if none.

### Standard fetch pattern

```
1. Compute cacheKey
2. If force=false → check readApiCache (DB, 6-hour TTL)
3. Cache hit → update state, return (markFetched(key, fetchedAt))
4. Cache miss → call Edge Function (25s timeout)
5. Success → normalize + writeApiCache + update state + apiStatus="ok"
6. Failure → record error + mock fallback + apiStatus="error"
```

### Auto-refresh triggers

| Trigger | Scope | Mode |
|---------|-------|------|
| Language change | News + Trends + Smart Widget | `force=false`, per-language cache key (reuses same-language cache within 6h) |
| Interest change | News only | `force=true`, fingerprint-diffed subscription |
| Tab visibility return | All | `force=false`, 6-hour stale check |
| 5-minute poll | All | `force=false` |
| Manual refresh button | Individual widget | `force=true` |

---

## 7) Widget System

### 7.1 Layout (DashboardLayout)

```
┌──────────────┬──────────────────────────────┬──────────┐
│  Col A (30%) │        Col B (50%)           │ Col C    │
│              │                              │  (20%)   │
│ BriefingWidget│  CalendarWidget            │ Weather  │
│ DiaryCard    │  (calendar + Events + Tasks) │ Stocks   │
│              │                              │ Trends   │
│              │                              │ Health   │
│              │                              │ News     │
│              │                              │ Smart*   │
└──────────────┴──────────────────────────────┴──────────┘
```

- Col A: `flex: 3`, `height: calc(100vh - 6rem)` (Briefing 3/5 + Diary 2/5 vertical split)
- Col B: `flex: 5`, Calendar sticky (unsticky when PIN modal is active)
- Col C: `width: 20%` fixed, hidden/shown via `width/max-width/opacity` CSS transition (0.38s cubic-bezier)
  - When Col C is closed: Col A/B expand at 37.5%:62.5%
- **Scroll policy**: No global `wheel` capture — scroll behavior managed via column `overflow`/`height` CSS only

### 7.2 WidgetCard (shared)

- Header: drag handle + manual refresh + close button
- Refresh icon click → individual `force=true` fetch
- Close → `closeWidget(widgetId)` (vis=false)
- Shows `apiStatus` ok/error indicator

### 7.3 Per-Widget Reference

#### NewsWidget

- Data: `newsResults [{title, url, content, image, published_date}]`
- View types: `"text"` | `"news"` | `"grid"` (controlled by `widgetSettings.news.viewType`)
- Default item counts by font size:

  | fontKey | text | news | grid |
  |---------|------|------|------|
  | small | 5 | 5 | 9 |
  | medium | 4 | 4 | 6 |
  | large | 3 | 3 | 3 |

- "More" → `NewsAllModal` (grid, max 10 items) via `createPortal`
- Click → direct URL navigation (`<a target="_blank">`)
- Content cleaned with `cleanContent()` before display

#### TrendsWidget

- Data: `trendsResults [{title, url, content}]` (primary). `trends` string[] is fallback title cache only.
- Default display: small=2, medium/large=3. "More" → inline expand up to 6. "Less" collapses.
- Pill layout, `line-clamp-2`. No interest personalization — global/domestic real-time trends only.

#### WeatherWidget

- Data: `weather {temp, city, condition, precipitation, airQuality, humidity}`
- Temperature unit toggle (C/F). Shows humidity%, precipitation%, air quality in a 3-column grid.

#### StocksWidget

- Data: `stocks [{symbol, name, value, change, up, type?, currency?}]`
- **Widget body layout** (`grid-cols-2`): top row = first 2 entries of `fixedIndexSymbols` (placeholder cards while loading); `<hr>` separator; bottom = up to 4 user stocks from `stockSymbols`. "View More" button surfaces the unified modal when user stocks exceed 4.
- **Unified modal** (+ icon, two sections separated by `<hr>`):
  - **Major Indices** — all 8 entries from `fixedIndexSymbols`; drag-to-reorder only (no add/delete; reorder persists to localStorage via `setFixedIndexSymbols`).
  - **My Stocks** — ticker input (Enter or Add button), drag-to-reorder grid (@hello-pangea/dnd), X-to-delete with ConfirmDialog (optimistic dismiss — closes before the network call resolves).
- **Currency/type detection** (`getCurrency`, priority order):
  1. `s.type === "index"` → `"Index"` (no symbol prefix); `s.type === "currency"` → `"Rate"` (no symbol prefix)
  2. `s.currency` code → `CURRENCY_SYMBOL` map (USD→`$`, KRW→`₩`, JPY→`¥`, EUR→`€`, GBP→`£`, CNY→`¥`, HKD→`HK$`)
  3. Legacy fallback: `LEGACY_INDEX_SYMBOLS` set (KOSPI/NASDAQ/SP500/VIX/DXY/DJI), `LEGACY_RATE_SYMBOLS` set (USDKRW)
  4. Name contains `"KRW"` → KRW; default → USD
- **Ticker validation**: strict — `validateStockSymbol` returns true only when Edge response has `price > 0`. Garbage tickers (e.g. `KOSDAQ`, `ZZZZ`) → Edge returns `price: 0` → UI shows "Invalid ticker: {symbol}". Adding a symbol that is already a fixed index or already in `stockSymbols` silently clears the input.
- **Fetch trigger**: widget mounts → `fetchStocks([...fixedIndexSymbols, ...normalizedStockSymbols])`; `fetchAll` in `useDataStore` unions the two lists; adding/removing user stocks triggers a forced refetch of the combined list.
- **Edge Function fetch strategy** (`supabase/functions/stocks/index.ts`):
  1. TwelveData (primary) — returns `type`, `currency` fields from Twelve Data JSON response
  2. Yahoo Finance v7/v8 (secondary) — returns `quoteType`/`instrumentType` + `currency`
  3. Stooq CSV fallback — no metadata, returns `type: "unknown", currency: ""`
  4. USD/KRW exhausted → `open.er-api.com` fallback
- ⚠️ After modifying `supabase/functions/stocks/index.ts`, redeploy manually via Supabase Dashboard

#### HealthWidget

- Data: `healthData {steps, stepsGoal, sleep, sleepGoal, calories, caloriesGoal, heartRate}`
- Steps (green progress bar) + sleep (indigo progress bar) + heart rate / calories / water cards

#### CalendarWidget

- Data: `calEvents` (today's events via `useGoogleCalendarStore`)
- Calendar grid with event indicators and blue dots for diary days
- **3-level header drill-down**: month → year (3×4 grid) → decade (3×4 grid). Arrow keys navigate level-appropriate units. `Today` button returns to current month.
- Month/week/day view toggle auto-closes open Date Details panel.

#### BriefingWidget

- Data inputs: weather, stocks, trends, calEvents (future-only), tomorrowEvents, todos, newsResults, trendsResults, smartSummaries, keywordInterests, fixedInterestIds, persona
- **Deterministic sections + narrow AI augmentation** pattern (`aiService.generateDetailedBriefing`):
  - JS controls section structure and order; Groq called for 2 tasks only (`temperature: 0.1`)
  - 2 parallel Groq calls: diary rewrite, article batch summary (news + trends). Smart keyword block built directly in JS — no Groq call.
- **Section order:**
  1. `header` — Date + weather in one line
  2. `schedule` — Morning (5–12): today's events; Afternoon/evening (≥12): remaining today + tomorrow events. Tomorrow events fetched via explicit local-timezone `timeMin/timeMax` (not UTC-bound `date`), always fetched after login regardless of calendar widget visibility.
  3. `yesterday` — Yesterday's diary rewritten to 1–2 past-tense sentences (Groq #1)
  4. `latest_info` — sub-blocks: `latest_smart` (one hyperlinked latest article per smart keyword, with `[keyword]` prefix), `latest_news` (Top 3 news + AI 1-sentence summary + link), `latest_trends` (Top 3 trends + AI 1-sentence summary + link)
- **Return shape:** `{ summary, detail, sections, timeMode }`. `sections: [{id, title, lines, subBlocks?}]`
- `section.lines` is polymorphic: `string` (plain text) | `{title, url, summary, source, keyword?}` (news/trends/smart article)
- Auto-saves snapshot to `useBriefingHistoryStore` (3-hour interval or on manual refresh)
- Language change → `briefingVersions` cache cleared → immediate re-generation

#### DiaryCard

- Data: Today's Q&A question + `diaryAnswers[today]`
- PIN-gated
- `fixedInterestIds` → `generatePersonalizedQuestion()` → 1 interest topic + 1 general topic mixed
- Answer save → keyword extraction → `bumpKeyword(kw, "qa", 5)` (score +5 per keyword)
- `questionCacheRef = useRef({ko, en})`: language-switch uses cached question, no extra API call

#### DiaryPanel

- Displays diary + inline editing + memo editing
- **Feedback UI**: Like/Dislike buttons when diary exists → Dislike → feedback text + "Rewrite" → `applyFeedbackRewrite()` → Groq → `pendingRewrite` preview → "Confirm" (irreversible) or "Cancel"
- Memo save → keyword extraction → `bumpKeyword(kw, "note", 10)` (score +10 per keyword)

---

### 7.4 Smart Widget

**ID format:** `smart_{keyword}`

**Cache key:** `${keyword}_${lang}` (language-isolated storage in `useWidgetStore.smartWidgetData`)

**Category taxonomy:**

| Category | Content focus |
|----------|---------------|
| `shopping` | Product info, reviews, price/deals |
| `streetwear` | Brand info, collabs, drops |
| `chains` | Brand info, latest updates, local stores |
| `food` | Nutrition, recipes, restaurants |
| `camera` | Camera info, sales, shooting tips |
| `beauty` | Products, sales, tips |
| `books` | Reviews, similar recommendations |
| `sports` | Updates, equipment, training tips |
| `finance` | Market news, comparisons, checklists |
| `health` | Key info, routine tips, research |
| `education` | Learning paths, practical tips |
| `automotive` | Reviews/specs, price/buying, maintenance tips |
| `tech` | Reviews/specs, deals, comparisons, tips |
| `travel` | Guides, destinations, booking/deals |
| `entertainment` | Key info, releases, reviews/reactions |
| `person` | Profile, latest articles |
| `general` | Key info, latest updates |

**Search/filter policy:**
- All section results require the keyword in the article title
- Multi-word keywords: full keyword or all major words must appear in title
- Person keywords: prioritize results containing the full name in title
- Blog section: blog domain results only
- Video section: YouTube domain results only
- `Latest Updates / Latest Coverage`: news search first; fallback to non-recency-filtered search if no results
- Korean mode: Korean results and Korean sites prioritized
- English mode: English results prioritized

**UI policy:**
- No `Personalized Search` / `맞춤 검색` summary section at top
- Card-first layout: title, source, image, open link
- Empty-state message when no results
- Language mismatch (keyword script ≠ language mode) → informational notice

**Rendering:**
- Two rendered sections: `type === "summary"` (Groq bullets, 3–4 items) + `type === "news"` (2–3 related news, opens in new tab)
- Section title determined at render time from `section.type` + current i18n language — cached value not trusted (prevents stale English titles in Korean mode)

**Fetch flow:**
1. Category classification via Groq
2. Tavily search by section plan
3. `filterSmartResults(items, isKo)`: Hangul/Latin regex language detection; if ≥1 result matches language → return that language only; 0 results → full fallback
4. Korean mode: `include_domains: KO_NEWS_DOMAINS` fallback if <2 Korean results (deduped merge)
5. Groq bullets: if no Korean characters in output → request re-translation (1 extra call); only validated Korean items accepted

**Key files:**
- `src/services/aiService.js`: category classification, section planning, Tavily search, filtering
- `src/store/useWidgetStore.js`: smart widget state, cache, category override
- `src/components/widgets/SmartWidgetContent.jsx`: widget UI, keyword editing, category dropdown, card rendering

---

## 8) Modals

| Modal | Role |
|-------|------|
| `OnboardingModal` | Initial category selection, persona selection, permission toggles |
| `SettingsModal` | Theme, clock, temp unit, stock symbols, priority order, diary language/PIN lock |
| `BriefSettingsModal` | AI briefing tone + length selection |
| `FirstLoginBriefingModal` | First daily login briefing display — today's date recorded to prevent re-display |
| `WidgetSettingsModal` | News view type (text/news/grid), Smart Widget interest toggle |
| `PINModal` | Diary access PIN input/confirmation |
| `DiaryListModal` | Browse diary entries by date |
| `NewsDetailModal` | **Currently unused** — replaced by direct URL navigation |
| `NewsAllModal` (inline) | NewsWidget "More" → full news grid via `createPortal` (defined inside `NewsWidget.jsx`) |
| `StocksViewAllModal` (inline) | StocksWidget "View More" → read-only full ticker grid (defined inside `StocksWidget.jsx`) |

---

## 9) Edge Functions

🔒 = Supabase JWT required (`Authorization: Bearer {user_access_token}`)

| Function | Endpoint | Auth | Input | Output |
|----------|----------|------|-------|--------|
| `weather` | `/functions/v1/weather` | — | `{lat, lon}` | `{temp, city, condition, humidity, precipitation, airQuality}` |
| `stocks` | `/functions/v1/stocks` | — | `{symbols: string[]}` | `[{symbol, price, change, changePercent, type, currency}]` — `type`: `"index"\|"stock"\|"etf"\|"currency"\|"unknown"`; `currency`: ISO code (e.g. `"USD"`, `"KRW"`) or `""`. Supported internal symbols: `KOSPI`, `NASDAQ`, `SP500`, `USDKRW`, `VIX`, `CRUDE` (WTI, → `USOIL`/`CL=F`), `DXY` (Dollar Index, → `DX=F` on Yahoo), `DJI`. Other tickers pass through to Twelve Data / Yahoo / Stooq as-is. |
| `tavily` | `/functions/v1/tavily` | — | `{query, mode, max_results, location?, include_domains?}` | News: `{answer, results, location}` / Trends: `{trends, answer, results}` |
| `groq` | `/functions/v1/groq` | — | `{system, prompt, model?, temperature?}` | `{text}` — `Content-Type: application/json; charset=utf-8` |
| `events` 🔒 | `/functions/v1/events` | JWT | `{token, action?, ...}` | Google Calendar CRUD. `action`: `list` (default) / `create` / `update` / `delete` / `read` |
| `tasks` 🔒 | `/functions/v1/tasks` | JWT | `{token, action?, taskListId?}` | Google Tasks CRUD. `action`: `list` / `create` / `update` / `delete` / `move` / `clearCompleted` |
| `fitness` 🔒 | `/functions/v1/fitness` | JWT | `{token}` | `{steps, sleep, calories, heartRate}` |
| `smart-widget` 🔒 | `/functions/v1/smart-widget` | JWT | `{keyword, persona, token?, ...context}` | Personalized content structure |
| `kakao-places` | `/functions/v1/kakao-places` | — | `{query, lat, lon}` | Place search results (currently unused) |

**JWT auth:** Client sends `supabase.auth.getSession()` → `session.access_token` in Authorization header. Server validates with `supabase.auth.getUser(jwt)` → 401 on failure.

**Tavily Edge Function internals:**
- `cleanTitle(raw)`: strips `"- SiteName"` suffixes and markdown characters
- Trends mode: returns article titles directly as `trends[]` (no `toHashtag()`)
- `include_domains` parameter passed conditionally (omitted if empty array)

---

## 10) Database Schema

> Full DDL is in `supabase/schema.sql` and `supabase/migrations/`. This section is a summary.
> **Note:** From 2026-05-30, Supabase stops auto-granting permissions on new tables. All SQL files include explicit `GRANT` blocks.

### Core tables (schema.sql)

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `user_settings` | `id` (= `auth.users.id`) | All per-user preferences and personalization data |
| `widget_layouts` | `id` | Per-user widget grid positions (`{lg, md, sm}` breakpoints) |
| `todos` | `id` | Daily todo items; `is_fixed`, `is_recurring` (generated column) |
| `smart_keywords` | `id`, UNIQUE(`user_id`, `keyword`) | Smart widget keyword list |
| `api_cache` | `id` (text, e.g. `u:{userId}:news_KR_ko_base`) | 1-hour TTL external API response cache |

**`user_settings` notable columns:**
```sql
keyword_interests     jsonb default '[]'   -- [{keyword, category, score}]
fixed_interests       jsonb default '[]'   -- onboarding category ID array
onboarding_perms      jsonb default '{"fit": false, "cal": false}'
pin_lock_mode         text  default 'immediate'  -- "immediate" | "off" | "timed"
```

### Migration tables

| Table | File | Purpose |
|-------|------|---------|
| `diaries` | `add_personalization.sql` | Per-user diary entries with notes, answers, memo |
| `keyword_score_log` | `add_personalization.sql` | Raw interest keyword scoring events (30-day window) |
| `user_qa` | `add_user_qa.sql` | Daily Q&A question/answer pairs |
| `briefing_snapshots` | (optional, app-level) | Time-stamped briefing snapshots for diary synthesis |

### RLS policies

All tables: `auth.uid() = user_id` (or `= id` for `user_settings`), with SELECT/INSERT/UPDATE/DELETE policies.

### Triggers

`update_updated_at()`: auto-updates `updated_at` on `user_settings`, `widget_layouts`, `diaries`.

---

## 11) Personalization Logic

### 11.1 Purpose

Extract and accumulate interest keywords from Q&A answers to improve news query quality and AI briefing personalization.

### 11.2 Keyword extraction rules

1. AI (Groq) output: JSON array only
2. `category` must be one of: `food | place | content | shopping | lifestyle | mood | interest`
3. `keyword` normalized to searchable noun form
4. Invalid categories and empty keywords discarded

### 11.3 Score calculation (30-day window)

```
score = Σ(base_weight × (30 - elapsed_days) / 30)  where elapsed_days < 30
```

- Personal Q&A: `base_weight = 2`
- Diary: `base_weight = 1`

### 11.4 Processing flow

```
Daily Q&A/diary collection (source = "personal" | "diary")
  └─ Midnight batch (runPersonalizationBatch via useMidnightTrigger)
  └─ AI → JSON keyword array
  └─ Insert into keyword_score_log
  └─ Aggregate → update user_settings.keyword_interests
  └─ Purge logs older than 30 days
```

### 11.5 News query injection

On `fetchNews`:
1. Merge `fixedInterestIds` + `keywordInterests`
2. Sort by score desc, take top 5
3. Insert into query: EN `"Focus topics: kw1, kw2..."`, KO `"관심 주제: kw1, kw2..."`
4. `interestFingerprint = topKeywords.join("+") || "base"` → included in cache key

Trends: no interest injection — global/domestic real-time trends only.

### 11.6 Interest application scope

| Touchpoint | Mechanism | File |
|------------|-----------|------|
| News query | Top-5 keywords inserted into Tavily query | `useDataStore.js` |
| Simple AI briefing | `keywordInterests` → `Interest guidance:` line in Groq prompt | `aiService.generateBriefing()` |
| Diary Q&A question | `fixedInterestIds` → `INTEREST_TOPIC_MAP` → 1 interest + 1 general topic | `aiService.generatePersonalizedQuestion()` |
| Auto diary generation | `interests` + `briefingSnapshots` + `previousDayDiary/Feedback` → `promptContext` | `aiService.generateDiary()` |
| Persona context | `fixedInterestIds` + `keywordInterests` merged → `interests[]` | `personaContext.buildPersonaContext()` |
| Q&A answer save | Token extraction → `bumpKeyword(kw, "qa", 5)` | `DiaryCard.jsx` |
| Note save | Token extraction → `bumpKeyword(kw, "note", 10)` | `DiaryPanel.jsx` |

### 11.7 Diary generation flow

```
New day, first login
  └─ useMidnightTrigger (runs once on mount)
  └─ recoverMissedDiaries(): iterates skipped dates from lastAccess → today
      └─ For each date: useBriefingHistoryStore.getSnapshotsForDate(date)
          ├─ 0 snapshots → skip (no access that day)
          └─ Snapshots present → generateAndSaveDiaryForDate(date, { briefingSnapshots })
              └─ buildDiaryGenerationContext():
                  - briefingSnapshots: time-stamped texts (max 6, first 200 chars each) + up to 8 `[Headlines]` lines extracted from `snapshot.sections.latest_info` (news + trends + smart titles)
                  - previousDayDiary: prior day diary (max 400 chars)
                  - previousDayFeedback: prior day cumulative feedback (max 200 chars)
              └─ aiService.generateDiary() → Groq → diaryText
              └─ useDiaryStore.saveGeneratedDiary(date, diaryText)
              └─ useBriefingHistoryStore.clearDate(date)
```

**Diary language resolution:**
```
resolveDiaryGenerationLanguage()  [diaryGenerationService.js]
  1. useSettingsStore.diaryLanguage === "ko"|"en" → explicit setting wins
  2. Otherwise → i18n.language → "en"/"ko" mapping
```

**Diary rewrite flow (feedback):**
```
DiaryPanel → Dislike
  └─ feedbackText + "Rewrite"
  └─ applyFeedbackRewrite(date, feedbackText, language)
      └─ baseline = aiGeneratedDiary (immutable)
      └─ Append to feedbackHistory
      └─ rewriteDiaryWithFeedback({ baseline, feedbackHistory, language }) → Groq
      └─ feedback.pendingRewrite = result
  → "Rewrite again": same baseline + accumulated feedbackHistory
  → "Confirm" → ConfirmDialog → confirmRewrite(date) → diary = pendingRewrite → DB sync
  → "Cancel" → discardPendingRewrite → pendingRewrite = null
```

---

## 12) Utilities / Hooks / Constants

### src/utils/

| File | Exports |
|------|---------|
| `contentUtils.js` | `cleanContent(text)`: strips markdown headers/bold/italic/links, hashtags, "follow us/subscribe/sign up/newsletter/click here", normalizes line breaks |
| `storage.js` | `load(key, fallback)`, `save(key, value)`: localStorage wrappers |
| `date.js` | `formatLocalDate()` (YYYY-MM-DD in local time), `shiftDateString(date, days)` |
| `interests.js` | `normalizeFixedInterestIds()`, `buildFixedInterests(ids)`, `mergeInterestLists(fixedIds, dynamicInterests)`, `getTopInterestKeywords()`, `getInterestFingerprint()`. 8 fixed IDs: `news·tech·fashion·finance·health·food·entertainment·sports` |
| `taskRecurrence.js` | `doesTaskOccurOnDate()`, `isTaskCompletedOnDate()`, `materializeTasksForDate()`, `getTaskDisplayDate()` |
| `personaContext.js` | `buildPersonaContext(fixedInterestIds, keywordInterests, persona)` — merged interest list for Groq prompts |

### src/hooks/

| Hook | Role |
|------|------|
| `useBriefingContext` | Subscribes to all stores, returns `buildContext()` — used by both `BriefingWidget` and `FirstLoginBriefingModal` for identical 14-field context |
| `useMidnightTrigger` | Runs once on login (after hydrate complete). Lazy diary synthesis for missed days + todo reset. No midnight polling. |
| `useTheme` | Returns theme CSS classes: `isDark, cardCls, listItemBgCls, secondaryBgCls, muted, hoverCls, borderCls` |
| `useFontSize(multiplier?)` | Subscribes to `globalFontSize`. Returns `{body, title, key}` inline style objects. body: S=10/M=12/L=14px; title: S=12/M=14/L=16px. `multiplier` defaults to 1.0; BriefingWidget modal uses 1.2. |

### src/constants/

| Constant | Content |
|----------|---------|
| `CATEGORIES` | 8 categories: news, tech, fashion, finance, health, food, entertainment, sports |
| `FIXED_WIDGETS` | Left fixed: briefing, diary / Right fixed: calendar, todo |
| `STANDARD_WIDGETS` | weather, stocks, trends, health, news, smart |
| `DEFAULT_VIS` | Default widget visibility map |
| `DEFAULT_LAYOUTS` | Default grid positions for lg/md/sm breakpoints |
| `DEFAULT_PRIORITY_ORDER` | Default center column widget order |

---

## 13) Internationalization

- **Supported languages:** English (`en`, default), Korean (`ko`)
- **Storage:** Language setting persisted in localStorage
- **Language switch:** `i18n.changeLanguage()` → emits `languageChanged` event → `useDataStore` listener refetches news/trends (cache-first, per-language cache keys)
- **Korean article post-processing:** Even when Tavily returns English titles for Korean-domain articles, `translateArticlesToKorean()` post-processes `title`/`content` before storing in `newsResults`/`trendsResults`. Translated payload is backfilled to `api_cache` so future cache hits also return Korean text.
- **Trends warm-up:** `warmupTrendsMemCache()` pre-loads both language caches at login. If Korean cache has an untranslated payload, it skips loading so `fetchTrends` takes the translate-and-backfill path.
- **Diary question card:** Question generated in current app language; cached per language (`{ko: "...", en: "..."}`) to avoid redundant API calls on language switch.
- **Smart Widget titles:** Section titles (`"맞춤 검색"` / `"Personalized Search"`) determined at render time from `section.type` + current `i18n.language` — cached title string not trusted.
- **API integration:** Tavily query language + Korean news domain filter applied based on current language.

---

## 14) Supabase Setup

### Required environment variables

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

Share `.env.example` only — never commit actual keys.

### Google OAuth scopes

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/tasks
https://www.googleapis.com/auth/fitness.activity.read
```

### Security principles

1. Third-party API keys managed in Supabase Secrets only
2. No hardcoded secrets in client code
3. RLS on all tables for user data isolation
4. Google OAuth token in memory (Zustand) only — never localStorage
5. Edge Functions for user data (events/tasks/fitness/smart-widget) require Supabase JWT validation
6. Diary PIN: SHA-256 hashed before storage — no plaintext
7. All table `GRANT` statements explicitly written in SQL files (Supabase auto-grant ends 2026-05-30)

### Cloudflare Workers deployment

**`wrangler.jsonc` (repo root) required:**
```jsonc
{
  "name": "morningbriefing",
  "compatibility_date": "2026-05-13",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

`not_found_handling: "single-page-application"` ensures OAuth callbacks (`/?code=xxx`) and deep links serve `index.html` instead of 404.

**Deploy sequence (order matters):**
```powershell
npm run build      # injects VITE_* values into bundle
npx wrangler deploy
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are hardcoded into the JS bundle at build time. Cloudflare Workers runtime does not read `.env`. Running `wrangler deploy` without `npm run build` first deploys a stale bundle.

**GCP OAuth app verification:**
- App remains in **Testing** status — full verification deferred (academic project). Calendar/Tasks (sensitive) + Fitness (restricted) scopes each require separate Google review; Fitness additionally requires an annual CASA Tier 2 security assessment.
- All users see an "unverified app" warning on first login. **Workaround:** click **Advanced → Continue (unsafe)**. See README §Testing → "Google sign-in warning" for full instructions.

---

## 15) Operations Checklist

### Pre-deploy

1. Confirm all environment variables are set
2. Verify Auth/DB/RLS policies are in place
3. Confirm Edge Functions are deployed (especially `stocks`, `groq` after recent changes)
4. Confirm all migrations have been run (`add_personalization.sql`, `add_user_qa.sql`, `add_fixed_interests.sql`)

### Runtime verification

1. Widgets render immediately after login
2. Manual refresh (`force=true`) works per widget
3. News/trends item click → external URL opens
4. Language toggle → correct-language results reload
5. Interest change → news auto-reloads
6. Calendar/panel/PIN flow
7. Midnight trigger → todo reset + personalization batch

### Incident triage

1. Is `handleAuthChange` being called?
2. Is `user.id` set?
3. Is `fetchAll` being entered?
4. What does `visibleWidgets` resolve to?
5. Edge Function response: ok / error / timeout?
6. Does `api_cache` table contain data for this user?

---

## 16) Known Incomplete Items

| Item | Status |
|------|--------|
| Google Calendar live API sync | Edge Function implemented; frontend store partially mock-based |
| Google Fitness live API sync | Edge Function implemented; live token connection needed |
| Voice feature (`voiceOn`) | State exists; no UI or TTS implementation |
| `NewsDetailModal` | File exists but unused — replaced by direct URL navigation |
| Trends detail view | News/stocks "view all" modals implemented; trends left/right pagination unimplemented |
| Diary PIN setup | PIN hashing + storage + verify done; PIN set/modify/recovery UI not yet exposed in settings |
| Stocks Edge Function deploy | Local modification done (type/currency metadata + validation fixes); needs Supabase Dashboard manual deploy |
| `groq` Edge Function deploy | `charset=utf-8` header added; needs manual deploy |

---

## 17) Milestone 4 Compliance Status

Updated 2026-05-22. All five Milestone 4 documentation deliverables complete; deployment live on Cloudflare Workers; remaining items are content edits and final-sprint polish.

### ✅ README.md — Done

- [x] Setup instructions for Windows / PowerShell (prerequisites, clone, install, `.env` config, DB setup, Edge Function deploy, dev run)
- [x] Build & Deploy section (`npm run build` + `npx wrangler deploy`)
- [x] Testing section with 8-point manual verification checklist
- [x] OS coverage explicitly stated (Windows 10 / 11 + PowerShell)
- [x] Bug Reporting section linking to `<REPO_URL>/issues`
- [x] Backend description corrected (was `FastAPI/Python/Gemini`; now `Supabase Edge Functions/Deno/Groq`)
- [ ] **Remaining:** find/replace `<REPO_URL>` (3 occurrences) and `<DEPLOYED_URL>` (1 occurrence) before submission

### ✅ Milestone/SCHEDULE.md — Done

- [x] May 1st Jira baseline (12 epics × 4 sprints) imported and verified against codebase
- [x] Executive Summary table at top (9 ✅ / 2 🟡 / 1 🔄)
- [x] Per-task "Completion Evidence" column with code references, function names, commit hashes
- [x] Schedule Changes section: SCRUM-28 (Vercel → Cloudflare), SCRUM-16/25 (Persona → category-based personalization), SCRUM-24 (Desktop History → Smart Widget keyword learning + Briefing snapshots) — all 3 changes formally documented with rationale
- [x] "Additional accomplishments beyond schedule" section listing unscheduled work
- [x] Jira board linked at top as live source of truth

### ✅ Milestone/API.md — Done

- [x] All 9 Edge Functions documented (weather, stocks, tavily × 3 modes, groq, events, tasks, fitness, smart-widget)
- [x] All Supabase REST endpoints documented (6 missing from original template added: todos, smart_keywords, diaries, user_qa, briefing_snapshots, keyword_score_log)
- [x] All 3 Supabase Auth client API calls documented
- [x] 7 corrections applied vs. Excel template (Groq output field, Smart Widget input shape, Tasks legacy MB_META note, etc.)
- [x] Auth/RLS requirements clearly marked per endpoint
- [x] Caching, error handling, RLS cross-cutting concerns documented

### ✅ Bug tracking — Done

- [x] README "Bug Reporting" section explains where to find issues and how to file new ones
- [x] `.github/ISSUE_TEMPLATE/bug_report.md` — structured bug form
- [x] `.github/ISSUE_TEMPLATE/feature_request.md` — structured feature form
- [x] `Milestone/KNOWN_ISSUES.md` — open issues drafted, ready to paste into GitHub Issues with severity, owner, labels
- [ ] **Remaining:** team confirms GitHub Issues is enabled at the repo; files all open entries into Issues; replaces `_to file_` with GH issue numbers; deletes KNOWN_ISSUES.md after all are filed
- [ ] **Remaining:** team completes cross-verification of completed features (per ProjectMilestones.md — verify each marked-complete feature with a team member who did not implement it; bugs found get filed)

### ✅ Milestone/MILESTONE4_PROGRESS.md — Done

- [x] Individual progress update sections for all 3 team members (scheduled, in-progress, actually completed, partial)
- [x] Group progress update with self-assigned grade (B) and rationale
- [x] Process adjustments section for the final release sprint
- [x] Sign-off block for each team member
- [ ] **Remaining:** each team member signs the sign-off block
- [ ] **Remaining:** copy to Brightspace for submission alongside GitHub commit

### Final-release polish (low risk)

1. **Live URL placeholder** — `<DEPLOYED_URL>` placeholder in README.md to be replaced with the actual Cloudflare Workers URL (deployment is already live).
2. **Stocks + groq Edge Function manual deploys** — Local code is ready; Supabase Dashboard upload pending so the deployed app picks up the universal-ticker fallback (stocks) and `charset=utf-8` header (groq).
3. **Sprint 4 closeout** — SCRUM-26 UI/UX audit and SCRUM-27 RLS audit + indexing pass complete by May 27.

---

*Document maintained by the team. Update relevant sections when code changes. Use [CHANGELOG.md](./CHANGELOG.md) for dated change history.*
