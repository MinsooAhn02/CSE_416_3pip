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
