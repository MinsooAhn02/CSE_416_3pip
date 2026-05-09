# MorningBriefing.AI - 통합 프로젝트 문서

> 최종 정리일: 2026-05-09 (2차)
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
    aiService.js                  # Groq LLM 호출 (브리핑 생성, 개인화 배치)
  store/
    useAuthStore.js
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
hydrateFromDB() → settings/widgets/todos/diary 병렬 로드
  └─ fetchAll({ useExistingCache: true })  ← 캐시 우선, 빠른 첫 렌더
  └─ AI 후속 처리 (generateAiTodoOnLoad 등)

Fallback: user.id 지연 시 1200ms 타임아웃 후 fetchAll() 단독 실행
```

### 4.3 Phase 3 — 주기적 갱신

1. 탭 visible 복귀 시 `fetchAll({ useExistingCache: true })` (1시간 stale 체크)
2. 5분 주기 폴링 (visible일 때만)
3. 위젯별 수동 새로고침: `force=true`로 캐시 우회
4. 언어 변경: `i18n.on("languageChanged")` → 뉴스/트렌드 강제 재호출 (useDataStore 모듈 레벨)
5. 관심사 변경: `useSettingsStore.subscribe()` → 뉴스만 강제 재호출
6. 자정: `useMidnightTrigger` → 할일 리셋 + 개인화 배치

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
| `providerToken` | string | null | 메모리 |

**주요 액션:**

- `login()`: Supabase Google OAuth 호출
- `logout()`: 로컬 상태 즉시 초기화 → Supabase signOut
- `handleAuthChange(session)`: 세션 처리, `loadUserSettings()` 호출
- `ensureProviderToken()`: Google access token 획득/캐시
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

**주요 액션:**

- `hydrateFromDB(data)`: DB → 로컬 상태 동기화, `fixed_interests`/`keyword_interests` hydrate, showFirstLoginModal 조건 판단
- `set*`: 각 설정 변경 → localStorage 저장 + DB upsert (`syncSettings()`) + toast
- `addKeywordInterest(keyword, category)`: 중복 없이 추가, score=1 초기화
- `removeKeywordInterest(keyword)`: 제거
- `resetKeywordInterests()`: 전체 초기화
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

**뉴스 fetch 세부:**
- 지역 뉴스 5개 + 글로벌 뉴스 5개 병렬 호출 후 merged (최대 10개)
- 관심사 상위 5개를 쿼리에 삽입: 한국어 `관심: kw1, kw2`, 영어 `topics: kw1, kw2`
- 한국어 모드: `include_domains: ["news.naver.com", "yna.co.kr", "chosun.com", "joins.com", "hani.co.kr", "news1.kr"]`

**트렌드 fetch 세부:**
- 관심사 무관 — 세계/국내 실시간 트렌드 전용 쿼리
- 한국어: `오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스`
- 영어: `today major trending news worldwide technology AI politics economy entertainment sports latest`
- 반환: `trendsResults [{title, url, content}]` (Tavily 기사 제목을 트렌드 키워드로 사용)

**외부 리스너 (모듈 레벨):**

```js
// 언어 변경 → 뉴스 + 트렌드 강제 재호출
i18n.on("languageChanged", () => { ... });

// 관심사 변경 → 뉴스만 강제 재호출 (트렌드는 관심사 무관)
useSettingsStore.subscribe((state) => {
  const fingerprint = getInterestFingerprint(state.keywordInterests);
  if (fingerprint !== _prevInterestFingerprint) fetchNews(userId, true);
});
```

---

### 5.4 useWidgetStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `vis` | `{[widgetId]: boolean}` | localStorage + DB |
| `layouts` | `{[breakpoint]: array}` | localStorage + DB |
| `editMode` | boolean | 메모리 |
| `smartKeywords` | string[] | localStorage + DB |
| `smartWidgetData` | `{[keyword]: data}` | localStorage |
| `widgetSettings` | `{[widgetId]: {viewType, interestsEnabled}}` | localStorage |
| `globalFontSize` | "small" \| "medium" \| "large" | localStorage |
| `activeWidgetSettings` | string \| null | 메모리 (현재 설정 열린 위젯 ID) |

**주요 액션:**

- `hydrateFromDB()`: vis, layouts, smart_keywords DB → 로컬 동기화
- `toggleVis/closeWidget/setVis`: 위젯 표시 제어
- `handleLayoutChange/saveDraggedLayout/resetLayout`: 그리드 레이아웃 관리
- `loadSmartWidget(kw, force)`: aiService로 스마트 위젯 콘텐츠 생성
- `addSmartWidget/removeSmartWidget/refreshSmartWidget`: 스마트 위젯 CRUD
- `setWidgetSetting(widgetId, key, value)`: 위젯별 설정 변경
- `setGlobalFontSize(size)`: 전체 글자 크기 변경
- `openWidgetSettings(widgetId)/closeWidgetSettings()`: 설정 모달 제어

**DB sync:** vis → `user_settings`, layouts → `widget_layouts`, smartKeywords → `smart_keywords` (전체 삭제 후 재삽입)

---

### 5.5 useDiaryStore

**상태:**

| 필드 | 타입 | 저장 |
|------|------|------|
| `entries` | `{[date]: {diary, memo}}` | localStorage + DB |
| `diaryAnswers` | `{[date]: string[]}` | DB |
| `wasActiveToday` | boolean | 메모리 |
| `pinSet` | boolean | localStorage |
| `isPinAuthenticated` | boolean | 세션 메모리 |

**주요 액션:**

- `setPIN/verifyPIN/clearPinAuth/resetPIN`: PIN 관리
- `getDiary/saveDiary/saveMemo`: 로컬 + `diaries` 테이블 upsert
- `addAnswer(dateStr, question, answer)`: `user_qa` 테이블 insert
- `hydrateFromDB()`: `diaries` + `user_qa` DB → 로컬 동기화
- Mock 데이터(2026-03-25/26/27)가 기본 포함, localStorage 데이터가 우선

---

### 5.6 useTodoStore

**상태:** `todos: [{id, text, completed, isFixed}]` (localStorage + DB)

**주요 액션:**

- `ensureDailyReset()`: 날짜 경계 시 비고정 할일 삭제, 고정 할일 미완료 리셋
- `hydrateFromDB()`: DB → 로컬 동기화
- `toggleTodo/addTodo/addRecurringTodo/deleteTodo`: CRUD
- `addAiTodos(aiTodos)`: AI 생성 할일 일괄 추가 (소문자 기준 중복 제거)
- Optimistic update: 로컬 상태 먼저 반영 → DB upsert (임시 ID → 실제 UUID 교체)

---

### 5.7 useGoogleCalendarStore

**상태:** `events`, `tasks`, `taskLists`, `selectedTaskListFilter`, `selectedDate`, `loading`, `error`

**주요 액션:**

- `fetchEvents()`: 월 단위 Google Calendar 이벤트 로드, 실패 시 로컬 캐시 fallback
- `fetchTasks()`: Google Tasks + task list 로드, list filter 지원
- `fetchEventsAndTasks()`: 선택 날짜 기준 이벤트/태스크 동시 hydrate
- `addTask/updateTask/deleteTask()`: Google Tasks가 실제 지원하는 `title`, `notes`, `due`, `completed`, `taskListId` 중심으로 저장
- 레거시 `[MB_META]...[/MB_META]` task metadata는 읽을 때 제거하고, 새 저장에는 더 이상 쓰지 않음

---

### 5.8 useQuickLinksStore

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
| 언어 변경 | 뉴스 + 트렌드 | `i18n.on("languageChanged")` (모듈 레벨) |
| 관심사 변경 | 뉴스만 | `useSettingsStore.subscribe()` fingerprint 비교 |
| 탭 복귀 | 전체 | App.jsx visibility 이벤트 (1시간 stale 체크) |
| 5분 폴링 | 전체 | App.jsx setInterval |
| 수동 새로고침 | 개별 위젯 | force=true 직접 호출 |

---

## 7) 위젯 시스템

### 7.1 레이아웃 구조 (DashboardLayout)

```
┌─────────────────────────────────────────────────────┐
│ 왼쪽 (1/5)      │ 중간 (3/5)       │ 오른쪽 (1/5)    │
│ BriefingWidget  │ WeatherWidget    │ SmartWidgets    │
│ DiaryCard       │ StocksWidget     │ (keyword별)     │
│                 │ TrendsWidget     │                 │
│                 │ HealthWidget     │                 │
│                 │ NewsWidget       │                 │
│                 │ CalendarWidget   │                 │
└─────────────────────────────────────────────────────┘
```

- 중간 컬럼: 슬라이더 deck 방식 (버튼 + 트랙패드 가로 스와이프, 브라우저 히스토리 오작동 방지)
- 오른쪽: 스마트 위젯 (`smart_{keyword}` ID 형식)
- 전체: `@hello-pangea/dnd` 드래그앤드롭, breakpoint(lg/md/sm) 반응형

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

- 더보기 클릭 시 인라인 확장, 최대 10개
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
  | small   | 7    |
  | medium  | 5    |
  | large   | 4    |

- 더보기 클릭 시 인라인 확장, 최대 12개
- 클릭 → 해당 기사 URL 직접 이동
- pill 형태: `line-clamp-2` (truncate 없음, 최대 2줄 줄바꿈)
- 관심사 반영 없음 — 세계/국내 실시간 트렌드 전용

#### WeatherWidget

- 데이터: `weather {temp, city, condition, precipitation, airQuality, humidity}`
- 온도 단위 토글 (C/F 변환)
- 습도%, 강수량%, 공기질 3가지 지표 그리드 표시

#### StocksWidget

- 데이터: `stocks [{name, value, change, up}]`
- 심볼별 현재가 + 등락폭 표시
- 심볼 변경 시 `fetchStocks` 재호출

#### HealthWidget

- 데이터: `healthData {steps, stepsGoal, sleep, sleepGoal, calories, caloriesGoal, heartRate}`
- 걸음 수 (초록 progress bar) + 수면 (인디고 progress bar)
- 심박수, 칼로리, 수분 카드 그리드

#### CalendarWidget

- 데이터: `calEvents` (오늘 일정)
- 달력 그리드 + 이벤트 인디케이터
- `Today` 버튼으로 현재 달 즉시 복귀
- 월/주/일 뷰 전환 시 열려 있던 `Date Details` 자동 닫힘

#### BriefingWidget

- 데이터: weather, stocks, trends, calEvents, todos, keywordInterests, persona, priorityOrder
- Groq LLM 호출 (`/functions/v1/groq`) → AI 브리핑 생성
- 브리핑 3가지 길이(short/medium/long) 캐시
- 어조(tone) + 길이(bLen) 설정 반영
- 어제 메모 + 오늘 일정/할일을 컨텍스트로 포함
- `effectiveInterests = mergeInterestLists(fixedInterestIds, keywordInterests)` → 상세/단순 브리핑 모두 `Interest guidance:` 포함
- 아침 자동일기(`ensureYesterdayDiaryForMorning`): `language: resolveDiaryGenerationLanguage()` + `interests: effectiveInterests` 전달

#### SmartWidgetContent

- ID 형식: `smart_{keyword}`
- `smartWidgetData[keyword]`에서 콘텐츠 읽기
- aiService로 키워드 기반 개인화 콘텐츠 생성
- 섹션/불릿/태그 형태로 렌더링
- 새로고침/삭제/외부 링크 지원

#### DiaryCard

- 데이터: 오늘의 질문 + `diaryAnswers[today]`
- PIN 인증 후 접근
- 질문 응답 입력 → `user_qa` 테이블 저장
- `fixedInterestIds` 구독 → `generatePersonalizedQuestion()` 에 전달 → `INTEREST_TOPIC_MAP` 기반 관심사 주제 1개 + 일반 주제 1개 혼합 질문 생성

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

---

## 9) Edge Functions

| 함수 | 엔드포인트 | 입력 | 출력 |
|------|-----------|------|------|
| `weather` | `/functions/v1/weather` | `{lat, lon}` | `{temp, city, condition, humidity, precipitation, airQuality}` |
| `stocks` | `/functions/v1/stocks` | `{symbols: string[]}` | `[{symbol, price, change, changePercent}]` |
| `tavily` | `/functions/v1/tavily` | `{query, mode, max_results, location, include_domains}` | 뉴스: `{answer, results, location}` / 트렌드: `{trends, answer, results}` |
| `calendar` | `/functions/v1/calendar` | `{token, todayOnly}` | `[{id, title, start, end, allDay, location, description}]` |
| `fitness` | `/functions/v1/fitness` | `{token}` | `{steps, sleep, calories, heartRate}` |
| `groq` | `/functions/v1/groq` | `{system, prompt}` | `{text}` |
| `smart-widget` | `/functions/v1/smart-widget` | `{keyword, persona, token, ...context}` | 개인화 콘텐츠 구조체 |
| `kakao-places` | `/functions/v1/kakao-places` | `{query, lat, lon}` | 장소 검색 결과 (현재 미사용) |

**Tavily Edge Function 내부 처리:**

- `cleanTitle(raw)`: 기사 제목에서 "- 사이트명" 접미사, 마크다운 문자 제거
- 트렌드 모드: 검색 결과 기사 제목을 직접 `trends` 배열로 반환 (구 `toHashtag()` 방식 제거)
- `include_domains` 파라미터로 한국 뉴스 도메인 필터링 지원

---

## 10) DB 스키마

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
| **상세 AI 브리핑** | `Interest guidance:` 줄로 Groq 프롬프트에 포함 | `aiService.generateDetailedBriefing()` |
| **단순 AI 브리핑** | 동일 패턴 — `keywordInterests` → `Interest guidance:` | `aiService.generateBriefing()` |
| **Diary Q&A 질문** | `fixedInterestIds` → `INTEREST_TOPIC_MAP` → 관심사 주제 1개 + 일반 주제 1개 혼합 | `aiService.generatePersonalizedQuestion()` |
| **AI 일기 자동 생성** | `interests` → `promptContext`에 포함, 관련 데이터 있으면 자연스럽게 언급 | `aiService.generateDiary()` |
| **브리핑 스코어러 / 페르소나** | `fixedInterestIds` + `keywordInterests` 병합 → `interests` 배열 | `personaContext.buildPersonaContext()` |

**INTEREST_TOPIC_MAP** (ko/en × 8): `news`, `tech`, `fashion`, `finance`, `health`, `food`, `entertainment`, `sports` → 각 언어별 자연어 주제 문구로 매핑. 관심사가 없으면 기존 `TOPIC_POOL` 랜덤 선택으로 fallback.

**일기 언어 결정 흐름:**
```
resolveDiaryGenerationLanguage()  [diaryGenerationService.js, exported]
  1. useSettingsStore.diaryLanguage === "ko" | "en" → 명시 설정 우선
  2. 아니면 i18n.language → "en"/"ko" 매핑
```
`BriefingWidget`의 아침 자동일기(`ensureYesterdayDiaryForMorning`)와 자정 자동일기(`useMidnightTrigger → generateAndSaveDiaryForDate`) 모두 이 함수를 사용해 언어 일관성 보장.

---

## 12) 유틸리티 / 훅 / 상수

### 12.1 src/utils/

| 파일 | 내보내는 것 |
|------|------------|
| `contentUtils.js` | `cleanContent(text)`: 마크다운 헤더·볼드·이탤릭·링크, 해시태그(`#word`), "follow us/subscribe/sign up/newsletter/click here" 제거, 줄바꿈 → 공백 정규화 |
| `storage.js` | `load(key, fallback)`, `save(key, value)`: localStorage 래퍼 |

### 12.2 src/hooks/

| 훅 | 역할 |
|----|------|
| `useMidnightTrigger` | 로그인 상태에서 자정 도달 시 `ensureDailyReset()` + `runPersonalizationBatch()` 실행 |
| `useTheme` | `isDark, cardCls, listItemBgCls, secondaryBgCls, muted, hoverCls, borderCls` 등 테마 CSS 클래스 반환 |

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

---

## 17) 문서 관리 규칙

1. 신규 문서는 임시 작성 후 DOCS.md로 병합
2. 병합 완료 후 임시 문서는 삭제
3. 동일 주제는 DOCS.md 내부 단일 섹션만 유지
4. 코드 변경 시 관련 섹션(위젯/스토어/스키마) 동시 업데이트

---

## 18) 최근 반영 사항 (2026-05-09)

### 2026-05-09 (2차) — 관심사 전체 적용 + 자동일기 일관성

- **관심사 기반 Q&A 질문 생성**: `DiaryCard`가 `fixedInterestIds`를 `generatePersonalizedQuestion()`에 전달. `INTEREST_TOPIC_MAP`(ko/en × 8 카테고리)으로 관심사 주제 1개 + 일반 주제 1개 혼합 선택; 관심사 없으면 기존 랜덤 fallback 유지.
- **단순 AI 브리핑 관심사 반영**: `generateBriefing()`(3줄 버전)에 `Interest guidance:` 줄 추가 — 기존 상세 브리핑과 동일 패턴으로 통일.
- **자동일기 관심사 포함**: `generateDiary()`에 `interests` 파라미터 추가 → `promptContext`에 포함 → AI가 관련 트렌드/뉴스/주식 데이터와 연결해 언급.
- **일기 생성 컨텍스트 보강**: `buildDiaryGenerationContext()`에서 `mergeInterestLists(fixedInterestIds, keywordInterests)` 포함 → 자정 자동일기(`useMidnightTrigger`)도 자동 수혜.
- **아침 자동일기 언어 수정**: `ensureYesterdayDiaryForMorning()`이 이전엔 `language` 미전달(기본값 "ko" 고정)이었으나, 이제 `resolveDiaryGenerationLanguage()` 호출로 사용자 설정 언어 반영.
- **페르소나 컨텍스트 통합**: `personaContext.buildPersonaContext()` — `fixedInterestIds`만 사용하던 것을 `mergeInterestLists(fixedInterestIds, keywordInterests)`로 변경, 브리핑 스코어러에 동적 키워드까지 전달.
- **`resolveDiaryGenerationLanguage` export**: `diaryGenerationService.js`에서 export로 변경 → `BriefingWidget` 등 외부 모듈에서 일관된 언어 해결 함수 공유.

### 2026-05-09 (1차)

- 뉴스/트렌드는 언어 변경 시 강제 재요청되고, 한국어 모드에서는 영어 응답이 와도 기사 제목/요약을 한국어로 후처리 번역해 표시
- 온보딩 관심사는 `user_settings.fixed_interests`, 연동 권한 선택은 `user_settings.onboarding_perms`로 서버 저장/복원
- Date Details는 `Events` / `Tasks`를 동시에 보여주지 않고 탭처럼 하나씩만 전체 폭으로 표시
- 위젯 deck은 마우스 엣지 호버 전환을 제거했고, 트랙패드 가로 스와이프는 위젯 섹션 안에서만 소비
- 전역 글자 크기 조절은 `설정 > 위젯 관리`로 이동했고, 위젯 제목줄의 숨김 설정 진입점은 제거
- Diary 질문 카드는 깨진 다국어 출력 방지 검증/fallback과 현재 언어 기반 질문 생성을 적용
