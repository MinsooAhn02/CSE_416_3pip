# MorningBriefing.AI - 통합 프로젝트 문서

> 최종 정리일: 2026-05-16
> 관리 정책: 문서는 DOCS.md 단일 파일로 유지

---

## 1) 프로젝트 개요

MorningBriefing.AI는 브라우저 새 탭(New Tab)에서 동작하는 개인 대시보드형 서비스다.
사용자의 하루 맥락(날씨, 주식, 뉴스, 트렌드, 일정, 건강, 일기/Q&A)을 모아 AI 브리핑과 기록 흐름으로 연결한다.

핵심 목표:

1. 필요한 정보를 한 화면에서 빠르게 확인
2. 캐시 우선 렌더링으로 로딩 체감 개선
3. 사용자별 설정/데이터를 안전하게 저장
4. 관심사 기반 개인화 뉴스 + AI 브리핑

핵심 원칙:

1. API 실패 시 mock fallback으로 UX 단절 최소화
2. 사용자 데이터 격리 (RLS)
3. 비밀키는 Supabase Secrets에서만 관리

---

## 2) 기술 스택

### Frontend

- React 18
- Vite 6
- Tailwind CSS 3
- Zustand (상태 관리)
- framer-motion (애니메이션)
- @hello-pangea/dnd (드래그앤드롭)
- i18next / react-i18next (한국어/영어)

### Backend / Infra

- Supabase (Auth, Postgres, Edge Functions)
- Edge Functions (TypeScript / Deno)
- 외부 데이터 연동:
  1. OpenWeatherMap / Groq (날씨)
  2. Twelve Data (주식)
  3. Tavily (뉴스/트렌드)
  4. Kakao Local (장소, 미사용 예정)
  5. Google Calendar API
  6. Google Fitness API
  7. Groq (LLM - AI 브리핑, 개인화 배치)

---

## 3) 디렉토리 구조

```text
src/
  App.jsx                         # 앱 진입점, 인증 부트스트랩, 초기화
  constants/
    index.js                      # CATEGORIES, WIDGET_LIST, DEFAULT_VIS, DEFAULT_LAYOUTS 등
  components/
    common/
      ConfirmDialog.jsx
      DragHandle.jsx
      GooglePlacesLocationField.jsx
      TimeInput.jsx
      Toggle.jsx
      WidgetCard.jsx              # 모든 위젯의 공통 카드 래퍼
    layout/
      DashboardLayout.jsx         # 1:3:3 컬럼 레이아웃, 슬라이더
      DatePanelContainer.jsx      # 선택 날짜용 Events/Tasks/Diary 컨테이너
      DiaryPanel.jsx
      EventPanel.jsx
      FixedButtons.jsx
      LoginScreen.jsx
      QuickLinks.jsx
      TaskPanel.jsx
      TopNav.jsx                  # 언어 토글, 설정 버튼, 프로필
    modals/
      BriefSettingsModal.jsx
      DiaryListModal.jsx
      FirstLoginBriefingModal.jsx
      NewsDetailModal.jsx         # 현재 미사용 (직접 URL 이동으로 대체)
      OnboardingModal.jsx
      PINModal.jsx
      SettingsModal.jsx
      WidgetSettingsModal.jsx     # 개별 위젯 설정(뉴스 보기 방식, 스마트 위젯 관심사 반영)
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
    useMidnightTrigger.js         # 자정 트리거 (할일 리셋, 개인화 배치)
    useTheme.js                   # 테마 관련 CSS 클래스 반환
  l10n/
    i18n.js                       # i18next 설정, 언어 변경 이벤트 발행
    ko.json
    en.json
  lib/
    supabase.js                   # Supabase 클라이언트 초기화
  mock/
    data.js                       # API 실패 시 fallback 데이터
  services/
    aiService.js                  # Groq LLM 호출 (브리핑 생성, 일기 생성, 일기 재작성)
    diaryGenerationService.js     # 일기 생성 컨텍스트 빌드 + generateAndSaveDiaryForDate
  store/
    useAuthStore.js
    useBriefingHistoryStore.js    # 시간대별 브리핑 스냅샷 저장 (localStorage + Supabase)
    useDataStore.js
    useDiaryStore.js
    useGoogleCalendarStore.js     # Google Calendar/Tasks 동기화 + 로컬 fallback
    useQuickLinksStore.js
    useSettingsStore.js
    useTodoStore.js
    useWidgetStore.js
  utils/
    contentUtils.js               # cleanContent() — 마크다운/해시태그/SNS 잡문구 제거
    storage.js                    # load(), save() localStorage 래퍼

supabase/
  schema.sql                      # 기본 테이블 정의
  migrations/
    add_personalization.sql       # diaries, keyword_score_log, keyword_interests 컬럼
    add_fixed_interests.sql       # fixed_interests, onboarding_perms 컬럼
    add_user_qa.sql               # user_qa 테이블
  functions/
    calendar/
    events/
    fitness/
    groq/
    kakao-places/                 # 미사용 (예정)
    smart-widget/
    stocks/
    tasks/
    tavily/
    weather/
```

---

## 4) App.jsx 초기화 흐름

### 4.1 Phase 1 — 인증 부트스트랩

```
mount
  └─ getSession() 명시 호출          ← 레이스 컨디션 방지
  └─ onAuthStateChange 구독
  └─ handleAuthChange(session) 호출
  └─ authBootstrapDone = true
```

### 4.2 Phase 2 — 로그인 후 데이터 초기화

조건: `isLoggedIn=true && user.id` 존재

```
hydrateFromDB() → settings/widgets/todos/diary/briefingHistory 병렬 로드
  └─ fetchAll({ useExistingCache: true })  ← 캐시 우선, 빠른 첫 렌더
  └─ AI 후속 처리 (generateAiTodoOnLoad 등)
  └─ useMidnightTrigger → 새 날 첫 로그인 시 전날 일기 lazy 합성

Fallback: user.id 지연 시 1200ms 타임아웃 후 fetchAll() 단독 실행
```

### 4.3 Phase 3 — 주기적 갱신

1. 탭 visible 복귀 시 `fetchAll({ useExistingCache: true })` (1시간 stale 체크)
2. 5분 주기 폴링 (visible일 때만)
3. 위젯별 수동 새로고침: `force=true`로 캐시 우회
4. 언어 변경: `i18n.on("languageChanged")` → 뉴스/트렌드 강제 재호출 (useDataStore 모듈 레벨)
5. 관심사 변경: `useSettingsStore.subscribe()` → 뉴스만 강제 재호출
6. 자정 polling 제거 → `useMidnightTrigger` 는 **로그인 시 1회** 만 실행: 전날(들) 브리핑 스냅샷 기반 일기 lazy 합성 + 할일 리셋
7. AI 브리핑 1시간 자동 갱신: `BriefingWidget` 내부 `setInterval(60min)`

---

## 5) 상태 관리 (Zustand Stores)

### 5.1 useAuthStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `isLoggedIn` | boolean | localStorage |
| `onboarded` | boolean | localStorage |
| `showOnboarding` | boolean | 메모리 |
| `obStep` | number | 메모리 |
| `selCats` | string[] | DB (`user_settings.fixed_interests`) hydrate |
| `perms` | { fit, cal } | DB (`user_settings.onboarding_perms`) hydrate |
| `persona` | string | DB (`user_settings.persona`) |
| `user` | { id, email, displayName, avatarUrl } | null | 메모리 |
| `providerToken` | string \| null | 메모리 전용 (localStorage 저장 제거됨 — XSS 토큰 탈취 방지) |

**주요 액션:**

- `login()`: Google OAuth. `queryParams.prompt` = `"select_account"` (not `"consent"`) — 재방문 유저에게 매 로그인마다 전체 동의 화면을 강제하지 않음. `access_type: "offline"`으로 최초 동의 시 refresh token 확보.
- `logout()`: 로컬 상태 즉시 초기화 → Supabase signOut
- `handleAuthChange(session)`: 세션 처리, `loadUserSettings()` 호출
- `ensureProviderToken()`: Google access token 획득 — 메모리 캐시 우선, 없으면 `supabase.auth.getSession()` → `refreshSession()` 순으로 복원. localStorage 저장 없음
- `loadUserSettings()`: `user_settings` DB 로드, `fixed_interests`/`onboarding_perms` hydrate, `runPersonalizationBatch()` 백그라운드 실행
- `finishOB()`: 온보딩 완료, `persona`/`fixed_interests`/`onboarding_perms` DB 저장

---

### 5.2 useSettingsStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `theme` | "dark" \| "light" | localStorage |
| `bgImage` | string \| null | localStorage |
| `clockStyle` | "digital" \| "analog" | localStorage |
| `is12Hour` | boolean | localStorage |
| `tempUnit` | "c" \| "f" | localStorage |
| `stockSymbols` | string[] | localStorage |
| `tone` | "friendly" \| "formal" \| "casual" | localStorage |
| `bLen` | "short" \| "medium" \| "long" | localStorage |
| `voiceOn` | boolean | localStorage (현재 UI 미구현) |
| `priorityOrder` | string[] | localStorage |
| `showFirstLoginBriefing` | boolean | localStorage |
| `lastBriefingShown` | date string \| null | localStorage |
| `showFirstLoginModal` | boolean | 메모리 |
| `fixedInterestIds` | string[] | DB (`user_settings.fixed_interests`) |
| `keywordInterests` | `[{keyword, category, score}]` | DB (`user_settings.keyword_interests`) |
| `diaryLanguage` | `"app"` \| `"ko"` \| `"en"` | localStorage. `"app"`=i18n 언어 따름, 나머지는 명시 고정 |
| `pinLockMode` | `"immediate"` \| `"off"` \| `"timed"` | localStorage + DB (`user_settings.pin_lock_mode`). `immediate`=매 진입마다 PIN, `off`=PIN 비활성, `timed`=세션 만료 시각까지 인증 유지 |

**주요 액션:**

- `hydrateFromDB(data)`: DB → 로컬 상태 동기화, `fixed_interests`/`keyword_interests` hydrate, showFirstLoginModal 조건 판단
- `set*`: 각 설정 변경 → localStorage 저장 + DB upsert (`syncSettings()`) + toast
- `addKeywordInterest(keyword, category)`: 중복 없이 추가, score=1 초기화
- `removeKeywordInterest(keyword)`: 제거
- `resetKeywordInterests()`: 전체 초기화
- `bumpKeyword(keyword, category, delta=10)`: 기존 키워드면 score += delta, 없으면 신규 추가. 알림 없이 백그라운드 실행. note 저장·Q&A 답변 저장 시 자동 호출
- `dismissFirstLoginModal()`: 오늘 날짜 기록 → 재표시 방지

**DB sync:** 모든 설정 변경 → `user_settings` upsert (비차단 백그라운드)

---

### 5.3 useDataStore

**상태:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `weather` | `{temp, city, condition, precipitation, airQuality, humidity}` | null |
| `stocks` | `[{name, value, change, up}]` | 정규화된 주식 데이터 |
| `trends` | string[] | 미사용 (trendsResults로 대체) |
| `trendsResults` | `[{title, url, content}]` | 트렌드 실제 데이터 소스 |
| `newsResults` | `[{title, url, content, image, published_date}]` | 뉴스 실제 데이터 소스 |
| `calEvents` | array | 오늘 일정 |
| `healthData` | `{steps, stepsGoal, sleep, sleepGoal, calories, caloriesGoal, heartRate, water, waterGoal}` | |
| `loading` | `{[key]: boolean}` | 위젯별 로딩 상태 |
| `errors` | `{[key]: string}` | 위젯별 에러 메시지 |
| `apiStatus` | `{[key]: "ok"\|"error"\|null}` | API 상태 표시용 |
| `fetchedLanguage` | `{news: string, trends: string}` | 마지막 fetch 시 언어 |
| `lastFetchedAt` | `{[key]: timestamp}` | 마지막 업데이트 시각 |
| `activeWidgetIds` | string[] | fetchAll에서 결정된 표시 위젯 목록 |

**fetch 함수 요약:**

| 함수 | 엔드포인트 | 캐시 키 패턴 |
|------|-----------|-------------|
| `fetchWeather(lat, lon, userId, force)` | `weather` | `weather_{rLat}_{rLon}` |
| `fetchStocks(symbols, userId, force)` | `stocks` | `stocks_{sym1}_{sym2}...` |
| `fetchTrends(userId, force)` | `tavily` | `trends_full_{lang}` |
| `fetchNews(userId, force)` | `tavily` × 2 (병렬) | `news_{location}_{lang}_{interestFingerprint}` |
| `fetchCalendar(userId, force)` | `calendar` | `calendar_today` |
| `fetchHealth(userId, force)` | `fitness` | `health_default` |
| `fetchTomorrowCalendar(userId, force)` | `events` (date 파라미터) | `calendar_{YYYY-MM-DD}` |

**뉴스 fetch 세부:**
- 지역 뉴스 5개 + 글로벌 뉴스 5개 병렬 호출 후 merged (최대 10개)
- 캐시 키: `news_${lang}_${interestFingerprint}` (언어별/관심사별 독립 캐시)
- 관심사 상위 5개를 쿼리에 삽입:
  - 영어: `Top 10 live issues in America: politics, tech, economy, lifestyle trends today. Focus topics: kw1, kw2, ...`
  - 한국어: `대한민국 실시간 주요 뉴스: 정치, 경제, IT, 라이프스타일, 사회 트렌드 오늘. 관심 주제: kw1, kw2, ...`
- 글로벌 쿼리:
  - 영어: `Top world breaking news today: international politics, business, technology, science.`
  - 한국어: `오늘의 세계 주요 뉴스 속보: 국제 정치, 경제, 기술, 과학.`
- `include_domains`: **영어 모드만** `EN_NEWS_DOMAINS` 전달. 한국어 모드는 빈 배열 — Tavily의 한국 도메인 인덱스가 빈약해 화이트리스트를 강제하면 결과 0개가 빈번하던 문제(News #103) 우회. 한국어 필터링은 클라이언트 측 `scoreArticleForLanguage`로 수행.
- `location`(geolocation) 전달 안 함 — 언어별 쿼리로 지역성 표현 대체.

**트렌드 fetch 세부:**
- 관심사 무관 — 세계/국내 실시간 트렌드 전용 쿼리
- 캐시 키: `trends_full_${lang}`
- 한국어: `반드시 한국어 기사 제목만 사용. 영어/일본어/중국어/러시아어 등 외국어 제목 제외. 오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스`
- 영어: `English-language major trending news headlines today worldwide technology AI politics economy entertainment sports latest`
- `include_domains`: 양 언어 모두 `EN_NEWS_DOMAINS` / `KO_NEWS_DOMAINS` 전달 (`fetchTrends` L1395) — 트렌드는 신뢰 도메인 위주가 유리.
- 반환: `trendsResults [{title, url, content}]` (Tavily 기사 제목을 트렌드 키워드로 사용)

**뉴스 언어 필터 (클라이언트 측, `useDataStore.js`):**
- `scoreArticleForLanguage(item, "ko")` (L478–498):
  - title에 한글 점수 > 0 → `titleScore * 4 + hostBonus`
  - content에 한글 점수 > 0 → `contentScore * 2 + hostBonus` (영어 제목이라도 본문 한글이면 통과)
  - KO_NEWS_DOMAINS host → `hostBonus` (2)
  - 위 모두 미달 → `-1` (탈락)
- `filterLocalizedArticles(items, "ko", limit)` (L678–705):
  - 한국어 모드: 점수 음수 탈락 없이 **모두 통과** (Tavily가 영어-한국 기사를 자주 반환 → 다운스트림 `translateArticlesToKorean`이 한글 번역). KO 도메인 기사는 정렬로 앞에 배치.
  - 영어 모드: 점수 > 0 통과, hostBonus≥2(EN_NEWS_DOMAINS)도 통과.
- `filterByAllowedDomains(items, "ko")` (L664–676): **정렬 전용**. KO_NEWS_DOMAINS 매칭 기사를 앞으로 정렬할 뿐 누락시키지 않음 (이전 하드 필터 → sort-only 변경, 신뢰 도메인 외 한국어 기사 누락 방지).

**트렌드 인메모리 캐시:**
- `_trendsMemCache` (모듈 레벨 맵): `fetchTrends` 1순위 체크 — hit 시 loading 없이 즉시 표시.
- `warmupTrendsMemCache(userId)`: `fetchAll` 시 `fetchTrends`와 병렬 실행. 양 언어(`ko`/`en`) DB 캐시를 메모리로 미리 적재. `_trendsWarmupPromise` 게이트로 부팅당 1회 보장. ko 캐시에 한국어 결과 0개면 warm-up 생략(stale 영어 캐시 방지).
- 언어 불일치 stale 캐시 감지: `fetchTrends`에서 DB 캐시 read 후 `lang === "ko"` && 한국어 결과 0개이면 캐시 무시 후 fresh fetch.

**외부 리스너 (모듈 레벨):**

```js
// 언어 변경 → 뉴스 + 트렌드 재호출 (캐시 우선, 언어별 독립 키)
i18n.on("languageChanged", () => { ... });

// 관심사 변경 → 뉴스만 강제 재호출 (트렌드는 관심사 무관)
useSettingsStore.subscribe((state) => {
  const fingerprint = getInterestFingerprint(state.keywordInterests);
  if (fingerprint !== _prevInterestFingerprint) fetchNews(userId, true);
});
```

- 언어 변경 리스너는 `force=true` 미사용. 캐시 키가 `news_${lang}_*` / `trends_full_${lang}` 로 언어별 독립이라 신규 언어 캐시가 hit이면 그대로 사용, miss이면 자연스러운 fresh fetch. "강제 재호출"이라는 표현 대신 "재호출 (캐시 우선)" 으로 이해해야 정확.
- 관심사 변경 리스너만 `force=true` 사용 — fingerprint가 바뀌면 즉시 새 쿼리로 fresh fetch가 필요하므로.

---

### 5.4 useWidgetStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `vis` | `{[widgetId]: boolean}` | localStorage + DB |
| `layouts` | `{[breakpoint]: array}` | localStorage + DB |
| `editMode` | boolean | 메모리 |
| `smartKeywords` | string[] | localStorage + DB |
| `smartWidgetData` | `{[keyword_lang]: data}` (예: `"카메라_ko"`, `"camera_en"`) | localStorage |
| `widgetSettings` | `{[widgetId]: {viewType, interestsEnabled}}` | localStorage |
| `globalFontSize` | "small" \| "medium" \| "large" | localStorage |
| `activeWidgetSettings` | string \| null | 메모리 (현재 설정 열린 위젯 ID) |

**주요 액션:**

- `hydrateFromDB()`: vis, layouts, smart_keywords DB → 로컬 동기화
- `toggleVis/closeWidget/setVis`: 위젯 표시 제어
- `handleLayoutChange/saveDraggedLayout/resetLayout`: 그리드 레이아웃 관리
- `loadSmartWidget(kw, force)`: aiService로 스마트 위젯 콘텐츠 생성. 캐시 키는 `${kw}_${lang}` (언어별 독립 저장)
- `addSmartWidget/removeSmartWidget/refreshSmartWidget`: 스마트 위젯 CRUD. 삭제 시 `kw`, `kw_ko`, `kw_en` 세 키 모두 정리
- 언어 변경 시: 모듈 레벨 `i18n.on("languageChanged")` → 모든 smartKeywords에 `loadSmartWidget(kw, false)` 호출 (캐시 우선)
- `setWidgetSetting(widgetId, key, value)`: 위젯별 설정 변경
- `setGlobalFontSize(size)`: 전체 글자 크기 변경 — 변경 시 `useFontSize()` 훅을 사용하는 모든 위젯(NewsWidget, TrendsWidget, WeatherWidget, HealthWidget, SmartWidgetContent, DiaryCard, CalendarWidget, StocksWidget, BriefingWidget 모달)에 즉시 반영
- `openWidgetSettings(widgetId)/closeWidgetSettings()`: 설정 모달 제어

**DB sync:** vis → `user_settings`, layouts → `widget_layouts`, smartKeywords → `smart_keywords` (전체 삭제 후 재삽입)

---

### 5.5 useDiaryStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `entries` | `{[date]: {diary, aiGeneratedDiary, editedDiary, notes, memo, feedback}}` | localStorage + DB |
| `diaryAnswers` | `{[date]: string[]}` | DB |
| `todayQA` | `[{question, answer}]` | DB |
| `wasActiveToday` | boolean | 메모리 |
| `pinSet` | boolean | localStorage |
| `isPinAuthenticated` | boolean | 세션 메모리 |

**feedback 필드 구조:**

```js
feedback: {
  rating: "like" | "dislike" | null,
  history: [{ at: ISO, text: string }],  // 누적 피드백
  pendingRewrite: string | null,          // 확정 전 임시 재작성본
  confirmedAt: ISO | null,
}
```

**주요 액션:**

- `setPIN/verifyPIN/clearPinAuth/resetPIN`: PIN 관리 — `setPIN`/`verifyPIN`은 async. 저장 시 Web Crypto API SHA-256 해시로 변환. `verifyPIN` 호출 시 구형 평문 PIN이 남아있으면 자동 마이그레이션
- `getDiary/saveDiary/saveMemo`: 로컬 + `diaries` 테이블 upsert
- `saveGeneratedDiary(dateStr, diaryText)`: AI 생성 일기 저장. `aiGeneratedDiary` + `diary` 동시 세팅, `editedDiary` 초기화
- `addAnswer(dateStr, question, answer)`: `user_qa` 테이블 insert
- `hydrateFromDB()`: `diaries` + `user_qa` DB → 로컬 동기화
- `setFeedbackRating(dateStr, rating)`: like/dislike 토글. 일기 내용은 변경하지 않음
- `applyFeedbackRewrite(dateStr, feedbackText, language)`: `aiGeneratedDiary` + 누적 feedback → Groq `rewriteDiaryWithFeedback` 호출 → 결과를 `feedback.pendingRewrite`에 저장
- `confirmRewrite(dateStr)`: `pendingRewrite` → `diary`/`editedDiary` 덮어쓰기 + DB sync. 되돌릴 수 없음
- `discardPendingRewrite(dateStr)`: `pendingRewrite` 초기화
- Mock 데이터(2026-03-25/26/27)가 기본 포함, localStorage 데이터가 우선

---

### 5.6 useBriefingHistoryStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `byDate` | `{[YYYY-MM-DD]: Snapshot[]}` | localStorage (`mb_briefing_history`) + Supabase `briefing_snapshots` |

**Snapshot 구조:**

```js
{
  capturedAt: ISO,           // 저장 시각
  source: "auto"|"refresh", // 자동(3h 간격) vs 수동 refresh
  text: string,              // 브리핑 detail 전문
  summary: string,           // 1줄 요약
  sections: array,           // 섹션 구조체
}
```

**저장 정책 (`shouldSave`):**

- `source === "refresh"` → 무조건 저장
- 그날 첫 저장이면 → 저장
- 마지막 저장 이후 ≥3시간 경과 → 저장

**주요 액션:**

- `addSnapshot(snapshot)`: 오늘 날짜로 snapshot 추가. localStorage + Supabase `briefing_snapshots` insert (테이블 미존재 시 조용히 무시)
- `getSnapshotsForDate(date)`: 해당 날짜 snapshot 배열 반환
- `getLastSavedAt(date)`: 마지막 저장 시각 (ISO)
- `shouldSave(source)`: 저장 정책 판단 → true/false
- `clearDate(date)`: 해당 날짜 snapshot 전체 삭제 (일기 합성 완료 후 호출)
- `hydrateFromDB()`: Supabase `briefing_snapshots` → 로컬 동기화. 앱 로그인 시 자동 실행

**Supabase 테이블 (옵션, 미생성 시 localStorage only):**

```sql
-- briefing_snapshots
user_id     uuid
date        date
captured_at timestamptz
source      text  -- "auto" | "refresh"
payload     jsonb -- { text, summary, sections }
```

---

### 5.7 useTodoStore

**상태:** `todos: [{id, text, completed, isFixed}]` (localStorage + DB)

**주요 액션:**

- `ensureDailyReset()`: 날짜 경계 시 비고정 할일 삭제, 고정 할일 미완료 리셋
- `hydrateFromDB()`: DB → 로컬 동기화
- `toggleTodo/addTodo/addRecurringTodo/deleteTodo`: CRUD
- `addAiTodos(aiTodos)`: AI 생성 할일 일괄 추가 (소문자 기준 중복 제거)
- Optimistic update: 로컬 상태 먼저 반영 → DB upsert (임시 ID → 실제 UUID 교체)

---

### 5.8 useGoogleCalendarStore

**상태:** `events`, `tasks`, `taskLists`, `selectedTaskListFilter`, `selectedDate`, `loading`, `error`

**주요 액션:**

- `fetchEvents()`: 월 단위 Google Calendar 이벤트 로드, 실패 시 로컬 캐시 fallback
- `fetchTasks()`: Google Tasks + task list 로드, list filter 지원
- `fetchEventsAndTasks()`: 선택 날짜 기준 이벤트/태스크 동시 hydrate
- `addTask/updateTask/deleteTask()`: Google Tasks가 실제 지원하는 `title`, `notes`, `due`, `completed`, `taskListId` 중심으로 저장
- 레거시 `[MB_META]...[/MB_META]` task metadata는 읽을 때 제거하고, 새 저장에는 더 이상 쓰지 않음

---

### 5.9 useQuickLinksStore

**상태:** `links: [{id, name, url, icon, color}]` (localStorage)

기본 링크: Naver, YouTube, Instagram, Google

---

## 6) 데이터 캐시 아키텍처

### 6.1 캐시 계층

```
1. 메모리 캐시  : 위치 정보 (GEO_CACHE_MS = 5분)
2. localStorage : mb_cache_{key} (fallback)
3. DB 캐시      : api_cache 테이블 (TTL 1시간)
```

### 6.2 캐시 키 패턴

| 데이터 | 캐시 키 |
|--------|---------|
| 날씨 | `weather_{rLat}_{rLon}` |
| 주식 | `stocks_{sym1}_{sym2}_...` |
| 트렌드 | `trends_full_{lang}` |
| 뉴스 | `news_{locationLabel}_{lang}_{interestFingerprint}` |
| 캘린더 | `calendar_today` |
| 건강 | `health_default` |

`interestFingerprint` = 관심 키워드 상위 5개 `join("+")` 또는 `"base"`

### 6.3 fetch 공통 패턴

```
1. cacheKey 계산
2. force=false → readApiCache 확인 (DB, 1시간 TTL)
3. 캐시 hit → 상태 반영 후 종료 (markFetched(key, fetchedAt))
4. 캐시 miss → Edge Function 호출 (25초 timeout)
5. 성공 → 정규화 + writeApiCache + 상태 업데이트 + apiStatus="ok"
6. 실패 → errors 기록 + mock fallback + apiStatus="error"
```

### 6.4 자동 재호출 트리거

| 트리거 | 대상 | 방식 |
|--------|------|------|
| 언어 변경 | 뉴스 + 트렌드 + Smart Widget | `i18n.on("languageChanged")` (모듈 레벨, useDataStore + useWidgetStore 각각) — force=false, 언어별 캐시 우선 |
| 관심사 변경 | 뉴스만 | `useSettingsStore.subscribe()` fingerprint 비교 |
| 탭 복귀 | 전체 | App.jsx visibility 이벤트 (1시간 stale 체크) |
| 5분 폴링 | 전체 | App.jsx setInterval |
| 수동 새로고침 | 개별 위젯 | force=true 직접 호출 |

---

## 7) 위젯 시스템

### 7.1 레이아웃 구조 (DashboardLayout)

```
┌──────────────┬──────────────────────────────┬──────────┐
│  Col A (30%) │        Col B (50%)           │ Col C    │
│              │                              │  (20%)   │
│ BriefingWidget│  CalendarWidget             │ Weather  │
│ DiaryCard    │  (달력 + Events + Tasks)     │ Stocks   │
│              │                              │ Trends   │
│              │                              │ Health   │
│              │                              │ News     │
│              │                              │ Smart*   │
└──────────────┴──────────────────────────────┴──────────┘
```

비율: **Brief+Diary(30%) : Calendar(50%) : 추가 위젯 패널(20%)**

- Col A: `flex: 3`, `height: calc(100vh - 6rem)` (Brief 3/5 + Diary 2/5 수직 분할)
- Col B: `flex: 5`, Calendar sticky (PIN 모달 활성 시 sticky 해제)
- Col C: `width: 20%` 고정, `overflow-hidden` + CSS transition으로 접기/펼치기
  - 패널 닫기 시 → Col A/B가 `flex 3:5` 비율로 자동 확장 (각각 37.5%, 62.5%)
  - 전환 애니메이션: `width/max-width/opacity` 0.38s cubic-bezier
- Col C 내부: `custom-scrollbar`, `overflow-y-auto`, `max-height: DASHBOARD_VIEWPORT_H`
- Col C 패널 토글: TopNav 햄버거 → `toggle-widget-panel` 커스텀 이벤트 → DashboardLayout handler
- **스크롤 정책**: 전역 `wheel` 이벤트 캡처는 기본 스크롤 동작을 깨뜨리므로 금지. 스크롤 동작 변경은 각 컬럼의 `overflow`/`height` CSS만으로 처리.

### 7.2 WidgetCard 공통 기능

- 헤더: 드래그 핸들 + 수동 새로고침 + 닫기 버튼
- 새로고침 아이콘 클릭 → 개별 fetch `force=true`
- 닫기 → `closeWidget(widgetId)` (vis=false)
- apiStatus "ok"/"error" 표시

### 7.3 위젯별 상세

#### NewsWidget

- 데이터: `newsResults [{title, url, content, image, published_date}]`
- 뷰 타입: `widgetSettings.news.viewType` ("text" | "news" | "grid")
- 기본 표시 수 (`MAX_ITEMS`):

  | fontKey | text | news | grid |
  |---------|------|------|------|
  | small   | 5    | 5    | 9    |
  | medium  | 4    | 4    | 6    |
  | large   | 3    | 3    | 3    |

- 더보기 클릭 시 **grid 고정 모달**(`NewsAllModal`) 진입 — 전체 기사 스크롤 가능, 인라인 확장 없음
- 클릭 → 해당 기사 URL 직접 이동 (`<a target="_blank">`)
- `cleanContent()` 로 마크다운/SNS 잡문구 제거 후 표시

**text 뷰:** 제목 + 요약 2줄 카드 나열
**news 뷰:** 썸네일(64×56) + 제목 + 요약 2줄
**grid 뷰:** 3열 정사각 이미지 + 제목 그라디언트 오버레이

#### TrendsWidget

- 데이터: `trendsResults [{title, url, content}]` (string 배열 `trends` 미사용)
- 기본 표시 수:

  | fontKey | 기본 |
  |---------|------|
  | small   | 2    |
  | medium  | 3    |
  | large   | 3    |

- 더보기 클릭 시 인라인 확장, 최대 6개
- 확장 후 "접기" 버튼으로 다시 축소 가능
- 클릭 → 해당 기사 URL 직접 이동
- pill 형태: `line-clamp-2` (truncate 없음, 최대 2줄 줄바꿈)
- 관심사 반영 없음 — 세계/국내 실시간 트렌드 전용
- 새로고침 시 expanded 상태 자동 초기화

#### WeatherWidget

- 데이터: `weather {temp, city, condition, precipitation, airQuality, humidity}`
- 온도 단위 토글 (C/F 변환)
- 습도%, 강수량%, 공기질 3가지 지표 그리드 표시

#### StocksWidget

- 데이터: `stocks [{symbol, name, value, change, up}]` (`symbol` 필드는 drag 재정렬 시 순서 저장에 사용)
- 위젯 본체 최대 표시 `WIDGET_LIMIT = 6`, 초과 시 "전체 보기" 버튼 → 읽기 전용 `StocksViewAllModal` 진입 (종목명 + 가격 + 변동률 + 통화(`CURRENCY_MAP` 기반))
- 심볼 선택/추가/삭제:
  - 기본 4종(KOSPI, NASDAQ, S&P 500, USD/KRW) 토글
  - 커스텀 티커 직접 입력 → Edge Function으로 유효성 검증 후 추가 (`validateStockSymbol`)
  - 순서는 `useSettingsStore.stockSymbols` 배열로 영구 저장
- 관리 모달(DnD 재정렬): 기어 아이콘 → 인라인 설정 패널 → "순서 관리" 버튼으로 진입
- Drag-and-drop 재정렬 (관리 모달):
  - `@hello-pangea/dnd` 사용, compact 3열 카드 레이아웃 (`flex flex-wrap`, `calc(33.333% - 5.5px)`)
  - Framer Motion `style={{ x: "-50%", y: "-50%" }}` 이 CSS transform containing block을 만들어 `position: fixed` 드래그 좌표를 망가뜨림 → `createPortal(card, document.body)`로 탈출
  - 드래그 중 카드가 backdrop(`z-9999`) 뒤에 숨는 문제 → `zIndex: 10001` 강제 override
- Edge Function (`supabase/functions/stocks/index.ts`) fetch 전략:
  1. **TwelveData** (primary): `KS11/XKOS`, `IXIC`, `SPX`, `USD/KRW` 심볼 사용
  2. TwelveData 오류 **또는 `price <= 0`** → **Stooq CSV fallback**
     - 고정 심볼 매핑: `KS11→^ks11`, `IXIC→^ndq`, `SPX→^spx`
     - 커스텀 심볼: `sym.us` 시도 후 price=0이면 bare `sym` 재시도 (순차 loop, 첫 번째 양수 값 반환)
  3. USD/KRW: TwelveData 실패 시 `open.er-api.com` fallback
  - ⚠️ Edge Function 로컬 수정 후 반드시 Supabase Dashboard에서 수동 배포 필요

#### HealthWidget

- 데이터: `healthData {steps, stepsGoal, sleep, sleepGoal, calories, caloriesGoal, heartRate}`
- 걸음 수 (초록 progress bar) + 수면 (인디고 progress bar)
- 심박수, 칼로리, 수분 카드 그리드

#### CalendarWidget

- 데이터: `calEvents` (오늘 일정)
- 달력 그리드 + 이벤트 인디케이터
- **헤더 3단 드릴다운** (인플레이스 교체):
  - `"month"` 레벨: "May 2026 ▾" 클릭 → `"year"` 레벨 (12개월 3×4 grid)
  - `"year"` 레벨: "2026 ▾" 클릭 → `"decade"` 레벨 (decade±1 ~ decade+10, 12년 3×4 grid)
  - 월/연도 선택 시 한 단계 아래로 복귀; `Today` 버튼은 month 레벨에서만 표시
  - 좌우 화살표: 레벨에 따라 달/연/10년 단위 이동
  - 뷰 전환(`handleCycleView`) 시 헤더 레벨 자동 리셋
- `Today` 버튼으로 현재 달 즉시 복귀
- 월/주/일 뷰 전환 시 열려 있던 `Date Details` 자동 닫힘

#### BriefingWidget

- 데이터: weather, stocks, trends, calEvents(현재 시각 이후 미종료 이벤트만 필터), **tomorrowEvents**, todos, newsResults, trendsResults, smartSummaries, keywordInterests, **fixedInterestIds**, persona
- **결정론적 섹션 + 좁은 AI 보강 패턴** (`aiService.generateDetailedBriefing`):
  - JS로 섹션 구조·순서 고정 → 새로고침 변동성 제거
  - Groq 호출은 3개로 한정(`temperature: 0.1`, 사실 외 생성 금지 가드): 어제 일기 재작성 / 고정 관심사별 1문장 / 스마트 키워드 요약
- 섹션 순서:
  1. `header` — 날짜 + 날씨 결합 한 줄. 날씨 상태 → 이모지 매핑(`getWeatherEmoji`).
  2. `schedule` — 시간대 분기. 오전(5–12): 오늘 일정. 오후·저녁(≥12): 오늘 남은 일정 + 내일 일정(`tomorrowEvents`).
  3. `yesterday` — 어제 일기/메모를 1–2문장 과거형 사실로 재작성(Groq #1).
  4. `interests` — `fixedInterestIds` 중 `news/tech/finance/health/food/entertainment`에 대해 각각 한 문장(Groq #2). 데이터 부족 항목은 "오늘 새로운 정보가 없습니다".
  5. `latest_info` — `subBlocks: [관심 키워드, 주요 뉴스 Top 3]`. 관심 키워드는 스마트 위젯 bullets 요약(Groq #3), 뉴스는 `newsResults[0..2]` + URL 호스트명 출처.
  6. `market` (조건부) — `fixedInterestIds` 에 `finance` 포함 시 stocks Top 4.
- 반환: `{ summary, detail, sections, timeMode }`. `sections` 는 `[{ id, title, lines, subBlocks? }]`. `detail` 은 후방호환용 평문.
- 모달 렌더링: `divide-y` 섹션 블록 + 굵은 카테고리 제목 + `subBlocks` 하위 헤더(작은 글자, 들여쓰기). 본문 라인(`sb.lines`, `section.lines`, `detailLines`)에 `useFontSize(1.2).body` 적용 — 다른 위젯 대비 1.2× 크기.
- 언어 일치: 모든 섹션 제목·내용·Groq 프롬프트가 `getLangConfig()` 기반으로 ko/en 분기.
- `i18n.language` watch `useEffect`: 언어 변경 시 `briefingVersions` 캐시 비우고 즉시 재생성. 사용자가 언어를 바꾸면 모달·대시보드 미리보기 모두 현재 언어로 즉시 반영.
- `useDataStore.fetchTomorrowCalendar`: 오후·저녁 모드의 "내일 일정"용. `events` Edge Function의 `date` 파라미터 활용, `calendar_{YYYY-MM-DD}` DB 캐시.

**갱신 및 저장 정책:**

- **1시간 자동 갱신**: 초기 생성 완료 후 `setInterval(60min)` 로 자동 regenerate
- **스냅샷 저장**: 생성 완료 후 `useBriefingHistoryStore.shouldSave()` 판단 → true면 `addSnapshot()` 호출
  - 첫 저장이거나 마지막 저장 이후 ≥3시간 → `source: "auto"` 로 저장
  - manual refresh → `source: "refresh"` 로 무조건 저장
- **일정 필터**: 브리핑 컨텍스트에 투입되는 `calEvents`는 현재 시각 이후 미종료 이벤트만 포함
- 아침 자동일기(`ensureYesterdayDiaryForMorning`): `language: resolveDiaryGenerationLanguage()` + `interests: effectiveInterests` 전달.

#### SmartWidgetContent

- ID 형식: `smart_{keyword}`
- `smartWidgetData[keyword]`에서 콘텐츠 읽기; 캐시 키: `${keyword}_${lang}` (언어별 독립 저장)
- aiService로 키워드 기반 개인화 콘텐츠 생성
- 섹션/불릿/태그 형태로 렌더링
- 새로고침/삭제/외부 링크 지원
- Tavily 2단계 fetch: 한국어 결과 < 2개이면 `include_domains: KO_NEWS_DOMAINS`로 재호출 후 dedupe 머지
- `filterSmartResults(items, isKo)`: Hangul/Latin 정규식으로 언어 감지, 일치 결과 ≥1개면 해당 언어만, 0개면 전체 fallback
- Groq bullets에 한글 없으면 번역 재요청(추가 1회), 한글 검증된 항목만 채택
- 두 섹션만 렌더: `type === "summary"` (Groq bullet 3-4개) + `type === "news"` (관련 뉴스 2-3개, 새 탭 이동)
- Tavily `r.content` 스니펫을 `[제목]\n본문` 형식으로 Groq에 전달 → 제목 나열 금지 프롬프트

#### DiaryCard

- 데이터: 오늘의 질문 + `diaryAnswers[today]`
- PIN 인증 후 접근
- 질문 응답 입력 → `user_qa` 테이블 저장
- **레이아웃 정책**: 카드 전체 `flex flex-col`. 질문 영역은 `flex-shrink-0 max-h-[40%] overflow-y-auto` (길어지면 내부 스크롤, textarea 침범 방지). textarea는 `flex-1 min-h-[3rem]` (남은 공간 차지, 최소 3rem 보장).
- `fixedInterestIds` 구독 → `generatePersonalizedQuestion()` 에 전달 → `INTEREST_TOPIC_MAP` 기반 관심사 주제 1개 + 일반 주제 1개 혼합 질문 생성
- **관심사 bump**: 답변 저장 시 단순 키워드 추출 → `useSettingsStore.bumpKeyword(kw, "qa", 5)` 자동 호출 (score +5/키워드)
- `questionCacheRef = useRef({})`: 언어별 질문 캐시(`{ko: "질문", en: "question"}`). 언어 전환 시 캐시에 해당 언어 질문이 있으면 API 호출 없이 즉시 복원.

#### DiaryPanel

- 일기 표시 + 직접 편집 + 메모 편집
- **Feedback UI**:
  - 일기가 존재할 때 패널 하단에 Like / Dislike 버튼 노출
  - Dislike 클릭 → 피드백 텍스트 입력 + "재작성" 버튼
  - 재작성 → `useDiaryStore.applyFeedbackRewrite()` → Groq → `pendingRewrite` 미리보기 렌더링
  - 미리보기 상태에서 "다시 재작성" 가능 (baseline은 항상 `aiGeneratedDiary`)
  - "확정" 클릭 → `ConfirmDialog` 경고("되돌릴 수 없습니다") → `confirmRewrite()` → DB 동기화
  - "취소" → `discardPendingRewrite()` → 미리보기 제거
- **메모 → 관심사**: 메모 저장 시 단순 키워드 추출 → `bumpKeyword(kw, "note", 10)` 자동 호출

---

## 8) 모달 목록

| 모달 | 역할 |
|------|------|
| `OnboardingModal` | 최초 카테고리 선택, 페르소나 선택, 권한 토글 |
| `SettingsModal` | 테마, 시계, 온도 단위, 주식 심볼, 우선순위, 브리핑 모달 토글 |
| `BriefSettingsModal` | AI 브리핑 어조 + 길이 선택 |
| `FirstLoginBriefingModal` | 당일 첫 로그인 시 브리핑 표시 (REQ-WS-006), 오늘 날짜 기록으로 재표시 방지 |
| `WidgetSettingsModal` | 뉴스 뷰 타입 선택(text/news/grid), 스마트 위젯 관심사 반영 토글 |
| `PINModal` | 일기 접근 PIN 입력/확인 |
| `DiaryListModal` | 날짜별 일기 목록 조회 |
| `NewsDetailModal` | **현재 미사용** — 직접 URL 이동으로 대체됨 |
| `NewsAllModal` (인라인) | NewsWidget "더보기" 클릭 시 전체 뉴스 grid 표시 — `createPortal` + `AnimatePresence`, 별도 파일 없이 NewsWidget.jsx 내부에 정의 |
| `StocksViewAllModal` (인라인) | StocksWidget "View more" 클릭 시 읽기 전용 전체 종목 grid — 종목명 + 가격 + 변동률 + 통화 표시, StocksWidget.jsx 내부에 정의 |

---

## 9) Edge Functions

🔒 = Supabase JWT 인증 필수 (Authorization: Bearer {user_access_token})

| 함수 | 엔드포인트 | 인증 | 입력 | 출력 |
|------|-----------|------|------|------|
| `weather` | `/functions/v1/weather` | — | `{lat, lon}` | `{temp, city, condition, humidity, precipitation, airQuality}` |
| `stocks` | `/functions/v1/stocks` | — | `{symbols: string[]}` | `[{symbol, price, change, changePercent}]` |
| `tavily` | `/functions/v1/tavily` | — | `{query, mode, max_results, location, include_domains}` | 뉴스: `{answer, results, location}` / 트렌드: `{trends, answer, results}` |
| `groq` | `/functions/v1/groq` | — | `{system, prompt, model?, temperature?}` | `{text}` — 응답 `Content-Type: application/json; charset=utf-8` 명시 (UTF-8 글자깨짐 방지) |
| `events` 🔒 | `/functions/v1/events` | JWT | `{token, action?, ...}` | Google Calendar 이벤트 CRUD. action: list(기본)/create/update/delete/read |
| `tasks` 🔒 | `/functions/v1/tasks` | JWT | `{token, action?, taskListId?}` | Google Tasks CRUD. action: list(기본)/create/update/delete/move/clearCompleted |
| `fitness` 🔒 | `/functions/v1/fitness` | JWT | `{token}` | `{steps, sleep, calories, heartRate}` |
| `smart-widget` 🔒 | `/functions/v1/smart-widget` | JWT | `{keyword, persona, token?, ...context}` | 개인화 콘텐츠 구조체 |
| `kakao-places` | `/functions/v1/kakao-places` | — | `{query, lat, lon}` | 장소 검색 결과 (현재 미사용) |

**JWT 인증 방식:** 클라이언트는 `supabase.auth.getSession()` → `session.access_token`을 Authorization 헤더로 전송. 서버는 `supabase.auth.getUser(jwt)`로 검증 후 미인증 시 401 반환. `invokeGoogleFunction` (useGoogleCalendarStore), `invokeEdgeDetailed` (useDataStore) 모두 user JWT 우선 전송.

**Tavily Edge Function 내부 처리:**

- `cleanTitle(raw)`: 기사 제목에서 "- 사이트명" 접미사, 마크다운 문자 제거
- 트렌드 모드: 검색 결과 기사 제목을 직접 `trends` 배열로 반환 (구 `toHashtag()` 방식 제거)
- `include_domains` 파라미터로 한국 뉴스 도메인 필터링 지원

---

## 10) DB 스키마

> **2026-05-30 Supabase 변경 대비:** 2026-05-30부터 신규 테이블에 자동 GRANT가 중단되므로, 각 테이블 생성 직후 명시적 GRANT 블록이 `schema.sql`·`migrations/*.sql`에 포함돼 있음 (규칙 7 참고).

### 기본 테이블 (schema.sql)

#### user_settings (PK: id = auth.users.id)

```sql
persona                   text default 'default'
theme                     text default 'dark'
tone                      text default 'casual'
briefing_length           text default 'medium'
voice_on                  boolean default false
clock_style               text default 'digital'
bg_image                  text
vis                       jsonb default '{}'
stock_symbols             jsonb
priority_order            jsonb
show_first_login_briefing boolean
last_briefing_shown       date
keyword_interests         jsonb default '[]'   -- [{keyword, category, score}]
keyword_interests_updated date
fixed_interests           jsonb default '[]'   -- 온보딩 고정 관심사 id 배열
onboarding_perms          jsonb default '{"fit": false, "cal": false}'
pin_lock_mode             text default 'immediate'  -- "immediate" | "off" | "timed"
created_at / updated_at   timestamptz
```

#### widget_layouts (PK: id)

```sql
layouts        jsonb default '{}'   -- {lg, md, sm} breakpoint 배열
layout_version int default 1
```

#### todos (PK: id)

```sql
user_id      uuid
text         text
done         boolean
completed    boolean
is_fixed     boolean
is_recurring boolean (generated always as (is_fixed) stored)
```

#### smart_keywords (PK: id, UNIQUE: user_id+keyword)

```sql
user_id  uuid
keyword  text
```

#### api_cache (PK: id = text)

```sql
id         text    -- e.g. "u:{userId}:news_KR_ko_base"
user_id    uuid
data       jsonb
fetched_at timestamptz
```

TTL은 앱 레벨에서 1시간 체크.

---

### 마이그레이션 테이블

#### diaries (add_personalization.sql, UNIQUE: user_id+date)

```sql
user_id    uuid
date       date
diary_text text
memo       text
answers    jsonb default '[]'   -- 날짜별 Q&A 응답 배열
updated_at timestamptz (trigger 자동 갱신)
```

#### keyword_score_log (add_personalization.sql)

```sql
user_id     uuid
keyword     text
category    text check (category in ('food','place','content','shopping','lifestyle','mood','interest'))
source      text check (source in ('personal','diary'))
base_weight float
logged_date date default current_date
```

인덱스: `(user_id, logged_date)`

#### user_qa (add_user_qa.sql)

```sql
user_id    uuid
question   text
answer     text
asked_date date default current_date
```

인덱스: `(user_id, asked_date)`

---

### RLS 정책

모든 테이블: `auth.uid() = user_id(또는 id)` 조건, SELECT/INSERT/UPDATE/DELETE 각각 정책 설정.

### Triggers

`update_updated_at()` 함수: `user_settings`, `widget_layouts`, `diaries`의 `updated_at` 자동 갱신.

---

## 11) 개인화 로직

### 11.1 목적

Q&A 응답에서 관심 키워드를 추출·누적해 뉴스 쿼리 품질과 AI 브리핑 개인화를 높인다.

### 11.2 키워드 추출 규칙

1. AI(Groq) 출력은 JSON 배열만 허용
2. category는 고정 목록만 허용: `food | place | content | shopping | lifestyle | mood | interest`
3. keyword는 검색 가능한 명사 형태로 정규화
4. 무효 category, 빈 keyword 제거

### 11.3 점수 계산 (30일 윈도우)

$$score = \sum \left(base\_weight \times \frac{30 - elapsed\_days}{30}\right), \quad elapsed\_days < 30$$

- personal 질문: base_weight = 2
- 일기(diary): base_weight = 1

### 11.4 처리 흐름

```
하루 Q&A/일기 수집 (source=personal|diary)
  └─ 자정 배치 (runPersonalizationBatch via useMidnightTrigger)
  └─ AI → JSON 키워드 배열 추출
  └─ keyword_score_log 적재
  └─ 집계 결과 → user_settings.keyword_interests 캐시 갱신
  └─ 30일 초과 로그 정리
```

### 11.5 뉴스 쿼리 반영

`fetchNews` 실행 시:
1. `fixedInterestIds` + `keywordInterests`를 merge한 관심사 목록 계산
2. score 내림차순 상위 5개 추출
3. 한국어: `관심: kw1, kw2, ...` / 영어: `topics: kw1, kw2, ...` 쿼리에 삽입
4. `interestFingerprint = topKeywords.join("+") || "base"` → 캐시 키 포함

트렌드는 관심사 미반영 — 세계/국내 실시간 트렌드 전용.

### 11.6 관심사 적용 범위 (전체)

| 적용 지점 | 방식 | 파일 |
|-----------|------|------|
| **뉴스 쿼리** | 관심사 상위 5개를 Tavily 쿼리에 삽입 | `useDataStore.js` |
| **상세 AI 브리핑 — 관심사 섹션** | `fixedInterestIds` 중 news/tech/finance/health/food/entertainment 각각에 대해 newsResults/stocks/trendsResults/smartSummaries에서 사실 1개 선택 → JSON 출력 → 섹션 라인. 미지원 id는 "기타: ..." 라벨로 묶음 | `aiService.generateInterestSentences()` |
| **상세 AI 브리핑 — 시장 섹션 (조건부)** | `fixedInterestIds.includes("finance")` + stocks 데이터 존재 시만 노출 | `aiService.generateDetailedBriefing()` |
| **단순 AI 브리핑** | `keywordInterests` → `Interest guidance:` 줄로 Groq 프롬프트에 포함 | `aiService.generateBriefing()` |
| **Diary Q&A 질문** | `fixedInterestIds` → `INTEREST_TOPIC_MAP` → 관심사 주제 1개 + 일반 주제 1개 혼합 | `aiService.generatePersonalizedQuestion()` |
| **AI 일기 자동 생성** | `interests` + `briefingSnapshots`(시간대별 브리핑 텍스트) + `previousDayDiary/Feedback` → `promptContext`에 포함 | `aiService.generateDiary()` |
| **브리핑 스코어러 / 페르소나** | `fixedInterestIds` + `keywordInterests` 병합 → `interests` 배열 | `personaContext.buildPersonaContext()` |
| **Q&A 답변 → score bump** | 답변 저장 시 단순 토큰화 → `bumpKeyword(kw, "qa", 5)` | `DiaryCard.jsx` |
| **메모(note) → score bump** | 메모 저장 시 단순 토큰화 → `bumpKeyword(kw, "note", 10)` | `DiaryPanel.jsx` |

### 11.7 일기 생성 흐름

```
새로운 날 첫 로그인
  └─ useMidnightTrigger (마운트 시 1회)
  └─ recoverMissedDiaries(): lastAccess → today까지 skipped 날짜 순회
      └─ 각 날짜: useBriefingHistoryStore.getSnapshotsForDate(date)
          ├─ 스냅샷 0건 → 일기 skip (접속 안 한 날)
          └─ 스냅샷 있음 → generateAndSaveDiaryForDate(date, { briefingSnapshots })
              └─ buildDiaryGenerationContext():
                  - briefingSnapshots: 시간대별 브리핑 texts (최대 6개, 앞 200자)
                  - previousDayDiary: 전날 일기 (최대 400자)
                  - previousDayFeedback: 전날 피드백 누적 (최대 200자)
              └─ aiService.generateDiary() → Groq → diaryText
              └─ useDiaryStore.saveGeneratedDiary(date, diaryText)
              └─ useBriefingHistoryStore.clearDate(date) ← 스냅샷 정리
```

### 11.8 일기 재작성 흐름

```
DiaryPanel → Dislike 클릭
  └─ feedbackText 입력 + "재작성" 클릭
  └─ useDiaryStore.applyFeedbackRewrite(date, feedbackText, language)
      └─ baseline = aiGeneratedDiary (불변)
      └─ feedbackHistory에 새 항목 추가
      └─ aiService.rewriteDiaryWithFeedback({ originalDiary: baseline, feedbackHistory, language })
          └─ Groq → 재작성 일기 텍스트
      └─ feedback.pendingRewrite = rewritten
  → "다시 재작성" 클릭: 동일 baseline + 누적 feedbackHistory로 반복 가능
  → "확정" 클릭:
      └─ ConfirmDialog 경고 → 승인 시
      └─ useDiaryStore.confirmRewrite(date)
          └─ diary = pendingRewrite, editedDiary = pendingRewrite
          └─ DB upsert (edited_diary)
          └─ pendingRewrite = null, confirmedAt = now()
  → "취소": discardPendingRewrite → pendingRewrite = null
```

**INTEREST_TOPIC_MAP** (ko/en × 8): `news`, `tech`, `fashion`, `finance`, `health`, `food`, `entertainment`, `sports` → 각 언어별 자연어 주제 문구로 매핑. 관심사가 없으면 기존 `TOPIC_POOL` 랜덤 선택으로 fallback.

**일기 언어 결정 흐름:**
```
resolveDiaryGenerationLanguage()  [diaryGenerationService.js, exported]
  1. useSettingsStore.diaryLanguage === "ko" | "en" → 명시 설정 우선
  2. 아니면 i18n.language → "en"/"ko" 매핑
```
`BriefingWidget`의 아침 자동일기(`ensureYesterdayDiaryForMorning`)와 로그인 시 lazy 합성(`useMidnightTrigger → generateAndSaveDiaryForDate`) 모두 이 함수를 사용해 언어 일관성 보장.

---

## 12) 유틸리티 / 훅 / 상수

### 12.1 src/utils/

| 파일 | 내보내는 것 |
|------|------------|
| `contentUtils.js` | `cleanContent(text)`: 마크다운 헤더·볼드·이탤릭·링크, 해시태그(`#word`), "follow us/subscribe/sign up/newsletter/click here" 제거, 줄바꿈 → 공백 정규화 |
| `storage.js` | `load(key, fallback)`, `save(key, value)`: localStorage 래퍼 |
| `interests.js` | 고정(온보딩) + 동적(학습) 관심사 통합 관리. `normalizeFixedInterestIds(items)` (소문자 중복제거), `buildFixedInterests(ids)` (ID → `{id, keyword, label, category, score:1000, source:"onboarding", fixed:true}` 객체 변환), `mergeInterestLists(fixedIds, dynamicInterests)` (score 내림차순 병합), `getTopInterestKeywords(fixedIds, dynamic, limit)` (상위 N개 키워드 문자열 배열), `getInterestFingerprint(fixedIds, dynamic)` (top keywords join "+" → 캐시 키용). 8개 고정 ID: news·tech·fashion·finance·health·food·entertainment·sports |
| `taskRecurrence.js` | 할일 날짜 처리. `doesTaskOccurOnDate(task, dateStr)` (task.date/due/occurrenceDate와 YYYY-MM-DD 비교), `isTaskCompletedOnDate(task, dateStr)` (날짜 일치 + completed=true 여부), `materializeTasksForDate(tasks, dateStr)` (날짜 기준 필터 + occurrenceDate·seriesStartDate 정규화), `getTaskDisplayDate(task)` (날짜 문자열 앞 10자 추출) |
| `personaContext.js` | `buildPersonaContext(fixedInterestIds, keywordInterests, persona)` — `mergeInterestLists()`로 통합된 관심사 목록을 브리핑 스코어러/Groq 프롬프트에 전달 |

### 12.2 src/hooks/

| 훅 | 역할 |
|----|------|
| `useMidnightTrigger` | 로그인 시 1회 실행. 전날(들) 브리핑 스냅샷이 있으면 일기 lazy 합성 → 스냅샷 정리. 새 날이면 todo 리셋. 자정 60초 polling 없음 |
| `useTheme` | `isDark, cardCls, listItemBgCls, secondaryBgCls, muted, hoverCls, borderCls` 등 테마 CSS 클래스 반환 |
| `useFontSize(multiplier?)` | `useWidgetStore.globalFontSize` 구독 → `{ body: {fontSize}, title: {fontSize}, key }` 반환. `body`: small=10/medium=12/large=14px, `title`: small=12/medium=14/large=16px. `multiplier`(기본 1.0) 로 배율 조정 가능 (BriefingWidget 모달: 1.2). 인라인 `style` 반환으로 Tailwind arbitrary value 없이 적용. |

### 12.3 src/constants/

| 상수 | 내용 |
|------|------|
| `CATEGORIES` | 8가지 카테고리 (news, tech, fashion, finance, health, food, entertainment, sports) |
| `FIXED_WIDGETS` | 왼쪽 고정: briefing, diary / 오른쪽 고정: calendar, todo |
| `STANDARD_WIDGETS` | weather, stocks, trends, health, news, smart |
| `WIDGET_LIST` | 전체 위젯 목록 |
| `DEFAULT_VIS` | 기본 위젯 표시 여부 |
| `DEFAULT_LAYOUTS` | lg/md/sm 브레이크포인트 기본 그리드 위치 |
| `DEFAULT_PRIORITY_ORDER` | 중간 컬럼 위젯 기본 순서 |

---

## 13) i18n

- **한국어 표시 보정:** 한국어 모드에서 Tavily 결과가 영어로 와도 `useDataStore`가 기사 제목/요약을 한국어로 후처리 번역해 `newsResults`, `trendsResults`에 반영

- **지원 언어:** 영어(en, 기본값), 한국어(ko)
- **저장:** localStorage에 언어 설정 유지
- **언어 변경 시:** `i18n.changeLanguage()` → `languageChanged` 이벤트 → useDataStore 리스너가 뉴스/트렌드 force refresh
- **API 연동:** 언어에 따라 Tavily 쿼리 언어 전환 + 한국어 시 한국 뉴스 도메인 필터 적용
- **Diary 질문 카드:** 현재 앱 언어에 맞춰 질문 생성 언어와 UI 문구를 함께 전환

---

## 14) Supabase 설정 요약

### 14.1 필수 환경 변수

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

선택적으로 사용할 수 있는 디버그 변수:

```env
VITE_DEBUG_FLOW=1
```

Google Maps / Places key 정책:

1. `VITE_GOOGLE_MAPS_API_KEY`는 로컬 `.env` 또는 배포 환경 변수에만 둔다
2. 실제 키는 Git에 커밋하지 않고 `.env.example`만 공유한다
3. Google Cloud에서 `HTTP referrers` 제한을 건다
4. Places autocomplete는 브라우저에서 동작하므로 Supabase secret로 대체할 수 없다

### 14.2 Google OAuth Scope

```text
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/tasks
https://www.googleapis.com/auth/fitness.activity.read
```

### 14.3 보안 원칙

1. 서드파티 API 키는 Supabase Secrets에서만 관리
2. 클라이언트 코드 하드코딩 금지
3. RLS로 사용자 데이터 격리
4. Google OAuth token은 메모리(Zustand)에만 보관 — localStorage 저장 금지
5. 사용자 개인 데이터에 접근하는 Edge Function(events/tasks/fitness/smart-widget)은 Supabase JWT 필수 검증
6. Diary PIN은 SHA-256 해시 후 저장 — 평문 저장 금지
7. Data API GRANT는 SQL 파일에 명시적으로 기재 (2026-05-30부터 Supabase 자동 GRANT 중단)

### 14.4 Cloudflare Workers 배포

`wrangler.jsonc` (레포 루트) 필수:
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
- `not_found_handling: "single-page-application"`: OAuth 콜백(`/?code=xxx`) 및 딥링크가 404 대신 `index.html`을 받도록 — SPA 라우팅 필수.
- 이 파일 없이 `npx wrangler versions upload` 실행 시 `Missing entry-point to Worker script or to assets directory` 오류로 배포 실패.

**GCP OAuth 앱 검증 (개발자 액션 필요):**
- 앱이 "Testing" 상태이면 비-테스트 유저에게 "확인하지 않은 앱" 경고 노출.
- Calendar/Tasks(sensitive) + Fitness(restricted) 스코프 요청 → Google 검증 필수. restricted Fitness 스코프는 연 1회 CASA 보안 평가 추가.
- 대안: `useAuthStore.js`에서 `fitness.*` 스코프 3종 제거 → sensitive-only로 검증 난이도 감소.

---

## 15) 운영 체크리스트

### 15.1 배포 전

1. 환경 변수 확인
2. Auth/DB/RLS 정책 확인
3. Edge Functions 배포 상태 확인
4. 마이그레이션 실행 여부 확인 (`add_personalization.sql`, `add_user_qa.sql`, `add_fixed_interests.sql`)

### 15.2 런타임 확인

1. 로그인 직후 위젯 즉시 렌더 여부
2. 수동 새로고침 (force=true) 정상 동작 여부
3. 뉴스/트렌드 아이템 클릭 → 외부 URL 이동 여부
4. 언어 전환 → 해당 언어 결과 재호출 여부
5. 관심사 변경 → 뉴스 자동 재호출 여부
6. 캘린더/패널/PIN 흐름 정상 여부
7. 자정 트리거 → 할일 리셋 + 개인화 배치 실행 여부

### 15.3 장애 시 우선 점검

1. `handleAuthChange` 호출 여부
2. `user.id` 세팅 여부
3. `fetchAll` 진입 여부
4. `visibleWidgets` 계산 결과
5. Edge Function 응답 (ok/error/timeout) 로그
6. `api_cache` 테이블 데이터 존재 여부

---

## 16) 알려진 미완성 항목

| 항목 | 상태 |
|------|------|
| Google Calendar 실 API 연동 | Edge Function 구현됨, 프론트 store는 Mock 기반 |
| Google Fitness 실 API 연동 | Edge Function 구현됨, 실 토큰 연동 필요 |
| kakao-places 함수 | 구현됨, 프론트에서 미사용 |
| 음성 기능 (voiceOn) | 상태는 존재, UI/TTS 구현 없음 |
| keyword_score_log 자동 집계 | runPersonalizationBatch 호출됨, 내부 상세 로직 미확인 |
| NewsDetailModal | 파일 존재하나 미사용 (직접 URL 이동으로 대체) |
| 위젯 상세 팝업 모달 | news/stocks "전체 보기" 모달 구현됨; trends 상세보기(좌우 버튼 넘기기)는 미구현 |
| 스마트 위젯 포맷 정의 | 일반 위젯 양식 기반 포맷 미확정 |
| Diary PIN 설정 기능 | 설정 내 PIN 저장/수정, 본인 확인 질문 authenticate 미구현 |
| Stocks Edge Function 배포 | 로컬 수정 완료, Supabase Dashboard 수동 배포 후 KOSPI/NASDAQ/SP500 정상값 확인 필요 |
| groq Edge Function 배포 | charset=utf-8 헤더 추가, Supabase Dashboard 수동 배포 필요 |
| i18n 전체 적용 완료 | 대시보드, 설정, 브리핑 전 영역에 언어 설정 반영 마무리 |

---

## 17) 문서 관리 규칙

1. 신규 문서는 임시 작성 후 DOCS.md로 병합
2. 병합 완료 후 임시 문서는 삭제
3. 동일 주제는 DOCS.md 내부 단일 섹션만 유지
4. 코드 변경 시 관련 섹션(위젯/스토어/스키마) 동시 업데이트

---

## 18) 2026-05-16 — Widget Round 4 (News / Stocks / AI Briefing)

### News: 한국어 모드 엄격 도메인 필터

- **파일**: `src/store/useDataStore.js`
- `filterByAllowedDomains`의 "결과 0 → unfiltered fallback" 로직 제거.  
  `lang=ko`일 때 KO_NEWS_DOMAINS 화이트리스트(naver.com, yna.co.kr, chosun.com, joins.com, hani.co.kr, news1.kr) 필터 결과가 비어 있으면 빈 배열 반환 — 영어 기사 노출 완전 방지.
- `fetchNews`의 `fallbackLocalResults` / `fallbackGlobalResults` 경로도 제거.  
  캐시 읽기 경로(`dbCached`)에서도 동일하게 `filterLocalizedArticles` 결과만 사용.
- 영어 모드(`lang !== "ko"`) 동작 변화 없음.

### News: 모달 뷰 리스트 레이아웃

- **파일**: `src/components/widgets/NewsWidget.jsx`
- 기존 `showAllModal` 내 `grid grid-cols-3 aspect-square` 그리드 → 수직 스크롤 리스트로 교체.
- 각 row: 왼쪽 썸네일(80×56 px 고정) + 오른쪽 타이틀 2줄 clamp + source 표시.
- `allItems.slice(0, 10)` — 최대 10개 표시.
- `divide-y` 구분선, 테마 hover 색 적용.

### Stocks: 통합 모달 (설정 패널 + 순서 관리 + 전체 보기 → 단일 모달)

- **파일**: `src/components/widgets/StocksWidget.jsx`
- 제거: `showSettings`(설정 드롭다운), `showViewAll`(전체보기 모달), `STOCK_OPTIONS`(preset 토글), `toggleSymbol`, `customSymbols` memo, `presetIds`.
- 대시보드 헤더의 ⚙ 설정 아이콘 → `+` 아이콘으로 교체, 클릭 시 통합 모달 오픈.
- "View More" 버튼 → 동일한 통합 모달 오픈.
- **통합 모달 구조**:
  1. 헤더 (타이틀 + 닫기)
  2. 티커 입력 칸 + Add 버튼 (모달 상단, 고정)
  3. 드래그-리오더 카드 그리드 (@hello-pangea/dnd, 기존 애니메이션 그대로)
  4. 각 카드 우상단 X 버튼 → `ConfirmDialog` (확인/취소) → 확인 시 삭제
- **기존 사용자 데이터**: `stockSymbols` 배열 구조 변경 없음. KOSPI/NASDAQ/SP500/USDKRW는 alias map 통해 정상 작동.
- 미사용 i18n 키 제거: `symbol_settings`, `select_symbols`, `manage_order`, `remove_symbol`.
- 신규 i18n 키 추가: `confirm_delete_title`, `confirm_delete_message` (en/ko).

### Stocks: 지수 티커 범용 지원 (Edge Function)

- **파일**: `supabase/functions/stocks/index.ts`
- **기존 문제**: symbolMap에 없는 지수(VIX, DJI, RUT, N225, HSI, FTSE, GDAXI 등)는 Yahoo가 `^PREFIX` 형식을 요구하는데 bare symbol로 조회해서 항상 `--` 반환.
- **해결 방식 (하드코딩 없음)**:
  - `fetchYahooQuote`: primary 심볼로 조회 실패 시 `^${symbol}` 자동 재시도. yahooSymbolMap에 없는 심볼만 적용.
  - `fetchStooqPrice`: 기본 후보 배열을 `[sym.us, ^sym, sym]`으로 확장 — Stooq 인덱스 `^vix`, `^dji` 등 자동 커버.
  - TwelveData 브랜치는 변경 없음 (실패 시 새 Yahoo/Stooq 체인으로 자연히 낙하).
- **재배포 필요**: `supabase functions deploy stocks`

### AI Briefing: 관심사(Interests) 섹션 제거

- **파일**: `src/services/aiService.js`
- `FIXED_INTEREST_LABELS_LOCALIZED`, `SUPPORTED_INTEREST_IDS` 상수 삭제.
- `generateInterestSentences` 함수 삭제 (~107 lines).
- `Promise.all` 병렬 호출에서 `generateInterestSentences` 제거; `[diaryRewrite, smartSummary]` 두 개만 유지.
- `// ── 5) 관심사 …` 섹션 블록 (`sections.push({ id: "interests", ... })`) 삭제.
- "오늘 최신 정보" (latest_info) 섹션이 smart keyword + Top 3 뉴스로 유사한 정보를 이미 커버.

### AI Briefing: 대시보드 미리보기 섹션 분리 (CSS line-clamp)

- **파일**: `src/components/widgets/BriefingWidget.jsx`
- **기존**: 모든 섹션 내용을 `·` 구분자로 이어붙인 단일 `<p>` + 바이너리 서치 높이 피팅 (~50 lines).
- **변경**: `displayBriefing.sections`를 순회해 `divide-y` 섹션 구조로 렌더링.  
  각 섹션: 9px 대문자 타이틀 + 11px 내용 (`-webkit-line-clamp: 2`으로 2줄 자동 트리밍).  
  `overflow-hidden` 컨테이너가 하단 초과 섹션 클리핑.
- 제거: `dashboardDetailText` useMemo, `dashboardDetailPreview` useState, `detailPreviewRef` useRef, `fitDashboardDetailPreview` useCallback, 관련 useEffect 2개, `useCallback` import.
- 모달 뷰는 변경 없음 (기존 divide-y 섹션 구조 그대로).

---

## 19) 2026-05-16 — Briefing/Diary 자동화 버그 수정 (Fix A–E)

### Fix A: BriefingWidget `ensureYesterdayDiaryForMorning` 제거

- **파일**: `src/components/widgets/BriefingWidget.jsx`
- **문제**: 브리핑 생성 시 전날 일기가 없으면 자동으로 일기를 생성하고 `saveDiary`로 저장했으나,
  이 경로는 `saveGeneratedDiary` 대신 `saveDiary`를 사용해 `aiGeneratedDiary` baseline이 세팅되지 않았다.
  결과적으로 사용자 피드백 반영 재작성(rewrite) 흐름이 깨졌다.
- **해결**: `ensureYesterdayDiaryForMorning` 함수 전체 삭제, `autoDiaryStatusRef` 삭제, `saveDiary` 셀렉터 삭제.
  전날 일기는 `diaryEntries[yesterdayDateStr]?.diary`에서 그대로 읽어 context에 주입.
  자동 일기 생성은 `useMidnightTrigger`의 전담 경로(Fix B/C 참조)로만 수행.

### Fix B: `useMidnightTrigger` hydrate 완료 후 실행

- **파일**: `src/App.jsx`
- **문제**: `useMidnightTrigger(isLoggedIn)`가 로그인 직후 store hydrate(DB 조회)가 끝나기 전에 발화해
  빈 데이터로 일기 생성을 시도하거나 중복 시도가 발생했다.
- **해결**: `hydrateComplete` boolean state 추가.
  `Promise.all([...hydrateFromDB])` 완료 직후 `setHydrateComplete(true)`, 로그아웃 시 `false` 리셋.
  `useMidnightTrigger(isLoggedIn && hydrateComplete)`로 게이팅.

### Fix C: `useBriefingHistoryStore` 날짜 UTC→로컬 수정

- **파일**: `src/store/useBriefingHistoryStore.js`
- **문제**: `const todayStr = () => new Date().toISOString().slice(0, 10)` — UTC 기준 날짜라서
  KST(UTC+9) 또는 PT(UTC-8) 환경에서 자정 전후 스냅샷이 엉뚱한 날짜 key에 저장됐다.
- **해결**: `import { formatLocalDate } from "../utils/date"` 추가,
  `const todayStr = () => formatLocalDate()`로 교체 → 로컬 시간 기준 YYYY-MM-DD.

### Fix D: `BriefingWidget.yesterdayDateStr` UTC→로컬 수정

- **파일**: `src/components/widgets/BriefingWidget.jsx`
- **문제**: `new Date().toISOString().slice(0, 10)` 기반 useMemo로 "어제" 날짜를 계산해
  KST 자정 직후 UTC 기준으로 하루 앞선 날짜를 읽어 전날 일기를 찾지 못했다.
- **해결**: `import { shiftDateString, formatLocalDate } from "../../utils/date"` 추가,
  `const yesterdayDateStr = shiftDateString(formatLocalDate(), -1)`로 교체.

### Fix E: `initialGenDoneRef` → `useState` 변환

- **파일**: `src/components/widgets/BriefingWidget.jsx`
- **문제**: `const initialGenDoneRef = useRef(false)`는 변경돼도 리렌더를 트리거하지 않아
  1시간 interval useEffect의 deps 배열에 `[initialGenDoneRef.current]`를 넣어도
  ref가 `true`로 바뀌는 시점에 interval이 등록되지 않았다.
  결과: 초기 생성 완료 후 1시간 자동 재생성이 실행되지 않았다.
- **해결**: `const [initialGenDone, setInitialGenDone] = useState(false)`로 교체.
  `setInitialGenDone(true)` 호출 시 리렌더가 발생하고 interval useEffect deps `[initialGenDone]`이
  정상적으로 interval을 등록한다.

---

## 20) 2026-05-16 — AI Briefing: 가짜 캘린더 일정 노출 버그 수정

### 증상

AI 브리핑 "Today's schedule / 오늘 일정" 섹션에 사용자의 실제 일정과 무관한 항목들이 항상 같은 내용으로 노출됨:

- `CSE 416 팀 미팅`
- `점심 약속`
- `라이브러리 스터디`
- `헬스장 운동`

### 원인

`src/mock/data.js`의 `mockCalendarEvents` 하드코딩 fallback이 AI 브리핑 컨텍스트로 흘러들어감.

- Google OAuth `provider_token`이 없는 사용자(이메일/비번 가입, 토큰 만료 등) → `fetchCalendar()`가 mock 데이터를 `calEvents`로 set.
- mock 항목은 `time: "09:00"` 같은 문자열만 보유하고 실제 `start`/`endTime` ISO datetime이 없음.
- `BriefingWidget`의 방어용 `endTime >= now` 필터(L146–156)는 `endTime=undefined`라서 mock 이벤트를 그대로 통과시킴.
- `aiService.generateDetailedBriefing()`은 빈 배열일 때만 "일정 없음"을 출력하므로 mock 4개가 LLM 프롬프트에 주입.

### 과거 일정 누락 검증

`supabase/functions/events/index.ts`의 `getListRange()` L286 — `todayOnly: true`일 때 `timeMin: now.toISOString()` 사용. Google API 단계에서 이미 과거 일정 제외됨. 위젯도 endTime 기준 추가 필터를 적용. **실제 Google Calendar 데이터에서 과거 일정 누락 경로 없음.** 보고된 가짜 항목은 mock fallback 단일 원인.

### 해결

- **파일**: `src/store/useDataStore.js`
- L10 `mockFetchCalendarEvents` import 제거.
- `fetchCalendar`의 4개 mock fallback 분기를 빈 배열로 교체:
  1. `if (!supabase)` 분기 → `set({ calEvents: [] })`
  2. `if (!token)` 분기 (Google OAuth 미연결) → `set({ calEvents: [] })`
  3. edge 응답이 비배열인 else 분기 → `set({ calEvents: cached("calendar", []) })`
  4. catch 블록 → `set({ calEvents: cached("calendar", []) })`
- `fetchTomorrowCalendar`는 이미 token 없을 때 빈 배열 반환 — 변경 없음.

### 영향 범위

- AI 브리핑 `calEvents` 컨텍스트만 영향. 진짜 일정이 없으면 "일정 없음 / No events"로 정직하게 표시.
- Calendar 위젯은 별도 store(`useGoogleCalendarStore`) 사용 — 무영향.
- Diary 자동 생성(`diaryGenerationService.fetchCalendarEventsForDate`)은 `event.start || event.date` 필터로 mock을 이미 걸러내고 있어 무영향.
- `mockCalendarEvents` export는 `src/mock/data.js`에 그대로 둠 — 다른 mock 데이터와 단일 파일 일관성 유지 (import만 끊으면 번들에서 빠짐).

### 회귀 위험

낮음. `aiService.generateDetailedBriefing()`의 morning/afternoon 모드 모두 빈 calEvents 배열을 "일정 없음 / No events" 메시지로 graceful 처리. 기존 Google OAuth 연결 사용자는 동일하게 실제 calendar 이벤트만 받음.

---

## 21) 2026-05-16 — News/Trends 로직 문서 정합화

### 배경

`DOCS.md` § 5.3의 "뉴스 fetch 세부 / 트렌드 fetch 세부 / 뉴스 언어 필터 / 외부 리스너" 섹션이 News #103 fix 이전의 옛 동작을 기술하고 있어 실제 코드(`src/store/useDataStore.js`)와 불일치. 코드는 의도된 fix 상태로 정상 작동 중이므로 **문서만** 갱신.

### 발견된 불일치 (Audit 요약)

| DOCS.md 기술 | 실제 코드 |
|---|---|
| `관심: kw1, kw2` | `관심 주제: kw1, kw2` / `Focus topics: ...` (`useDataStore.js` L1530) |
| 한국어 모드 `include_domains: KO_NEWS_DOMAINS` 전달 | 한국어 모드 빈 배열 `[]` 전달 (L1539) — Tavily 한국 도메인 인덱스 빈약 우회 |
| 트렌드 ko 쿼리 `오늘 대한민국 …` | prefix `반드시 한국어 기사 제목만 사용 …` 추가됨 (L1394) |
| 트렌드 en 쿼리 `today major trending news …` | `English-language major trending news headlines today …` (L1393) |
| `filterByAllowedDomains` 하드 필터, 결과 0 → 원본 유지 | **정렬 전용** (L667–676) |
| (문서 누락) | `scoreArticleForLanguage` ko 분기에 content Hangul 인정 (L489–493) |
| (문서 누락) | `filterLocalizedArticles` ko 모드 전체 통과 + 정렬 (L691–698) |
| `// 언어 변경 → 뉴스 + 트렌드 **강제** 재호출` | 리스너가 `force=true` 없이 호출 — 캐시 키가 언어별이라 stale 누락 없음 (L1995–2004) |

### 갱신 내용

- § 5.3 "뉴스 fetch 세부 / 트렌드 fetch 세부 / 뉴스 언어 필터" 블록을 코드와 1:1 매칭되게 재작성.
- 한국어 모드 `include_domains` 빈 배열 처리 명시 (Tavily 한국 도메인 인덱스 빈약 우회).
- `filterByAllowedDomains`: 하드 필터 → 정렬 전용으로 변경된 동작 명시.
- `scoreArticleForLanguage` ko 분기에 content Hangul 인정 추가됨을 명시.
- `filterLocalizedArticles` ko 모드의 "전체 통과 + translateArticlesToKorean" 흐름 명시.
- 뉴스/트렌드 캐시 키 포맷 (`news_${lang}_${fingerprint}`, `trends_full_${lang}`) 명시.
- 뉴스/트렌드 ko/en 쿼리 문자열 실제 값으로 업데이트.
- 외부 리스너 코멘트의 "강제 재호출" 문구를 "재호출 (캐시 우선, 언어별 독립 키)" 로 정정 — 캐시가 언어별 키잉되어 stale 누락 없음. force=true 미사용 의도를 본문에 한 줄 추가.

### Tavily Edge Function 점검 (`supabase/functions/tavily/index.ts`)

- `include_domains` 조건부 추가 (L46–48) — 빈 배열이면 전달 안 함 ✓
- `location` 조건부 추가 (L50–55) — lat/lon 모두 있어야 전달 ✓
- 디폴트 query (L24) — 클라이언트 측에서 항상 query 명시하므로 미사용 (안전망 역할만) ✓
- 변경 불필요.

### 코드 변경 없음

`src/store/useDataStore.js`, `supabase/functions/tavily/index.ts` 모두 미수정. 본 작업은 순수 문서 정합화.

### 회귀 위험

없음. 문서 외 파일 변경 0건. News #103 fix 이후의 한국어/영어 뉴스 정상 동작은 그대로 유지.
