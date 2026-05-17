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




create table if not exists cardio_benchmarks (
  id uuid primary key default gen_random_uuid(),
  benchmark_key text unique,
  name text not null,
  score_type text,
  description text,
  is_builtin boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists strength_movements (
  id uuid primary key default gen_random_uuid(),
  movement_key text unique,
  name text not null,
  is_builtin boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists warmup_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique,
  name text not null,
  notes text not null,
  is_builtin boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  cardio_notes text,
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
  benchmark_key text,
  benchmark_name text,
  movement_key text,
  movement_name text,
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

create table if not exists workout_assignments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (workout_id, athlete_id)
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
  score_result text,
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
alter table workouts add column if not exists cardio_notes text;
alter table workouts add column if not exists workout_format text not null default 'Strength';
alter table workouts add column if not exists rounds text;
alter table workouts add column if not exists score_type text;
alter table workouts add column if not exists assignment_type text not null default 'everyone';

alter table warmup_templates add column if not exists template_key text unique;
alter table warmup_templates add column if not exists is_builtin boolean not null default false;



insert into cardio_benchmarks (benchmark_key, name, score_type, description, is_builtin)
values
  ('4k-row', '4K Row', 'Time', 'For time: row 4,000 meters. Record finish time.', true),
  ('2k-row', '2K Row', 'Time', 'For time: row 2,000 meters. Record finish time.', true),
  ('1-mile-run', '1 Mile Run', 'Time', null, true),
  ('5k-run', '5K Run', 'Time', null, true),
  ('assault-bike-calories', 'Assault Bike Calories', 'Calories', null, true),
  ('ski-erg-calories', 'SkiErg Calories', 'Calories', null, true),
  ('cindy', 'Cindy', 'Rounds + reps', '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats.', true),
  ('murph', 'Murph', 'Time', 'For time: 1 mile run, 100 pull-ups, 200 push-ups, 300 air squats, 1 mile run. Partition reps as needed. Vest optional.', true),
  ('fran', 'Fran', 'Time', '21-15-9 reps for time: thrusters and pull-ups.', true),
  ('helen', 'Helen', 'Time', '3 rounds for time: 400m run, 21 kettlebell swings, 12 pull-ups.', true),
  ('annie', 'Annie', 'Time', '50-40-30-20-10 reps for time: double-unders and sit-ups.', true),
  ('grace', 'Grace', 'Time', 'For time: 30 clean and jerks.', true)
on conflict (benchmark_key) do nothing;

insert into strength_movements (movement_key, name, is_builtin)
values
  ('back-squat', 'Back Squat', true),
  ('front-squat', 'Front Squat', true),
  ('deadlift', 'Deadlift', true),
  ('bench-press', 'Bench Press', true),
  ('incline-db-chest-press', 'Incline DB Chest Press', true),
  ('strict-press', 'Strict Press', true),
  ('push-press', 'Push Press', true),
  ('power-clean', 'Power Clean', true),
  ('squat-clean', 'Squat Clean', true),
  ('power-snatch', 'Power Snatch', true),
  ('squat-snatch', 'Squat Snatch', true),
  ('clean-and-jerk', 'Clean & Jerk', true),
  ('pull-up', 'Pull-up', true),
  ('ring-row', 'Ring Row', true),
  ('push-up', 'Push-up', true),
  ('kettlebell-swing', 'Kettlebell Swing', true)
on conflict (movement_key) do nothing;

insert into warmup_templates (template_key, name, notes, is_builtin)
values
  ('pushup-ringrow', 'Push-up + Ring Row', '3 rounds: alternate 5 push-ups and 8 ring rows. Move smooth, not for time.', true),
  ('general-dynamic', 'General Dynamic Warm-up', '2 rounds: 10 air squats, 10 lunges, 10 band pull-aparts, 20 jumping jacks. Then easy movement prep for today’s workout.', true),
  ('row-mobility', 'Row + Mobility', '5 min easy row, then 2 rounds: 10 pass-throughs, 10 inchworms, 10 glute bridges, 10 scap pull-ups.', true),
  ('barbell-prep', 'Barbell Prep', 'With empty bar: 2 rounds of 5 good mornings, 5 front squats, 5 strict press, 5 RDL, 5 hang power cleans.', true)
on conflict (template_key) do nothing;

insert into athletes (name, email, notes)
values
  ('Alex Rivera', 'alex.demo@mangofitness.local', 'Demo athlete for individual programming'),
  ('Jamie Chen', 'jamie.demo@mangofitness.local', 'Demo athlete for individual programming'),
  ('Taylor Brooks', 'taylor.demo@mangofitness.local', 'Demo athlete for individual programming')
on conflict (email) do update set name = excluded.name, notes = excluded.notes;

create index if not exists workouts_workout_date_idx on workouts(workout_date);
alter table workout_exercises add column if not exists target_weight text;
alter table workout_exercises add column if not exists benchmark_key text;
alter table workout_exercises add column if not exists benchmark_name text;
alter table workout_exercises add column if not exists movement_key text;
alter table workout_exercises add column if not exists movement_name text;
alter table workout_exercises add column if not exists section_type text not null default 'cardio';

create index if not exists workout_exercises_workout_id_idx on workout_exercises(workout_id);
create index if not exists workout_assignments_workout_id_idx on workout_assignments(workout_id);
create index if not exists workout_assignments_athlete_id_idx on workout_assignments(athlete_id);
alter table athlete_workout_results add column if not exists score_result text;

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

drop trigger if exists warmup_templates_set_updated_at on warmup_templates;
create trigger warmup_templates_set_updated_at
before update on warmup_templates
for each row execute function set_updated_at();

drop trigger if exists strength_movements_set_updated_at on strength_movements;
create trigger strength_movements_set_updated_at
before update on strength_movements
for each row execute function set_updated_at();

drop trigger if exists cardio_benchmarks_set_updated_at on cardio_benchmarks;
create trigger cardio_benchmarks_set_updated_at
before update on cardio_benchmarks
for each row execute function set_updated_at();

alter table athletes enable row level security;
alter table warmup_templates enable row level security;
alter table strength_movements enable row level security;
alter table cardio_benchmarks enable row level security;
alter table programs enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table athlete_programs enable row level security;
alter table workout_assignments enable row level security;
alter table athlete_workout_results enable row level security;
alter table athlete_prs enable row level security;

-- MVP policies: simple signed-in access while the app is still being built.
drop policy if exists "authenticated read athletes" on athletes;
create policy "authenticated read athletes" on athletes for select to authenticated using (true);
drop policy if exists "authenticated manage athletes" on athletes;
create policy "authenticated manage athletes" on athletes for all to authenticated using (true) with check (true);




drop policy if exists "authenticated read cardio benchmarks" on cardio_benchmarks;
create policy "authenticated read cardio benchmarks" on cardio_benchmarks for select to authenticated using (true);
drop policy if exists "authenticated manage cardio benchmarks" on cardio_benchmarks;
create policy "authenticated manage cardio benchmarks" on cardio_benchmarks for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read strength movements" on strength_movements;
create policy "authenticated read strength movements" on strength_movements for select to authenticated using (true);
drop policy if exists "authenticated manage strength movements" on strength_movements;
create policy "authenticated manage strength movements" on strength_movements for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read warmup templates" on warmup_templates;
create policy "authenticated read warmup templates" on warmup_templates for select to authenticated using (true);
drop policy if exists "authenticated manage warmup templates" on warmup_templates;
create policy "authenticated manage warmup templates" on warmup_templates for all to authenticated using (true) with check (true);

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

drop policy if exists "authenticated read workout assignments" on workout_assignments;
create policy "authenticated read workout assignments" on workout_assignments for select to authenticated using (true);
drop policy if exists "authenticated manage workout assignments" on workout_assignments;
create policy "authenticated manage workout assignments" on workout_assignments for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read athlete results" on athlete_workout_results;
create policy "authenticated read athlete results" on athlete_workout_results for select to authenticated using (true);
drop policy if exists "authenticated manage athlete results" on athlete_workout_results;
create policy "authenticated manage athlete results" on athlete_workout_results for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read athlete prs" on athlete_prs;
create policy "authenticated read athlete prs" on athlete_prs for select to authenticated using (true);
drop policy if exists "authenticated manage athlete prs" on athlete_prs;
create policy "authenticated manage athlete prs" on athlete_prs for all to authenticated using (true) with check (true);
