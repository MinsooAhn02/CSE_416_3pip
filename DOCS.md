# MorningBriefing.AI - 통합 프로젝트 문서

> 최종 정리일: 2026-05-20
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
| `trends` | string[] | 화면/브리핑 fallback용 트렌드 제목 배열 |
| `trendsResults` | `[{title, url, content}]` | 트렌드 위젯과 AI 브리핑의 실제 기사 데이터 |
| `newsAnswer` | string \| null | Tavily 뉴스 요약. AI 브리핑의 뉴스 fallback 컨텍스트로 사용 |
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
| `fetchNews(userId, force)` | `tavily` × 2 (병렬) | `news_{lang}_{interestFingerprint}` |
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
- `include_domains`: 영어 모드는 `EN_NEWS_DOMAINS`, 한국어 모드는 `KO_NEWS_DOMAINS` 전달. 한국어 모드에서는 한국 언론사 도메인만 받아오고, 이후 클라이언트에서 한 번 더 도메인/언어 정규화.
- 한국어 모드 후처리: Tavily 원본 제목/요약이 영어여도 `translateArticlesToKorean()`으로 `title`/`content`를 한국어화한 뒤 `newsResults`에 반영하고, 같은 번역본 payload를 `api_cache`에 backfill 저장한다. 이후 캐시 hit 시에도 원본 영어가 아니라 번역된 한국어 결과를 표시한다.
- `location`(geolocation) 전달 안 함 — 언어별 쿼리로 지역성 표현 대체.

**트렌드 fetch 세부:**
- 관심사 무관 — 세계/국내 실시간 트렌드 전용 쿼리
- 캐시 키: `trends_full_${lang}`
- 한국어: `반드시 한국어 기사 제목만 사용. 영어/일본어/중국어/러시아어 등 외국어 제목 제외. 오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스`
- 영어: `English-language major trending news headlines today worldwide technology AI politics economy entertainment sports latest`
- `include_domains`: 양 언어 모두 `EN_NEWS_DOMAINS` / `KO_NEWS_DOMAINS` 전달 — 신뢰 도메인 위주로 수집.
- 반환: `trendsResults [{title, url, content}]` (Tavily 기사 제목 기반)
- 한국어 모드 후처리: `trendsResults`의 기사 제목/요약을 한국어로 번역하고, `buildLocalizedTrendTitles()`가 화면/브리핑 fallback용 `trends` 제목도 한국어로 재생성한다. `api_cache` 저장 payload 역시 번역본 `results`/`trends`를 사용한다.

**뉴스 언어 필터 (클라이언트 측, `useDataStore.js`):**
- `scoreArticleForLanguage(item, "ko")`:
  - title에 한글 점수 > 0 → `titleScore * 4 + hostBonus`
  - content에 한글 점수 > 0 → `contentScore * 2 + hostBonus` (영어 제목이라도 본문 한글이면 통과)
  - KO_NEWS_DOMAINS host → `hostBonus` (2)
  - 위 모두 미달 → `-1` (탈락)
- `filterLocalizedArticles(items, "ko", limit)`:
  - 한국어 모드: `score > 0`만 통과. KO 도메인이라면 제목/본문이 영어여도 hostBonus로 통과할 수 있고, 다운스트림 `translateArticlesToKorean()`이 한글 번역한다.
  - 영어 모드: 점수 > 0 통과, hostBonus≥2(EN_NEWS_DOMAINS)도 통과.
- `filterByAllowedDomains(items, "ko")`: **하드 필터**. 한국어 모드는 `KO_NEWS_DOMAINS`, 영어 모드는 `EN_NEWS_DOMAINS`에 포함된 도메인만 통과한다.
- `needsKoreanTranslation(text)`: 한글이 일부 포함되어도 라틴 문자가 대부분이면 번역 대상으로 판단한다. 예: `Trump tariff fight - 연합뉴스`처럼 출처명만 한글인 제목도 한국어 제목으로 변환.

**트렌드 인메모리 캐시:**
- `_trendsMemCache` (모듈 레벨 맵): `fetchTrends` 1순위 체크 — hit 시 loading 없이 즉시 표시.
- `warmupTrendsMemCache(userId)`: `fetchAll` 시 `fetchTrends`와 병렬 실행. 양 언어(`ko`/`en`) DB 캐시를 메모리로 미리 적재. `_trendsWarmupPromise` 게이트로 부팅당 1회 보장. ko 캐시에 한국어 결과가 없거나 backfill이 필요한 원본 영어 payload면 warm-up을 생략해 `fetchTrends`가 번역/캐시 backfill 경로를 타게 한다.
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
| 뉴스 | `news_{lang}_{interestFingerprint}` |
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

- 데이터: `trendsResults [{title, url, content}]` 중심. `trends` string 배열은 화면/브리핑 fallback용 제목 캐시로만 유지
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
  - Groq 호출은 3개로 한정(`temperature: 0.1`, 사실 외 생성 금지 가드): 어제 일기 재작성 / 스마트 키워드 요약 / 기사 배치 요약
- 섹션 순서:
  1. `header` — 날짜 + 날씨 결합 한 줄. 날씨 상태 → 이모지 매핑(`getWeatherEmoji`).
  2. `schedule` — 시간대 분기. 오전(5–12): 오늘 일정. 오후·저녁(≥12): 오늘 남은 일정 + 내일 일정(`tomorrowEvents`).
  3. `yesterday` — 어제 일기/메모를 1–2문장 과거형 사실로 재작성(Groq #1).
  4. `latest_info` — `subBlocks: [latest_smart, latest_news, latest_trends]`. 스마트 키워드 bullets 요약(Groq #2), 뉴스 Top 3 + AI 1문장 요약 + 링크(Groq #3 배치), 트렌드 Top 3 + AI 1문장 요약 + 링크.
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
- 아침 자동일기는 `useMidnightTrigger` 전담 경로(`generateAndSaveDiaryForDate`)로만 처리.

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

- **한국어 표시 보정:** 한국어 모드에서 Tavily 결과가 영어로 와도 `useDataStore`가 기사 제목/요약을 한국어로 후처리 번역해 `newsResults`, `trendsResults`에 반영하고, 번역본을 `api_cache`에 backfill 저장한다. 한국어 모드 캐시 hit 시에도 원본 영어가 아니라 번역된 값을 표시한다.

- **지원 언어:** 영어(en, 기본값), 한국어(ko)
- **저장:** localStorage에 언어 설정 유지
- **언어 변경 시:** `i18n.changeLanguage()` → `languageChanged` 이벤트 → useDataStore 리스너가 뉴스/트렌드를 재호출한다. force refresh가 아니라 언어별 캐시 우선이며, 캐시 miss 또는 backfill 필요 시 fresh fetch/번역 경로로 진행한다.
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

**배포 절차 (필수 순서):**
```powershell
npm run build      # .env의 VITE_* 값을 번들에 주입
npx wrangler deploy
```
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 **빌드 시점에 JS 번들에 하드코딩**됨. Cloudflare Workers 런타임에서 `.env`를 읽지 않는다.
- `npm run build` 없이 `wrangler deploy`만 실행하면 이전 dist가 그대로 올라가 Supabase 키 누락 → Demo mode로 동작.
- `.env`가 없거나 키가 비어있는 상태로 빌드하면 배포 후 로그인 화면에 "Demo mode · add Supabase keys in .env to enable real login" 표시.

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

---

## 22) 2026-05-17 — AI Briefing Round 5: 뉴스 AI 요약+링크 / 트렌드 섹션 / 시장 동향 제거

### 변경 요약

| 항목 | 이전 | 이후 |
|------|------|------|
| 시장 동향 섹션 | `finance` 관심사 보유 시 조건부 노출 | **완전 제거** |
| 뉴스 Top 3 표시 | 제목 + 출처 라벨 (평문) | 제목 (클릭 → 원문 새 탭) + AI 1문장 요약 + 출처 |
| 트렌드 Top 3 | 없음 | **신규 sub-block** — 뉴스와 동일 구조 |

### `src/services/aiService.js`

#### 시장 동향 블록 제거

`// ── 7) (조건부) 시장 동향 ──` 블록(19줄) 전체 삭제.  
JSDoc 섹션 순서 코멘트도 최신화.

#### `summarizeArticlesBatch` 헬퍼 추가 (line ~882)

```js
const summarizeArticlesBatch = async ({ articles, lang, langInstruction }) => { ... }
```

- 입력: `{title, url, content}` 배열 (최대 6개 — 뉴스 3 + 트렌드 3 합산)
- 단일 Groq 호출, JSON 출력 `{ summaries: [{ index, summary }] }`
- 각 요약: 1문장 ≤ 120자, 사실 기반, 언어 일치
- 실패 시 빈 배열 반환 → UI는 제목+링크만 표시 (graceful)

#### `generateDetailedBriefing` 수정

```
// 이전: 2개 Groq 병렬 호출
const [diaryRewrite, smartSummary] = await Promise.all([...])

// 이후: 3개 병렬 (추가 지연 없음 — 기존 2개와 동시에 실행)
const [diaryRewrite, smartSummary, articleSummaries] = await Promise.all([...])
```

- `allArticles = [...newsArticles, ...trendsArticles]` (최대 6개) 합산 후 단일 배치 호출
- 인덱스 분할: `index < newsArticles.length` → `newsSummaryMap`, 나머지 → `trendsSummaryMap`
- `articleSummaries.forEach` 방어 처리: `item?.index`, `item?.summary` 존재 확인 후 적용

#### `latest_info` 섹션 sub-block 구조 변경

`lines` 항목이 **polymorphic**:
- `string` — 기존처럼 평문 렌더
- `{ title, url, summary, source }` — 뉴스·트렌드 기사 (URL 없는 항목은 `.filter((o) => o.title && o.url)`로 배제)

sub-block 3개:
1. `latest_smart` — Smart keywords (기존 문자열 요약, 변경 없음)
2. `latest_news` — Top 3 news (객체 배열)
3. `latest_trends` — Trends Top 3 (객체 배열) ← **신규**

`section.lines` (detail 평문 직렬화용): `toPlainLine` 헬퍼로 객체를 `"제목 — 출처: 요약"` 형태 변환.

### `src/components/widgets/BriefingWidget.jsx`

#### 모달 sub-block 렌더러 업데이트

```jsx
// 이전: 모든 line을 <p>{line}</p>로 렌더
// 이후: typeof line === "object" 분기
line && typeof line === "object" ? (
  <div className="space-y-0.5">
    <p>
      <a href={line.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {line.title}
      </a>
      <span>— {line.source}</span>
    </p>
    {line.summary && <p>{line.summary}</p>}
  </div>
) : (
  <p>{line}</p>
)
```

- `stopPropagation` → 링크 클릭 시 모달 닫힘 방지
- `target="_blank"` + `rel="noopener noreferrer"` — 보안 표준
- 요약 없으면 (Groq 실패 시) 제목+링크만 표시

#### 대시보드 미리보기 직렬화 수정

```jsx
// 이전: .join(" · ") → [object Object] 노출
// 이후: .map(l => typeof l === "object" ? `${l.title}${l.source ? ` — ${l.source}` : ""}` : l).join(" · ")
```

#### `trendsResults` 컨텍스트 확인

`BriefingWidget.jsx` L172에 이미 `trendsResults: (trendsResults ?? []).slice(0, 5)` 포함 → 코드 변경 없음.

### 영향 범위

- `generateBriefing` (FirstLoginBriefingModal 전용) — 변경 없음
- 뉴스/트렌드 store 로직 — 변경 없음
- 일기, 일정, 날씨 섹션 — 변경 없음
- Groq 추가 호출 수: +1 (기존 2 → 3), 단 모두 `Promise.all` 병렬이라 총 대기 시간 증가 없음

### 회귀 위험

낮음. `summarizeArticlesBatch` 실패 → 빈 `articleSummaries` → `newsSummaryMap`/`trendsSummaryMap` 빈 맵 → 객체 lines에서 `summary: ""` → UI에서 `line.summary && ...` 조건으로 요약 줄 숨김. 제목+링크는 항상 표시.

---

## Fixes Round 6 (2026-05-17)

### 1. AI Briefing 첫 로그인 모달 ↔ 위젯 상세 모달 동기화

**문제:** `FirstLoginBriefingModal`이 5개 필드만 AI에 전달해 평문 text를 렌더링했고, `BriefingWidget` 상세 모달(14+ 필드, 구조화 섹션)과 내용이 달랐다.

**해결:** 공유 로직 추출

- `src/hooks/useBriefingContext.js` (신규): 모든 스토어 구독 + `buildContext()` 함수 반환. 두 컴포넌트가 동일한 14-필드 컨텍스트를 빌드하도록 보장.
- `src/components/widgets/BriefingSectionsView.jsx` (신규): 구조화 섹션 렌더러 (sections → subBlocks → 뉴스 링크 포함). `SkeletonLine`, `BriefingSkeleton` export 포함.
- `BriefingWidget.jsx`: `useBriefingContext` 훅 + `BriefingSectionsView` 사용으로 리팩터.
- `FirstLoginBriefingModal.jsx`: `useBriefingContext` 훅 + `BriefingSectionsView` 사용으로 업데이트. `fetchTodayQA` 마운트 시 호출.

### 2. 캘린더 일기 파란 점 복원

**문제:** commit `42573fd` 리팩터로 `useDiaryStore` 임포트 + 파란 점 렌더링 제거됨.

**해결:** `CalendarWidget.jsx`에

- `useDiaryStore` import 추가
- `diaryEntries`로 `diaryDateSet` (Set) 계산 + `hasDiaryOnDate()` 함수
- Month View, Week View 인디케이터 컨테이너에 파란 점 (`bg-blue-500`, today면 `bg-white`) 추가

### 3. 설정 UI 수정

**스마트 키워드 입력창 위치:** `SettingsModal.jsx` 스마트 탭에서 입력창을 키워드 rows 하단 → 섹션 헤더 직후 상단으로 이동. 관심사 키워드 레이아웃(입력 → 리스트)과 동일한 패턴. 섹션 헤더 조건부(`smartKeywords.length > 0`) 제거 → 항시 표시.

**AI 브리핑 토글 제거:** 위젯 관리 탭의 기본 위젯 리스트에서 `briefing` 필터링. AI 브리핑은 항상 활성화 (사용자가 끌 수 없음). `DEFAULT_VIS`, `FIXED_WIDGETS`는 변경 없음.

---

## Fixes Round 7 (2026-05-17)

### 일기 재생성 시 일정 섹션 소실 버그 수정

**문제:** 오늘 일기를 처음 생성하면 구글 캘린더 일정이 정상 표시되지만, **다시 생성** 클릭 시 일정 섹션이 "일정 없음"으로 바뀐다.

**근본 원인:** `src/services/diaryGenerationService.js`의 `fetchCalendarEventsForDate`가 `useDataStore.calEvents`를 primary source로 사용했으나:

1. `useDataStore.fetchCalendar`는 `todayOnly: true`로 오늘 이벤트만 캐싱 → 재생성 시점에 store가 갱신되거나 에러 fallback(`cached("calendar", [])`)으로 빈 배열이 될 수 있음.
2. `filterEventsForDate`가 `isSameLocalDate(start, dateStr)` 검사를 사용해, all-day 이벤트(`start = "2026-05-17"`)를 UTC 기준으로 파싱하면 타임존에 따라 날짜가 하루 어긋남.
3. 보조 fallback으로 `supabase.functions.invoke("events", { body: { token, date } })`를 호출했으나 Edge Function은 `{ action: "list", timeMin, timeMax }` 형식을 요구해 항상 실패.

**해결:** `useGoogleCalendarStore.events`를 canonical source로 사용 (CalendarWidget과 동일 패턴)

- `filterEventsForDate`: `event.date === dateStr` 직접 비교 우선 (normalized string, timezone 무관) → fallback으로 `isSameLocalDate`.
- `fetchCalendarEventsForDate`: `useGoogleCalendarStore.getState().events`에서 읽고, 없으면 `fetchEvents({ date: dateStr, skipLoading: true })`로 lazy-fetch. 깨진 supabase fallback 제거.
- `import { supabase }` 제거 (더 이상 불필요).

**수정 파일:** `src/services/diaryGenerationService.js` (lines 1, 19-49)

**부수 효과:** 과거 날짜 일기 재생성 시에도 해당 달 이벤트가 `useGoogleCalendarStore.events`에 있으면 올바르게 포함됨.

---

## Fixes Round 8 (2026-05-17)

### 1. 일기 생성 언어 엄격 적용 + 외래 문자 후처리 검증

**문제:** AI가 일기 title/summary를 "五月十五日"(한자), "스트 назначить"(한국어+러시아어) 등 엉뚱한 언어로 생성하는 경우 발생. 기존 프롬프트는 `Write the response in Korean` 한 줄뿐이라 입력 데이터에 외래어가 섞이면 모델이 언어를 혼용함.

**해결:** `src/services/aiService.js` `generateDiary` 함수 수정

- **프롬프트 강화:** `resolvedLanguage`에 따라 한국어/영어 시스템 프롬프트를 분기. 한국어 시스템 프롬프트는 한국어로 작성하여 모델을 한국어 컨텍스트에 고정. 각 프롬프트에 사용 금지 문자(일본어, 러시아어, 아랍어 등) 명시 및 날짜 표기 형식("5월 15일" — "五月十五日" 금지) 안내.
- **후처리 검증:** `containsForeignScripts(text, targetLang)` 헬퍼 추가. AI 응답 파싱 후 title/summary 각각 검사 — 한국어 대상: 히라가나·가타카나·키릴 등 탐지, 영어 대상: 한글·CJK·키릴 등 탐지. 외래 문자 감지 시 해당 필드를 결정론적 fallback(`buildDiaryFallbackTitleForLanguage`, `buildDiaryFallbackSummaryForLanguage`)으로 대체 후 경고 로그 출력.
- 기존 미사용 한국어 `prompt`/`systemPrompt` 변수(dead code) 제거.

### 2. AI 브리핑 대시보드 뷰 글자 크기 설정 적용

**문제:** `글자 크기` 설정이 AI 브리핑 모달에는 적용되지만 대시보드 위젯 미리보기에는 적용되지 않음. 대시보드 내 모든 텍스트가 `text-xs`, `text-[11px]`, `text-[9px]`, `text-[10px]` 등 하드코딩된 Tailwind 클래스를 사용.

**해결:** `src/components/widgets/BriefingWidget.jsx` 수정

- `useFontSize` 훅 임포트 추가.
- 컴포넌트 상단에서 4개 스타일 변수 선언: `bodyStyle`(×1.0), `titleStyle`(×1.0), `sectionTitleStyle`(×0.75, ~9px), `contentLineStyle`(×0.92, ~11px), `footerHintStyle`(×0.83, ~10px). 각 배수는 medium 기준 현행 픽셀값을 유지.
- 대시보드 내 모든 텍스트 요소(위젯 제목 h2, 자막, today_briefing 레이블, 섹션 타이틀, 섹션 콘텐츠, "자세히 보기" 힌트)에서 하드코딩 사이즈 클래스 제거 → `style={...Style}` 적용.
- 모달 뷰(`BriefingSectionsView`)는 이미 `useFontSize(1.2)` 사용 중 — 변경 없음.

---

## Fixes Round 9 (2026-05-17)

### 재생성 과거 일기에 "앱 접속 기록이 없어" 문장 오출력 수정

**문제:** 과거 날짜(예: 5월 15일) 일기를 재생성하면 "앱 접속 기록이 없어 자동 수집된 데이터만 정리했다." 문장이 포함됨. 해당 날짜에 실제로 앱을 사용했음에도 `wasActiveDay = false`로 추론됨.

**근본 원인 (2가지):**

1. `useDiaryStore.wasActiveOn(dateStr)` — `ACTIVE_KEY`("mb_last_access_date")는 단일 문자열 슬롯. `useMidnightTrigger.js`가 로그인마다 `todayStr()`으로 덮어씀. 5월 17일 로그인 후 `wasActiveOn("2026-05-15")`는 항상 `false`.
2. `buildDiaryGenerationContext`의 `inferredWasActiveDay` OR 체인이 "일기가 이미 존재함" 신호를 누락. 일기가 존재한다는 사실 자체가 과거 활동의 증거임 — 자동 합성(briefing snapshots 존재 → `wasActiveDay: true`로 저장) 또는 사용자 명시적 생성 어느 경로로든 생성된 것이므로.

**해결:** `src/services/diaryGenerationService.js` `buildDiaryGenerationContext` 내 `inferredWasActiveDay` OR 체인에 한 줄 추가:

```js
!!(existingEntry?.diary || "").trim() ||
```

`existingEntry?.notes`/`existingEntry?.memo` 검사 뒤, `briefingSnapshots` 검사 앞에 삽입. `existingEntry`는 이미 같은 함수 상단에서 로드된 변수 — 추가 store 호출 없음.

**수정 파일:** `src/services/diaryGenerationService.js` (line 101, 1줄 추가)

**보류 항목:** Set 기반 다중 날짜 활동 기록 + `markActive(today)` 로그인 시 호출 + 기존 일기 키에서 backfill. 현재 재생성 시나리오는 이번 fix로 커버되므로 우선순위 낮음.

---

## Fixes Round 10 (2026-05-17)

### 1. Edit event modal not closing / save not persisting

**문제:** 이벤트 시간 수정 후 저장 버튼 클릭 시 모달이 닫히지 않고 변경 사항이 저장되지 않음.

**근본 원인:** Google 동기화 실패 시 `updateEvent`가 throw → `handleSubmit` catch 블록이 `console.error`만 출력하고 끝남 → 성공 경로의 `setShowAddForm(false)` / `resetForm()`이 실행되지 않아 모달 유지. 사용자 입장에서 "아무 일도 안 일어났다"처럼 보임.

**해결:** `src/components/layout/EventPanel.jsx` handleSubmit catch 블록에 `toast.error()` 추가. 오류 발생 시 빨간 토스트로 에러 메시지 표시 (모달은 열린 채 유지 — 사용자가 편집 내용 보존). `react-hot-toast` import 추가.

### 2. Google Calendar 동기화 오류 표면화

**문제:** Google 로그인 상태임에도 캘린더 이벤트 동기화 실패. 오류가 모두 무음으로 삼켜져 사용자/개발자 모두 원인 파악 불가.

**4개 무음 catch 수정:**

| 파일 | 위치 | 수정 내용 |
|------|------|----------|
| `src/components/widgets/CalendarWidget.jsx` | line 93 | `.catch(() => {})` → `[gcal]` 로그 + auth 오류 제외 toast |
| `src/store/useGoogleCalendarStore.js` | line 481 | `.catch(() => FALLBACK_TASK_LISTS)` → 로그 추가 후 동일 fallback |
| `src/store/useGoogleCalendarStore.js` | line 567 | `catch {}` → `catch (err)` + `[gcal]` 로그 |
| `src/store/useAuthStore.js` | line 151 | `catch { return null; }` → `catch (err)` + `[gcal]` 로그 |

**진단 포인트:** `[gcal] ensureProviderToken failed:` 로그가 콘솔에 나타나면 Supabase OAuth `provider_token` 만료가 실제 원인임을 확인 가능 — 이를 기반으로 다음 라운드에서 재연결 플로우 개선 가능.

**i18n 추가:** `en.json` + `ko.json` `toast` 네임스페이스에 `event_save_failed`, `calendar_sync_failed` 키 추가.

**수정 파일:** `EventPanel.jsx`, `CalendarWidget.jsx`, `useGoogleCalendarStore.js`, `useAuthStore.js`, `en.json`, `ko.json`


---

## 23) 2026-05-17 — Round 11: 이벤트 생성/편집 모달 닫힘 버그 수정

### 증상

1. 새 이벤트 생성 — 저장은 성공하지만 모달이 닫히지 않음
2. 이벤트 편집 — 저장도 안 되고 모달도 닫히지 않음
3. Cancel 버튼 — 클릭해도 아무 반응 없음

### 근본 원인

handleSubmit의 setShowAddForm(false) 호출이 await addEvent/updateEvent 이후에 조건부로만 실행됨. addEvent 내부에서 fetchEvents가 추가 re-render를 유발해 setShowAddForm(false) 타이밍과 충돌 -> 모달이 열린 채 유지.

Round 10의 '오류 시 모달 유지' 정책도 사용자 UX 기대와 충돌.

추가: 시간 미입력 시 무음 return — 피드백 없이 아무것도 안 되는 것처럼 보임.

### 해결

패턴: Optimistic Close — 네트워크 호출 전에 모달을 먼저 닫고, 실패 시 toast만 표시.

#### src/components/layout/EventPanel.jsx

- handleCloseAddForm 헬퍼 추가 (setShowAddForm(false) + resetForm() 묶음)
- handleSubmit 전면 개선:
  - editingId, selectedEventForDetail 등 필요한 값을 로컬 변수에 미리 캡처
  - payload 빌드 완료 후 await 이전에 handleCloseAddForm() 호출 (항상 닫힘 보장)
  - 성공/실패 여부와 무관하게 모달은 항상 닫힘; 실패는 toast로만 알림
  - 시간 미입력 early-return -> toast 피드백 추가 (toast.event_time_required)
- X 버튼에 type='button' 명시 (방어적 수정)
- backdrop / X / Cancel 세 곳의 인라인 close 핸들러를 handleCloseAddForm 단일 호출로 교체

#### src/l10n/en.json + src/l10n/ko.json

toast.event_time_required 키 추가:
- EN: Please fill in start and end time
- KO: 시작 시간과 종료 시간을 입력해주세요

수정 파일: EventPanel.jsx, en.json, ko.json

---

## 24) 2026-05-18 — Tavily 한국어 뉴스/트렌드 출처 + 번역 캐시 정규화

### 문제

한국어 모드에서 Tavily가 한국 언론사 URL은 잘 가져오지만, 기사 원본 제목이 영어인 경우 `NewsWidget`/`TrendsWidget` 제목이 영어로 표시됐다. 또한 기존 캐시가 원문 payload를 보관하면 다음 캐시 hit 때 번역 경로를 다시 타지 않고 영어 제목이 재노출될 수 있었다.

### 해결

- `src/store/useDataStore.js`
- 한국어 뉴스/트렌드 요청에 `include_domains: KO_NEWS_DOMAINS`를 전달해 한국 언론사 도메인만 수집한다. 영어 모드는 `EN_NEWS_DOMAINS`를 유지한다.
- `filterByAllowedDomains()`를 정렬 전용이 아니라 도메인 하드 필터로 운용한다.
- `translateArticlesToKorean()`으로 한국어 모드의 `title`/`content`를 표시 전 한국어로 정규화한다.
- `buildLocalizedTrendTitles()`를 추가해 실시간 트렌드 표시 제목도 한국어 기사 제목 또는 번역된 fallback 제목으로 구성한다.
- `needsKoreanTranslation()`을 강화해 `Trump tariff fight - 연합뉴스`처럼 한글 출처명만 붙은 영어 제목도 번역 대상으로 판정한다.
- DB 캐시 read 시 원본 영어 payload를 발견하면 번역본 `full` payload를 `api_cache`에 backfill 저장한다. 이후 한국어 모드 캐시 hit는 항상 번역된 `results`/`trends`를 사용한다.
- `warmupTrendsMemCache()`는 한국어 캐시에 backfill이 필요한 원본 payload가 있으면 메모리 캐시에 올리지 않고 `fetchTrends`의 번역/저장 경로가 실행되도록 생략한다.

### 캐시 정책

- 뉴스: `news_${lang}_${interestFingerprint}`
- 트렌드: `trends_full_${lang}`
- 한국어 캐시 payload에는 원본 Tavily 제목이 아니라 번역된 `results[].title`, `results[].content`, `trends[]`가 저장된다.
- 영어 모드는 번역하지 않고 원본 영어 결과를 유지한다.

### 검증

- `npm run build` 통과.
- 빌드 산출물 `dist/index.html`의 번들 해시 변경은 소스 변경과 무관해 되돌림.

---

## 25) 2026-05-20 — 일기 생성 로직 개선: 브리핑 스냅샷 반영 + 프롬프트 강화

### 문제

1. **수동 생성 시 브리핑 스냅샷 누락**: `DiaryPanel.jsx`의 "일기 생성" 버튼이 `briefingSnapshots` 없이 `generateAndSaveDiaryForDate`를 호출해, 시간대별 브리핑 내용이 일기에 반영되지 않았다. 자정 자동 생성(`useMidnightTrigger`)은 정상적으로 스냅샷을 넘겼지만 수동 생성 경로만 누락됐다.

2. **불필요한 stocks 데이터 포함**: `promptContext`에 주식 데이터가 포함돼 LLM 프롬프트가 오염됐다.

3. **피드백 연속성 문제**: 전날 피드백("주식 없애줘")이 Day 2에는 반영되지만 Day 3에서 사라지는 구조적 문제가 있었다.

### 해결

#### DiaryPanel.jsx
- `useBriefingHistoryStore` import 추가
- `handleGenerateDiary`에서 `useBriefingHistoryStore.getState().getSnapshotsForDate(selectedDate)`로 스냅샷을 조회해 `generateAndSaveDiaryForDate`에 전달

#### diaryGenerationService.js
- `buildDiaryGenerationContext` 반환값에서 `stocks: dataStore.stocks` 제거
- `interests` slice 10 → 8

#### aiService.js
- `generateDiary()` 파라미터에서 `stocks` 제거
- `promptContext`에서 `stocks` 제거
- 영어 프롬프트 룰에서 stocks 언급 제거

#### 프롬프트 룰 강화 (한/영 공통)
- 기존: "previousDayDiary가 있으면 비슷한 문체로 작성"
- 변경:
  - `previousDayDiary`는 **문체·톤·스타일 참고용만** — 전날 사건·내용은 오늘 일기에 절대 포함 금지
  - 오늘 내용은 오직 `briefingText / completedLines / scheduleLines / diaryAnswers`에서만
  - `previousDayFeedback`이 있으면 해당 선호도(포함·제외 항목)를 오늘 일기에 반영

### 피드백 연속성 설계

`previousDayDiary`는 이미 `buildDiaryGenerationContext` 내에서 항상 조회된다 (파라미터 미제공 시 store에서 직접 조회). 전날 피드백을 이전처럼 조건부로 넘기는 대신 다음 흐름으로 처리한다:

```
Day 1 일기 (주식 포함) + 피드백 "주식 없애줘"
  ↓
Day 2: previousDayDiary(스타일 참고) + previousDayFeedback(주식 제외) → 주식 없는 일기
  ↓
Day 3: previousDayDiary = Day 2 일기(주식 없는 스타일) → 피드백 없어도 스타일 유지
```

프롬프트가 "전날 스타일 참고, 오늘 내용은 입력 데이터에서만"을 명시하므로 전날 이벤트 혼입 없이 선호도가 자연스럽게 이어진다.

### 브리핑 스냅샷 구조

`useBriefingHistoryStore` — 3시간 간격으로 스냅샷 누적 저장

```
shouldSave() → 마지막 스냅샷으로부터 3시간 경과 여부 확인
addSnapshot() → { capturedAt, source, text, summary, sections }
             → localStorage (mb_briefing_history) + Supabase briefing_snapshots 테이블
getSnapshotsForDate(dateStr) → 해당 날짜 스냅샷 배열 반환
clearDate(dateStr) → 일기 생성 후 소비된 스냅샷 정리
```

LLM에는 최대 6개, 각 200자로 잘라서 `[09:00] 브리핑 내용...` 형태로 포맷팅 후 `briefingText`로 전달.

### 검증

`scripts/test-diary-generation.mjs` — Node.js 스크립트로 Supabase Edge Function 직접 호출

```
✅ stocks 없음 (promptContext에서 제거 확인)
✅ briefingText 포함 (시간대별 스냅샷 반영)
✅ previousDayDiary 항상 전달
✅ interests 8개
✅ 전날 이벤트 혼입 없음
✅ 주식 언급 없음
✅ 오늘 할일/일정 반영
```

수정 파일: `DiaryPanel.jsx`, `diaryGenerationService.js`, `aiService.js`
추가 파일: `scripts/test-diary-generation.mjs`

## 26) 2026-05-20 — Stocks Widget 버그 수정 2종

### Fix 1: 지수 항목 통화 심볼($, ₩) 제거

- **파일**: `src/components/widgets/StocksWidget.jsx`
- **문제**: KOSPI, NASDAQ, S&P 500은 포인트 단위 지수임에도 `CURRENCY_MAP`에서 "KRW"/"USD"로 매핑되어 ₩/$가 표시됨.
- **해결**: `CURRENCY_MAP`의 KOSPI/NASDAQ/SP500 값을 `"Index"`로 변경. `curSymbol` 도출 로직(`cur === "KRW" ? "₩" : cur === "USD" ? "$" : ""`)이 "Index"에 대해 빈 문자열을 반환하므로 심볼 미표시. StockCard(위젯 본체)와 모달 상세 뷰 모두 `getCurrency()`를 통해 처리되므로 단일 변경으로 적용.

### Fix 2: "remove ticker?" 확인 후 메인 모달 유지

- **파일**: `src/components/common/ConfirmDialog.jsx`
- **문제**: ConfirmDialog backdrop 클릭(Cancel/backdrop) 시 React synthetic event가 상위 컴포넌트로 전파되어 StocksWidget의 메인 모달 backdrop(`onClick={() => setShowModal(false)}`)까지 도달, 메인 모달이 함께 닫힘.
- **해결**: ConfirmDialog backdrop의 `onClick={onCancel}` → `onClick={(e) => { e.stopPropagation(); onCancel(); }}`로 변경. ConfirmDialog를 사용하는 모든 컴포넌트(DiaryPanel, SettingsModal, EventPanel, TaskPanel)에 동일하게 적용됨.

수정 파일: `src/components/widgets/StocksWidget.jsx`, `src/components/common/ConfirmDialog.jsx`
