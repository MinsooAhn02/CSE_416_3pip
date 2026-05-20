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
