-- ============================================================
-- Personalization System Migration
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. diaries 테이블 생성 (없으면)
create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  diary_text text,
  memo text,
  answers jsonb default '[]',
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.diaries enable row level security;

drop policy if exists "Users can read own diaries" on public.diaries;
create policy "Users can read own diaries"
  on public.diaries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diaries" on public.diaries;
create policy "Users can insert own diaries"
  on public.diaries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diaries" on public.diaries;
create policy "Users can update own diaries"
  on public.diaries for update
  using (auth.uid() = user_id);

drop trigger if exists diaries_updated on public.diaries;
create trigger diaries_updated
  before update on public.diaries
  for each row execute function public.update_updated_at();

-- 기존 diaries 테이블에 answers 컬럼이 없는 경우에만 추가
alter table public.diaries
  add column if not exists answers jsonb default '[]';


-- 2. keyword_score_log: 키워드 점수 이벤트 로그 (30일 raw 데이터)
create table if not exists public.keyword_score_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  keyword text not null,
  category text not null check (category in ('food','place','content','shopping','lifestyle','mood','interest')),
  source text not null check (source in ('personal','diary')),
  base_weight float not null,
  logged_date date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists keyword_score_log_user_date
  on public.keyword_score_log(user_id, logged_date);

alter table public.keyword_score_log enable row level security;

drop policy if exists "Users can read own score log" on public.keyword_score_log;
create policy "Users can read own score log"
  on public.keyword_score_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own score log" on public.keyword_score_log;
create policy "Users can insert own score log"
  on public.keyword_score_log for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own score log" on public.keyword_score_log;
create policy "Users can delete own score log"
  on public.keyword_score_log for delete
  using (auth.uid() = user_id);


-- 3. user_settings에 개인화 컬럼 추가
-- keyword_interests: 집계된 관심 키워드 (read 최적화용 캐시)
-- [{ keyword, category, score }] 배열, score 내림차순 정렬
alter table public.user_settings
  add column if not exists keyword_interests jsonb default '[]';

-- keyword_interests_updated: 마지막 배치 실행 날짜 (중복 실행 방지)
alter table public.user_settings
  add column if not exists keyword_interests_updated date;
