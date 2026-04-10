# MorningBrief.AI — 프로젝트 문서 통합본

> 작성일: 2026-04-09 | 기존 문서들(brief.txt, fix.txt, guide.txt, func_requirements*.txt, progress.txt, TODO.md 등)을 하나로 합침

---

## 1. 프로젝트 개요

**MorningBriefing.AI** — Chrome New Tab Extension (React 기반 대시보드)

사용자 데이터(날씨, 주식, 뉴스, 일정, 건강 정보)를 한눈에 파악하고, AI 기반 브리핑 및 일기/TODO 관리 기능을 제공하는 자동화 라이프로깅 서비스.

**핵심 가치:**
- 캘린더·할일·개인 반성·매크로 데이터를 자동 합성하여 일기 생성 (수동 입력 제로)
- 자정(00:00)에 자동으로 하루 데이터를 집계, 구조화된 일기 항목 생성
- 감정 분석 없이 사실 기반 기록만 수행

---

## 2. 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 18 + Vite |
| 상태 관리 | Zustand |
| UI | Tailwind CSS 3 + Lucide React |
| 드래그 앤 드롭 | @hello-pangea/dnd |
| 백엔드 | Supabase (Auth, DB, Edge Functions) |
| LLM | Groq API |
| 데이터 | Twelve Data, Tavily Search, Kakao Local, Google APIs |

---

## 3. 아키텍처

### 3.1 파일 구조

```
src/
├── App.jsx                    # 메인 앱, DND 레이아웃 관리
├── components/
│   ├── layout/
│   │   ├── TopNav.jsx         # 헤더 (프로필, 시계, 검색, 테마, 즐겨찾기)
│   │   ├── QuickLinks.jsx     # 즐겨찾기 링크
│   │   ├── EditModeBanner.jsx # 드래그 활성화 배너
│   │   └── FixedButtons.jsx   # FAB 스택
│   ├── widgets/
│   │   ├── BriefingWidget.jsx
│   │   ├── CalendarWidget.jsx
│   │   ├── DiaryCard.jsx
│   │   ├── WeatherWidget.jsx
│   │   ├── StocksWidget.jsx
│   │   ├── TrendsWidget.jsx
│   │   ├── NewsWidget.jsx
│   │   ├── HealthWidget.jsx
│   │   ├── TodoWidget.jsx
│   │   ├── RestaurantsWidget.jsx
│   │   ├── FoodRouletteWidget.jsx
│   │   └── SmartWidgetContent.jsx
│   ├── modals/
│   │   ├── OnboardingModal.jsx
│   │   ├── SettingsModal.jsx
│   │   ├── NewsDetailModal.jsx
│   │   └── BriefSettingsModal.jsx
│   └── common/
│       ├── DragHandle.jsx
│       ├── WidgetCard.jsx
│       └── AnalogClock.jsx
├── store/
│   ├── useAuthStore.js        # Google OAuth, 세션
│   ├── useSettingsStore.js    # 테마, 브리핑, 시계 스타일
│   ├── useWidgetStore.js      # 위젯 visibility, 레이아웃
│   ├── useDataStore.js        # API 호출, 캐시
│   ├── useTodoStore.js        # TODO (일반 + 고정, 일일 리셋)
│   └── useDiaryStore.js       # 일기 entries, answers, 메모
├── services/
│   ├── aiService.js           # AI 브리핑 + 스마트 위젯 + 일기 생성
│   └── supabaseClient.js      # Supabase 초기화
├── hooks/
│   └── useTheme.js            # isDark, cardCls, muted
├── mock/
│   └── data.js                # Mock 데이터 (fallback용)
└── utils/
    └── storage.js             # localStorage 유틸

supabase/
├── schema.sql
└── functions/
    ├── groq/          # LLM (Groq API)
    ├── stocks/        # Twelve Data
    ├── tavily/        # 뉴스/트렌드
    ├── kakao-places/  # 맛집
    ├── calendar/      # Google Calendar
    ├── fitness/       # Google Fit
    ├── smart-widget/  # 스마트 위젯
    └── weather/       # 날씨
```

### 3.2 데이터 흐름

```
앱 시작
  → onAuthStateChange → useAuthStore.handleAuthChange()
  → isLoggedIn = true
  → hydrateFromDB() (Settings, Widgets, Todo, Diary)
  → fetchAll({ useExistingCache: true })  ← 캐시 우선, 스피너 없이 즉시 표시
    → 각 fetch: DB api_cache 조회 → Edge Function → Mock fallback
    → 응답 → api_cache + localStorage 저장
  → 렌더링: col1(Briefing) | col2(Standard Widgets) | col3(Calendar)
```

### 3.3 캐시 TTL

| 위젯 | 소스 | TTL |
|------|------|-----|
| WeatherWidget | Weather API | 10분 |
| StocksWidget | Twelve Data | 5분 |
| TrendsWidget / NewsWidget | Tavily | 20분 |
| RestaurantsWidget | Kakao Local | 20분 |
| CalendarWidget | Google Calendar | 5분 |
| HealthWidget | Google Fit | 15분 |

---

## 4. 기능 요구사항

### 4.1 AI 브리핑

- 대시보드 로드 시 날씨·증시·뉴스·캘린더 기반 AI 브리핑 생성
- 브리핑 톤(formal/casual), 길이(short/medium/long) 설정 가능
- 자정 이후 첫 접속 시 자동으로 상세 브리핑 모달 표시 (하루 1회)
- 스마트 위젯: 사용자 정의 키워드 기반 Groq 콘텐츠 생성, 20분 캐시

### 4.2 일기 & 데일리 질문

- DiaryCard: 매일 새 질문 표시 (30일 이내 중복 없음)
- 답변 blur 시 자동 저장 (Supabase)
- 자정 합성: 체크된 할일·완료 캘린더 이벤트·답변·매크로 데이터 → Groq LLM → 사실 기반 일기
- 합성 후 프리뷰 모달 표시, 30초 후 자동 저장

### 4.3 캘린더 & Todo

- Google Calendar OAuth 연동 (read-only)
- 이벤트·할일 체크박스 완료 처리 → 자정 일기에만 포함
- 일반 TODO: 하루 후 삭제 / 고정 TODO(루틴): 매일 리셋

### 4.4 위젯 시스템

- 1:3:3 레이아웃 (좌:BriefingWidget+DiaryCard / 중:Standard Widgets / 우:CalendarWidget)
- 드래그 앤 드롭으로 중앙 열 위젯 순서 변경, Supabase 저장
- Settings에서 위젯 visibility 토글 (Fixed 위젯 제외)

### 4.5 보안

- 모든 서드파티 API 키는 Supabase Secrets Manager에만 저장
- Supabase RLS로 사용자별 데이터 격리

---

## 5. BriefingWidget 상세 다이얼로그 구현 명세 (v2)

> `brief.txt` 내용 — 구현 완료 기준 (2026-03-xx)

**확정 사항 요약:**

| 항목 | 내용 |
|------|------|
| 확장 애니메이션 | 오버레이 방식, scale(0.5→1) + opacity (framer-motion) |
| AI 호출 | Single Call → `{ summary, detail }` JSON 반환 |
| 데이터 호출 | 하이브리드: 최초 1회 + 캐시 + 새로고침 시 재호출 |
| 스크롤 제어 | `overflow:hidden` + `paddingRight` (Layout Shift 방지) |
| 인사말 | 시간대별 3종 (05-12 오전 / 12-18 오후 / 18-05 저녁) |
| 종료 | X 버튼 + 배경 클릭 |
| 스켈레톤 UI | 문단 블록 + `animate-pulse` |

**aiService.js 추가 함수:**
- `formatCalEventsForAI(calEvents)`: 캘린더 이벤트 → `"HH:MM 제목"` 포맷 문자열
- `getTimeGreeting()`: 시간대별 공식 인사말 반환
- `generateDetailedBriefing({ tone, length, context })`: summary + detail 동시 반환

---

## 6. 개발 히스토리

### 6.1 v2 리팩토링 (완료)

- `LAYOUT_VERSION` 갱신 (기존 레이아웃 강제 리셋)
- layout key: `left/center/right` → `col1/col2/col3`
- 캘린더·Todo: `WIDGET_COMPONENTS`에서 제거 → 별도 고정 렌더링
- DND: col1 ↔ col2 ↔ col3 자유 이동, 캘린더 제외

### 6.2 버그 수정 보고서 (2026-03-18)

| 항목 | 상태 |
|------|------|
| 로그아웃 로직 (useAuthStore) | ✅ |
| 시계 '날짜 상세' 스타일 (TopNav) | ✅ |
| 레이아웃 초기화 `resetDndLayout()` | ✅ |
| DND 이중 애니메이션(떨림) 해결 | ✅ |
| NewsWidget 신규 생성 (MiniWidgetGrid 교체) | ✅ |
| QuickLink 편집창 z-index → z-[9999] | ✅ |

### 6.3 캐시 최적화 & 무한 로딩 방지 (2026-04-04)

**문제:** 로그인 직후 fetchAll()이 모든 위젯을 동시에 `loading: true`로 세팅 → 무한 스피너

**수정 내용:**
- `fetchAll(options = {})` 에 `useExistingCache` 옵션 추가
  - `true`: 캐시 우선 (로그인 직후), loading 상태 없이 즉시 반환
  - `false`: 기존 30분 stale 체크 (기본값)
- 각 fetch 함수: loading 설정 전 캐시 먼저 확인 → 캐시 있으면 즉시 반환
- App.jsx: `fetchAll()` → `fetchAll({ useExistingCache: true })`

**효과:**

| 상황 | Before | After |
|------|--------|-------|
| 로그인 직후 (캐시 O) | 스피너 30초 | UI 즉시 표시 (0.05초) |
| 자동 새로고침 | 30분마다 | 없음 (수동만) |

---

## 7. 캘린더 기능 확장 (Progress)

> `progress.txt` 내용 — Calendar Integration (구현 완료)

**추가된 컴포넌트:**
- `PINModal.jsx` — 4자리 PIN 입력/인증
- `EventPanel.jsx` — 날짜별 구글 캘린더 이벤트 표시/추가
- `TaskPanel.jsx` — 날짜별 Task 표시/추가/완료 처리
- `DiaryPanel.jsx` — PIN 인증 후 일기 열람 + 메모 편집
- `DiaryListModal.jsx` — 전체 일기 목록, 검색, 정렬
- `DatePanelContainer.jsx` — Event|Task|Diary 3열 컨테이너

**추가된 Store:**
- `useGoogleCalendarStore.jsx` — events[], tasks[], selectedDate, PIN 인증 상태
- `useDiaryStore` 확장 — PIN 상태 관리 (pinSet, isPinAuthenticated, verifyPIN, setPIN)

**미완성 항목:**
- `googleCalendarService.js` — Backend API 엔드포인트 연동

---

## 8. Supabase 초기 설정 가이드

> `TODO.md` 내용 요약

### 필요 환경 변수 (.env)

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Supabase Google OAuth 설정 순서

1. Supabase 대시보드 → Authentication → Providers → Google 활성화
2. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 발급
   - 리디렉션 URI: `https://xxxxx.supabase.co/auth/v1/callback`
   - Calendar API + Fitness API 활성화
3. Additional OAuth Scopes:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/fitness.activity.read
   ```

### DB 스키마 (schema.sql)

테이블: `user_settings`, `widget_layouts`, `todos`, `diaries`, `api_cache`

모든 테이블에 Supabase RLS 적용 (사용자별 데이터 격리)
