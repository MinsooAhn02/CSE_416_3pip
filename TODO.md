# MorningBrief.AI — TODO (백엔드/API/고급 기능)

> 사전 준비가 필요하거나 백엔드가 있어야 하는 작업들을 정리한 목록입니다.

---

## 2단계: API 연동 및 데이터 흐름

### Google OAuth2 로그인

- [ ] Google Cloud Console에서 프로젝트 생성
- [ ] OAuth 2.0 클라이언트 ID 발급 (웹 애플리케이션)
- [ ] `src/services/googleService.js`에 실제 OAuth 플로우 구현
- [ ] access_token 안전 관리 (메모리 저장, refresh token은 httpOnly cookie 등)
- [ ] 현재 `useAuthStore.login()` → 실제 Google Sign-In SDK 연동으로 교체

### Google Calendar API

- [ ] OAuth scope에 `https://www.googleapis.com/auth/calendar.readonly` 추가
- [ ] `src/services/googleService.js` → `fetchCalendarEvents()` 실제 REST 호출 구현
- [ ] 오늘/내일 일정 필터링 로직

### Google Fit / Health Connect API

- [ ] ⚠️ Google Fit Web REST API 폐지 이슈 확인 (2025~ Health Connect 마이그레이션)
- [ ] 대안 조사: Health Connect Web API 또는 서버사이드 프록시
- [ ] 걸음 수, 수면 시간, 심박수 등 활동 데이터 추출 구현

### AI API 연동 (Gemini / OpenAI)

- [ ] ⚠️ **API 키를 프론트에 노출하면 안 됨** → 서버리스 프록시 필요
  - 옵션 A: Vercel Serverless Functions
  - 옵션 B: Cloudflare Workers
  - 옵션 C: Firebase Functions
- [ ] `src/services/aiService.js` → 실제 AI API 호출 구현
- [ ] Contextual Prompting: 시간 + 일정 + 수면 + 날씨 데이터를 조합한 프롬프트 설계
- [ ] Multi-Model 전략: 요약(Gemini), 이미지생성(DALL-E), 분석(GPT-4) 역할 분담

### 실시간 데이터 API

- [ ] 날씨 API (OpenWeatherMap 또는 기상청 API) 연동
- [ ] 주식/환율 API 연동
- [ ] 트렌드 API (Google Trends 또는 뉴스 API) 연동
- [ ] 맛집 API (Google Places API 또는 카카오 로컬 API) 연동

---

## 3단계: AI 기반 신규 기능

### Smart Prioritization (지능형 우선순위)

- [ ] Calendar 데이터 분석 → AI에게 우선순위 판단 요청
- [ ] "오늘은 9시 미팅이 제일 중요하니 준비물을 챙기세요" 등 동적 알림
- [ ] 전제: Google Calendar API 연동 완료 후

### Semantic Search & Q&A (대화형 질의)

- [ ] 위젯 데이터(뉴스, 일정, 할 일)를 컨텍스트로 LLM에 전달
- [ ] "오늘 내가 언제 제일 한가해?" 같은 자연어 질문 처리
- [ ] 이전 대화 기억: 벡터 DB (Pinecone) 또는 로컬 히스토리 저장 필요
- [ ] 전제: AI API 프록시 구축 완료 후

### Predictive Health Suggestion (예측 건강 조언)

- [ ] 수면/활동 데이터 누적 기록 시스템 구축 (최소 1~2주 데이터 필요)
- [ ] 수면 + 일정 비교 분석 → "오늘 점심엔 20분 낮잠 추천" 등
- [ ] 전제: Google Fit/Health Connect 연동 + 데이터 누적 후

### Auto-Layout Optimization (자동 레이아웃 최적화)

- [ ] 사용 패턴 추적 (클릭 빈도, 체류 시간) 로직 추가
- [ ] AI 분석 → 자주 보는 위젯 크게, 안 보는 위젯 숨기기/축소
- [ ] react-grid-layout의 레이아웃을 프로그래밍적으로 조작

---

## 4단계: 서비스 고도화

### TypeScript 전환

- [ ] `.jsx` → `.tsx` 점진적 마이그레이션
- [ ] API 응답 타입 정의 (Google, AI)
- [ ] Vite에서 TS는 zero-config이므로 파일 단위로 진행 가능

### Chrome Extension 고도화

- [ ] CSP (Content Security Policy) 제약 대응 — 인라인 스크립트 불가
- [ ] 외부 API 호출 방식 조정 (background script 활용)
- [ ] Chrome Web Store 배포 준비

### 성능 최적화 (위젯 증가 시)

- [ ] React.memo로 위젯 컴포넌트 래핑 (이미 일부 적용)
- [ ] useMemo/useCallback 추가 최적화
- [ ] 대량 위젯 시 가상화(virtualization) 검토
