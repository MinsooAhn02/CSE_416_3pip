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



