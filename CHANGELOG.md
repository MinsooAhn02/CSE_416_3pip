# CHANGELOG

> 변경 이력은 최신 순으로 정렬됩니다.
> 아키텍처 참조는 [DOCS.md](./DOCS.md) (English) 또는 [DOCS_kor.md](./DOCS_kor.md) (한국어)를 참고하세요.

---

## 2026-05-22

### [Docs] Schedule and progress doc sync against codebase

- `Milestone/SCHEDULE.md` rewritten with verified completion status per SCRUM item (9 ✅ / 2 🟡 / 1 🔄), Executive Summary table, per-task Completion Evidence column, and 3 formally documented Schedule Changes:
  - SCRUM-28: Vercel → Cloudflare Workers (deployment live)
  - SCRUM-16/25: Persona settings UI → 8-category personalization (backend persona context retained)
  - SCRUM-24: Desktop History fetching → Smart Widget keyword learning + Briefing snapshots (browser-history permission incompatibility)
- `Milestone/MILESTONE4_PROGRESS.md` updated to match SCHEDULE.md decisions; removed all `[VERIFY]` flags; SCRUM-28 deployment marked done
- `DOCS.md §16` corrected: removed outdated "`keyword_score_log` aggregation unverified" entry (implementation confirmed in `personalizationService.js`); Diary PIN status clarified
- `DOCS.md §17` updated: SCHEDULE.md "remaining placeholder cells" item removed; deployment risk removed from blocker watchlist
- `Milestone/KNOWN_ISSUES.md` Issue #11 marked resolved — `personalizationService.js` implements the 30-day decay aggregation per spec

### [Docs] Milestone 4 deliverables

- `README.md` rewritten with Windows setup, build/deploy, testing, bug reporting sections; backend description corrected from FastAPI/Python/Gemini to Supabase Edge Functions/Deno/Groq
- `SCHEDULE.md` created from May 1st Jira baseline (11 epics × 4 sprints) with Schedule Changes section
- `API.md` created with 25 endpoints (8 Edge Functions + 16 REST + 3 Auth); 7 corrections applied vs. the `MorningBriefingAI_API_Design.xlsx` template, 12 endpoints added
- `MILESTONE4_PROGRESS.md` drafted per ProjectMilestones.md requirements (individual + group + self-grade B + process adjustments)
- `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md` added
- `KNOWN_ISSUES.md` created with 16 issues ready to file into GitHub Issues
- DOCS.md §17 updated from "Compliance Gaps" to "Compliance Status" — all 5 deliverables marked done

### [Docs] Documentation restructure

- `DOCS.md` (1,854 lines) split into three files:
  - `DOCS.md` — rewritten in English, concise architecture reference (970 lines)
  - `DOCS_kor.md` — cleaned Korean reference, fix rounds removed (1,166 lines)
  - `CHANGELOG.md` — all dated fix-round entries extracted here (this file)
- Section 1 duplicate "Smart Widget Notes" removed from top of original DOCS.md; content consolidated into DOCS.md §7.4 (Smart Widget) and §8 (Edge Functions)
- Milestone 4 compliance gaps documented in DOCS.md §17
- README.md backend description discrepancy flagged (README says FastAPI/Python/Gemini; actual code is Supabase Edge Functions/Deno/Groq)

---

## 2026-05-20

### [Fix 26] Stocks Widget 버그 수정 2종

**파일:** `src/components/widgets/StocksWidget.jsx`, `src/components/common/ConfirmDialog.jsx`

**Fix 1: 지수 항목 통화 심볼($, ₩) 제거**

- KOSPI, NASDAQ, S&P 500은 포인트 단위 지수임에도 `CURRENCY_MAP`에서 "KRW"/"USD"로 매핑되어 ₩/$가 표시됨.
- `CURRENCY_MAP`의 KOSPI/NASDAQ/SP500 값을 `"Index"`로 변경. `curSymbol` 도출 로직이 "Index"에 대해 빈 문자열을 반환하므로 심볼 미표시.

**Fix 2: "remove ticker?" 확인 후 메인 모달 유지**

- ConfirmDialog backdrop 클릭 시 React synthetic event가 상위 컴포넌트로 전파되어 StocksWidget 메인 모달까지 닫힘.
- ConfirmDialog backdrop의 `onClick={onCancel}` → `onClick={(e) => { e.stopPropagation(); onCancel(); }}`로 변경.

---

### [Fix 25] 일기 생성 로직 개선: 브리핑 스냅샷 반영 + 프롬프트 강화

**파일:** `DiaryPanel.jsx`, `diaryGenerationService.js`, `aiService.js`, `scripts/test-diary-generation.mjs` (신규)

**문제:**
1. 수동 생성 시 브리핑 스냅샷 누락 — `briefingSnapshots` 없이 `generateAndSaveDiaryForDate` 호출
2. `promptContext`에 불필요한 stocks 데이터 포함
3. 피드백 연속성 문제 — 전날 피드백이 이틀 후 사라지는 구조

**해결:**
- `DiaryPanel.jsx`: `useBriefingHistoryStore.getState().getSnapshotsForDate(selectedDate)`로 스냅샷 조회 후 전달
- `diaryGenerationService.js`: `stocks` 제거, `interests` slice 10 → 8
- `aiService.js`: `generateDiary()` 파라미터에서 `stocks` 제거, 프롬프트 룰 강화
  - `previousDayDiary`는 문체·톤·스타일 참고용만 — 전날 사건·내용은 오늘 일기에 절대 포함 금지
  - `previousDayFeedback`이 있으면 해당 선호도(포함·제외 항목)를 오늘 일기에 반영

**피드백 연속성 설계:**
```
Day 1 일기 (주식 포함) + 피드백 "주식 없애줘"
  ↓
Day 2: previousDayDiary(스타일 참고) + previousDayFeedback(주식 제외) → 주식 없는 일기
  ↓
Day 3: previousDayDiary = Day 2 일기(주식 없는 스타일) → 피드백 없어도 스타일 유지
```

---

## 2026-05-18

### [Fix 24] Tavily 한국어 뉴스/트렌드 출처 + 번역 캐시 정규화

**파일:** `src/store/useDataStore.js`

**문제:** 한국어 모드에서 Tavily가 한국 언론사 URL은 잘 가져오지만 기사 원본 제목이 영어인 경우 제목이 영어로 표시됨. 기존 캐시가 원문 payload를 보관하면 다음 캐시 hit 때 영어 제목이 재노출됨.

**해결:**
- 한국어 뉴스/트렌드 요청에 `include_domains: KO_NEWS_DOMAINS`를 전달
- `filterByAllowedDomains()`를 정렬 전용이 아니라 도메인 하드 필터로 운용
- `translateArticlesToKorean()`으로 `title`/`content` 표시 전 한국어 정규화
- `buildLocalizedTrendTitles()` 추가 — 실시간 트렌드 표시 제목도 한국어 기사 제목 또는 번역된 fallback 제목으로 구성
- `needsKoreanTranslation()` 강화 — `Trump tariff fight - 연합뉴스`처럼 한글 출처명만 붙은 영어 제목도 번역 대상으로 판정
- DB 캐시 read 시 원본 영어 payload 발견하면 번역본 payload를 `api_cache`에 backfill 저장
- `warmupTrendsMemCache()`: 한국어 캐시에 backfill이 필요한 원본 payload가 있으면 메모리 캐시에 올리지 않음

**캐시 정책:**
- 뉴스: `news_${lang}_${interestFingerprint}`
- 트렌드: `trends_full_${lang}`
- 한국어 캐시 payload에는 번역된 `results[].title`, `results[].content`, `trends[]`가 저장됨

---

## 2026-05-17

### [Fix 23 / Round 11] 이벤트 생성/편집 모달 닫힘 버그 수정

**파일:** `EventPanel.jsx`, `en.json`, `ko.json`

**증상:**
1. 새 이벤트 생성 — 저장은 성공하지만 모달이 닫히지 않음
2. 이벤트 편집 — 저장도 안 되고 모달도 닫히지 않음
3. Cancel 버튼 — 클릭해도 아무 반응 없음

**근본 원인:** `handleSubmit`의 `setShowAddForm(false)` 호출이 await addEvent/updateEvent 이후에 조건부로만 실행됨. `addEvent` 내부에서 `fetchEvents`가 추가 re-render를 유발해 타이밍 충돌 → 모달이 열린 채 유지.

**해결 (Optimistic Close 패턴):**
- `handleCloseAddForm` 헬퍼 추가 (`setShowAddForm(false)` + `resetForm()` 묶음)
- `handleSubmit` 전면 개선: payload 빌드 완료 후 await 이전에 `handleCloseAddForm()` 호출 (항상 닫힘 보장)
- 시간 미입력 early-return → toast 피드백 추가 (`toast.event_time_required`)
- backdrop / X / Cancel 세 곳의 인라인 close 핸들러를 `handleCloseAddForm` 단일 호출로 교체
- i18n: `toast.event_time_required` 키 추가 (EN/KO)

---

### [Fix 22 / AI Briefing Round 5] 뉴스 AI 요약+링크 / 트렌드 섹션 / 시장 동향 제거

**파일:** `src/services/aiService.js`, `src/components/widgets/BriefingWidget.jsx`

| 항목 | 이전 | 이후 |
|------|------|------|
| 시장 동향 섹션 | `finance` 관심사 보유 시 조건부 노출 | 완전 제거 |
| 뉴스 Top 3 표시 | 제목 + 출처 라벨 (평문) | 제목 (클릭 → 원문 새 탭) + AI 1문장 요약 + 출처 |
| 트렌드 Top 3 | 없음 | 신규 sub-block — 뉴스와 동일 구조 |

**변경 상세:**
- `// ── 7) (조건부) 시장 동향 ──` 블록(19줄) 삭제
- `summarizeArticlesBatch` 헬퍼 추가: `{title, url, content}` 배열 최대 6개 → 단일 Groq 호출, JSON `{ summaries: [{ index, summary }] }` 출력
- `generateDetailedBriefing`: 2개 병렬 → 3개 병렬 (`diaryRewrite`, `smartSummary`, `articleSummaries`)
- `section.lines` polymorphic: `string` (기존 평문) | `{ title, url, summary, source }` (뉴스·트렌드 기사)
- `latest_info` sub-block: `latest_smart`, `latest_news`, `latest_trends` 3개
- 대시보드 미리보기 직렬화 수정: `.join(" · ")` → `toPlainLine` 헬퍼

---

### [Fix Round 10] 이벤트 모달 + Google Calendar 동기화 오류 표면화

**파일:** `EventPanel.jsx`, `CalendarWidget.jsx`, `useGoogleCalendarStore.js`, `useAuthStore.js`, `en.json`, `ko.json`

**1. Edit event modal not closing / save not persisting**
- Google 동기화 실패 시 `updateEvent`가 throw → `handleSubmit` catch 블록이 `console.error`만 출력 → 모달 유지
- 해결: catch 블록에 `toast.error()` 추가 (오류 발생 시 빨간 토스트, 모달은 열린 채 유지)

**2. Google Calendar 동기화 오류 표면화 (4개 무음 catch 수정)**

| 파일 | 위치 | 수정 내용 |
|------|------|----------|
| `CalendarWidget.jsx` | line 93 | `.catch(() => {})` → `[gcal]` 로그 + auth 오류 제외 toast |
| `useGoogleCalendarStore.js` | line 481 | `.catch(() => FALLBACK_TASK_LISTS)` → 로그 추가 후 동일 fallback |
| `useGoogleCalendarStore.js` | line 567 | `catch {}` → `catch (err)` + `[gcal]` 로그 |
| `useAuthStore.js` | line 151 | `catch { return null; }` → `catch (err)` + `[gcal]` 로그 |

진단: `[gcal] ensureProviderToken failed:` 콘솔 로그 → Supabase OAuth `provider_token` 만료가 원인임 확인 가능

---

### [Fix Round 9] 재생성 과거 일기에 "앱 접속 기록이 없어" 문장 오출력 수정

**파일:** `src/services/diaryGenerationService.js`

**문제:** 과거 날짜(예: 5월 15일) 일기를 재생성하면 "앱 접속 기록이 없어 자동 수집된 데이터만 정리했다." 문장이 포함됨. `wasActiveDay = false`로 추론됨.

**근본 원인 (2가지):**
1. `ACTIVE_KEY`("mb_last_access_date")는 단일 문자열 슬롯 → 5월 17일 로그인 후 `wasActiveOn("2026-05-15")`는 항상 `false`
2. `inferredWasActiveDay` OR 체인이 "일기가 이미 존재함" 신호를 누락

**해결:** `buildDiaryGenerationContext` 내 `inferredWasActiveDay` OR 체인에 한 줄 추가:
```js
!!(existingEntry?.diary || "").trim() ||
```

---

### [Fix Round 8] 일기 생성 언어 엄격 적용 + 외래 문자 후처리 검증 / 브리핑 글자 크기 설정

**파일:** `src/services/aiService.js`, `src/components/widgets/BriefingWidget.jsx`

**1. 일기 생성 언어 엄격 적용**
- AI가 일기 title/summary를 "五月十五日"(한자), "스트 назначить"(한국어+러시아어) 등 엉뚱한 언어로 생성하는 경우 발생
- `resolvedLanguage`에 따라 한국어/영어 시스템 프롬프트를 분기, 사용 금지 문자 명시
- `containsForeignScripts(text, targetLang)` 헬퍼 추가: 외래 문자 감지 시 결정론적 fallback으로 대체

**2. AI 브리핑 대시보드 뷰 글자 크기 설정 적용**
- `useFontSize` 훅 임포트 추가
- 대시보드 내 모든 텍스트 요소에서 하드코딩 사이즈 클래스 제거 → `style={...Style}` 적용
- 4개 스타일 변수: `bodyStyle`(×1.0), `titleStyle`(×1.0), `sectionTitleStyle`(×0.75), `contentLineStyle`(×0.92), `footerHintStyle`(×0.83)

---

### [Fix Round 7] 일기 재생성 시 일정 섹션 소실 버그 수정

**파일:** `src/services/diaryGenerationService.js`

**문제:** 오늘 일기를 처음 생성하면 구글 캘린더 일정이 정상 표시되지만, **다시 생성** 클릭 시 일정 섹션이 "일정 없음"으로 바뀜.

**근본 원인 (3가지):**
1. `useDataStore.fetchCalendar`는 `todayOnly: true`로 오늘 이벤트만 캐싱 → 재생성 시점에 빈 배열이 될 수 있음
2. all-day 이벤트(`start = "2026-05-17"`)를 UTC 기준 파싱 → 타임존에 따라 날짜가 하루 어긋남
3. 보조 fallback Edge Function 호출 형식 불일치로 항상 실패

**해결:** `useGoogleCalendarStore.events`를 canonical source로 사용
- `filterEventsForDate`: `event.date === dateStr` 직접 비교 우선 → fallback으로 `isSameLocalDate`
- `fetchCalendarEventsForDate`: `useGoogleCalendarStore.getState().events`에서 읽고, 없으면 `fetchEvents({ date: dateStr, skipLoading: true })`로 lazy-fetch

---

### [Fix Round 6]

**1. AI Briefing 첫 로그인 모달 ↔ 위젯 상세 모달 동기화**
- `src/hooks/useBriefingContext.js` (신규): 모든 스토어 구독 + `buildContext()` 함수 반환
- `src/components/widgets/BriefingSectionsView.jsx` (신규): 구조화 섹션 렌더러
- `BriefingWidget.jsx`, `FirstLoginBriefingModal.jsx`: `useBriefingContext` 훅 + `BriefingSectionsView` 사용으로 리팩터

**2. 캘린더 일기 파란 점 복원**
- `CalendarWidget.jsx`: `useDiaryStore` import 추가, `diaryDateSet` (Set) 계산 + `hasDiaryOnDate()` 함수 + 파란 점 인디케이터 복원

**3. 설정 UI 수정**
- 스마트 키워드 입력창 위치: 섹션 헤더 직후 상단으로 이동
- AI 브리핑 토글 제거: 위젯 관리 탭에서 `briefing` 필터링 — AI 브리핑은 항상 활성화

---

## 2026-05-16

### [Fix 21] News/Trends 로직 문서 정합화

코드 변경 없음. `DOCS.md` §5.3의 내용을 실제 코드(`src/store/useDataStore.js`)와 1:1 매칭되게 재작성.

| DOCS.md 기술 | 실제 코드 |
|---|---|
| `관심: kw1, kw2` | `관심 주제: kw1, kw2` / `Focus topics: ...` |
| 한국어 모드 `include_domains: KO_NEWS_DOMAINS` | 빈 배열 `[]` 전달 — Tavily 한국 도메인 인덱스 빈약 우회 |
| `filterByAllowedDomains` 하드 필터 | 정렬 전용으로 변경 |

---

### [Fix 20] AI Briefing: 가짜 캘린더 일정 노출 버그 수정

**파일:** `src/store/useDataStore.js`

**증상:** AI 브리핑 "Today's schedule" 섹션에 항상 동일한 가짜 일정 (`CSE 416 팀 미팅`, `점심 약속`, `라이브러리 스터디`, `헬스장 운동`) 노출.

**원인:** `src/mock/data.js`의 `mockCalendarEvents` fallback이 Google OAuth token 없는 사용자에게 `calEvents`로 set됨. mock 항목은 `endTime=undefined` → BriefingWidget 방어 필터 통과 → LLM 프롬프트에 주입.

**해결:** `fetchCalendar`의 4개 mock fallback 분기를 빈 배열로 교체.

---

### [Fix 19] Briefing/Diary 자동화 버그 수정 (Fix A–E)

**Fix A: BriefingWidget `ensureYesterdayDiaryForMorning` 제거**
- `ensureYesterdayDiaryForMorning` 함수 전체 삭제. 전날 일기 자동 생성은 `useMidnightTrigger` 전담 경로로만 수행.

**Fix B: `useMidnightTrigger` hydrate 완료 후 실행**
- `hydrateComplete` boolean state 추가. `hydrateFromDB` 완료 직후 `setHydrateComplete(true)`.
- `useMidnightTrigger(isLoggedIn && hydrateComplete)`로 게이팅.

**Fix C: `useBriefingHistoryStore` 날짜 UTC→로컬 수정**
- `const todayStr = () => new Date().toISOString().slice(0, 10)` → `formatLocalDate()`로 교체

**Fix D: `BriefingWidget.yesterdayDateStr` UTC→로컬 수정**
- `const yesterdayDateStr = shiftDateString(formatLocalDate(), -1)`로 교체

**Fix E: `initialGenDoneRef` → `useState` 변환**
- `useRef(false)` → `useState(false)`: ref 변경이 리렌더를 트리거하지 않아 1시간 interval useEffect가 등록되지 않았던 버그 수정.

**수정 파일:** `BriefingWidget.jsx`, `App.jsx`, `useBriefingHistoryStore.js`

---

### [Fix 18 / Widget Round 4] News / Stocks / AI Briefing

**News: 한국어 모드 엄격 도메인 필터**
- `filterByAllowedDomains`의 "결과 0 → unfiltered fallback" 로직 제거. `lang=ko`일 때 KO_NEWS_DOMAINS 필터 결과가 비어 있으면 빈 배열 반환.
- `fetchNews`의 `fallbackLocalResults` / `fallbackGlobalResults` 경로 제거.

**News: 모달 뷰 리스트 레이아웃**
- `showAllModal` 내 `grid grid-cols-3 aspect-square` 그리드 → 수직 스크롤 리스트로 교체. 왼쪽 썸네일(80×56 px) + 오른쪽 타이틀 2줄 clamp + source 표시.

**Stocks: 통합 모달 (설정 패널 + 순서 관리 + 전체 보기 → 단일 모달)**
- 헤더 ⚙ → `+` 아이콘으로 교체. 통합 모달 구조: 헤더 + 티커 입력 + DnD 카드 그리드 + X 버튼 삭제.
- 미사용 i18n 키 제거: `symbol_settings`, `select_symbols`, `manage_order`, `remove_symbol`
- 신규 i18n 키 추가: `confirm_delete_title`, `confirm_delete_message`

**Stocks: 지수 티커 범용 지원 (Edge Function)**
- `fetchYahooQuote`: primary 심볼 실패 시 `^${symbol}` 자동 재시도
- `fetchStooqPrice`: 기본 후보 배열 `[sym.us, ^sym, sym]`으로 확장
- 재배포 필요: `supabase functions deploy stocks`

**AI Briefing: 관심사(Interests) 섹션 제거**
- `generateInterestSentences` 함수 삭제 (~107 lines)
- `Promise.all` 병렬 호출에서 `generateInterestSentences` 제거

**AI Briefing: 대시보드 미리보기 섹션 분리 (CSS line-clamp)**
- `displayBriefing.sections` 순회 → `divide-y` 섹션 구조로 렌더링. 각 섹션: 9px 대문자 타이틀 + 11px 내용 (`-webkit-line-clamp: 2`).
- 제거: `dashboardDetailText` useMemo, `dashboardDetailPreview` useState, `fitDashboardDetailPreview` useCallback 등.

---

*이전 Fix Rounds 1–5는 이 날짜 이전 커밋 참조.*
