# 감사 결과 수정 (2026-10-04) — 완료

- [x] 1. A1 일기 DB 저장 복구: 라이브 DB에 컬럼 추가(schema.sql 184-216) + hydrate/personalization이 새 컬럼 읽기 + error 체크
- [x] 2. A2 Edge Functions 잠금: groq/tavily/stocks/weather/google-refresh에 getUser + 상한 → 사용자 배포
- [x] 3. A3~A5: 첫 로그인 모달 재생성 반복, 개인화 중복 실행, loadUserSettings 오류=신규 처리
- [x] 4. B1 three.js lazy + B2 dead code 삭제
- [x] 5. 둘러보기 모드 — 외부 호출 0 확인(내장 브라우저), 언어 전환/새로고침/날짜 패널 OK, localStorage 누수 2곳 차단(briefing_history, todos)
각 단계: typecheck/build + 동작 확인 후 체크
# 둘러보기(게스트) 모드 (2026-10-04) — 계획, 승인 대기

목표: 로그인 없이 "둘러보기" 버튼 → 샘플 데이터 대시보드. 네트워크/API 비용 0.

- [ ] 1. useAuthStore: isGuest + enterGuest(); logout 시 해제. (메모리만 — 새로고침하면 로그인 화면)
- [ ] 2. 네트워크 차단: 엣지 호출 헬퍼 3곳(invokeEdgeDetailed, invokeFunction, invokeGoogleFunction)에서 게스트면 즉시 실패 반환 → 놓친 호출도 비용 0, 기존 fallback 경로 사용
- [ ] 3. src/demo/demoData.ts: 날씨/주식/뉴스/트렌드/일정/할일/건강/스마트위젯 샘플 + loadDemoData() (스토어 setState, initialFetchDone=true → 브리핑은 로컬 생성)
- [ ] 4. 캘린더 마운트 시 localStorage로 덮어쓰는 것 방지: fetchEventsAndTasks 게스트 가드 1줄
- [ ] 5. LoginScreen "둘러보기" 버튼 + 대시보드 상단 배너("샘플 데이터 · Google로 로그인") , en/ko 키
- [ ] 6. 로그인 화면 문구 "Testing mode" → 실제 상태(프로덕션, 미인증)로 수정
- [ ] 7. 검증: typecheck/build, Chrome에서 게스트 진입 → 네트워크 탭에 supabase.co 호출 0, 위젯 렌더, 언어 전환, 종료 후 실제 로그인 정상

알려진 한계: 게스트가 바꾼 설정(테마 등)은 같은 브라우저 localStorage에 남음.
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
