## 완료

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

---

## 진행 예정

5. 일기 적는 형태 통일화 (로직 직접 구현 필요)
6. 언어 i18n — default 영어, 한국어는 마지막에 (전체 적용)
9. 위젯 세부 내용 popup modal + 좌우 버튼 넘기기 (news, trends, stocks 등)
10. Stocks 위젯 종목/지수 max 개수 설정 (kospi, nasdaq, spy, vix 등)
11. 마우스 호버링 제거 + 트랙패드 동작 확인
12. 글씨 크기 축소 버튼 상단 배치
13. 달력: 오늘(today)로 복귀 버튼
14. 달력: 월/년 헤더("May 2026") 클릭 시 드롭다운 날짜 이동 (Windows 작업표시줄 달력 방식)
15. 달력: event/task 텍스트 영역 가로 확장
16. 온보딩 데이터 → 고정 interest로 반영
17. 스마트 위젯 format 정의 (일반 widget 양식 참고)
19. Diary PIN 설정 기능 — ⚙️ 설정에서 PIN 저장/수정, 재설정 시 본인 확인 질문(유저 직접 작성) 통해 authenticate
20. Diary 질문 카드 깨진 글자 수정 ("금요일이终于 도착했군요... 외식 плани..." → 한국어로 정상 표시)
