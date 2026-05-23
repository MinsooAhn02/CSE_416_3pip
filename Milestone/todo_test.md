# Cross-Verification Log — MorningBriefing.AI

> **Purpose:** Record of cross-verification testing per ProjectMilestones.md requirement.
> Each completed feature must be verified by a team member who did **not** implement it.
> Bugs found during verification should be filed in [GitHub Issues](https://github.com/MinsooAhn02/CSE_416_3pip/issues).
>
> **Format:** Date | Tester | SCRUM # | Feature | Test steps | Result | Issues filed

---

## Verification Checklist

| SCRUM | Feature | Implementer | Assigned Tester | Status | Date | Issues Filed |
|-------|---------|-------------|-----------------|--------|------|--------------|
| SCRUM-16 | Onboarding (category selection) + DiaryCard Q&A | Dahyun Kwon | Sungmin Choo | ⬜ Pending | — | — |
| SCRUM-17 | PostgreSQL schema + RLS policies | Sungmin Choo | Dahyun Kwon | ⬜ Pending | — | — |
| SCRUM-18 | Smart Widgets & Briefing sync | Minsoo Ahn | Dahyun Kwon | ⬜ Pending | — | — |
| SCRUM-20 | i18n (Korean/English full compatibility) | Dahyun Kwon | Minsoo Ahn | ⬜ Pending | — | — |
| SCRUM-21 | Diary Card responses → Diary integration | Sungmin Choo | Minsoo Ahn | ⬜ Pending | — | — |
| SCRUM-22 | 30-day keyword decay + API caching | Minsoo Ahn | Dahyun Kwon | ⬜ Pending | — | — |
| SCRUM-23 | Modal portals + Diary feedback UI | Dahyun Kwon | Minsoo Ahn | ⬜ Pending | — | — |
| SCRUM-25 | Persona → Groq API bridge + error handling | Minsoo Ahn | Sungmin Choo | ⬜ Pending | — | — |
| SCRUM-28 | Cloudflare Workers deployment (live) | Minsoo Ahn | Sungmin Choo | ⬜ Pending | — | — |
| BUG-15b | Tomorrow-schedule timezone bug fix (briefing "Tomorrow" section) | Minsoo Ahn | — | ⬜ Pending | — | Issue #15b |

**Legend:** ⬜ Pending · ✅ Pass · ❌ Fail (bug filed) · 🟡 Partial

---

## Detailed Test Steps

### SCRUM-16 — Onboarding + DiaryCard
**Implementer:** Dahyun Kwon · **Tester:** Sungmin Choo

- [ ] First login → onboarding modal appears with category selection (8 categories)
- [ ] Select 2+ categories → proceed to permissions step → finish onboarding → dashboard renders
- [ ] DiaryCard shows a personalized Q&A question based on selected categories
- [ ] Answer Q&A → save → reload → answer retained (PIN-gated)
- [ ] DiaryCard question language matches app language setting

**Tester notes:**

---

### SCRUM-17 — PostgreSQL Schema + RLS
**Implementer:** Sungmin Choo · **Tester:** Dahyun Kwon

- [ ] Log in with two different Google accounts in separate browsers
- [ ] Account A adds a widget, todo, and diary entry
- [ ] Switch to Account B → verify Account A's data is NOT visible
- [ ] Check Supabase Dashboard → RLS policies exist on all user-scoped tables
- [ ] Run `supabase/schema.sql` on a fresh project → no errors

**Tester notes:**

---

### SCRUM-18 — Smart Widgets & Briefing Sync
**Implementer:** Minsoo Ahn · **Tester:** Dahyun Kwon

- [ ] Add a Smart Widget keyword (e.g., "camera") → content loads within 30s
- [ ] Add 2nd keyword → both widgets display correctly
- [ ] Remove a keyword → widget disappears from layout
- [ ] Open AI Briefing detail modal → "Smart keywords" subBlock shows one hyperlinked article per keyword
- [ ] Click smart keyword article link → opens correct URL in new tab
- [ ] Switch language → smart widget content reloads in correct language

**Tester notes:**

---

### SCRUM-20 — i18n (Korean / English)
**Implementer:** Dahyun Kwon · **Tester:** Minsoo Ahn

- [ ] Toggle language to Korean → TopNav, widget titles, settings modal labels all in Korean
- [ ] Toggle language to English → all labels revert to English
- [ ] Korean mode: news widget shows Korean articles only (no English articles mixed in)
- [ ] Korean mode: smart widget section titles show "맞춤 검색" (not "Personalized Search")
- [ ] Settings modal → Diary tab → Korean mode shows "생성 언어" heading
- [ ] Trends widget: Korean mode shows Korean trend titles

**Tester notes:**

---

### SCRUM-21 — Diary Card → Diary Integration
**Implementer:** Sungmin Choo · **Tester:** Minsoo Ahn

- [ ] Answer DiaryCard Q&A → save
- [ ] Open DiaryPanel for today → AI-generated diary references Q&A content naturally
- [ ] Answer is stored and visible after page reload
- [ ] Keywords from the answer are reflected in personalization (check Settings → keyword interests after midnight batch, or manually trigger)

**Tester notes:**

---

### SCRUM-22 — Keyword Decay + API Caching
**Implementer:** Minsoo Ahn · **Tester:** Dahyun Kwon

- [ ] Add stock symbols in Settings → StocksWidget updates
- [ ] Refresh StocksWidget manually → loading indicator → fresh data
- [ ] Refresh NewsWidget → new articles load; check Supabase `api_cache` table — row updated
- [ ] Force-refresh twice within 6 hours → second refresh uses cached data (no new Tavily call)
- [ ] Check `src/services/personalizationService.js` exists and has `VALID_CATEGORIES` + `SOURCE_WEIGHTS`

**Tester notes:**

---

### SCRUM-23 — Modal Portals + Diary Feedback UI
**Implementer:** Dahyun Kwon · **Tester:** Minsoo Ahn

- [ ] NewsWidget "More" → NewsAllModal opens as overlay (portal) → close button works
- [ ] StocksWidget "+" icon → manage modal opens → add/reorder/delete ticker works → ConfirmDialog appears on delete
- [ ] DiaryPanel: Like/Dislike buttons visible when diary exists
- [ ] Dislike → enter feedback text → "Rewrite" → (verify GH #2 status)
- [ ] EventPanel: create event → modal closes after save → event appears in calendar

**Tester notes:**

---

### SCRUM-25 — Persona → Groq API Bridge + Error Handling
**Implementer:** Minsoo Ahn · **Tester:** Sungmin Choo

- [ ] AI Briefing generates within ~15s on first load
- [ ] Briefing includes all sections: header / schedule / yesterday / today's latest info
- [ ] BriefingWidget shows `apiStatus` indicator (green dot = ok, red = error)
- [ ] Disconnect internet → refresh widget → mock/fallback data displayed (no crash)
- [ ] Korean mode briefing: no character garbling in generated text
- [ ] `BriefSettingsModal` tone/length change → next briefing reflects the setting

**Tester notes:**

---

### SCRUM-28 — Cloudflare Workers Deployment
**Implementer:** Minsoo Ahn · **Tester:** Sungmin Choo

- [ ] Open [https://morningbriefing.dksalstn0621.workers.dev](https://morningbriefing.dksalstn0621.workers.dev) in a browser → login screen loads
- [ ] Sign in with Google → OAuth redirect back to app → dashboard renders (no 404)
- [ ] Hard-refresh the page (Ctrl+F5) → still loads correctly (SPA routing works)
- [ ] Open a deep link path directly → redirects to login correctly
- [ ] All widgets load data (not stuck in demo mode)

**Tester notes:**

---

### BUG-15b — Tomorrow-schedule timezone bug fix
**Implementer:** Minsoo Ahn · **Tester:** (팀원 배정 필요)

- [ ] 오후 모드 (12시 이후): 브리핑 "Tomorrow" 섹션에 내일 Google Calendar 일정 표시 확인
- [ ] 내일 00:00~09:00 KST 일정도 포함되는지 확인 (timezone fix 핵심 검증)
- [ ] 오전 모드 (12시 이전): "Tomorrow" 섹션 미표시 확인 (morning-mode 정책 유지)
- [ ] 설정에서 Calendar 위젯 숨김 → 새로고침 → 브리핑 "Tomorrow" 섹션 여전히 표시 (visibility gate 분리 검증)

**Tester notes:**

---

## Change Log

| Date | Editor | What was changed | Related Issue |
|------|--------|-----------------|---------------|
| 2026-05-23 | Sungmin Choo | Created this file; 9 features assigned for cross-verification; 15 GitHub Issues filed | GH #1–15 |
| 2026-05-24 | Minsoo Ahn | Added BUG-15b: Tomorrow-schedule timezone bug fix verification entry | Issue #15b |

