# MorningBrief.AI — 제안서 기반 전체 구현 계획 (Supabase 아키텍처)

> **Supabase를 중심 백엔드로 사용하는 풀스택 구현 계획입니다.**
> ✅ = 이미 구현됨 | 🔧 = 코드 수정 필요 | 🆕 = 신규 구현 필요 | 🔑 = **네가 준비해야 할 것**

---

## 왜 Supabase인가?

| 이전 계획 (개별 서비스)                   | Supabase 통합                                            |
| ----------------------------------------- | -------------------------------------------------------- |
| Google Identity Services 직접 구현        | `supabase.auth.signInWithOAuth({ provider: 'google' })`  |
| localStorage (설정, Todo, 레이아웃)       | Supabase PostgreSQL → **크로스 디바이스 동기화**         |
| Vercel/Cloudflare 서버리스 프록시         | **Supabase Edge Functions** (Deno)                       |
| `.env`에 VITE_KEY 노출 위험               | Edge Function 환경변수 → **프론트에 키 절대 노출 안 됨** |
| 사용자 데이터 날아감 (브라우저 초기화 시) | DB에 영구 저장                                           |

**무료 티어**: 월 50k MAU, 500MB DB, Edge Function 500k 호출, 무제한 Auth — 학교 프로젝트에 충분

---

## 0. 네가 먼저 준비해야 할 것

### 0-A. Supabase 프로젝트 생성 (모든 것의 시작)

1. [supabase.com](https://supabase.com) 가입 → **New Project** 생성
2. 프로젝트 대시보드에서 확인할 값:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon (public) key**: `eyJhbGci...` (프론트엔드용, 노출 OK)
   - **service_role key**: `eyJhbGci...` (⚠️ Edge Function 전용, 절대 프론트에 노출 금지)
3. 이 두 값만 `.env`에 넣으면 됨:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### 0-B. Supabase에서 Google OAuth 설정

1. Supabase 대시보드 → **Authentication** → **Providers** → **Google** 활성화
2. 필요한 값: Google Cloud Console에서 발급한 **Client ID** + **Client Secret**
3. Google Cloud Console 설정:
   - [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 (또는 기존 프로젝트)
   - API 및 서비스 → 사용자 인증 정보 → **OAuth 2.0 클라이언트 ID** 생성
   - 유형: `웹 애플리케이션`
   - **승인된 리디렉션 URI**: `https://xxxxx.supabase.co/auth/v1/callback` (Supabase 대시보드에서 복사)
   - API 라이브러리 → **Google Calendar API** 활성화
   - API 라이브러리 → **Fitness API** 활성화
4. 발급된 Client ID / Client Secret을 Supabase Google Provider 설정에 입력
5. **Additional Scopes** 추가:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/fitness.activity.read
   https://www.googleapis.com/auth/fitness.sleep.read
   https://www.googleapis.com/auth/fitness.heart_rate.read
   ```

### 0-C. 외부 API 키 발급 → Supabase Edge Function 환경변수로 등록

| #   | 항목                   | 용도      | 어디서 발급                                                                  | 비고                      |
| --- | ---------------------- | --------- | ---------------------------------------------------------------------------- | ------------------------- |
| 1   | **Gemini API Key**     | AI 전체   | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)             | 무료 티어 존재            |
| 2   | **OpenWeatherMap Key** | 날씨      | [openweathermap.org/api](https://openweathermap.org/api)                     | 무료: 1000 calls/day      |
| 3   | **카카오 REST API 키** | 맛집      | [developers.kakao.com](https://developers.kakao.com)                         | 무료, 일 30만 건          |
| 4   | **주식 API Key**       | 주식/환율 | [Alpha Vantage](https://www.alphavantage.co) (무료 25/day) 또는 한국투자증권 | 데모면 Alpha Vantage 충분 |

**등록 방법** (Supabase CLI 또는 대시보드):

```bash
# Supabase CLI 설치 후
supabase secrets set GEMINI_KEY=AIzaSy...
supabase secrets set WEATHER_KEY=xxxxx
supabase secrets set KAKAO_KEY=xxxxx
supabase secrets set STOCK_KEY=xxxxx
```

또는 대시보드 → **Edge Functions** → **Secrets** 에서 직접 입력

→ **이렇게 하면 API 키가 서버(Edge Function)에만 존재하고, 프론트엔드 코드에 절대 노출되지 않음**

### 🔑 전체 체크리스트

- [ ] Supabase 프로젝트 생성 → URL + anon key 확인
- [ ] Google Cloud Console → OAuth Client ID + Secret 발급
- [ ] Supabase Auth → Google Provider 설정 + scope 추가
- [ ] Google Calendar API 활성화
- [ ] Google Fitness API 활성화
- [ ] Gemini API Key 발급 → Supabase secrets 등록
- [ ] OpenWeatherMap Key 발급 → Supabase secrets 등록
- [ ] 카카오 REST API Key 발급 → Supabase secrets 등록
- [ ] 주식 API Key 발급 → Supabase secrets 등록
- [ ] `.env` 파일 생성 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 만 넣으면 됨)

---

## 1. 제안서 2.1 — 사용자 맞춤형 Onboarding & Default Presets

### 현재 상태

- ✅ OnboardingModal 존재 (2단계: 카테고리 선택 → 권한 설정)
- ✅ 8개 카테고리 선택 (`selCats` in useAuthStore)
- ✅ Google Fit / Calendar 권한 토글
- ✅ 위젯 on/off 커스터마이징 (SettingsModal)

### 수정 필요 (🔧)

- **Persona(직업) 선택 단계 추가** — OnboardingModal에 Step 0 이전에 직업 선택 화면 삽입
  - 선택지: 학생, 직장인, 사업가, 취준생
  - `useAuthStore`에 `persona` 상태 추가 + localStorage 저장
- **Role-Based Preset 로직** — 선택된 persona에 따라 `DEFAULT_VIS`와 `DEFAULT_LAYOUTS` 분기
  - 학생: 날씨 ✅, Todo ✅, AI Briefing ✅, 트렌드 ✅ (주식 OFF)
  - 직장인: 주식 ✅, 캘린더 ✅, AI Briefing ✅, 트렌드 ✅ (건강 OFF)
  - 사업가: 트렌드 ✅, 캘린더 ✅, 주식 ✅, AI Briefing ✅ (푸드룰렛 OFF)
- **수정 파일**: `OnboardingModal.jsx`, `useAuthStore.js`, `constants/index.js`

### 신규 필요 (🆕)

- 없음 — 기존 구조 위에 분기 로직만 추가하면 됨

---

## 2. 제안서 2.2 — Smart Keyword Widget (AI 맞춤형 정보 요약)

### 현재 상태

- ✅ SmartWidgetContent 존재 (키워드별 가격비교 + 트렌드 + 뉴스 3섹션)
- ✅ 키워드 추가/삭제 UI (FixedButtons + SettingsModal)
- ✅ Mock 데이터 구조 완성 ("카메라", "노트북")
- ✅ 새로고침 애니메이션

### 수정 필요 (🔧)

- **Persona-Specific Point 3** — SmartWidgetContent의 3섹션 내용을 persona에 따라 다르게 표시
  - 학생: 1.가격/가성비 2.최신트렌드 3.입문뉴스
  - 직장인: 1.업무활용 2.시장점유율 3.전문리뷰
  - → Gemini 프롬프트에 persona 정보 포함하여 요약 방식 분기
- **Contextual Navigation** — 요약 항목 클릭 시 원문 URL로 이동하는 링크 추가
  - SmartWidgetContent 각 항목에 `url` 필드 추가 + 클릭 핸들러
- **수정 파일**: `SmartWidgetContent.jsx`, `aiService.js`, `mock/data.js`

### 🔑 네가 할 것

- **Gemini API Key 발급** → `aiService.js`의 `generateSmartWidgetData(keyword)` 연동
- Gemini 2.5 Flash의 **Google Search grounding** 기능을 사용하면 별도 뉴스 API 없이 실시간 웹 데이터 수집 가능

---

## 3. 제안서 2.3 — 3-Phase Time Briefing

### 현재 상태

- ✅ BriefingWidget 존재 (tone 설정: friendly/professional/humorous)
- ✅ BriefSettingsModal (tone + length 설정)
- ✅ App.jsx에 실시간 시계 (매초 갱신)
- ❌ 시간대별 위젯 내용 변화 없음 (현재 정적)

### 신규 필요 (🆕)

- **시간대 판별 함수** — `utils/helpers.js`에 phase 판별 로직 추가
  ```
  getTimePhase(): "morning" (< 11:00) | "lunch" (11:00~15:00) | "evening" (>= 18:00)
  ```
- **BriefingWidget 3-Phase 분기**:
  - Morning: 동기부여 멘트 + 밤사이 키워드 요약 + 오늘 일정/날씨
  - Lunch: 메뉴 추천 + 오후 일정 리마인드 + 기상 변화 알림
  - Evening: 마무리 멘트 + Todo 미완성 점검 + 내일 일정 예고
- **Gemini 프롬프트 설계** — phase별로 다른 컨텍스트를 조합한 프롬프트 템플릿
  - Morning 프롬프트: `{날씨} + {오늘일정} + {키워드뉴스} → 아침 브리핑`
  - Lunch 프롬프트: `{오후일정} + {기상변화} + {음식추천} → 점심 브리핑`
  - Evening 프롬프트: `{미완료Todo} + {내일일정} + {하루요약} → 저녁 브리핑`
- **수정 파일**: `BriefingWidget.jsx`, `aiService.js`, `utils/helpers.js`
- **신규 파일**: 없음 (기존 파일 수정으로 충분)

### 🔑 네가 할 것

- Gemini API Key (위와 동일)
- 프롬프트 문구는 내가 작성 가능하지만, 최종 tone/style은 네가 확인

---

## 4. 제안서 2.4 — Anti-Filter Bubble: AI Discover Engine

### 현재 상태

- ❌ 완전 미구현

### 신규 필요 (🆕)

- **Discover 로직** — 사용자 키워드 + persona를 분석해서 "설정하지 않았지만 놓치면 안 될" 정보를 추천
  - Gemini에 사용자 프로필 전달 → "이 사용자가 모를 수 있지만 관련된 트렌드 1가지" 요청
  - 8:2 비율: 기존 키워드 80% + 의외성 20%
- **UI: 1줄 추천 배너** — BriefingWidget 하단 또는 대시보드 상단에 작은 텍스트로 표시
  - "💡 **놓치면 안 될 소식**: [AI가 추천하는 1줄 요약]"
  - 클릭 시 상세 정보 or 원문 링크
- **수정 파일**: `BriefingWidget.jsx` 또는 `App.jsx`, `aiService.js`
- **신규 파일**: `DiscoverBanner.jsx` (선택 — 별도 컴포넌트로 분리할 경우)

### 🔑 네가 할 것

- Gemini API Key (위와 동일, grounding 활용)

---

## 5. 제안서 3.1 — System Workflow (Supabase 아키텍처)

### 전체 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                       │
│  - supabase-js 클라이언트                                     │
│  - supabase.auth.signInWithOAuth({ provider: 'google' })     │
│  - supabase.from('user_settings').select() / .upsert()       │
│  - supabase.functions.invoke('weather') → Edge Function 호출  │
└──────────────┬──────────────────────────────────────┬────────┘
               │ Auth (Google OAuth)                  │ Edge Functions
               ▼                                      ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│  Supabase Auth        │    │  Supabase Edge Functions (Deno)  │
│  - Google Provider    │    │  - /weather  → OpenWeatherMap    │
│  - access_token 관리  │    │  - /gemini   → Gemini API        │
│  - Calendar scope     │    │  - /kakao    → 카카오 로컬 API   │
│  - Fitness scope      │    │  - /stocks   → Alpha Vantage     │
└──────────┬───────────┘    │  - /calendar → Google Calendar   │
           │                 │  - /fitness  → Google Fit         │
           ▼                 │  (API 키는 서버 환경변수에만 존재) │
┌──────────────────────┐    └──────────────────────────────────┘
│  Supabase PostgreSQL  │
│  - user_settings      │  (persona, categories, theme, clock 등)
│  - user_todos         │  (할 일 목록)
│  - widget_layouts     │  (위젯 배치)
│  - smart_keywords     │  (스마트 위젯 키워드)
│  - briefing_cache     │  (캐시: AI 응답, 날씨, 주식 등)
│  Row Level Security   │  (각 유저가 자기 데이터만 접근)
└──────────────────────┘
```

### 5-A. 인증: Supabase Auth + Google OAuth

- ✅ `useAuthStore` 로그인/로그아웃 로직 존재
- 🔧 **Supabase Auth로 교체** (현재보다 훨씬 간단)

  ```js
  // 로그인 (한 줄)
  await supabase.auth.signInWithOAuth({
  	provider: "google",
  	options: {
  		scopes:
  			"https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/fitness.activity.read",
  		redirectTo: window.location.origin,
  	},
  });

  // 로그아웃
  await supabase.auth.signOut();

  // 세션 확인
  const {
  	data: { session },
  } = await supabase.auth.getSession();
  // session.provider_token → Google Access Token (Calendar/Fit API 호출용)
  ```

- **Google Identity Services 라이브러리 필요 없음** — Supabase가 전부 처리
- **수정 파일**: `useAuthStore.js`, `LoginScreen.jsx`
- **삭제 가능**: `googleService.js`의 OAuth 관련 코드 → Supabase로 대체
- **신규 파일**: `src/lib/supabase.js` (Supabase 클라이언트 초기화)

### 5-B. DB: localStorage → Supabase PostgreSQL

현재 모든 사용자 데이터가 localStorage에 저장되어 있음 → DB로 이전

**테이블 설계:**

```sql
-- 1. 사용자 설정
create table user_settings (
  id uuid references auth.users primary key,
  persona text,           -- 'student' | 'worker' | 'business' | 'jobseeker'
  categories text[],      -- ['tech', 'finance', ...]
  theme text default 'dark',
  clock_style text default 'digital',
  bg_image text,
  briefing_tone text default 'friendly',
  briefing_length text default 'medium',
  voice_on boolean default false,
  widget_visibility jsonb,  -- { health: true, calendar: true, ... }
  updated_at timestamptz default now()
);

-- 2. 위젯 레이아웃
create table widget_layouts (
  id uuid references auth.users primary key,
  layouts jsonb,          -- { lg: [...], md: [...], sm: [...], xs: [...] }
  updated_at timestamptz default now()
);

-- 3. 할 일
create table todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  text text not null,
  completed boolean default false,
  created_at timestamptz default now()
);

-- 4. 스마트 키워드
create table smart_keywords (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  keyword text not null,
  created_at timestamptz default now()
);

-- 5. API 응답 캐시 (Graceful Degradation용)
create table api_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  cache_key text not null,           -- 'weather', 'stocks', 'briefing_morning', ...
  data jsonb not null,
  fetched_at timestamptz default now(),
  unique(user_id, cache_key)
);

-- Row Level Security (각 유저가 자기 데이터만 접근)
alter table user_settings enable row level security;
alter table widget_layouts enable row level security;
alter table todos enable row level security;
alter table smart_keywords enable row level security;
alter table api_cache enable row level security;

create policy "Users can CRUD own data" on user_settings
  for all using (auth.uid() = id);
create policy "Users can CRUD own data" on widget_layouts
  for all using (auth.uid() = id);
create policy "Users can CRUD own data" on todos
  for all using (auth.uid() = user_id);
create policy "Users can CRUD own data" on smart_keywords
  for all using (auth.uid() = user_id);
create policy "Users can CRUD own data" on api_cache
  for all using (auth.uid() = user_id);
```

→ Supabase 대시보드 **SQL Editor**에 위 쿼리 붙여넣기만 하면 테이블 생성 완료

- **수정 파일**: 모든 store 파일 (`useAuthStore.js`, `useSettingsStore.js`, `useWidgetStore.js`, `useTodoStore.js`)
- **변경 내용**: `localStorage.getItem/setItem` → `supabase.from('table').select/upsert`

### 5-C. Edge Functions: API 프록시 (키 보호)

모든 외부 API 호출을 Edge Function으로 감싸서 **API 키를 서버에만 보관**

**Edge Function 목록:**

| Function 이름  | 호출하는 외부 API              | 프론트에서 호출 방법                                                       |
| -------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `weather`      | OpenWeatherMap                 | `supabase.functions.invoke('weather', { body: { lat, lon } })`             |
| `gemini`       | Gemini 2.5 Flash (+ grounding) | `supabase.functions.invoke('gemini', { body: { prompt, mode } })`          |
| `kakao-places` | 카카오 로컬 API                | `supabase.functions.invoke('kakao-places', { body: { lat, lon, query } })` |
| `stocks`       | Alpha Vantage / 한투           | `supabase.functions.invoke('stocks', { body: { symbols } })`               |
| `calendar`     | Google Calendar API            | `supabase.functions.invoke('calendar', { body: { token } })`               |
| `fitness`      | Google Fit REST API            | `supabase.functions.invoke('fitness', { body: { token } })`                |

**Edge Function 예시 (weather):**

```ts
// supabase/functions/weather/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
	const { lat, lon } = await req.json();
	const key = Deno.env.get("WEATHER_KEY"); // 서버에만 존재
	const res = await fetch(
		`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=kr`,
	);
	const data = await res.json();
	return new Response(JSON.stringify(data));
});
```

- **신규 디렉토리**: `supabase/functions/` (프로젝트 루트에)
- **신규 파일 6개**: 각 Edge Function
- **수정 파일**: `useDataStore.js` (API 호출을 `supabase.functions.invoke()`로 교체)

### 5-D. Gemini 연동 (via Edge Function)

- 🔧 `aiService.js`의 직접 API 호출 → `supabase.functions.invoke('gemini')` 로 교체
- Edge Function 내에서:
  - **grounding** 설정: `tools: [{ googleSearch: {} }]` → 실시간 웹검색
  - `buildContextPrompt()` 로직은 프론트에서 구성 후 Edge Function에 전달
  - 또는 Edge Function 내에서 프롬프트 조립 (더 안전)
- **수정 파일**: `aiService.js`

### 5-E. Google Calendar + Fit (via Edge Function)

- Google OAuth 로그인 시 Supabase가 `provider_token` (Google access token) 제공
- 이 토큰을 Edge Function에 전달 → Calendar/Fit API 호출
- **프론트에서**:

  ```js
  const {
  	data: { session },
  } = await supabase.auth.getSession();
  const googleToken = session.provider_token;

  // Calendar
  await supabase.functions.invoke("calendar", {
  	body: { token: googleToken },
  });
  ```

- **수정 파일**: `useDataStore.js`

### 🔑 네가 할 것 (5번 섹션)

| 항목                                   | 필수?   | 설명                          |
| -------------------------------------- | ------- | ----------------------------- |
| Supabase 프로젝트 생성                 | ✅ 필수 | 모든 것의 기반                |
| Google OAuth Client ID + Secret        | ✅ 필수 | Supabase Auth Provider에 입력 |
| Google Calendar API 활성화             | ✅ 필수 | 일정 조회                     |
| Google Fitness API 활성화              | ✅ 필수 | 건강 데이터                   |
| Gemini API Key → Supabase secrets      | ✅ 필수 | AI 전체                       |
| OpenWeatherMap Key → Supabase secrets  | ✅ 필수 | 날씨                          |
| 카카오 REST API Key → Supabase secrets | ✅ 필수 | 맛집                          |
| 주식 API Key → Supabase secrets        | ✅ 필수 | 주식/환율                     |
| SQL Editor에서 테이블 생성             | ✅ 필수 | 위에 있는 SQL 복붙            |

---

## 6. 제안서 3.2 — AI Scoring Algorithm

### 현재 상태

- ❌ 완전 미구현

### 구현 방안

- 🆕 **점수 산출 함수**: `utils/scoring.js` 신규 생성

  ```
  S_i = (R_i × K_match) · w_persona + (U_i × w_time) + S_e
  ```

  - `R_i`: Gemini 응답의 relevance score (프롬프트에서 0~1 점수 요청)
  - `K_match`: 사용자 키워드 일치 시 ×1.5 부스트
  - `w_persona`: persona별 카테고리 가중치 테이블
  - `U_i`: 기상특보/임박일정 → urgency 플래그
  - `w_time`: `getTimePhase()` 기반 가중치 (아침: 뉴스↑, 점심: 편의↑, 저녁: 정리↑)
  - `S_e`: Discover 엔진의 serendipity 점수

- **적용 위치**: 위젯 정렬 순서 또는 브리핑 항목 우선순위에 활용
- **수정 파일**: `constants/index.js` (가중치 테이블), `App.jsx` (정렬 적용)
- **신규 파일**: `utils/scoring.js`

### 🔑 네가 할 것

- 없음 — 순수 프론트엔드 로직, 내가 구현 가능

---

## 7. 제안서 3.3 — Security & Privacy (Supabase로 강화)

### 구현 방안

- ✅ **API 키 보호**: Edge Function 환경변수에 저장 → 프론트엔드에 절대 노출 안 됨 (서버리스 프록시 별도 구축 불필요)
- ✅ **Row Level Security**: Supabase RLS로 각 유저가 자기 데이터만 접근 가능
- 🔧 **Zero-Knowledge**: Calendar/Fit 데이터는 DB에 저장하지 않고 Edge Function → 프론트 메모리에만 보관
  - `api_cache` 테이블은 날씨/주식/트렌드 같은 비개인 데이터만 캐시
  - 개인 건강 데이터, 일정 텍스트는 캐시하지 않음
- 🔧 **.env 최소화**: `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`만 프론트에 노출 (이 값은 공개 가능하도록 설계된 키)
- **수정 파일**: `.gitignore` (`.env` 포함 확인)

### 🔑 네가 할 것

- `service_role` 키는 Edge Function에서만 사용, **절대 프론트에 넣지 않기**
- `.env` 파일 Git에 커밋하지 않기

---

## 8. 제안서 4.1 — UI/UX Robustness (품질 관리)

### 현재 상태

- ✅ Grid 레이아웃에 `minW`, `minH` 존재 (DEFAULT_LAYOUTS)
- ✅ EditModeBanner + FixedButtons 편집 모드 UI
- 🔧 일부 보완 필요

### 수정 필요 (🔧)

- **Grid Constraints 강화** — 일부 위젯 `minW` 값이 너무 작아 깨질 수 있음 → 검증
- **Lock-State Enforcement** — `editMode === false`일 때 `pointer-events: none` 적용
  - 현재 DragHandle만 숨김 → 위젯 자체의 드래그 이벤트도 차단해야 함
  - `index.css`에 `.react-grid-item:not(.react-grid-item--editing) { pointer-events: ... }` 추가
- **Ghost Space 방지** — 드래그 완료 후 placeholder DOM 잔류 확인
  - react-grid-layout의 `onDragStop`에서 layout compaction 확인
- **수정 파일**: `index.css`, `App.jsx`

### 🔑 네가 할 것

- 없음 — 순수 CSS/React 수정

---

## 9. 제안서 4.2 — API Failure Handling (Graceful Degradation)

### 현재 상태

- ❌ 에러 핸들링 없음 (API 실패 시 빈 화면)

### 신규 필요 (🆕)

- **캐시 레이어** — Supabase `api_cache` 테이블 활용
  - Edge Function에서 API 성공 시 `api_cache` 테이블에 자동 저장
  - 다음 호출 실패 시 → `api_cache`에서 마지막 데이터 조회 + "마지막 업데이트: 10분 전" 표시
  - localStorage 캐시와 달리 **크로스 디바이스에서도 캐시 공유**
- **에러 UI** — 위젯별 "데이터를 불러올 수 없습니다. 다시 시도" 메시지
- **구현 위치**: Edge Function 내 try-catch + `useDataStore.js`에서 fallback 조회
- **수정 파일**: Edge Functions, `useDataStore.js`, 각 위젯 컴포넌트 (에러 상태 표시)

---

## 10. Google Fit 건강 데이터 연동

### 현재 상태

- ✅ HealthWidget UI 완성 (Mock 데이터: 걸음수, 수면, 심박수, 칼로리, 수분)
- ⚠️ Google Fit REST API는 공식적으로 Health Connect 전환 권장 중이나, **웹 REST API는 2026년 3월 현재 아직 동작함**

### 구현 방안 (전부 구현)

- 🔧 **1차: Google Fit REST API 연동** (동작하는 동안 사용)
  - OAuth scope 추가: `https://www.googleapis.com/auth/fitness.activity.read`, `fitness.sleep.read`, `fitness.heart_rate.read`
  - `googleService.js`에 `fetchGoogleFitData()` 실구현
  - REST endpoint: `POST https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`
  - 데이터 종류: 걸음수(`com.google.step_count.delta`), 수면(`com.google.sleep.segment`), 심박수(`com.google.heart_rate.bpm`), 칼로리(`com.google.calories.expended`)
- 🆕 **2차: 수동 입력 Fallback** (API 폐지 대비)
  - HealthWidget에 "직접 기록" 버튼 추가
  - 걸음수/수면/수분 수동 입력 모달
  - `useTodoStore` 패턴으로 `useHealthStore` 분리 가능
- **수정 파일**: `useDataStore.js`, `HealthWidget.jsx`
- **수정 파일 (fallback)**: `HealthWidget.jsx` (수동 입력 UI)
- **신규 파일**: `supabase/functions/fitness/index.ts` (Edge Function — Google Fit 프록시)

### 🔑 네가 할 것

- Google Cloud Console → **Fitness API 활성화**
- Supabase Auth Google Provider에서 fitness scope 이미 추가됨 (0-B에서 설정)

---

## 11. 주식/환율 실시간 데이터 연동

### 현재 상태

- ✅ StocksWidget UI 완성 (Mock: KOSPI, NASDAQ, S&P500, USD/KRW)
- ❌ 실 API 연동 없음

### 구현 방안

- 🔧 **옵션 A: 한국투자증권 Open API** (국내 주식 + 해외 주식 + 환율 전부 커버)
  - 가입: [apiportal.koreainvestment.com](https://apiportal.koreainvestment.com)
  - 모의투자 계좌 개설 → APP Key / APP Secret 발급
  - 국내 시세: `/uapi/domestic-stock/v1/quotations/inquire-price`
  - 해외 시세: `/uapi/overseas-price/v1/quotations/price`
  - 환율: `/uapi/overseas-stock/v1/trading/inquire-present-balance`
  - ⚠️ **인증 토큰 필요** → 서버리스 프록시 경유 권장 (토큰 유효시간 24h)
- 🔧 **옵션 B: Alpha Vantage** (간단, 무료 25 calls/day)
  - `GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=005930.KS&apikey=xxx`
  - KOSPI: `^KS11`, NASDAQ: `^IXIC`, S&P500: `^GSPC`, USD/KRW: `USDKRW=X`
  - 무료 티어로 데모에 충분
- 🔧 **옵션 C: 혼합** — 환율은 [exchangerate-api.com](https://exchangerate-api.com) (무료 1500/month) + 주식은 Alpha Vantage
- **수정 파일**: `useDataStore.js`, `StocksWidget.jsx` (실데이터 필드 매핑)
- **신규 파일**: `supabase/functions/stocks/index.ts` (Edge Function — 주식 프록시)

### 🔑 네가 할 것

- **한국투자증권 or Alpha Vantage** 중 하나 선택 후 API Key 발급
- `supabase secrets set STOCK_KEY=xxx` 로 등록

---

## 12. 맛집 — 카카오 로컬 API 연동

### 현재 상태

- ✅ RestaurantsWidget UI 완성 (Mock: 5개 맛집, 평점/거리/카테고리/가격)
- ❌ 실 API 연동 없음

### 구현 방안

- 🔧 **카카오 로컬 API (키워드 검색)** 사용
  - **발급**: [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 생성 → REST API 키 복사
  - **엔드포인트**: `GET https://dapi.kakao.com/v2/local/search/keyword.json`
  - **헤더**: `Authorization: KakaoAK {REST_API_KEY}`
  - **파라미터**:
    - `query`: "맛집" 또는 "점심 맛집"
    - `x`, `y`: 현재 위치 경도/위도 (navigator.geolocation)
    - `radius`: 1000 (1km 반경)
    - `category_group_code`: `FD6` (음식점)
    - `sort`: `distance` (거리순)
  - **응답 매핑**:
    - `place_name` → 가게 이름
    - `category_name` → 카테고리 ("음식점 > 한식 > 국밥")
    - `distance` → 거리 (m)
    - `place_url` → 카카오맵 링크 (클릭 시 이동)
    - `phone` → 전화번호
  - ⚠️ 카카오 API는 **평점(rating)을 제공하지 않음** → 대안:
    - (A) UI에서 평점 제거, 거리+카테고리+전화번호로 대체
    - (B) 카카오맵 링크 제공하여 사용자가 직접 확인
    - (C) 네이버 Place API 병행 (평점 있음, 하지만 별도 key 필요)
- 🆕 **위치 기반 자동 갱신**: 날씨 API의 geolocation과 공유하여 좌표 1회만 요청
- **수정 파일**: `useDataStore.js`, `RestaurantsWidget.jsx`
- **신규 파일**: `supabase/functions/kakao-places/index.ts` (Edge Function — 카카오 프록시)

### 🔑 네가 할 것

- [developers.kakao.com](https://developers.kakao.com) 가입 → 앱 생성 → **REST API 키** 복사
- `supabase secrets set KAKAO_KEY=xxx` 로 등록
- 카카오 앱 설정 → **플랫폼** → 웹 → Supabase 프로젝트 URL 등록

---

## 구현 순서 (추천 로드맵)

### Phase 0 — Supabase 인프라 (네가 준비)

```
0. Supabase 프로젝트 생성 → URL + anon key 확보
1. Google Cloud Console → OAuth Client ID + Secret 발급
2. Supabase Auth → Google Provider 설정 + scope 추가
3. Supabase SQL Editor → 테이블 생성 (위 SQL 복붙)
4. 외부 API 키 발급 → Supabase secrets에 등록
5. .env 파일 생성 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

### Phase 1 — 핵심 연동 (내가 구현)

```
6. npm install @supabase/supabase-js
7. src/lib/supabase.js 초기화 파일 생성
8. Supabase Auth 로그인 연동 (LoginScreen → 실제 Google 로그인)
9. Zustand store → Supabase DB 마이그레이션 (설정, Todo, 레이아웃)
10. Edge Function 6개 생성 (weather, gemini, kakao, stocks, calendar, fitness)
```

### Phase 2 — Persona 시스템 + 3-Phase Briefing

```
11. Onboarding에 Persona(직업) 선택 추가
12. Role-Based Preset 로직
13. Gemini Edge Function 연동 (aiService.js)
14. 3-Phase Time Briefing 구현
15. Context Orchestration (프롬프트 빌더)
```

### Phase 3 — Smart Widget + Discover

```
16. SmartWidgetContent → Gemini 실연동
17. Persona-Specific Point 3 분기
18. Anti-Filter Bubble Discover 배너
19. AI Scoring Algorithm
```

### Phase 4 — 실데이터 연동 (주식 + 맛집 + 건강)

```
20. 주식/환율 → stocks Edge Function 연동
21. 카카오 맛집 → kakao-places Edge Function 연동
22. Google Fit → fitness Edge Function 연동
23. Health 수동 입력 Fallback UI
```

### Phase 5 — 품질 + 안정성

```
24. API Failure Handling (Supabase 캐시 + fallback)
25. UI/UX Robustness (Lock-state, Ghost Space)
26. 전체 통합 테스트
```

---

## 파일별 수정 범위 요약

| 파일                                            | 수정 유형    | 주요 변경                                                                 |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| `src/lib/supabase.js`                           | 🆕 생성      | Supabase 클라이언트 초기화                                                |
| `src/services/aiService.js`                     | 🔧 대폭 수정 | `supabase.functions.invoke('gemini')` + 프롬프트 빌더                     |
| `src/services/googleService.js`                 | 🔧 간소화    | OAuth 코드 제거 (Supabase Auth로 대체), Calendar/Fit은 Edge Function 경유 |
| `src/store/useAuthStore.js`                     | 🔧 수정      | Supabase Auth 연동, `persona` 상태 추가                                   |
| `src/store/useSettingsStore.js`                 | 🔧 수정      | localStorage → Supabase DB                                                |
| `src/store/useWidgetStore.js`                   | 🔧 수정      | localStorage → Supabase DB                                                |
| `src/store/useTodoStore.js`                     | 🔧 수정      | localStorage → Supabase DB                                                |
| `src/store/useDataStore.js`                     | 🔧 대폭 수정 | Edge Function 호출, 캐시 로직, 에러 핸들링                                |
| `src/components/modals/OnboardingModal.jsx`     | 🔧 수정      | Persona 선택 Step 추가                                                    |
| `src/components/widgets/BriefingWidget.jsx`     | 🔧 수정      | 3-Phase 분기, Discover 배너                                               |
| `src/components/widgets/SmartWidgetContent.jsx` | 🔧 수정      | Gemini 연동, Persona 분기, 원문 링크                                      |
| `src/components/widgets/HealthWidget.jsx`       | 🔧 수정      | Google Fit 실연동 + 수동 입력 Fallback                                    |
| `src/components/widgets/RestaurantsWidget.jsx`  | 🔧 수정      | 카카오 맛집 실데이터 표시                                                 |
| `src/components/widgets/StocksWidget.jsx`       | 🔧 수정      | 실시간 시세 표시                                                          |
| `src/constants/index.js`                        | 🔧 수정      | Persona별 프리셋, 가중치 테이블                                           |
| `src/utils/helpers.js`                          | 🔧 수정      | `getTimePhase()` 추가                                                     |
| `src/components/layout/LoginScreen.jsx`         | 🔧 수정      | Supabase Auth 로그인으로 교체                                             |
| `src/index.css`                                 | 🔧 수정      | Lock-state CSS                                                            |
| `src/App.jsx`                                   | 🔧 수정      | Supabase 세션 관리, Persona 기반 레이아웃                                 |
| `.env`                                          | 🆕 생성      | Supabase URL + anon key만                                                 |
| `src/utils/scoring.js`                          | 🆕 생성      | AI Scoring Algorithm                                                      |
| `src/components/widgets/DiscoverBanner.jsx`     | 🆕 생성      | 1줄 추천 UI                                                               |
| `supabase/functions/weather/index.ts`           | 🆕 생성      | 날씨 API 프록시                                                           |
| `supabase/functions/gemini/index.ts`            | 🆕 생성      | Gemini API 프록시 + grounding                                             |
| `supabase/functions/kakao-places/index.ts`      | 🆕 생성      | 카카오 로컬 맛집 프록시                                                   |
| `supabase/functions/stocks/index.ts`            | 🆕 생성      | 주식/환율 API 프록시                                                      |
| `supabase/functions/calendar/index.ts`          | 🆕 생성      | Google Calendar 프록시                                                    |
| `supabase/functions/fitness/index.ts`           | 🆕 생성      | Google Fit 프록시                                                         |

---

## `.env` 파일 (프론트엔드 — 훨씬 간단해짐)

```env
# Supabase (이 두 값은 공개 가능하도록 설계된 키)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**나머지 API 키는 전부 Supabase Edge Function 환경변수(secrets)에 저장:**

```
GEMINI_KEY=AIzaSy...
WEATHER_KEY=xxxxx
KAKAO_KEY=xxxxx
STOCK_KEY=xxxxx
```

→ 프론트엔드 `.env`에는 API 키가 **단 하나도 없음** = 보안 완벽

⚠️ `.env` 파일은 `.gitignore`에 반드시 포함!
