# DOCS.md §16–17 (archived 2026-10-04)

Moved out of DOCS.md: resolved-issue history and the CSE 416 Milestone 4 compliance checklist. Historical — current open work is in [docs/BACKLOG.md](../../docs/BACKLOG.md).

## 16) Known Incomplete Items

| Item | Status |
|------|--------|
| Google Fitness live API sync | Edge Function implemented; live token connection needed |
| Voice feature (`voiceOn`) | State exists; no UI or TTS implementation |
| `NewsDetailModal` | File exists but unused — replaced by direct URL navigation |
| Trends detail view | News/stocks "view all" modals implemented; trends left/right pagination unimplemented |
| Chrome extension publishing | `ExtensionInstallBanner` + `build:extension` script exist; `STORE_URL`/`EXTENSION_ID` are placeholders pending Web Store publish |

**Resolved since 2026-05-22:**
- ~~Tavily token overuse~~ → ✅ Resolved 2026-05-23 (`86a34a8`): `api_cache` TTL extended 1 h → 6 h
- ~~Briefing "Tomorrow" section empty for non-UTC users~~ → ✅ Resolved 2026-05-24 (`5c7b7a6`): explicit `timeMin/timeMax` local-timezone ISO strings

**Resolved 2026-06-02 (todo.md batch fix):**
- ~~이슈 1: 뉴스=트렌드~~ → ✅ `fetchNews` 파생 trends에서 뉴스 URL dedupe 적용
- ~~이슈 2/13: 카테고리 표시 불일치~~ → ✅ override 우선 표시, 드롭다운 글자만, 버튼 UI 완화
- ~~이슈 3: 스마트 위젯 stale 데이터~~ → ✅ `isSmartWidgetStale` 3시간 기준 자동 재생성
- ~~이슈 4: 로그인 시 새로고침 안 됨~~ → ✅ `mb_last_access_time` 초기화 + `useExistingCache: false`
- ~~이슈 5: 사이드바 너무 좁음~~ → ✅ 20% → 29%, Col A/B flex 축소
- ~~이슈 6: 추가 버튼 우측 벽에 붙음~~ → ✅ `bottom-8 right-10`, 팝업 `right-16`
- ~~이슈 7: 브리핑 임의 갱신~~ → ✅ interval 1h→3h, `activeWidgetIds` cascade 제거
- ~~이슈 8: 리마인더 기본값 default~~ → ✅ `EMPTY_FORM.reminderMode: "none"`
- ~~이슈 9: 이벤트 폼 가로 스크롤~~ → ✅ 모달 `max-w-md→max-w-xl`, `max-h-[85vh]`
- ~~이슈 10: 캘린더 폰트 불균형~~ → ✅ 월간 날짜 `text-sm→text-base`, 버튼 `h-9 w-9→h-10 w-10`
- ~~이슈 11: 스마트 위젯 그룹화~~ → ✅ 키워드별 개별 subBlock 생성
- ~~이슈 12: PIN 자동 포커스~~ → ✅ `MaskedPinField` forwardRef, 4자리 완성 시 confirm focus
- ~~이슈 14: 날씨 영어 표시~~ → ✅ AQI 인덱스 반환, `lang` 파라미터, UI 문자열 i18n
- ~~이슈 16: 창 축소 시 사이드바~~ → ✅ resize 리스너 1200px 미만 자동 닫힘
- ~~이슈 17: Tavily API 효율~~ → ✅ edge function 배치 지원, `searchSmartSectionsBatched` (N호출→1-2호출)
- ~~이슈 18: Google 연결 끊김~~ → ✅ `google-refresh` edge function, `providerRefreshToken` 저장/교환 (requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in Supabase secrets)

**Resolved 2026-06-04:**
- ~~Google Calendar live API sync~~ → ✅ `invokeGoogleWithAuth` wrapper with auto-retry on 401/403 (`b4ee88a`); `ensureProviderToken(forceRefresh:true)` recovers expired sessions on next-day re-entry without re-login
- ~~Smart Widget Korean mode (Latest Updates / Latest Coverage not loading)~~ → ✅ Korean article fetch reworked (`4ba0d4b`): `include_domains` opened for non-news sections, `exclude_domains` used to filter low-quality domains
- ~~Stocks Edge Function deploy~~ → ✅ Manually deployed to Supabase 2026-06-04 (universal-ticker fallback, type/currency metadata, ticker validation live)
- ~~`groq` Edge Function deploy~~ → ✅ Manually deployed to Supabase 2026-06-04 (`Content-Type: application/json; charset=utf-8` header live; Korean text no longer garbled)

**Resolved 2026-06-09:**
- ~~Diary PIN set/modify/recovery UI not exposed~~ → ✅ PIN setup/change/disable now exposed in the SettingsModal **diary** tab, alongside diary generation language and PIN lock timing (`immediate`/`off`/`timed`)
- ~~`BriefSettingsModal` standalone~~ → ✅ Removed; AI-briefing toggles folded into the SettingsModal **briefing** tab
- ~~Google connection toggles in widget management~~ → ✅ Moved to the SettingsModal **profile** tab (`c6762b0`)

---

## 17) Milestone 4 Compliance Status

Updated 2026-05-29. All five Milestone 4 documentation deliverables complete; Sprint 4 closed; deployment live on Cloudflare Workers at `https://morningbriefing.dksalstn0621.workers.dev`.

### ✅ README.md — Done

- [x] Setup instructions for Windows / PowerShell (prerequisites, clone, install, `.env` config, DB setup, Edge Function deploy, dev run)
- [x] Build & Deploy section (`npm run build` + `npx wrangler deploy`)
- [x] Testing section with 14-point manual verification checklist (expanded 2026-05-29 with items #12–#14)
- [x] OS coverage explicitly stated (Windows 10 / 11 + PowerShell)
- [x] Bug Reporting section linking to repo issues
- [x] Backend description corrected (was `FastAPI/Python/Gemini`; now `Supabase Edge Functions/Deno/Groq`)
- [x] TypeScript migration noted in Tech Stack; `ARCHITECTURE.md` and `docs/security/localStorage-audit.md` added to Documentation table

### ✅ Milestone/SCHEDULE.md — Done

- [x] May 1st Jira baseline (12 epics × 4 sprints) imported and verified against codebase
- [x] Executive Summary table (11 ✅ / 0 🟡 / 1 🔄) — Sprint 4 ✅ Completed 2026-05-29
- [x] Per-task "Completion Evidence" column with code references, function names, commit hashes
- [x] Schedule Changes section: SCRUM-28 (Vercel → Cloudflare), SCRUM-16/25 (Persona → category-based personalization), SCRUM-24 (Desktop History → Smart Widget keyword learning + Briefing snapshots) — all 3 changes formally documented with rationale
- [x] "Additional accomplishments beyond schedule" section — TypeScript migration, error-handling standardization, performance −27.9 %, ARCHITECTURE.md, Tavily TTL fix, timezone fix
- [x] Jira board linked at top as live source of truth

### ✅ Milestone/API.md — Done

- [x] All 9 Edge Functions documented (weather, stocks, tavily × 3 modes, groq, events, tasks, fitness, smart-widget)
- [x] All Supabase REST endpoints documented (6 missing from original template added: todos, smart_keywords, diaries, user_qa, briefing_snapshots, keyword_score_log)
- [x] All 3 Supabase Auth client API calls documented
- [x] 7 corrections applied vs. Excel template; cache TTL corrected to 6 h (2026-05-29)
- [x] Auth/RLS requirements clearly marked per endpoint
- [x] Caching, error handling, RLS cross-cutting concerns documented

### ✅ Bug tracking — Done

- [x] README "Bug Reporting" section explains where to find issues and how to file new ones
- [x] `.github/ISSUE_TEMPLATE/bug_report.md` — structured bug form
- [x] `.github/ISSUE_TEMPLATE/feature_request.md` — structured feature form
- [x] `Milestone/KNOWN_ISSUES.md` — 9 retroactive issues filed-and-closed (GH #3, #17–#23, #25); open issues remain tracked in GH Issues
- [x] 9 retroactive GitHub issues filed-and-closed for transparency paper trail (2026-05-29)
- [ ] **Remaining:** team completes cross-verification of completed features (verify each marked-complete feature with a team member who did not implement it; bugs found get filed)

### ✅ Milestone/MILESTONE4_PROGRESS.md — Done

- [x] Individual progress update sections for all 3 team members (scheduled, in-progress, actually completed, partial)
- [x] Group progress update with self-assigned grade (A−) and rationale — Sprint 4 fully closed
- [x] Process adjustments section for the final release sprint
- [x] Sign-off block for each team member
- [ ] **Remaining:** each team member signs the sign-off block
- [ ] **Remaining:** copy to Brightspace for submission alongside GitHub commit

### Remaining pre-submission items

1. **Cross-verification** — Each completed feature verified by a team member who did not implement it; any bugs found should be filed in GitHub Issues.
2. **Team sign-offs** — Each member signs `Milestone/MILESTONE4_PROGRESS.md`; file copied to Brightspace.

---

