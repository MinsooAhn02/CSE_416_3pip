# Tasks

## ✅ Goal 1 — 오류 처리 표준화 (완료)
- `src/utils/errorHandler.ts` 생성 (timeout/network/4xx/5xx 분류)
- `handleApiError(err, context)` 공통 유틸 — userVisible=true → toast, false → silent
- 3개 대상 파일 (useDataStore.ts, aiService.ts, diaryGenerationService.ts) — console.warn/error 0개
- invokeEdgeDetailed: 25초 AbortError → userVisible:true → "잠시 후 다시 시도" toast

## ✅ Goal 2 — TypeScript 마이그레이션 (완료)
- 모든 파일 .ts/.tsx 전환
- tsconfig.json strict: false
- tsc --noEmit 에러 0개, npm run build 성공

## ✅ Goal 3 — 성능 최적화 (완료)

### 1) fetchAll 중복 트리거 방지
- App.tsx: `const fetchAll = useCallback(_fetchAll, [])` — 안정적 레퍼런스 명시
- `initPhaseRef.current` 게이트: "none"→"user" / "none"→"fallback" 한 번만 실행
- StrictMode 이중 마운트, 동시 auth 이벤트에서 중복 fetchAll 방지 확인됨

### 2) 위젯 selector 최소화 + React.memo
- 9개 위젯 모두 `memo()` 적용
- 5개 핵심 위젯 `useShallow` 적용 — data 필드 N subscriptions → 1 shallow subscription:
  - WeatherWidget: 6 data fields (weather, loading, error, apiStatus, usingDefaultLocation, manualWeatherCity)
  - HealthWidget: 4 data fields (healthData, loading, error, apiStatus)
  - TrendsWidget: 3 data fields (trendsResults, loading, error)
  - NewsWidget: 3 data fields (newsResults, loading, error)
  - StocksWidget: 4 data fields (stocks, loading, error, apiStatus)
- Actions (fetchWeather 등)은 Zustand 보장 stable reference → 별도 구독 유지

### 3) 번들 크기 -27.9% (목표 -20% 초과달성)
- 1,025.94 kB → 739.50 kB
- DashboardLayout: 9개 위젯 React.lazy + Suspense
- App.tsx: 4개 모달 + FixedButtons React.lazy + Suspense(fallback=null)
- Vite가 자동으로 dnd.esm(97.65 kB), CalendarWidget(87.56 kB) 별도 chunk로 분리

## ⬜ Goal 4 — 상태 관리 분리
## ⬜ Goal 5 — 국제화/지역화 완성
## ⬜ Goal 6 — 보안 감사
## ⬜ Goal 7 — 아키텍처 문서화
