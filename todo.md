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
5. [x] 자동 일기 적는 형태 통일화 — 관심사 + 언어 일관성 적용
   - `generateDiary()`에 `interests` 파라미터 추가 → promptContext에 포함, 프롬프트 규칙 1줄 추가
   - `buildDiaryGenerationContext()`에서 `mergeInterestLists(fixedInterestIds, keywordInterests)` 포함
   - 자정 자동일기(useMidnightTrigger → diaryGenerationService)는 변경 없이 위 context 자동 수혜
   - `ensureYesterdayDiaryForMorning()`에 `language: resolveDiaryGenerationLanguage()` + `interests: effectiveInterests` 추가 (이전엔 language 미전달로 항상 기본값 "ko" 사용)
   - `resolveDiaryGenerationLanguage` export → BriefingWidget에서 import해 사용
7. [x] 오늘의 질문 무한로딩 해결 (DiaryCard.jsx: handleSubmit 성공 후 setIsSaving(false) 누락)
8. [x] API 실패 시 dummy 대신 에러 메시지 표시 (Weather/Stocks/Trends/News/Health 전체)
16. [x] 온보딩 데이터 → 고정 interest 전체 적용
   - `personaContext.js`: `fixedInterestIds` + `keywordInterests` 병합 → 브리핑 스코어러에 통합 전달
   - `DiaryCard.jsx`: `fixedInterestIds` 구독, `generatePersonalizedQuestion()`에 전달
18. [x] DB 기반 초기 데이터 (mockTodos 제거, layout DB값 우선 적용)
26. [x] Interest keywords logics application (locally stored)
   - `INTEREST_TOPIC_MAP` 추가 (ko/en × 8개 고정 관심사 → 자연어 주제 문구)
   - `pickTopics()`: `fixedInterestIds` 파라미터 추가 → 관심사 1개 + 일반 주제 1개 혼합 선택, 관심사 없을 시 기존 랜덤 유지
   - `generatePersonalizedQuestion()`: `fixedInterestIds` 파라미터 추가, DiaryCard에서 전달
   - `generateBriefing()` (단순 3줄): `keywordInterests` → `Interest guidance:` 줄 추가 (기존 상세 브리핑과 동일 패턴)

10. [x] Stocks 위젯 심볼 선택/추가/삭제/재정렬
   - 기본 심볼 4종(KOSPI, NASDAQ, S&P 500, USD/KRW) 토글 UI
   - 커스텀 티커 직접 입력: Edge Function 호출로 유효성 검증 후 추가 (`validateStockSymbol`)
   - 모달에서 drag-and-drop 순서 변경 (`@hello-pangea/dnd`), 순서는 `stockSymbols` store에 영구 저장
   - 모달 compact 3열 카드 레이아웃 (`flex flex-wrap`, `calc(33.333% - 5.5px)`)
   - 드래그 중 카드 사라짐 버그 수정: Framer Motion transform context 탈출용 `createPortal(card, document.body)` + `zIndex: 10001`
   - 위젯 본체 최대 표시 `WIDGET_LIMIT = 6`, 초과 시 "전체 보기" 버튼으로 모달 진입

27. [x] Stocks 지수 fetch 로직 전면 수정 (KOSPI/NASDAQ/S&P500 0 표시 문제)
   - 근본 원인 3중 수정 (`supabase/functions/stocks/index.ts`):
     1. `symbolMap` 오류: 기존 EWY/QQQ/SPY(ETF 대리) → KS11/IXIC/SPX(실 지수) 로 교체
     2. TwelveData가 오류 없이 price=0 반환 시 Stooq fallback 미발동 → `price <= 0` 조건 추가
     3. Stooq fallback 심볼 맵 비어 있음 → `KS11→^ks11`, `IXIC→^ndq`, `SPX→^spx` 복원
   - Stooq 커스텀 심볼 fallback 개선: `sym.us` 시도 후 price=0이면 bare `sym` 재시도 (순차 loop)
   - ⚠️ **배포 필요**: 로컬 파일 수정 완료, Supabase Dashboard → Edge Functions → `stocks` → Deploy 후 위젯 새로고침 필요

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

9. 위젯 세부 내용 popup modal + 좌우 버튼 넘기기 (news, trends, stocks 등)
14. 달력: 월/년 헤더("May 2026") 클릭 시 드롭다운 날짜 이동 (Windows 작업표시줄 달력 방식)
17. 스마트 위젯 format 정의 (일반 widget 양식 참고)
19. Diary PIN 설정 기능 — ⚙️ 설정에서 PIN 저장/수정, 재설정 시 본인 확인 질문(유저 직접 작성) 통해 authenticate
24. 설정에서 글씨 크기 전체 위젯에 적용 (현재는 trends 에만 적용됨)
25. 설정 모달 크기 고정(현재는 widget management, smart widgets 등과 같은 왼쪽 패널을 클릭할 때마다 오른쪽 패널의 길이가 들쭉날쭉해서 크기도 같이 변동되지만, 지향하는 디자인은 오른쪽 패널의 길이가 특정 설정 모달 박스를 넘어간다면 스크롤할 수 있게)

26. ai briefing: 
   26-1. 오늘자 기준 오전, 오후, 현재 상태에 관련된 정보만 출력.
   현재 briefing 최악의 예시 : {사용자의 최근 관심 키워드는 슈퍼마리오 갤럭시입니다. 족발, 음식, 음악, 산책, 드라마, IGC libarary, 주말도 관심 키워드에 포함됩니다. 노트북은 개인용 컴퓨터의 일종으로 휴대가 가능합니다. 최신 노트북에는 다양한 프로세서, 높은 해상도의 디스플레이, 충분한 저장 공간 등이 포함되어 있습니다....}. 
   
   새로고침할 때마다 often 이따구로 나오는데, 브리핑 순서는 {오늘 날짜, 날씨, 오전이면 오늘 일정 오후라면 오늘 남은 일정과 내일 일정, 어제 diary card에서 작성한 내용을 기반으로 과거형으로 사실 서술, interests, 스마트 위젯에 반영된 오늘 최신 정보} 를 담아야함.
   
   이런 형식이 굉장히 훌륭한 브리핑임: {

로컬 브리핑으로 안내드립니다.

날짜: 2026년 5월 11일 월요일

날씨: Incheon 21°C, 온흐림, 강수확률 35%

주요 뉴스:

- 최신 뉴스 속보 관심사에 대한 정보는 다음과 같습니다. 슈퍼마리오 갤럭시와 관련하여, 닌텐도의 전설적인 디자이너인 다카시 테즈카가 올해 퇴직할 예정이며, 그는 마리오와 젤다 시리즈를 비롯한 많은 닌텐도 게임에서 디자이너, 감독 또는 프로듀서로 활동했습니다. 음식과 관련하여, 음식 배달 서비스를 통해 서울에서 다양한 음식을...

- 한국의 주식시장은 이전보다 더 뜨겁고 골드만 삭스는 여전히 더 많은 상승 가능성이 있다고 말한다 - 비즈니스 인사이드

- 레전드 닌텐도 디자이너 테즈카 타카시, 은퇴 예정 - IGN 인디아

- 음악가 장기하의 서울 가이드 - 파이낸셜 타임스

- 니텐도의 전설적인 슈퍼 마리오 브라더스 디자이너 테즈카 타카시, 은퇴 예정 - IGN

트렌드:

- 오늘 대한민국의 주요 이슈는 인공지능 기술의 산업화 추세로 대표되고 있습니다. 특히, 대한민국의 인공지능 인프라 부문이 제조업, 물류, 의료 등 산업 분야로 확장되고 있습니다. 또한, 정치적으로는 지역 중소기업을 지원하기 위한 187만 달러의 연구개발 펀드 육성 계획이 발표되었습니다. 경제적으로는 아시아의 기술 대기업들이...

- [한국 스타트업 주간 뉴스 #117] 한국의 AI 인프라 붐, 산업으로 확대 - Wowtale

- 마자르, 헝가리 총리로 취임하고 변화 약속 - 로이터

- AI & 테크 브리프: 트럼프 행정부, 최전선 모델 테스트 - 워싱턴 포스트

- 아시아의 기술 거물, AI 황금기 새로운 중추 제공 - 로이터

오늘 남은 할 일: 없음

어제 일기 요약: 제목: 휴식의 날 날짜: 2026년 5월 10일 일정 - 일정 없음 완료한 일 - 완료한 일 없음 기록 2026년 5월 10일은 활동적인 날이 아니었습니다. 아무런 일정이不存在하지도 않았고, 완수한 일도 없었습니다}
   26-2. 새로고침 시마다 내용이 조금씩 달라짐. 변동성없는 형식을 위한 방안이 필요함.
   26-3. modal 상태시 배치를 정갈하게 할 필요가 있음. Bold, 카테고리 제목과 내용의 글자 크기 다름, 칸 나누기 등 요소를 
28. Stocks 통화 단위 표시: 미장이면 $, 국장이면 ₩ 표시 (StocksWidget.jsx normalizeStockItem 수정 필요)

100. (마무리 단계) i18n En/Ko 설정 적용. dashboard, user settings, briefing에서도 설정한 언어로 display.


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

