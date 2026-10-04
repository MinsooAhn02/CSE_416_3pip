-- ============================================================
-- user_qa: 개인화용 Q&A 응답 테이블 (diaries.answers와 분리)
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.user_qa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  question text not null,
  answer text not null,
  asked_date date not null default current_date,
  created_at timestamptz default now()
);

-- Data API grants (Supabase는 2026-05-30부터 public 테이블에 자동 GRANT를 하지 않음)
grant select, insert, update, delete on public.user_qa to authenticated;
grant select, insert, update, delete on public.user_qa to service_role;

create index if not exists user_qa_user_date
  on public.user_qa(user_id, asked_date);

alter table public.user_qa enable row level security;

drop policy if exists "Users can read own qa" on public.user_qa;
create policy "Users can read own qa"
  on public.user_qa for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own qa" on public.user_qa;
create policy "Users can insert own qa"
  on public.user_qa for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own qa" on public.user_qa;
create policy "Users can delete own qa"
  on public.user_qa for delete using (auth.uid() = user_id);
