-- ============================================================
-- briefing_snapshots: 시간별 브리핑 스냅샷 (일기 합성 입력)
-- Used by src/store/useBriefingHistoryStore.ts (insert / select / delete by date)
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.briefing_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  captured_at timestamptz not null default now(),
  source text not null default 'auto',
  payload jsonb not null default '{}'::jsonb
);

-- Data API grants (Supabase는 2026-05-30부터 public 테이블에 자동 GRANT를 하지 않음)
grant select, insert, update, delete on public.briefing_snapshots to authenticated;
grant select, insert, update, delete on public.briefing_snapshots to service_role;

create index if not exists briefing_snapshots_user_date
  on public.briefing_snapshots(user_id, date);

alter table public.briefing_snapshots enable row level security;

drop policy if exists "Users can read own snapshots" on public.briefing_snapshots;
create policy "Users can read own snapshots"
  on public.briefing_snapshots for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own snapshots" on public.briefing_snapshots;
create policy "Users can insert own snapshots"
  on public.briefing_snapshots for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own snapshots" on public.briefing_snapshots;
create policy "Users can delete own snapshots"
  on public.briefing_snapshots for delete using (auth.uid() = user_id);
