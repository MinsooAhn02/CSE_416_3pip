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

14. [x] 주식/환율 위젯 언어 전환 시 변경 없음 확인
    - 내용: i18n.on("languageChanged") 핸들러에 fetchStocks 없음 → 언어 전환 시 호출 안 됨 확인

26. [x] **해결 (2026-05-13)** ai briefing 전면 리팩토링 — 자세한 설명: DOCS.md "2026-05-13 — AI 브리핑 결정론적 섹션 + 좁은 AI 보강 리팩토링" 참조.
   - **결정론적 섹션** (`aiService.js > generateDetailedBriefing`): 날짜+날씨(결합, 한 줄, 날씨 이모지) → 일정(오전: 오늘 / 오후·저녁: 오늘 남은 + 내일) → 어제 → 관심사 → 오늘 최신 정보 → (조건부)시장. JS로 구조 고정, Groq 호출은 3개로 한정·temperature 0.1.
   - **고정 관심사별 1문장** (`generateInterestSentences`): news/tech/finance/health/food/entertainment 각각에 대해 newsResults/stocks/trendsResults/smartSummaries 중 가장 관련 깊은 사실 하나로 한 문장. JSON 출력, "데이터에 없는 사실 금지" 가드.
   - **오늘 최신 정보 subBlocks**: `관심 키워드`(스마트 키워드 요약 1-2문장) + `주요 뉴스 Top 3`(newsResults[0..2], URL 호스트명 출처).
   - **모달 UI** (`BriefingWidget.jsx`): `divide-y` 섹션 블록 + 굵은 카테고리 제목 + subBlock 하위 헤더 들여쓰기.
   - **언어 일치**: 모든 섹션 제목·내용·Groq 프롬프트가 `getLangConfig()` 기반으로 ko/en 분기.
   - **언어 자동 추종 (round 3)**: `BriefingWidget.jsx`에서 `i18n.language` watch `useEffect` 추가 → 변경 시 `briefingVersions` 캐시 비우고 강제 재생성. 사용자가 언어를 바꾸면 새로고침 없이도 모달·대시보드 미리보기 모두 현재 언어로 즉시 반영.
   - **모달 본문 가독성 (round 3)**: `modalBodyText` 상수(`text-morning-dark-text/90` / `text-morning-light-text/85`)로 모달 본문 라인 색 교체 — 다크 모드 더 밝게, 라이트 모드 더 진하게. 대시보드 미리보기·푸터는 `muted` 유지.
   - 26-1 (시간대별 정보), 26-2 (변동성 제거), 26-3 (모달 배치) 모두 해결.


## To Fix

13. News 한국어 모드에서 한국어 출처만 표시 확인
    - 파일: `src/store/useDataStore.js`
    - 내용: include_domains + filterLocalizedArticles 동작 검증

101. 일기장에 diary card에 답변한 내용이 적혀있지 않을 뿐더러, ai briefing의 내용이 들어가 있지 않음

**중요!!**
102. stocks widget: 아직도 ticker 를 입력하면 값이 0이여서 --가 되는 버그가 있음. vix, aapl 등 몇개의 주식이나 지수도 입력이 안됌. 주식과 지수를 동시에 입력하는 로직이 잘못되었나 점검을 해야할 듯.
103. 뉴스 - 한국어 왜 안됨? tavily
원인 & 수정 요약

  ┌───────────────────────────────────┬─────────────────────────────┬─────────────────────────────────────┐
  │               원인                │            증상             │                수정                 │
  ├───────────────────────────────────┼─────────────────────────────┼─────────────────────────────────────┤
  │ include_domains: KO_NEWS_DOMAINS  │ Tavily가 그 도메인들을 잘   │ Korean 모드에서 include_domains     │
  │ Tavily에서 hard filter처럼 작동   │ 인덱싱 못해서 결과 0개 반환 │ 제거. 한국어 쿼리 텍스트 +          │
  │                                   │                             │ 클라이언트 필터로 대체              │
  ├───────────────────────────────────┼─────────────────────────────┼─────────────────────────────────────┤
  │ scoreArticleForLanguage 과도한    │ 한국 도메인(yna.co.kr 등)   │ KO_NEWS_DOMAINS 기사는 영어         │
  │ 엄격성                            │ 기사도 영어 제목이면        │ 제목이어도 최소 점수로 통과         │
  │                                   │ score=-1 탈락               │                                     │
  ├───────────────────────────────────┼─────────────────────────────┼─────────────────────────────────────┤
  │                                   │ Edge function이             │                                     │
  │ location Tavily API 미전달        │ geolocation을 받아도 Tavily │ tavilyBody.location 추가            │
  │                                   │  body에 안 넣음             │                                     │
  └───────────────────────────────────┴─────────────────────────────┴─────────────────────────────────────┘

100. (마무리 단계) i18n En/Ko 설정 적용. dashboard, user settings, briefing에서도 설정한 언어로 display.
