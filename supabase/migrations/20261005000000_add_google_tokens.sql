-- ============================================================
-- google_tokens: 사용자별 Google OAuth refresh token (암호화) — BACKLOG R2
-- Google access token은 1시간짜리라, 이 refresh token으로 서버(google-refresh Edge Function)에서 갱신.
-- 클라이언트는 이 테이블을 읽지도 쓰지도 못함: 정책 없음 + anon/authenticated 권한 없음.
-- 값은 Edge Function이 AES-GCM(GOOGLE_TOKEN_ENC_KEY)으로 암호화해 저장.
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_enc text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_tokens enable row level security;

revoke all on public.google_tokens from anon, authenticated;
grant select, insert, update, delete on public.google_tokens to service_role;
