# localStorage Security Audit

**Date:** 2026-05-24  
**Scope:** All `localStorage.setItem` / `save()` call sites in `src/`

---

## Key Inventory

| Key | Owner | Value Type | Sensitivity | Notes |
|-----|-------|-----------|-------------|-------|
| `mb_login` | `useAuthStore` | boolean | 🟡 Low | Auth presence flag; no credentials |
| `mb_theme` | `useSettingsStore` | string | ⚪ None | UI preference |
| `mb_clock` | `useSettingsStore` | string | ⚪ None | UI preference |
| `mb_temp_unit` | `useSettingsStore` | string | ⚪ None | UI preference |
| `mb_stock_symbols` | `useSettingsStore` | string[] | ⚪ None | User-chosen ticker list |
| `mb_fixed_index_symbols` | `useSettingsStore` | string[] | ⚪ None | Index display prefs |
| `mb_tone` | `useSettingsStore` | string | ⚪ None | Briefing style |
| `mb_voice` | `useSettingsStore` | boolean | ⚪ None | TTS toggle |
| `mb_pin_lock_mode` | `useSettingsStore` | string | ⚪ None | Diary lock mode |
| `mb_bg` | `useSettingsStore` | string \| null | ⚪ None | Background image URL |
| `mb_priority_order` | `useSettingsStore` | string[] | ⚪ None | Widget ordering |
| `mb_show_first_login_briefing` | `useSettingsStore` | boolean | ⚪ None | Onboarding flag |
| `mb_last_briefing_shown` | `useSettingsStore` | string (date) | ⚪ None | Onboarding flag |
| `mb_diary_language` | `useSettingsStore` | string | ⚪ None | Language preference |
| `mb_is_12hour` | `useSettingsStore` | boolean | ⚪ None | Clock format |
| `mb_layouts` | `useWidgetStore` | object | ⚪ None | Dashboard layout |
| `mb_layout_ver` | `useWidgetStore` | number | ⚪ None | Layout version |
| `mb_widget_settings` | `useWidgetStore` | object | ⚪ None | Per-widget settings |
| `mb_briefing_history` | `useBriefingHistoryStore` | object | 🟡 Low | AI-generated briefings |
| `mb_last_access_time` | `useDataStore` | number (ms) | ⚪ None | Cache TTL timestamp |
| `mb_cache_*` | `useDataStore` | varies | 🟡 Low | API response cache (weather, news, stocks) |
| `mb_cache_*_at` | `useDataStore` | number (ms) | ⚪ None | Cache timestamp |
| `mb_last_fetched_at` | `useDataStore` | object | ⚪ None | Per-key fetch times |
| `mb_manual_city` | `useDataStore` | object | 🟡 Low | User-selected city (explicitly chosen) |
| `mb_diary_entries` | `useDiaryStore` | object | 🔴 High | Personal diary text — necessary for offline use; protected by PIN |
| `mb_last_access_date` | `useDiaryStore` | string (date) | ⚪ None | Daily reset marker |
| `mb_diary_pin` | `useDiaryStore` | string | 🟠 Medium | SHA-256 hash of user's PIN (not plaintext) |
| `mb_diary_pin_auth` | `useDiaryStore` | boolean | ⚪ None | In-session auth flag |
| `mb_diary_pin_auth_expires_at` | `useDiaryStore` | number (ms) | ⚪ None | Session expiry |
| `mb_calendar_events` | `useGoogleCalendarStore` | array | 🟠 Medium | Cached Google Calendar events |
| `mb_google_tasks` | `useGoogleCalendarStore` | array | 🟠 Medium | Cached Google Tasks |
| `mb_task_list_filter` | `useGoogleCalendarStore` | string | ⚪ None | Task list filter preference |
| `mb_task_last_reset` | `useTodoStore` | string (date) | ⚪ None | Daily reset date |
| `mb_todos` | `useTodoStore` | array | 🟡 Low | Cached todo items |
| `mb_quick_links` | `useQuickLinksStore` | array | 🟡 Low | User-saved URLs |
| `mb_ext_banner_dismissed` | `ExtensionInstallBanner` | string | ⚪ None | UI dismissal flag |
| `mb_last_synthesis_date` | `useMidnightTrigger` | string (date) | ⚪ None | Daily synthesis marker |
| `mb_last_access_date` | `useMidnightTrigger` | string (date) | ⚪ None | Daily reset marker |
| `language` | `i18n.ts` / `TopNav` | string | ⚪ None | UI language preference |
| `sb-<ref>-auth-token` | Supabase (auto) | object | ✅ **Fixed** | Session object — `provider_token` + `provider_refresh_token` stripped by custom storage adapter (see below) |

---

## Actions Taken

### 1. `provider_refresh_token` removed from Supabase session persistence

**File:** `src/lib/supabase.ts`

Supabase automatically writes the full `Session` object (including
`provider_token` and `provider_refresh_token`) to `sb-<project-ref>-auth-token`
in localStorage. The long-lived refresh token is the higher-value target —
an attacker who exfiltrates it via XSS can mint new access tokens
indefinitely.

**Fix:** Custom `secureStorage` adapter intercepts every `setItem` call for
keys matching `*-auth-token` and deletes `provider_refresh_token` before
writing.

**Trade-off (documented):** An earlier version of this fix also stripped
`provider_token`, but Supabase **does not refresh OAuth provider tokens** —
`refreshSession()` only refreshes the Supabase JWT, not the Google access
token. Stripping `provider_token` therefore broke every Google API call
after page reload (`fetchTomorrowCalendar`, `fetchHealth`, etc.). Because
the access token expires in ~1 h regardless, persisting it gives the same
practical exposure window as a short-lived in-memory copy. The
long-lived refresh token (which would let an attacker indefinitely mint
new access tokens) is the one we actually need to keep off-disk.

### 2. No unnecessary sensitive keys found

All other keys are either:
- Non-sensitive UI preferences
- User-generated content that is necessary for offline use (`mb_diary_entries`,
  `mb_calendar_events`, `mb_google_tasks`)
- Hashed credentials (`mb_diary_pin` — SHA-256, not plaintext)

No keys were removed because all stored data serves a clear functional purpose.

---

## Supabase RLS Status

All 7 listed application tables have Row Level Security enabled and policies restricting
reads/writes to the authenticated row owner (`auth.uid() = user_id` or
`auth.uid() = id`).

| Table | RLS | Policies |
|-------|-----|---------|
| `user_settings` | ✅ | SELECT, INSERT, UPDATE |
| `widget_layouts` | ✅ | SELECT, INSERT, UPDATE |
| `smart_keywords` | ✅ | SELECT, INSERT, DELETE |
| `diaries` | ✅ | SELECT, INSERT, UPDATE, DELETE |
| `api_cache` | ✅ | SELECT, INSERT, UPDATE |
| `keyword_score_log` | ✅ | SELECT, INSERT, DELETE |
| `user_qa` | ✅ | SELECT, INSERT, DELETE |

---

## Environment Variables

Only `VITE_`-prefixed variables are bundled into the browser:

| Variable | In Bundle | Notes |
|----------|-----------|-------|
| `VITE_SUPABASE_URL` | ✅ Yes | Public; safe by design |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Public anon key; protected by RLS |
| `GROQ_API_KEY` | ❌ No | Server-side only (no VITE_ prefix) |
| `TAVILY_API_KEY` | ❌ No | Server-side only |
| `TWELVEDATA_API_KEY` | ❌ No | Server-side only |
| `OPENWEATHER_API_KEY` | ❌ No | Server-side only |
