# 작업 현황

할 일 전체 목록은 [docs/BACKLOG.md](../docs/BACKLOG.md), 완료 기록은 [CHANGELOG.md](../CHANGELOG.md)·`git log`.
이 파일은 진행 중인 작업 계획만 둔다 (끝나면 비우고 CHANGELOG로).

## 묶음 C (2026-10-05) — 완료 (R2는 비밀값 설정 대기)

코드만:
- [x] C1 게스트가 저장소에 쓰는 문제 → storage.save()에서 게스트면 저장 안 함
- [x] C2 계정별 로컬 데이터(A8 포함): 다른 사용자 로그인·로그아웃 시 사용자 데이터 키 삭제 (일기·브리핑 캐시·질문·할일·캘린더 캐시 등)
- [x] C3 예비 로딩(fallback)은 Supabase 없을 때만 / 사용자 설정 대기 8초 타임아웃
- [x] C4 재연결 배너는 캘린더·건강 권한 있는 사용자만, 로그아웃 시 초기화
- [x] C5 브리핑 동시 요청 버그, groq 응답 상한 8192, 주식 잘못된 심볼만 제외
- [x] R10 auth.getUser() 21곳 → 로컬 세션 기반 헬퍼
- [x] R11 뉴스/스마트위젯: 섹션 페이지·위키 메타 문서 제외, 메뉴 텍스트 요약 제거
- [x] R13 건강: 오늘 0시를 클라이언트 로컬 기준으로 전달
- [x] R2 Google refresh token 서버 보관(암호화) + 갱신 함수 + 재연결 시 consent
사용자 필요: 비밀값 3개(GOOGLE_CLIENT_ID/SECRET, 암호화 키), DB: 토큰 테이블 생성
검증: typecheck/build, 내장 브라우저(로그인) 새로고침·게스트·로그아웃 흐름

## 다음 후보 (BACKLOG "Next up" 순서)

1. R2 근본 해결 (Google refresh token 서버 보관) — 보안 설계 필요
2. A8 일기 로컬 저장 계정별 분리 · R10 다중 탭 auth lock
3. R11 뉴스 품질

## 2026-10-04 세션 요약

- 브랜치 `fix/audit-and-guest-mode`: 실행 환경 복구 → 감사(버그·보안·군더더기) 수정 → 둘러보기 모드 → 묶음 A → R2 최소 대응
- 인프라 반영 완료: Supabase 프로젝트 복구, Groq 키 교체, `briefing_snapshots` 생성, `diaries` 컬럼 추가+백필, Edge Functions 5개 재배포
- 미검증: 실제 Google 재로그인 직후 강제 새로고침 경로, "Google 다시 연결" 버튼 클릭 흐름, 첫 로그인 Groq 호출 수
