# 정리 1차 (2026-10-04): 실행 가능 + 치명 문제 + 문서화

기준선(수정 전): npm install OK / typecheck 0 errors / build OK / build:extension FAIL(archiver 없음)

- [x] 0. git pull --ff-only
- [x] 1. npm install + 기준선
- [ ] 2. 치명 문제: index.html main.tsx, manifest icons, archiver, lockfile/.gitignore, .env.example, briefing_snapshots migration
- [ ] 3. 정리: .temp/dist untrack, 죽은 코드 삭제, archive/course 이동, BACKLOG 통합
- [ ] 4. 문서: AGENTS.md, CLAUDE.md, README, DOCS, CHANGELOG
- [ ] 5. 검증: typecheck/build/build:extension/dev 렌더, grep 체크

---

# Stocks 위젯 지수 값 오류 수정

## 문제 (확정)
- `StocksWidget` → `fetchStocks` → edge `stocks`(TwelveData) 경로.
- TwelveData 현재 플랜은 **지수 미지원**: `SPX`/`IXIC`/`KS11` → 404 에러 → price 0.
- `fetchStocks` 폴백이 값 0을 보고 이전 캐시값으로 대체 → 옛날/틀린 지수 값이 갱신 안 됨.
- 환율 `USD/KRW`만 TwelveData에서 정상 동작.

## 해결 (하이브리드)
지수/원자재는 Yahoo Finance(무료, 키 불필요), 환율·개별주식은 TwelveData 유지.

Yahoo 심볼 (검증 완료):
SP500→^GSPC, KOSPI→^KS11, NASDAQ→^IXIC, VIX→^VIX, DJI→^DJI, DXY→DX-Y.NYB, CRUDE→CL=F

## 작업
- [x] `supabase/functions/stocks/index.ts`
  - [x] `YAHOO_SYMBOL_MAP` 추가, `fetchJsonWithTimeout`에 init 옵션 추가
  - [x] `fetchYahooQuote` 헬퍼 추가 (chart v8 meta에서 price/prevClose→change/percent)
  - [x] symbols.map에서 Yahoo 심볼이면 Yahoo, 아니면 기존 TwelveData
  - [x] symbolMap에서 Yahoo로 옮긴 지수 항목 제거(USDKRW만 유지)
- [x] smart-widget 잘못된 변경 원복
- [x] 응답 shape 동일 확인: { symbol, price, change, changePercent, type, currency }
- [x] 전 심볼 출력 검증 (Yahoo 7종 + 변동/변동률/타입/통화)
- [ ] **(사용자) supabase 재배포**: `supabase functions deploy stocks`
- [ ] **(사용자) 배포 후 위젯 새로고침 버튼 눌러 force refresh → 실제 지수 값 확인**

## 검증 근거 (실측)
- SP500=7599.96(+0.26%), KOSPI=8801.49 KRW(+0.15%), NASDAQ=27086.81(+0.42%)
- VIX=16.15, DJI=51078.88, DXY=99.12, CRUDE=90.82($) — 모두 실제 지수 레벨.
- Deno 로컬 미설치로 타입체크/serve 실행은 못 함 → 배포 후 실측 필요.
