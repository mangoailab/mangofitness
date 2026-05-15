-- Mango Fitness schema draft
-- Not applied yet.

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name text not null,
  email text unique,
  phone text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_on date,
  created_at timestamptz default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id) on delete cascade,
  workout_date date not null,
  title text not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete cascade,
  exercise_name text not null,
  sets text,
  reps text,
  target text,
  notes text,
  sort_order integer default 0
);

create table if not exists athlete_programs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  program_id uuid references programs(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (athlete_id, program_id)
);

create table if not exists athlete_workout_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  workout_exercise_id uuid references workout_exercises(id) on delete cascade,
  completed_on date default current_date,
  working_weight numeric,
  reps_completed text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists athlete_prs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade,
  exercise_name text not null,
  pr_value numeric,
  unit text default 'lb',
  achieved_on date default current_date,
  notes text,
  created_at timestamptz default now()
);
