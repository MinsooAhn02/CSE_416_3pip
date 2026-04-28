# MorningBrief.AI - 통합 프로젝트 문서

> 최종 정리일: 2026-04-28
> 관리 정책: 문서는 `DOCS.md` 단일 파일로 유지

---

## 1) 프로젝트 개요

MorningBrief.AI는 브라우저 새 탭(New Tab)에서 동작하는 개인 대시보드형 서비스다.  
사용자의 하루 맥락(날씨, 주식, 뉴스, 일정, 건강, memo/질문)을 한 화면에 모으고, 이를 AI briefing과 diary 흐름으로 연결한다.

핵심 목표:

1. 필요한 정보를 한 화면에서 빠르게 확인
2. 캐시 우선 렌더링으로 로딩 체감 개선
3. 사용자별 설정과 데이터를 안전하게 저장

핵심 원칙:

1. 외부 API 실패 시 가능한 범위에서 fallback 유지
2. 사용자 데이터는 RLS 기준으로 격리
3. 비밀키는 클라이언트에 하드코딩하지 않고 Supabase/배포 환경 변수로만 관리

---

## 2) 기술 스택 (현재 코드 기준)

### Recent Docs Sync

2026-04-28

1. 일정/할 일 영역은 mock 데이터가 아니라 실제 Google Calendar + Google Tasks를 기준으로 동작하고, Supabase Edge Function(`events`, `tasks`)으로 읽기/쓰기/재인증 흐름을 처리한다.
2. Event는 Google Calendar의 실제 반복 이벤트(`RRULE`)와 연동된다. 반복 series 기준 편집/삭제, Guests, Google Meet, reminder, busy/free, visibility, Google Places API 기반 location autocomplete, rich-text description 입력/표시가 구현되어 있다.
3. Task는 Google Tasks를 단일 source로 유지한다. 실제 Google Task Lists 기준의 `All Tasks / 특정 리스트` 필터와 새 리스트 생성 UI를 제공하고, 선택한 리스트 필터는 캘린더 task dot과 today todo에도 그대로 반영된다.
4. Task의 앱 전용 확장 데이터는 `[MB_META]` notes에 저장한다. 여기에는 `repeat`, `dueDate`, `completedDates` 등이 포함되며, UI에서는 `Deadline`으로 보이지만 내부 마감일 필드는 `dueDate`를 사용한다. Google Tasks API의 `due`는 캘린더에 배치되는 task 날짜와 동기화한다.
5. 일반 task의 완료/미완료는 Google Tasks와 양방향 동기화된다. `status`와 `completed` timestamp를 함께 보내고, update 호출은 `PUT` 기준으로 맞춘다. 반복 task는 Google API 제약 때문에 완료만 occurrence 단위로 분리되고, 수정/삭제/리스트 이동은 series 전체 기준이다.
6. Event/Task 입력 UX는 시간 기본값을 현재 시각 기준 다음 30분 단위로 맞추고, 시간 없는 항목은 `All day`로 처리한다. Event 종료 시간은 시작 시간보다 1시간 뒤로 기본 설정된다.
7. Diary 데이터 구조는 `ai_generated_diary`, `edited_diary`, `memo`로 분리되어 있고, 하루가 끝난 뒤 같은 날짜의 이벤트, 완료된 task, 응답, memo, 외부 데이터(weather, stocks, trends)를 사용해 제목 포함 diary를 생성한다.
8. Diary 보안은 optional PIN 구조다. PIN 설정/변경/해제, lock timing, diary list 잠금, Settings 연동이 구현되어 있으며 PIN이 켜진 경우 diary 접근 전에 인증이 필요하다. diary popup은 즉시 PIN 입력창을 띄우지 않고 먼저 잠금 화면과 `Unlock` 버튼을 보여준다.
9. Settings에는 `Diary` 탭이 있어 PIN과 diary 생성 언어를 한곳에서 관리한다. diary popup의 settings 버튼도 이 `Diary` 탭으로 바로 연결된다.
10. Diary panel에는 수동 `Generate Diary / Regenerate Diary` 버튼이 있어 자정 자동 생성과 별개로 현재 날짜 diary를 즉시 테스트하거나 다시 만들 수 있다.
11. Personalization은 persona + onboarding interests + 과거 memo 요약을 사용한다. 단, briefing은 memo를 제외하고, diary 생성은 해당 날짜 memo를 직접 사용한다.
12. 캘린더에서는 diary dot을 제거했고, task dot은 occurrence-level completion과 현재 task list filter를 반영한다.
13. Event description은 detail 화면에서 Google-style HTML을 읽기 좋게 렌더링하고, add/edit 화면에서는 compact rich-text editor로 `bold`, `italic`, `underline`, `ordered list`, `bullet list`, `link`, `strikethrough`를 입력할 수 있다.
14. `Date Details`, `EventPanel`, `TaskPanel`은 `en/ko` 전환 시 비번역 문구 없이 전체가 바르게 돌아가도록 정리했고, 반복/알림 라벨, 상세 메타데이터, 재연결 CTA, 새 리스트 모달 문구, 빈 상태, 제목 없음 fallback, locale 날짜 표시까지 언어 전환을 따르도록 맞췄다.

문제점: tasks api에서 실제로 존재하지만, 제공하는 기능이 있어서 일부 연동 안됨 (deadline, 시간설정). 
그대로 둘지, 그냥 없앨지 향후 결정.


### Frontend

- React 18
- Vite 6
- Tailwind CSS 3
- Zustand
- framer-motion
- @hello-pangea/dnd
- i18next / react-i18next
- lucide-react

현재 프런트엔드 구조 핵심:

1. Zustand store 중심 상태 관리: `useAuthStore`, `useDataStore`, `useDiaryStore`, `useGoogleCalendarStore`, `useTodoStore`, `useWidgetStore`, `useSettingsStore`
2. 공통 UI 컴포넌트: `TimeInput`, `GooglePlacesLocationField`, `WidgetCard`, `ConfirmDialog`
3. Event description은 별도 에디터 라이브러리 없이 `contentEditable` 기반 lightweight rich-text editor로 구현
4. i18n은 `en` / `ko`를 기준으로 Event location autocomplete, deadline 표시, UI copy에 반영

5. i18n? Date Details / EventPanel / TaskPanel copy, repeat/reminder label, deadline/date display, reconnect flow, create-list / delete-confirm UI path源뚯? 諛섏쁺?섏뿬 ?몄뼱 ?꾪솚 ?뚰뒪媛 ?뺤깭?곸쑝濡??뚮┝?덈떎.

### Backend / Infra

- Supabase (Auth, Postgres, Edge Functions)
- Edge Functions (TypeScript)

Google APIs:

1. Google Calendar
2. Google Tasks
3. Google Fitness
4. Google Maps Places JavaScript API

외부 데이터/AI 연동:

1. Weather
2. Twelve Data (stocks)
3. Tavily (trends/news)
4. Kakao Local
5. Groq (LLM)

현재 사용 중인 Edge Functions:

1. `events`
2. `tasks`
3. `weather`
4. `stocks`
5. `tavily`
6. `fitness`
7. `groq`
8. `smart-widget`
9. `kakao-places`

---

## 3) 디렉토리 구조 요약

```text
src/
  App.jsx
  main.jsx
  index.css
  components/
    common/
      ConfirmDialog.jsx
      DragHandle.jsx
      GooglePlacesLocationField.jsx
      TimeInput.jsx
      Toggle.jsx
      WidgetCard.jsx
    layout/
      DashboardLayout.jsx
      DatePanelContainer.jsx
      DiaryPanel.jsx
      EventPanel.jsx
      FixedButtons.jsx
      LoginScreen.jsx
      QuickLinks.jsx
      TaskPanel.jsx
      TopNav.jsx
    modals/
      BriefSettingsModal.jsx
      DiaryListModal.jsx
      FirstLoginBriefingModal.jsx
      NewsDetailModal.jsx
      OnboardingModal.jsx
      PINModal.jsx
      SettingsModal.jsx
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
  constants/
  hooks/
    useMidnightTrigger.js
    useTheme.js
  l10n/
  lib/
    googleMaps.js
    supabase.js
  mock/
  services/
    aiService.js
    diaryGenerationService.js
  store/
    useAuthStore.js
    useDataStore.js
    useDiaryStore.js
    useGoogleCalendarStore.js
    useQuickLinksStore.js
    useSettingsStore.js
    useTodoStore.js
    useWidgetStore.js
  utils/
    date.js
    eventRepeat.js
    personaContext.js
    storage.js
    taskRecurrence.js

supabase/
  schema.sql
  functions/
    calendar/
    events/
    fitness/
    groq/
    kakao-places/
    smart-widget/
    stocks/
    tasks/
    tavily/
    weather/
```

---

## 4) 앱 초기화/실행 흐름

### 4.1 인증 부트스트랩

앱 초기화 시 인증은 아래 순서로 진행된다.

1. `supabase.auth.getSession()`으로 현재 세션 확인
2. `onAuthStateChange` 구독으로 이후 변경 감지
3. `provider_token`을 로컬에 유지해 Google 연동 복구 가능하게 처리

### 4.2 로그인 후 초기 데이터 로드

조건: `isLoggedIn === true` 그리고 `user.id` 존재

실행 순서:

1. Settings / widget layouts / smart keywords / diary / todo hydrate
2. `fetchAll({ useExistingCache: true })`
3. Google Calendar / Tasks store 초기화
4. 필요 시 AI todo / briefing 생성 흐름 실행

### 4.3 주기 갱신

1. 페이지 visible 복귀 시 `fetchAll({ useExistingCache: true })`
2. 일정 주기로 외부 위젯 데이터 갱신
3. 자정 기준 hook에서 daily reset, diary generation 흐름 수행

---

## 5) 데이터 수집 및 캐시 로직

### 5.1 캐시 계층

1. `api_cache` 테이블: 사용자별 API 응답 캐시
2. `localStorage`: UI 상태와 일부 데이터 fallback
3. 모듈 스코프 메모리 캐시: geolocation 등 짧은 TTL 데이터

### 5.2 캐시 규칙

1. 기본 access-time 기반 캐시 임계값은 1시간
2. geolocation은 약 5분 캐시
3. `force`가 아니면 DB/local cache를 먼저 확인
4. cache miss 또는 stale이면 Edge Function 재호출

### 5.3 fetchAll 핵심 규칙

1. visible widget 기준으로 필요한 fetch만 병렬 실행
2. 실패한 위젯은 가능한 경우 mock 또는 기존 cached 값으로 유지
3. Calendar/Tasks는 별도 Google 전용 store에서 관리
4. Edge 호출은 `supabase.functions.invoke` 대신 direct fetch wrapper를 사용해 실제 HTTP 오류를 노출

### 5.4 현재 데이터 소스 매핑

- weather -> `functions/v1/weather`
- stocks -> `functions/v1/stocks`
- trends/news -> `functions/v1/tavily`
- places -> `functions/v1/kakao-places`
- events -> `functions/v1/events`
- tasks -> `functions/v1/tasks`
- fitness -> `functions/v1/fitness`
- AI -> `functions/v1/groq`
- smart widget -> `functions/v1/smart-widget`

---

## 6) 위젯 시스템 요약

### 6.1 레이아웃 원칙

1. `DashboardLayout`이 built-in widget과 smart widget을 통합 렌더링
2. `useWidgetStore`가 visibility, layout, smart keywords를 관리
3. briefing / diary / calendar는 상단 핵심 흐름으로 배치되고, 나머지 위젯은 deck/stack 레이아웃을 따른다

### 6.2 공통 카드 규칙

`WidgetCard` 공통 기능:

1. 제목 / 아이콘 / refresh / close
2. API 상태 표시
3. widget visibility 토글과 DB 동기화

### 6.3 핵심 위젯 역할

1. `BriefingWidget`: persona와 외부 데이터를 바탕으로 AI briefing 생성
2. `CalendarWidget`: month/week/day 전환, date detail panel 연동, event/task dot 렌더링
3. `DiaryCard`: 오늘 질문/기록 진입점
4. `SmartWidgetContent`: keyword별 AI-generated personalized card
5. `HealthWidget`: Google Fitness 기반 요약

---

## 7) 캘린더 / 패널 / 일기 상태

`DatePanelContainer`는 선택 날짜의 Event / Task를 나란히 보여주고, diary는 헤더 버튼으로 modal 형태로 연다.

현재 구현 상태:

1. `EventPanel`은 Google Calendar CRUD를 담당하며, recurring event는 master series 기준으로 편집/삭제한다.
2. Event는 title optional, all-day, 12-hour time picker, guests, Google Meet, visibility, busy/free, reminder, Google Places location, rich-text description을 지원한다.
3. `TaskPanel`은 Google Tasks CRUD를 담당하며, title optional, all-day/no-time, repeat, `Deadline` UI, list selector를 지원한다. 내부적으로는 마감일을 `dueDate`로 저장한다.
4. 반복 task는 Google Tasks 한 건을 source로 유지하고, 완료 상태만 `completedDates`로 날짜별 분리된다.
5. Task list filter(`All Tasks` 또는 특정 Google Task List)는 Tasks 패널, Calendar task dot, today todo에 공통으로 반영된다.
6. `DiaryPanel`은 `ai_generated_diary`, `edited_diary`, `memo`를 기준으로 표시되며, diary list와 PIN 보호 modal 흐름을 공유한다.
7. Diary PIN은 optional이다. PIN이 설정된 경우 diary / diary list 진입 전에 `PINModal` 인증이 필요하고, lock timing은 Settings에서 제어한다.
8. 캘린더는 diary dot 없이 event/task indicator만 표시한다.

---

## 8) 개인화 로직

### 8.1 현재 사용되는 입력

`buildPersonaContext()`는 아래 데이터를 조합한다.

1. persona
2. onboarding interests
3. age
4. 과거 memo 요약

### 8.2 현재 memo 사용 규칙

1. same-day diary generation: 해당 날짜 memo를 직접 사용
2. smart widget personalization: 과거 memo 요약 사용
3. briefing / first-login briefing: `includeMemo: false`로 memo 제외

### 8.3 현재 한계

1. `UserInterestProfile` 같은 별도 derived profile 테이블은 아직 없다
2. memo 원문을 topic-only profile로 캐싱하지 않는다
3. personalization은 runtime context 기반이며 장기 프로필 레이어로 분리되어 있지 않다

---

## 9) 현재 제약 / 주의점

1. Event repeat은 Google Calendar native recurrence와 직접 연동되지만, Task repeat은 Google Tasks 공개 API 제약 때문에 앱 메타데이터(`[MB_META]`) 기반이다.
2. Task repeat에서 날짜별로 분리되는 것은 완료 상태만이다. repeat/list/`dueDate`(Deadline)/description 수정은 series 전체에 적용된다.
3. Event description rich text는 Google-style HTML과 호환되도록 제한된 태그만 sanitize해서 렌더링한다.
4. 일부 외부 위젯(weather, stocks, trends, restaurants, 일부 health 흐름)은 네트워크/인증 실패 시 기존 cache 또는 mock fallback을 사용할 수 있다.

---

## 10) Supabase 설정 요약

### 10.1 필수 환경 변수

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

### 10.2 Google OAuth / Scope

현재 로그인 시 요청하는 주요 scope:

```text
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/tasks
https://www.googleapis.com/auth/fitness.activity.read
https://www.googleapis.com/auth/fitness.sleep.read
https://www.googleapis.com/auth/fitness.heart_rate.read
```

주의:

1. 예전 readonly scope로 동의한 세션은 event/task write가 동작하지 않을 수 있다
2. Google 권한이 만료되면 Event/Task 패널의 `Reconnect Google` 흐름으로 다시 연결해야 한다

### 10.3 보안 원칙

1. third-party secret은 배포 플랫폼/Supabase secret로만 관리
2. 클라이언트 코드에는 anon key 외 비밀키를 넣지 않는다
3. 사용자 데이터는 RLS와 user-scoped row로 분리한다

---

## 11) 운영 체크리스트

### 11.1 실행 전

1. `.env` / Supabase 환경 변수 확인
2. Google Provider와 redirect URI 설정 확인
3. Edge Function 배포 상태 확인

### 11.2 런타임 확인

1. 로그인 직후 widget hydrate와 `fetchAll`이 정상 시작되는지
2. Event/Task write 후 원격 Google 데이터가 다시 반영되는지
3. diary generation / PIN flow / settings modal layering이 정상인지
4. smart widget / briefing이 persona context와 함께 생성되는지

### 11.3 장애 시 우선 점검

1. `provider_token`이 살아 있는지
2. `fetchAll`에서 어떤 widget fetch가 실패했는지
3. Supabase Edge Function HTTP 응답 본문이 무엇인지
4. Google OAuth scope가 현재 기능과 맞는지

---

## 12) 문서 통합 출처

현재 문서는 아래 정보를 기준으로 정리한다.

1. `DOCS.md`
2. 실제 코드베이스 구현 상태
3. `README.md`
4. `logic.txt`
5. `logic for Personalization.txt`
6. `widget.txt`

---

## 13) 문서 관리 규칙

1. 기능 변경과 함께 `DOCS.md`를 같은 턴에 갱신한다.
2. `Recent Docs Sync`에는 사소한 spacing, copy, 위치 미세조정 같은 trivial 변경을 누적하지 않는다.
3. `Recent Docs Sync`에는 현재 제품 상태를 이해하는 데 필요한 큰 변화만 남긴다.
4. 문서는 changelog보다 "현재 구조와 제약" 설명을 우선한다.
5. 오래된 설명이 현재 구현과 어긋나면, 새 항목을 덧붙이기보다 기존 설명을 교체한다.
