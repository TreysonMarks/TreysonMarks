-- CalTrack schema for Supabase (Postgres).
-- Run this in the Supabase SQL editor once, after creating your project.
-- Row Level Security ensures each authenticated user only sees their own rows.

-- ---------- profiles ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text not null default 'male' check (sex in ('male', 'female')),
  birthdate date not null default '1990-01-01',
  height_cm numeric not null default 175,
  weight_kg numeric not null default 75,
  activity_level text not null default 'light'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal_type text not null default 'maintain'
    check (goal_type in ('aggressive_cut','cut','maintain','bulk')),
  units text not null default 'metric' check (units in ('metric','imperial')),
  updated_at timestamptz not null default now()
);

-- ---------- food entries ----------
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  name text not null,
  calories numeric not null,
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, date);

-- ---------- exercise entries ----------
create table if not exists public.exercise_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  name text not null,
  calories_burned numeric not null,
  minutes numeric,
  created_at timestamptz not null default now()
);
create index if not exists exercise_entries_user_date_idx
  on public.exercise_entries (user_id, date);

-- ---------- weight logs ----------
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists weight_logs_user_date_idx
  on public.weight_logs (user_id, date);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.exercise_entries enable row level security;
alter table public.weight_logs enable row level security;

-- Reusable policy pattern: a user may only touch rows they own.
do $$
declare
  t text;
begin
  foreach t in array array['profiles','food_entries','exercise_entries','weight_logs']
  loop
    execute format('drop policy if exists "own_select" on public.%I;', t);
    execute format('drop policy if exists "own_insert" on public.%I;', t);
    execute format('drop policy if exists "own_update" on public.%I;', t);
    execute format('drop policy if exists "own_delete" on public.%I;', t);

    execute format(
      'create policy "own_select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
