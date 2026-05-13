## 🔒 보안 수정 목록

1. [x] [High] events Edge Function JWT 인증 추가
   - 파일: `supabase/functions/events/index.ts` + `src/store/useDataStore.js`
   - 내용: Google Calendar CRUD (list/create/update/delete) 모두 인증 없이 호출 가능
   - 수정: 서버에서 Supabase JWT 검증 + 클라이언트에서 user access_token 전송

2. [x] [High] tasks Edge Function JWT 인증 추가
   - 파일: `supabase/functions/tasks/index.ts`
   - 내용: Google Tasks CRUD 인증 없이 호출 가능
   - 수정: 위와 동일 패턴

3. [x] [Medium] Google OAuth token localStorage 저장 제거
   - 파일: `src/store/useAuthStore.js`
   - 내용: Google provider_token이 localStorage에 평문 저장 → XSS 시 탈취 가능
   - 수정: localStorage 저장 제거, Zustand 메모리에만 보관, 재로드 시 Supabase session에서 복원

4. [x] [Medium] Diary PIN 평문 저장 → SHA-256 해시로 교체
   - 파일: `src/store/useDiaryStore.js` + `src/components/modals/PINModal.jsx`
   - 내용: 4자리 PIN이 localStorage에 "1234" 그대로 저장
   - 수정: Web Crypto API SHA-256 해싱 후 저장/비교, 기존 평문 PIN 마이그레이션 처리

## 위젯 API 최적화 & 언어/UI 개선

5. [x] 언어 전환 시 불필요한 Tavily 재호출 제거
   - 파일: `src/store/useDataStore.js` 라인 1657-1661
   - 내용: i18n.on("languageChanged")에서 force=true로 언어별 캐시 무시하고 재호출
   - 수정: force 인자 제거 → 캐시 우선 확인

6. [x] Smart Widget 언어 대응
   - 파일: `src/services/aiService.js`, `src/store/useWidgetStore.js`
   - 내용: Groq/Tavily 쿼리 한국어 고정, 캐시 키 언어 미포함
   - 수정: getLangConfig() 활용 언어별 분기, 캐시 키 `${kw}_${lang}`

7. [x] Live Trend 표시 2-3개로 축소
   - 파일: `src/components/widgets/TrendsWidget.jsx`
   - 수정: MAX_ITEMS { small:2, medium:3, large:3 }, MAX_EXPANDED 6

8. [x] Smart Widget → "Personal Search" UI 리디자인
   - 파일: `src/components/widgets/SmartWidgetContent.jsx`, `src/services/aiService.js`
   - 수정: 핵심 포인트 섹션 제거, AI요약+관련뉴스(2-3개)만 표시, 이름 변경

## 추가 버그 수정 (2차)

9. [x] Smart Widget badge ("관심 검색") 제거
   - 파일: `src/components/widgets/SmartWidgetContent.jsx`

10. [x] Personalized Search: Groq로 언어 맞춤 3-4 bullet 재요약
    - 파일: `src/services/aiService.js`
    - 수정: Tavily 결과를 Groq에 입력 → 언어별 bullet 3-4개 생성

11. [x] App.jsx 중복 language 핸들러 제거 (force=true로 매번 재호출하던 근본 원인)
    - 파일: `src/App.jsx`
    - 수정: useEffect 제거 → useDataStore.js의 i18n.on 리스너만 사용

12. [x] Live Trend 언어 전환 시 in-memory 캐시로 즉시 표시 (로딩 없음)
    - 파일: `src/store/useDataStore.js`
    - 수정: `_trendsMemCache` 모듈 레벨 맵 추가 → 언어 전환 시 즉시 반영

13. [ ] News 한국어 모드에서 한국어 출처만 표시 확인
    - 파일: `src/store/useDataStore.js`
    - 내용: include_domains + filterLocalizedArticles 동작 검증

14. [x] 주식/환율 위젯 언어 전환 시 변경 없음 확인
    - 내용: i18n.on("languageChanged") 핸들러에 fetchStocks 없음 → 언어 전환 시 호출 안 됨 확인

## To Fix
9. 위젯 세부 내용 popup modal + 좌우 버튼 넘기기 (news, trends, stocks 등)
14. 달력: 월/년 헤더("May 2026") 클릭 시 드롭다운 날짜 이동 (Windows 작업표시줄 달력 방식)
24. 설정에서 글씨 크기 전체 위젯에 적용 (현재는 trends 에만 적용됨)
25. 설정 모달 크기 고정(현재는 widget management, smart widgets 등과 같은 왼쪽 패널을 클릭할 때마다 오른쪽 패널의 길이가 들쭉날쭉해서 크기도 같이 변동되지만, 지향하는 디자인은 오른쪽 패널의 길이가 특정 설정 모달 박스를 넘어간다면 스크롤할 수 있게)

26. [x] **해결 (2026-05-13)** ai briefing 전면 리팩토링 — 자세한 설명: DOCS.md "2026-05-13 — AI 브리핑 결정론적 섹션 + 좁은 AI 보강 리팩토링" 참조.
   - **결정론적 섹션** (`aiService.js > generateDetailedBriefing`): 날짜+날씨(결합, 한 줄, 날씨 이모지) → 일정(오전: 오늘 / 오후·저녁: 오늘 남은 + 내일) → 어제 → 관심사 → 오늘 최신 정보 → (조건부)시장. JS로 구조 고정, Groq 호출은 3개로 한정·temperature 0.1.
   - **고정 관심사별 1문장** (`generateInterestSentences`): news/tech/finance/health/food/entertainment 각각에 대해 newsResults/stocks/trendsResults/smartSummaries 중 가장 관련 깊은 사실 하나로 한 문장. JSON 출력, "데이터에 없는 사실 금지" 가드.
   - **오늘 최신 정보 subBlocks**: `관심 키워드`(스마트 키워드 요약 1-2문장) + `주요 뉴스 Top 3`(newsResults[0..2], URL 호스트명 출처).
   - **모달 UI** (`BriefingWidget.jsx`): `divide-y` 섹션 블록 + 굵은 카테고리 제목 + subBlock 하위 헤더 들여쓰기.
   - **언어 일치**: 모든 섹션 제목·내용·Groq 프롬프트가 `getLangConfig()` 기반으로 ko/en 분기.
   - **언어 자동 추종 (round 3)**: `BriefingWidget.jsx`에서 `i18n.language` watch `useEffect` 추가 → 변경 시 `briefingVersions` 캐시 비우고 강제 재생성. 사용자가 언어를 바꾸면 새로고침 없이도 모달·대시보드 미리보기 모두 현재 언어로 즉시 반영.
   - **모달 본문 가독성 (round 3)**: `modalBodyText` 상수(`text-morning-dark-text/90` / `text-morning-light-text/85`)로 모달 본문 라인 색 교체 — 다크 모드 더 밝게, 라이트 모드 더 진하게. 대시보드 미리보기·푸터는 `muted` 유지.
   - 26-1 (시간대별 정보), 26-2 (변동성 제거), 26-3 (모달 배치) 모두 해결.

   ---
   (원래 명세 보존)
   26-1. 오늘자 기준 오전, 오후, 현재 상태에 관련된 정보만 출력.
   현재 briefing 최악의 예시 : {사용자의 최근 관심 키워드는 슈퍼마리오 갤럭시입니다. 족발, 음식, 음악, 산책, 드라마, IGC libarary, 주말도 관심 키워드에 포함됩니다. 노트북은 개인용 컴퓨터의 일종으로 휴대가 가능합니다. 최신 노트북에는 다양한 프로세서, 높은 해상도의 디스플레이, 충분한 저장 공간 등이 포함되어 있습니다....}. 
   
   새로고침할 때마다 브리핑이 형식이 없이 랜덤하게 프롬프트에 맞춰서 나오는데, 브리핑 순서는 {오늘 날짜, 날씨, 오전이면 오늘 일정 오후라면 오늘 남은 일정과 내일 일정, 어제 diary card에서 작성한 내용을 기반으로 과거형으로 사실 서술, interests, 스마트 위젯에 반영된 오늘 최신 정보} 를 담아야함.
   
   이런 형식이 굉장히 훌륭한 브리핑임. 훌륭한 브리핑 예시: {

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
29. ai briefing 내용 취합해서 midnight때 자동 일기 생성 로컬에 저장

100. (마무리 단계) i18n En/Ko 설정 적용. dashboard, user settings, briefing에서도 설정한 언어로 display.
