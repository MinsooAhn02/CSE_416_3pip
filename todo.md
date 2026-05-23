## 🔧 To Fix

100. (마무리 단계) i18n En/Ko 설정 적용. dashboard, user settings, briefing에서도 설정한 언어로 display.
     ✅ 완료 (2026-05-20) — 아래 5개 버그 수정됨:
     1. ✅ 언어 전환 시 뉴스/트렌드 즉시 초기화 (`clearFeedForLanguageSwitch` 추가, `force=true` 재호출)
     2. ✅ 스마트 위젯 영어 모드에서 한국어 기사 노출 차단 (`filterSmartResults` fallback 제거)
     3. ✅ 스마트 위젯 섹션 타이틀 "Personalized Search" → 한국어 모드에서 "맞춤 검색"
     4. ✅ `resolveSmartLang()` default 오류 수정 ("ko" → "en")
     5. ✅ SettingsModal 일기 섹션 헤더 번역 ("Generation language" → "생성 언어")

smart widgets (난이도: 상):

- Korean language settings에서 관련 없는 기사 노출 문제. 원인 분석 필요.
  (예: "Super Mario Galaxy Movie" 검색 → 조선일보 법조 기사 노출)
  ✅ 완료 (2026-05-20) — `filterSmartResults` 영어 fallback 제거로 해결

### Smart Widget 작업 핵심

- 키워드별 카테고리 분류를 추가하고, 카테고리별로 다른 섹션을 보여주도록 변경.
- 사용자가 위젯 안에서 키워드를 수정하고, 이모지 드롭다운으로 카테고리를 직접 바꿀 수 있게 함.
- `Shopping`, `Fashion & streetwear`, `Chains & Brands`, `Food & restaurants`, `Person`, `General Search` 등 카테고리 세분화.
- 상단 `Personalized Search` / `맞춤 검색` 요약 섹션은 제거하고 카드형 결과 중심으로 변경.
- 블로그/영상/뉴스 섹션은 도메인 필터를 적용해 YouTube와 블로그가 섞이지 않도록 조정.
- 모든 스마트 위젯 카드 결과는 제목에 키워드가 있는 결과만 표시하도록 필터링.
- `Latest Updates` / `Latest Coverage`는 latest 검색을 먼저 사용하고, 결과가 없으면 최신 조건을 뺀 뉴스 검색으로 fallback.
- 한국어/영어 결과가 섞이지 않도록 언어별 캐시와 검색/번역 흐름을 분리.

### Smart Widget 해야 할 것

- Smart Widget 한국어 모드에서 `Latest Updates` / `Latest Coverage` 왜 안되는지

---

## 추가 TODO

- 다이어리 피드백 안됨.
- 연동 끄기 안됨 -> 연동 끄기 옵션 제거하고 무조건 연동되게 변경.
- 스마트위젯 키워드가 개인화 컨텍스트에 반영되는지 확인.

---

## 🧪 수동 테스트 필요 항목 (빌드 통과, 런타임 확인 필요)

- [x] 언어 토글 클릭 시 뉴스 위젯이 즉시 로딩 스피너로 전환되는지 (이전 언어 기사 잔류 없이)
- [x] 영어 모드 스마트 위젯 → 영어 기사만 노출, 한국어 기사 미노출
- [x] 한국어 모드 스마트 위젯 → 섹션 타이틀 "맞춤 검색" 표시 확인
- [x] 설정 모달 → 일기 탭 → 한국어 모드에서 "생성 언어" / 영어 모드에서 "Generation language"

---

## 📌 작업 원칙

- plan with opus, work with sonnet (switch model required)
- ask questions if unclear
- After the entire execution, update in @DOCS.md