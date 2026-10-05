-- useSettingsStore가 저장·복원하던 설정인데 칸이 없어서 서버 동기화가 실패하던 문제
-- ("이 기기에는 저장됐지만 계정 동기화에 실패했습니다"). 민감 정보 아님 — 화면·표시 설정.
alter table public.user_settings
  add column if not exists is_12hour boolean,
  add column if not exists temp_unit text,
  add column if not exists stock_symbols jsonb,
  add column if not exists pin_lock_mode text,
  add column if not exists priority_order jsonb,
  add column if not exists show_first_login_briefing boolean,
  add column if not exists last_briefing_shown date;
