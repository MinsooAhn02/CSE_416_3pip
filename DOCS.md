# MorningBrief.AI - 통합 프로젝트 문서

> 최종 정리일: 2026-04-21
> 관리 정책: 문서는 DOCS.md 단일 파일로 유지

---

## 1) 프로젝트 개요

MorningBrief.AI는 브라우저 새 탭(New Tab)에서 동작하는 개인 대시보드형 서비스다.
사용자의 하루 맥락(날씨, 주식, 뉴스, 일정, 건강, 메모/질문)을 모아 AI 브리핑과 기록 흐름으로 연결한다.

핵심 목표:

1. 정보를 한 화면에서 즉시 확인
2. 캐시 우선 렌더링으로 로딩 체감 개선
3. 사용자별 설정/데이터를 안전하게 저장

핵심 원칙:

1. API 실패 시 fallback으로 UX 단절 최소화
2. 사용자 데이터 격리(RLS)
3. 비밀키는 Supabase Secrets에서만 관리

---

## 2) 기술 스택 (현재 코드 기준)

### Frontend

- React 18
- Vite 6
- Tailwind CSS 3
- Zustand
- framer-motion
- @hello-pangea/dnd
- i18next / react-i18next

### Backend / Infra

- Supabase (Auth, Postgres, Edge Functions)
- Edge Functions (TypeScript)
- 외부 데이터 연동:

1. Weather
2. Twelve Data (stocks)
3. Tavily (trends/news)
4. Kakao Local
5. Google Calendar / Google Fitness
6. Groq (LLM)

---

## 3) 디렉토리 구조 요약

```text
src/
  App.jsx
  components/
    common/
      ConfirmDialog.jsx
      DragHandle.jsx
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
  services/
    aiService.js
  store/
    useAuthStore.js
    useDataStore.js
    useDiaryStore.js
    useGoogleCalendarStore.js
    useQuickLinksStore.js
    useSettingsStore.js
    useTodoStore.js
    useWidgetStore.js

supabase/
  schema.sql
  functions/
    calendar/
    fitness/
    groq/
    kakao-places/
    smart-widget/
    stocks/
    tavily/
    weather/
```

---

## 4) 앱 초기화/실행 흐름

### 4.1 인증 부트스트랩

App 초기화 시 인증은 아래 순서로 확정된다.

1. mount 시 getSession() 명시 호출
2. onAuthStateChange 구독으로 후속 이벤트 수신
3. authBootstrapDone 이후 데이터 초기화 로직 진행

의도:

- 자동 세션 복원 타이밍 레이스 상황에서도 초기 로드가 멈추지 않게 함

### 4.2 로그인 후 초기 데이터 로드

조건: isLoggedIn=true && user.id 존재

실행 순서:

1. hydrateFromDB(Settings/Widget/Todo/Diary)
2. fetchAll({ useExistingCache: true })
3. AI 후속 처리(generateAiTodoOnLoad 등)

### 4.3 주기 갱신

1. 탭 visible 복귀 시 fetchAll({ useExistingCache: true })
2. 5분 주기 폴링(visible일 때만)
3. 위젯별 수동 새로고침 시 force=true로 캐시 우회

---

## 5) 데이터 수집 및 캐시 로직

### 5.1 캐시 계층

1. 메모리 캐시: 위치 정보(짧은 TTL)
2. DB 캐시: api_cache (사용자별)
3. localStorage fallback

관련 키:

- mb_last_access_time
- mb_last_fetched_at

### 5.2 fetchAll 핵심 규칙

1. useExistingCache=true면 기본적으로 force refresh를 하지 않음
2. user_settings + widget_layouts 조회 후 visibleWidgets 결정
3. visibleWidgets 기준 필요한 fetch만 병렬 실행
4. 상태(apiStatus, loading, errors)를 일관되게 갱신

### 5.3 개별 fetch 공통 패턴

1. cacheKey 계산
2. force=false면 readApiCache 우선
3. 캐시 hit 시 즉시 상태 반영 후 종료
4. miss면 Edge Function 호출
5. 성공 시 정규화 + writeApiCache
6. 실패 시 mock fallback + 에러 상태 기록

### 5.4 엔드포인트 매핑

- weather -> /functions/v1/weather
- stocks -> /functions/v1/stocks
- trends/news -> /functions/v1/tavily
- places -> /functions/v1/kakao-places
- calendar -> /functions/v1/calendar
- fitness -> /functions/v1/fitness
- AI(groq) -> /functions/v1/groq

---

## 6) 위젯 시스템 요약

### 6.1 레이아웃 원칙

DashboardLayout 기준:

1. 브리핑 묶음(BriefingWidget + DiaryCard)은 핵심 블록
2. 나머지 위젯은 설정 순서/가시성에 따라 slider deck 구성
3. dense 위젯(news/trends/stocks/smart)은 단독 스택 처리 가능

### 6.2 공통 카드 규칙

WidgetCard 공통 기능:

1. 타이틀/아이콘/닫기/새로고침
2. apiStatus 표시
3. closeWidget(widgetId)로 vis=false 적용

### 6.3 위젯별 역할

1. BriefingWidget

- AI 요약/상세 브리핑
- tone/length 반영 및 재생성

2. DiaryCard

- 오늘 질문 응답 입력/저장
- 날짜별 응답 목록 표시

3. CalendarWidget

- month/week/day 전환
- DatePanelContainer 연동

4. WeatherWidget

- 현재 날씨 및 지표
- 단위 설정 연동

5. StocksWidget

- 심볼 기반 시세
- 심볼 변경 시 재조회

6. TrendsWidget

- 트렌드/출처/상세 모달

7. NewsWidget

- 뉴스 목록/요약/상세 모달

8. HealthWidget

- steps/sleep/calories/heart rate 요약

9. SmartWidgetContent

- 키워드 기반 개인화 콘텐츠
- refresh/remove/외부 링크 동작

---

## 7) 캘린더/패널/일기 상태

DatePanelContainer는 EventPanel, TaskPanel, DiaryPanel을 통합 제공한다.

현재 상태:

1. 패널 UI와 PIN 인증 흐름은 구현됨
2. useGoogleCalendarStore는 아직 Mock 기반
3. 실 API 완전 연동은 후속 작업 항목

---

## 8) 개인화 로직 (Smart/People)

### 8.1 목적

Q&A 응답에서 관심 키워드를 추출하고 최근성 가중치로 누적해 검색/추천 품질을 높인다.

### 8.2 키워드 추출 규칙

1. AI 출력은 JSON 배열만 허용
2. category는 고정 목록만 허용
3. keyword는 검색 가능한 명사 형태로 정규화
4. 무효 category, 빈 keyword는 제거

고정 category:

- food
- place
- content
- shopping
- lifestyle
- mood
- interest

### 8.3 점수 계산

30일 윈도우 가중치:

$$
score = \sum \frac{30 - elapsed\_days}{30}, \quad elapsed\_days < 30
$$

처리 흐름:

1. 하루 Q&A 수집
2. 자정 배치에서 키워드 추출
3. score_log 적재
4. 조회 시 합산/정렬
5. 30일 초과 데이터 정리

---

## 9) 최근 이슈 반영 상태

### 9.1 자동 세션 복원 시 공란 문제

증상:

- dev 실행 후 재로그인 전 위젯 공란

반영 내용:

1. authBootstrapDone 도입
2. getSession() + onAuthStateChange 병행
3. 초기화 fallback 경로 보강

결과:

- 자동 복원 경로 안정성 개선

### 9.2 슬라이더 위젯 상세 모달 위치 오프셋

원인:

- transform 컨텍스트 내부 모달 렌더 영향

반영 내용:

1. 상세 모달 portal 렌더 방식 적용
2. host 기반 표시 범위 정리

결과:

- 패널 이동 후에도 상세 모달 위치 일관성 확보

---

## 10) Supabase 설정 요약

### 10.1 필수 환경 변수

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 10.2 Google OAuth / Scope

1. Supabase Auth의 Google Provider 활성화
2. OAuth callback URI 등록
3. 필요한 scope 추가

권장 scope:

```text
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/fitness.activity.read
```

### 10.3 보안 원칙

1. 서드파티 키는 Secrets Manager에서만 관리
2. 클라이언트 코드 하드코딩 금지
3. RLS로 사용자 데이터 분리

---

## 11) 운영 체크리스트

### 11.1 실행 전

1. 환경 변수 확인
2. Auth/DB/RLS 정책 확인
3. Edge Functions 배포 상태 확인

### 11.2 런타임 확인

1. 로그인 직후 위젯 즉시 렌더 여부
2. 수동 새로고침(force=true) 정상 동작 여부
3. 뉴스/트렌드 상세 모달 위치 정상 여부
4. 캘린더/패널/PIN 흐름 정상 여부

### 11.3 장애 시 우선 점검

1. handleAuthChange 호출 여부
2. user.id 세팅 여부
3. fetchAll 진입 여부
4. visibleWidgets 계산 결과
5. edge 응답(ok/error/timeout) 로그

---

## 12) 문서 통합 출처

이번 정리본은 아래 파일의 중복을 제거하고 최신 구현 기준으로 통합했다.

1. DOCS.md(기존)
2. README.md
3. logic.txt
4. logic for Personalization .txt
5. widget.txt

---

## 13) 문서 관리 규칙

1. 신규 문서는 임시 작성 후 DOCS.md로 병합
2. 병합 완료 후 임시 문서는 삭제
3. 동일 주제는 DOCS.md 내부 단일 섹션만 유지
