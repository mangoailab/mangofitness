-- Mango Fitness MVP schema
-- Apply in Supabase SQL Editor.
-- This MVP policy is intentionally simple: any signed-in user can read/write workout data.
-- Before production, tighten policies so coaches manage workouts and athletes only see their own assignments/results.

create extension if not exists pgcrypto;

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text unique,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id) on delete cascade,
  workout_date date not null,
  title text not null,
  notes text,
  warmup_notes text,
  workout_format text not null default 'Strength',
  rounds text,
  score_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_name text not null,
  sets text,
  reps text,
  target text,
  target_weight text,
  section_type text not null default 'cardio',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists athlete_programs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  program_id uuid references programs(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (athlete_id, program_id)
);

create table if not exists athlete_workout_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  completed_on date not null default current_date,
  working_weight numeric,
  reps_completed text,
  notes text,
  is_pr boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists athlete_prs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  exercise_name text not null,
  pr_value numeric,
  unit text not null default 'lb',
  achieved_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table workouts add column if not exists warmup_notes text;
alter table workouts add column if not exists workout_format text not null default 'Strength';
alter table workouts add column if not exists rounds text;
alter table workouts add column if not exists score_type text;

create index if not exists workouts_workout_date_idx on workouts(workout_date);
alter table workout_exercises add column if not exists target_weight text;
alter table workout_exercises add column if not exists section_type text not null default 'cardio';

create index if not exists workout_exercises_workout_id_idx on workout_exercises(workout_id);
create index if not exists athlete_workout_results_exercise_idx on athlete_workout_results(workout_exercise_id);
create index if not exists athlete_workout_results_auth_user_idx on athlete_workout_results(auth_user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workouts_set_updated_at on workouts;
create trigger workouts_set_updated_at
before update on workouts
for each row execute function set_updated_at();

alter table athletes enable row level security;
alter table programs enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table athlete_programs enable row level security;
alter table athlete_workout_results enable row level security;
alter table athlete_prs enable row level security;

-- MVP policies: simple signed-in access while the app is still being built.
drop policy if exists "authenticated read athletes" on athletes;
create policy "authenticated read athletes" on athletes for select to authenticated using (true);
drop policy if exists "authenticated manage athletes" on athletes;
create policy "authenticated manage athletes" on athletes for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read programs" on programs;
create policy "authenticated read programs" on programs for select to authenticated using (true);
drop policy if exists "authenticated manage programs" on programs;
create policy "authenticated manage programs" on programs for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read workouts" on workouts;
create policy "authenticated read workouts" on workouts for select to authenticated using (true);
drop policy if exists "authenticated manage workouts" on workouts;
create policy "authenticated manage workouts" on workouts for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read workout exercises" on workout_exercises;
create policy "authenticated read workout exercises" on workout_exercises for select to authenticated using (true);
drop policy if exists "authenticated manage workout exercises" on workout_exercises;
create policy "authenticated manage workout exercises" on workout_exercises for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read athlete programs" on athlete_programs;
create policy "authenticated read athlete programs" on athlete_programs for select to authenticated using (true);
drop policy if exists "authenticated manage athlete programs" on athlete_programs;
create policy "authenticated manage athlete programs" on athlete_programs for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read athlete results" on athlete_workout_results;
create policy "authenticated read athlete results" on athlete_workout_results for select to authenticated using (true);
drop policy if exists "authenticated manage athlete results" on athlete_workout_results;
create policy "authenticated manage athlete results" on athlete_workout_results for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read athlete prs" on athlete_prs;
create policy "authenticated read athlete prs" on athlete_prs for select to authenticated using (true);
drop policy if exists "authenticated manage athlete prs" on athlete_prs;
create policy "authenticated manage athlete prs" on athlete_prs for all to authenticated using (true) with check (true);
