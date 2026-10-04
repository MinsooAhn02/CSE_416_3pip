-- ============================================================
-- anon 권한 회수 (BACKLOG A9)
-- 앱은 로그인한 사용자(authenticated)로만 테이블에 접근. RLS 정책이 auth.uid() 기준이라
-- anon은 원래 행을 못 보지만, 권한 자체를 없애 정책 실수가 곧바로 노출로 이어지지 않게 함.
-- Run in Supabase Dashboard > SQL Editor (after the other migrations)
-- ============================================================

revoke all on
  public.user_settings, public.widget_layouts, public.todos, public.smart_keywords,
  public.diaries, public.api_cache, public.briefing_snapshots, public.user_qa,
  public.keyword_score_log
from anon;
