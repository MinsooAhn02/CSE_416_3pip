# Project Goals

---

## 1. 오류 처리 표준화 (o)
 
Goal: 모든 Edge Function / API 호출 실패를 일관된 패턴으로 처리한다.

Condition:
- invokeEdgeDetailed 같은 공통 fetch 헬퍼에 에러 타입 분류 (네트워크/타임아웃/HTTP 4xx/5xx) 추가
- 스토어별로 흩어진 console.warn / console.error → 공통 handleApiError(err, context) 유틸로 교체
- 사용자에게 노출할 에러는 toast, 내부 경고만인 경우는 silent — 기준 명문화

Clear:
- 대상 파일: src/store/useDataStore.js, src/services/aiService.js, src/services/diaryGenerationService.js
- src/utils/errorHandler.js 신규 생성
- Supabase Edge Function 25초 타임아웃 abort → 사용자에게 "잠시 후 다시 시도" toast

---

## 2. TypeScript 마이그레이션 (o)

Goal: .js 전체를 .ts/.tsx로 전환하고 빌드 에러 0개를 달성한다.

Condition:
- tsconfig.json strict: false (strict: true는 향후 별도 Goal로 진행)
- src/store/*.js → .ts 전환 완료
- src/services/*.js → .ts 전환 완료
- npm run build 시 타입 에러 0개

Clear:
- 파일 이름 전환 완료: stores → services → components → hooks
- strict: true 완전 대응은 Goal 2-b로 별도 추진

---

## 3. 성능 최적화 (O)

Goal: 불필요한 리렌더를 제거하고 초기 로드 체감 속도를 높인다.

Condition:
- fetchAll 호출이 중복 트리거되지 않음 (React Profiler로 확인)
- 위젯 8개 각각 React.memo 또는 selector 최적화 적용
- 초기 번들 크기 현재 대비 -20% 이상 (lazy import 도입)

Clear:
- useDataStore의 fetchAll을 useCallback + 안정적 레퍼런스로 고정
- 각 위젯이 구독하는 스토어 slice를 최소화 (전체 state 구독 → 필드별 selector)
- DashboardLayout 아래 위젯들 React.lazy + Suspense 적용

---

## 4. 상태 관리 분리 (O)

Goal: useAuthStore의 책임을 단일화하고 스토어 간 직접 setState 호출을 없앤다.

Condition:
- useAuthStore는 세션/토큰/로그인 상태만 담당
- 온보딩 상태 → useOnboardingStore로 분리
- 스토어 간 useXxxStore.setState(...) 직접 호출 제거 → 이벤트 또는 action 경유

Clear:
- 현재 useAuthStore에 섞인 obStep, selCats, showOnboarding, perms, persona → useOnboardingStore로 이동
- finishOB, setObStep, toggleCat, setPerms 액션도 함께 이동
- useSettingsStore.setState(...) 직접 호출 3곳 → useSettingsStore.getState().setInterests(...) 패턴으로 교체

---

## 5. 국제화/지역화 완성 (O)

Goal: 한국어/영어 하드코딩 문자열을 모두 i18n 키로 교체한다.

Condition:
- src/ 전체에서 한글 문자열 직접 렌더링 0개 ✓
- en.json / ko.json 키 누락 없음 (빌드 시 missing key 경고 0) ✓
- 언어 전환 시 모든 UI 텍스트 즉시 반영 ✓

Clear:
- grep으로 하드코딩 문자열 스캔
- 대상 집중: App.jsx 로딩 텍스트, useAuthStore.js 에러 메시지, 각 위젯 fallback 텍스트
- i18next-parser 로 누락 키 자동 감지 설정

Done:
- isKo ternary 패턴 전면 교체: SmartWidgetContent, SettingsModal, DiaryPanel, WidgetSettingsModal, OnboardingModal, FirstLoginBriefingModal, ExtensionInstallBanner, WidgetCard, LoginScreen, TopNav
- eventRepeat.ts: getRepeatLocale() → i18n.t() with lng parameter (event_repeat namespace)
- aiService.ts: 브리핑 섹션 타이틀/fallback → bs() helper (briefing_sections namespace); smart widget 섹션 타이틀 동일 처리
- errorHandler.ts, useDataStore.ts, useWidgetStore.ts: 한국어 에러 메시지 → i18n.t()
- EventPanel.tsx: formatReminderMinutes/formatReminderLabel/formatEventTimeLabel/customFrequencyOptions → i18n.t()
- constants/index.ts, useSettingsStore.ts, useQuickLinksStore.ts: 한국어 기본값 → 영어로 교체
- en.json/ko.json: banner, categories, onboarding, widget_settings, settings_modal, diary_panel, smart_widget, briefing_sections, first_login_briefing, event_repeat, auth, errors 네임스페이스 추가/완성
- npx tsc --noEmit: 0 errors

---

## 6. 보안 감사

Goal: OAuth 토큰 노출 위험과 Supabase RLS 누락을 제거한다.

Condition:
- localStorage에 저장되는 민감 데이터 목록화 + 필요 없는 것 제거
- Supabase 모든 테이블에 RLS 활성화 확인 (user_settings 외 테이블 포함)
- providerToken (Google OAuth 토큰) 메모리 전용으로 변경 (localStorage 저장 제거)

Clear:
- src/utils/storage.js에서 저장되는 키 전체 감사
- Supabase Dashboard → Authentication → RLS 정책 확인
- VITE_ 접두사 환경변수가 번들에 노출되는 범위 확인

---

## 7. 아키텍처 문서화

Goal: 신규 팀원이 30분 안에 코드베이스 흐름을 파악할 수 있는 문서를 만든다.

Condition:
- 인증 흐름 다이어그램 (세션 체크 → 온보딩 → 대시보드)
- 스토어 의존 관계 맵 (어떤 스토어가 어떤 스토어를 참조하는지)
- Edge Function 목록 + 각 함수의 역할과 입출력

Clear:
- ARCHITECTURE.md 생성 (Mermaid 다이어그램 포함)
- 스토어 8개 관계도: useAuthStore → useSettingsStore → useDataStore 등 호출 방향 명시
- Supabase Edge Function 이름 / 트리거 조건 / 반환값 표 형식 정리
