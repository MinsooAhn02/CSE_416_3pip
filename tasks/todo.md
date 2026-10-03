# 정리 1차 (2026-10-04): 실행 가능 + 치명 문제 + 문서화

기준선(수정 전): npm install OK / typecheck 0 errors / build OK / build:extension FAIL(archiver 없음)

- [x] 0. git pull --ff-only
- [x] 1. npm install + 기준선
- [x] 2. 치명 문제: index.html main.tsx, manifest icons, archiver, lockfile/.gitignore, .env.example, briefing_snapshots migration
- [x] 3. 정리: .temp/dist untrack, 죽은 코드 삭제, archive/course 이동, BACKLOG 통합
- [x] 4. 문서: AGENTS.md, CLAUDE.md, README, DOCS, CHANGELOG
- [x] 5. 검증: typecheck/build/build:extension/dev 렌더, grep 체크


Stocks Yahoo 작업 기록 → docs/BACKLOG.md (배포만 남음)

## 검증 결과 (2026-10-04)
- npm ci(lockfile) OK / typecheck 0 errors / build:extension(tsc+vite+zip) OK, zip 안 manifest 아이콘 경로 = 실제 파일
- zip 스크립트 실패 경로: dist 없음 → exit 1 + 명확한 에러 (이전: 빈 zip + exit 0)
- dev 서버 :3000 → headless Chrome 렌더: 로그인 화면 + 안내문 정상, 콘솔 에러 0
- 미검증: 실제 Google 로그인 이후 대시보드, unpacked 확장 로드, Edge Function/DB 변경(배포 안 함)
