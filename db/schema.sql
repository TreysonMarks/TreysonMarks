-- CalTrack schema for Supabase (Postgres).
-- Run this in the Supabase SQL editor once, after creating your project.
-- Safe to re-run: every statement is idempotent, so it doubles as a migration.
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

-- Bring-your-own Claude key + model for AI food parsing (protected by RLS).
alter table public.profiles add column if not exists anthropic_key text;
alter table public.profiles add column if not exists anthropic_model text
  not null default 'claude-opus-5';

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
alter table public.food_entries add column if not exists protein_g numeric not null default 0;
alter table public.food_entries add column if not exists carbs_g numeric not null default 0;
alter table public.food_entries add column if not exists fat_g numeric not null default 0;
alter table public.food_entries add column if not exists category text not null default 'Other';
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

-- ---------- food categories (per user, editable) ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists categories_user_idx on public.categories (user_id, sort);

-- ---------- supplements (definitions with cadence) ----------
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dose numeric,
  dose_unit text,
  -- cadence_days: 1 = daily, 7 = weekly, 0/null = as-needed (no schedule)
  cadence_days integer,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists supplements_user_idx on public.supplements (user_id);

-- ---------- supplement logs (each dose taken) ----------
create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  taken_at timestamptz not null default now(),
  dose numeric,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists supplement_logs_user_idx
  on public.supplement_logs (user_id, supplement_id, taken_at);

-- ---------- workouts (training sessions) ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text not null,
  type text not null default 'mixed'
    check (type in ('strength','conditioning','cardio','mixed')),
  notes text,
  calories_burned numeric not null default 0,
  duration_min numeric,
  rpe numeric, -- rate of perceived exertion 1-10 (optional)
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date);

-- ---------- workout exercises (movements within a session) ----------
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- strength: sets is [{"reps": n, "weight": w}, ...]
  sets jsonb not null default '[]'::jsonb,
  -- cardio / conditioning fields (used when sets is empty)
  distance_m numeric,
  duration_sec numeric,
  score text, -- e.g. "12 rounds", "Fran 4:32"
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists workout_exercises_workout_idx
  on public.workout_exercises (workout_id, sort);
create index if not exists workout_exercises_user_name_idx
  on public.workout_exercises (user_id, name);

-- ---------- plan_days (recurring weekly template) ----------
-- One prescribed session per weekday (0 = Sunday ... 6 = Saturday).
create table if not exists public.plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  title text not null default '',
  type text not null default 'mixed'
    check (type in ('strength','conditioning','cardio','mixed')),
  is_rest boolean not null default false,
  notes text,
  -- prescription: [{"name":str,"sets":n,"reps":"8-12","weight":w,"notes":str}]
  prescription jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, weekday)
);
create index if not exists plan_days_user_idx on public.plan_days (user_id, weekday);

-- ---------- planned_workouts (one-off sessions on a specific date) ----------
create table if not exists public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text not null default '',
  type text not null default 'mixed'
    check (type in ('strength','conditioning','cardio','mixed')),
  is_rest boolean not null default false,
  notes text,
  prescription jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists planned_workouts_user_date_idx
  on public.planned_workouts (user_id, date);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.exercise_entries enable row level security;
alter table public.weight_logs enable row level security;
alter table public.categories enable row level security;
alter table public.supplements enable row level security;
alter table public.supplement_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.plan_days enable row level security;
alter table public.planned_workouts enable row level security;

-- Reusable policy pattern: a user may only touch rows they own.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','food_entries','exercise_entries','weight_logs',
    'categories','supplements','supplement_logs','workouts','workout_exercises',
    'plan_days','planned_workouts'
  ]
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
