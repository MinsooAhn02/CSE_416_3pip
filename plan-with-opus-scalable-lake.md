# Plan: Tomorrow-schedule briefing bug + Milestone/ docs sync

## Context

Two separate things to ship in this pass:

**Bug:** The AI briefing's "Tomorrow" section is empty even when the user has Google Calendar events on tomorrow. User confirmed it never shows regardless of time-of-day, and the Calendar widget IS visible (so `fetchTomorrowCalendar` is being called). This points to a data-shape / timezone problem inside that fetch, not a widget-visibility gating issue.

**Docs sync:** The last 2 hours of work overhauled the Stocks widget pipeline. `DOCS.md` §5.2/§7.3/§9 are already updated. `Milestone/API.md`, `Milestone/KNOWN_ISSUES.md`, `Milestone/SCHEDULE.md`, and `Milestone/MILESTONE4_PROGRESS.md` still describe the old stocks behavior and need to catch up.

Plan written with Opus; execution by Sonnet in the next session.

---

## Root cause — Tomorrow-schedule bug

### Trace

`useBriefingContext.js:59,101` reads `tomorrowEvents` from `useDataStore`. That field is set only by `useDataStore.fetchTomorrowCalendar` (`useDataStore.js:1776-1817`), which is invoked from `fetchAll` only when `visibleWidgets.includes("calendar")` is true (`useDataStore.js:2030`).

Inside the fetch:
```js
const tomorrowStr = shiftDateString(formatLocalDate(), 1);    // user's local tomorrow, YYYY-MM-DD
const data = await invokeEdge("events", { token, date: tomorrowStr });
const filtered = data.filter((ev) => String(ev?.start ?? "").startsWith(tomorrowStr));
```

The Edge Function (`supabase/functions/events/index.ts:259-297`, `getListRange`) maps `{ date }` to a UTC window:
```ts
if (date) {
    const startOfDay = new Date(`${date}T00:00:00`);   // Deno runs in UTC → this is UTC midnight
    const endOfDay   = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    return { timeMin: startOfDay.toISOString(), timeMax: endOfDay.toISOString() };
}
```

### The actual bug

For a KST (UTC+9) user asking for events on `2026-05-24`:
- The Edge Function sends Google Calendar `timeMin=2026-05-24T00:00:00Z` … `timeMax=2026-05-24T23:59:59Z`.
- That UTC window translates to **09:00 KST on the 24th → 08:59 KST on the 25th** in the user's local time.
- Events on the user's local 24th between **midnight and 09:00 KST** fall in the *previous* UTC day (`2026-05-23T15:00–23:59Z`) and are silently dropped by Google.
- Events on the user's local 25th between **00:00–09:00 KST** sneak into the window and are sent back, then dropped on the client by the `startsWith(tomorrowStr)` filter.

Net effect for non-UTC users: tomorrow returns nothing useful, often nothing at all. Same root issue exists in `fetchCalendar`'s `todayOnly: true` path (also UTC-bound), but it's largely masked because the client filter `startsWith(todayStr)` keeps the slice that does come back.

### Secondary issue (defense-in-depth, not the user's specific case)

`fetchTomorrowCalendar` is gated by `visibleWidgets.includes("calendar")` in `fetchAll`. The briefing widget (which is a `FIXED_WIDGETS.left` entry — always shown) needs tomorrow events independent of the calendar widget. User has calendar visible right now, so this isn't biting them, but it's still wrong and worth fixing in the same pass.

---

## Fix design

### Fix A — Pass an explicit local-timezone `timeMin/timeMax` from the client

Edge Function already supports a client-supplied window (`events/index.ts:268-270`):
```ts
if (timeMinInput && timeMaxInput) {
    return { timeMin: timeMinInput, timeMax: timeMaxInput };
}
```

Switch `fetchTomorrowCalendar` to use it:

```js
// In src/store/useDataStore.js, fetchTomorrowCalendar (~line 1803)
const startLocal = new Date(`${tomorrowStr}T00:00:00`);   // user's local midnight tomorrow
const endLocal   = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
const data = await invokeEdge("events", {
    token,
    timeMin: startLocal.toISOString(),
    timeMax: endLocal.toISOString(),
});
```

The client runs in the user's timezone, so `new Date("YYYY-MM-DDT00:00:00")` (no `Z`) is the correct local instant. `.toISOString()` converts it to the right absolute UTC moment for Google's filter. No Edge Function change required.

Apply the **same shape** to `fetchCalendar` (today) for symmetry — replace the `todayOnly: true` flag with an explicit local-day `timeMin/timeMax` so today's events stop having the same blind spot. Keep the same client-side `startsWith` safety filter on both.

### Fix B — Decouple tomorrow-fetch from calendar visibility

In `useDataStore.fetchAll` (~line 2030), pull `fetchTomorrowCalendar` out of the `visibleWidgets.includes("calendar")` block. Briefing is a fixed widget (always shown per `FIXED_WIDGETS`), so unconditionally fetching tomorrow when the user is logged in is correct. Keep `fetchCalendar` (today) inside the calendar-visibility gate — it's only used when the calendar widget renders, plus by the briefing context (which currently reads `calEvents` too, so we may also pull this out — TBD during execution; minimum-impact pass moves only the tomorrow call).

---

## Documentation sync (after the bug fix is verified)

### DOCS.md

Already up-to-date for stocks. Add one line to §7.3 BriefingWidget under "Section order → schedule" noting that tomorrow events are fetched via explicit local-timezone `timeMin/timeMax` and always fetched after login (no longer gated on calendar widget visibility).

### Milestone/API.md

The Stocks Edge Function output schema is stale (lines ~100–127 per Explore audit). Update two things:

1. **Output schema** — extend to include the new fields:
   ```ts
   [{ symbol, price, change, changePercent, type, currency }]
   //                                      ↑ NEW       ↑ NEW
   ```
   With type ∈ `"index"|"stock"|"etf"|"currency"|"unknown"` and currency = ISO code or `""`.

2. **Symbol mapping** — replace the 4-symbol map (`KOSPI→KS11/XKOS`, `NASDAQ→IXIC`, `SP500→SPX`, `USDKRW→USD/KRW`) with the 8-symbol list and note the new entries: `VIX→VIX`, `CRUDE→USOIL (Yahoo CL=F)`, `DXY→DXY (Yahoo DX=F)`, `DJI→DJI (Yahoo ^DJI)`.

### Milestone/KNOWN_ISSUES.md

Issue #15 (the "stocks Edge Function changes pending deployment" entry) is partially stale. Rewrite to reflect the current state:

- Local code now includes: strict ticker validation (`price>0`), type+currency metadata in Edge response, 8 hardcoded fixed indices (`fixedIndexSymbols`), VIX/CRUDE/DXY/DJI symbol mappings, DXY Yahoo fallback changed from `DX-Y.NYB` to `DX=F`.
- Production Edge Function still needs Supabase Dashboard manual upload.
- KOSDAQ-style invalid-ticker bug, confirm-delete-dialog non-dismiss bug, and hardcoded `CURRENCY_MAP` scaling issue are all FIXED locally and can be removed if they were tracked, or noted as resolved.

Add a new entry for the **tomorrow-schedule timezone bug** (this plan's main work) with a "fixed pending deploy" or "fixed in this session" status note matching the project's existing convention.

### Milestone/SCHEDULE.md & MILESTONE4_PROGRESS.md

Both files have a line (~108 in SCHEDULE.md, ~92 in MILESTONE4_PROGRESS.md) that describes the old stocks deliverable as "TwelveData → Stooq → ER-API fallback chain with `^${symbol}` auto-retry". Replace with a short description of the new architecture:

> Stocks widget: 8 fixed indices (SP500/KOSPI/NASDAQ/USDKRW/VIX/CRUDE/DXY/DJI) + user-added tickers split into widget (2+4) and modal (8 + N) sections. Strict ticker validation, auto-detect index/stock/currency via Edge Function `type`/`currency` metadata, optimistic confirm-dialog dismiss.

---

## Files modified

- `src/store/useDataStore.js` — `fetchTomorrowCalendar` (and optionally `fetchCalendar`) switched to explicit `timeMin/timeMax`; `fetchAll` ungates the tomorrow fetch.
- `DOCS.md` — one-line clarification in §7.3 BriefingWidget schedule section.
- `Milestone/API.md` — stocks Edge Function output + symbol map.
- `Milestone/KNOWN_ISSUES.md` — Issue #15 rewrite, optional new entry for tomorrow-schedule fix.
- `Milestone/SCHEDULE.md` — stocks deliverable line.
- `Milestone/MILESTONE4_PROGRESS.md` — Ahn Minsoo's accomplishments stocks line.

No Edge Function deploy required for the bug fix (changes are client-side only and use the Edge Function's existing `timeMin/timeMax` branch).

---

## Verification

### Bug fix

1. `npm run dev`, log in (KST timezone).
2. Confirm Google Calendar has at least one event on tomorrow's local date (try one early AM, one mid-day, one late PM if possible).
3. **Afternoon path**: check briefing widget after 12 PM local time → "Tomorrow" section lists those events in time order. Early-AM event must appear (this was the missing case).
4. **Morning path**: same setup before 12 PM local time → "Today's schedule" section only (no Tomorrow section per spec); confirms morning-mode policy still works.
5. Hide the calendar widget in settings → reload → briefing's "Tomorrow" section still populates (verifies Fix B).
6. Refresh the briefing manually → still works (cache key is local-tomorrow YYYY-MM-DD, not affected by the fix).

### Docs

- `DOCS.md` §7.3 reads correctly end-to-end.
- `Milestone/API.md` curl examples match the new output shape.
- `Milestone/KNOWN_ISSUES.md` Issue #15 reflects current local state vs deployment state.
- Spot-check `Milestone/SCHEDULE.md` and `MILESTONE4_PROGRESS.md` lines for accuracy.

---

## Out of scope (explicitly)

- Edge Function deployment to Supabase Dashboard — still pending per user's earlier decision to park that step.
- Frontend Cloudflare deploy — same.
- `Milestone/ProjectMilestones.md` and `Milestone/todo_test.md` have no stocks-related content per the Explore audit; leave untouched.
- Today's events have the same timezone bug structurally but it's masked by the client filter; optional to fix `fetchCalendar` in the same pass — Sonnet to apply if it can be done without touching unrelated logic.
