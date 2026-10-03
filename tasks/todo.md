# 작업 현황

할 일 전체 목록은 [docs/BACKLOG.md](../docs/BACKLOG.md), 완료 기록은 [CHANGELOG.md](../CHANGELOG.md)·`git log`.
이 파일은 진행 중인 작업 계획만 둔다 (끝나면 비우고 CHANGELOG로).

## 진행 중

(없음)

## 다음 후보 (BACKLOG "Next up" 순서)

1. R12 Groq 분당 토큰 한도 대응
2. R2 근본 해결 (Google refresh token 서버 보관) — 보안 설계 필요
3. A8 일기 로컬 저장 계정별 분리 · R10 다중 탭 auth lock
4. A3 브리핑 1회 생성 공유 · R11 뉴스 품질

## 2026-10-04 세션 요약

- 브랜치 `fix/audit-and-guest-mode`: 실행 환경 복구 → 감사(버그·보안·군더더기) 수정 → 둘러보기 모드 → 묶음 A → R2 최소 대응
- 인프라 반영 완료: Supabase 프로젝트 복구, Groq 키 교체, `briefing_snapshots` 생성, `diaries` 컬럼 추가+백필, Edge Functions 5개 재배포
- 미검증: 실제 Google 재로그인 직후 강제 새로고침 경로, "Google 다시 연결" 버튼 클릭 흐름, 첫 로그인 Groq 호출 수
