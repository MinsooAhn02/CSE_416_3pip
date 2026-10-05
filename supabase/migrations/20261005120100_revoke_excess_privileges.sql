-- 로그인 사용자(authenticated)에게 필요 없는 권한 회수.
-- TRUNCATE는 RLS를 우회해 표 전체를 비울 수 있고, TRIGGER·REFERENCES는 앱이 쓰지 않음.
-- 앱은 select/insert/update/delete만 사용 (RLS로 본인 행만).
revoke truncate, trigger, references on
  public.api_cache, public.briefing_snapshots, public.diaries, public.keyword_score_log,
  public.smart_keywords, public.user_qa, public.user_settings, public.widget_layouts
from authenticated;
