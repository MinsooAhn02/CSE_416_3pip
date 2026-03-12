-- ============================================================
-- Morning Brief — Supabase SQL Schema
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

-- 1. user_settings: 사용자별 설정 (theme, persona, clock 등)
create table if not exists public.user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  persona text default 'default',
  theme text default 'dark',
  tone text default 'casual',
  briefing_length text default 'medium',
  voice_on boolean default false,
  clock_style text default 'digital',
  bg_image text,
  vis jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = id);

drop policy if exists "Users can upsert own settings" on public.user_settings;
create policy "Users can upsert own settings"
  on public.user_settings for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = id);


-- 2. widget_layouts: 위젯 그리드 레이아웃
create table if not exists public.widget_layouts (
  id uuid primary key references auth.users(id) on delete cascade,
  layouts jsonb default '{}',
  layout_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.widget_layouts enable row level security;

drop policy if exists "Users can read own layouts" on public.widget_layouts;
create policy "Users can read own layouts"
  on public.widget_layouts for select
  using (auth.uid() = id);

drop policy if exists "Users can upsert own layouts" on public.widget_layouts;
create policy "Users can upsert own layouts"
  on public.widget_layouts for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own layouts" on public.widget_layouts;
create policy "Users can update own layouts"
  on public.widget_layouts for update
  using (auth.uid() = id);


-- 3. todos: 할일 목록
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  done boolean default false,
  completed boolean default false,
  is_fixed boolean default false,
  is_recurring boolean generated always as (is_fixed) stored,
  created_at timestamptz default now()
);

-- 기존 스키마와의 호환을 위한 확장
alter table public.todos
  add column if not exists completed boolean default false;

alter table public.todos
  add column if not exists is_fixed boolean default false;

-- 기존 done 값이 있으면 completed로 동기화
update public.todos
set completed = coalesce(completed, done, false)
where completed is distinct from coalesce(done, false);

alter table public.todos enable row level security;

drop policy if exists "Users can read own todos" on public.todos;
create policy "Users can read own todos"
  on public.todos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own todos" on public.todos;
create policy "Users can insert own todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own todos" on public.todos;
create policy "Users can update own todos"
  on public.todos for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own todos" on public.todos;
create policy "Users can delete own todos"
  on public.todos for delete
  using (auth.uid() = user_id);


-- 4. smart_keywords: AI 스마트 위젯 키워드
create table if not exists public.smart_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  keyword text not null,
  created_at timestamptz default now(),
  unique(user_id, keyword)
);

alter table public.smart_keywords enable row level security;

drop policy if exists "Users can read own keywords" on public.smart_keywords;
create policy "Users can read own keywords"
  on public.smart_keywords for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own keywords" on public.smart_keywords;
create policy "Users can insert own keywords"
  on public.smart_keywords for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own keywords" on public.smart_keywords;
create policy "Users can delete own keywords"
  on public.smart_keywords for delete
  using (auth.uid() = user_id);


-- 5. api_cache: Edge Function 응답 캐시 (선택)
create table if not exists public.api_cache (
  id text primary key,           -- e.g. 'weather_37.57_126.98'
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  fetched_at timestamptz default now()
);

alter table public.api_cache enable row level security;

drop policy if exists "Users can read own cache" on public.api_cache;
create policy "Users can read own cache"
  on public.api_cache for select
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own cache" on public.api_cache;
create policy "Users can upsert own cache"
  on public.api_cache for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own cache" on public.api_cache;
create policy "Users can update own cache"
  on public.api_cache for update
  using (auth.uid() = user_id);


-- ============================================================
-- updated_at 자동 갱신 trigger
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_settings_updated on public.user_settings;
create trigger user_settings_updated
  before update on public.user_settings
  for each row execute function public.update_updated_at();

drop trigger if exists widget_layouts_updated on public.widget_layouts;
create trigger widget_layouts_updated
  before update on public.widget_layouts
  for each row execute function public.update_updated_at();
