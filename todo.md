## 완료(성민)

1. [x] 카카오 Local API 코드 완전 제거 (Groq 일반 응답으로 대체)
2. [x] Geolocation → 수동 도시 설정 (Nominatim OSM 지오코딩, WeatherWidget 인라인 폼)
3. [x] AI 브리핑 메타데이터 제거 (마크다운/JSON 구조 줄 필터링)
4. [x] AI 브리핑 실데이터 연동 + Groq 연결 수정
   - invokeFunction: supabase.functions.invoke → direct fetch + anon key (401 fix)
   - 프롬프트 경량화: 거대 JSON dump → compact 섹션별 텍스트
   - 뉴스/트렌드/Q&A/스마트위젯 실데이터 context 추가
   - 시스템 프롬프트 영어화 + 언어 동적 설정 (ko/en)
   - [추가 버그픽스] aiService.js 633번줄 `.slice` 앞 `.` 누락 → ReferenceError로 브리핑 항상 실패하던 문제 수정
   - [정리] BriefingWidget.jsx useEffect: `isLoading` 불필요 deps 제거, bLen 변경 시 Groq 이중 호출 race condition 제거
7. [x] 오늘의 질문 무한로딩 해결 (DiaryCard.jsx: handleSubmit 성공 후 setIsSaving(false) 누락)
8. [x] API 실패 시 dummy 대신 에러 메시지 표시 (Weather/Stocks/Trends/News/Health 전체)
18. [x] DB 기반 초기 데이터 (mockTodos 제거, layout DB값 우선 적용)

## 완료(다현)

6. [x] 언어 i18n — default 영어, 한국어는 마지막에 (전체 적용)
   - 기본 언어와 fallback을 `en`으로 변경
   - Diary 질문 카드, 로그인 화면, 온보딩, 브리핑 모달, Diary 패널, 설정 주요 탭 등 한/영 전환 반영
11. [x] 마우스 호버링 제거 + 트랙패드 동작 확인
   - 위젯 deck의 엣지 호버 전환 제거
   - 트랙패드 가로 스와이프를 위젯 섹션 안에서만 처리하고 끝에서는 브라우저 뒤로/앞으로 이동 없이 멈추도록 처리
12. [x] 글씨 크기 축소 버튼 상단 배치
   - 전역 글자 크기 조절을 `설정 > 위젯 관리` 상단으로 이동
   - 위젯 제목줄의 숨김 설정 버튼과 제목 클릭 설정 진입 제거
13. [x] 달력: 오늘(today)로 복귀 버튼
15. [x] 달력: event/task 텍스트 영역 가로 확장
   - Date Details를 `Events` / `Tasks` 탭 구조로 바꿔 한 번에 하나만 전체 폭으로 표시
16. [x] 온보딩 데이터 → 고정 interest로 반영
   - `fixed_interests`, `onboarding_perms` 서버 저장/복원 추가
   - 고정 관심사와 동적 관심사를 함께 사용하도록 개인화 흐름 정리
20. [x] Diary 질문 카드 깨진 글자 수정 ("금요일이终于 도착했군요... 외식 плани..." → 한국어로 정상 표시)
   - 질문 생성 시 언어 검증, 재시도, fallback 추가
21. [x] Tasks: 앱 전용 메타데이터 제거, Google Tasks와 실제 연동되는 필드만 유지
22. [x] Calendar: 월/주/일 뷰 전환 시 열려 있던 Date Details 자동 닫힘
23. [x] 실시간 트렌드/뉴스 언어 표시 보정
   - 한국어 모드에서 결과가 영어로 보이던 문제를 후처리 번역 경로로 보정
   - `newsResults`, `trendsResults` 캐시/신규 응답 모두 한국어 번역 적용


---

## 진행 예정

5. 일기 적는 형태 통일화 (로직 직접 구현 필요)
9. 위젯 세부 내용 popup modal + 좌우 버튼 넘기기 (news, trends, stocks 등)
10. Stocks 위젯 종목/지수 max 개수 설정 (kospi, nasdaq, spy, vix 등)
14. 달력: 월/년 헤더("May 2026") 클릭 시 드롭다운 날짜 이동 (Windows 작업표시줄 달력 방식)
#15. 달력: event/task 텍스트 영역 가로 확장
#16. 온보딩 데이터 → 고정 interest로 반영
17. 스마트 위젯 format 정의 (일반 widget 양식 참고)
19. Diary PIN 설정 기능 — ⚙️ 설정에서 PIN 저장/수정, 재설정 시 본인 확인 질문(유저 직접 작성) 통해 authenticate


## 5/8/2026

### 코드 감사 & Dead Code 정리 (merge 누락 수정)

**🔴 CRITICAL 수정**

1. `src/store/useTodoStore.js` — import 5개 누락 복구
   - `formatLocalDate`, `materializeTasksForDate`, `useGoogleCalendarStore`, `filterTasksByTaskList`, `ALL_TASK_LIST_FILTER_ID` 전부 누락되어 todo 기능 완전 마비 상태였음
   - merge 중에 import 라인이 통째로 날아간 것으로 추정
   - 수정 후 `ensureDailyReset`, `syncTodosFromCalendarStore`, `toggleTodo`, `addTodo`, `deleteTodo` 정상 동작

**🟡 로직 버그 수정**

2. `src/components/widgets/BriefingWidget.jsx` — `healthData` context 누락 복구
   - `aiService.js`의 `scoreSignals()`는 `context.healthData`로 health 신호를 채점하는데 BriefingWidget이 context에 `healthData`를 넘기지 않아 health 점수가 항상 0이었음
   - `useDataStore((s) => s.healthData)` 구독 추가 + context 객체에 `healthData: healthData ?? null` 추가
   - `hoverCls` — BriefingWidget에서 unused한 destructure 제거

3. `src/store/useWidgetStore.js` — 기본 스마트 키워드 `["카메라", "노트북"]` → `[]`
   - 신규 사용자가 테스트 키워드로 시작하던 문제 수정

**🟢 Dead Code 삭제**

4. `src/store/useWidgetStore.js` — `resetDndLayout()` 함수 삭제
   - 구 DND 시스템(`mb_widget_layout` 키) 대상 함수. 현재 앱은 breakpoint grid(`mb_layouts`) 사용. 호출하는 곳도 없음
   - `initLayouts()` if/else 두 브랜치가 동일한 코드 → 단순화

5. `src/store/useDiaryStore.js` — `wasActiveToday` reactive state 제거
   - `markActive()`가 `set({ wasActiveToday: true })`를 호출했지만 어떤 컴포넌트도 subscribe하지 않음. 실제 로직은 `wasActiveOn()`이 localStorage 직접 읽음
   - `isPinAuthenticatedSession()` wrapper 함수 삭제 — `isPinAuthenticated` state 직접 구독으로 충분, 호출하는 코드 없음

6. `src/store/useDataStore.js` — dead mock import 4개 제거
   - `mockFetchWeather`, `mockFetchStocks`, `mockFetchTrends`, `mockFetchHealthData` — 현재 fetch 실패 시 에러 메시지 + null로 처리하므로 사용 안 됨
   - `mockFetchCalendarEvents`는 유지 (Supabase 미연결 시 fallback으로 실제 사용 중)

---

