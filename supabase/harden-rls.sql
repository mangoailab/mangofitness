-- Mango Fitness RLS hardening migration
-- Apply this in Supabase SQL Editor after creating/linking coach auth users.
-- It adds coach_profiles and replaces broad MVP policies with coach/athlete-scoped policies.

create table if not exists coach_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text,
  email text unique,
  created_at timestamptz not null default now()
);


alter table coach_profiles enable row level security;
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
alter table athlete_body_scans enable row level security;

-- Production-oriented RLS policies.
-- Coaches are users with a row in coach_profiles. Add coach users with:
-- insert into coach_profiles (auth_user_id, email, name)
-- values ('<auth.users.id>', '<coach email>', '<coach name>');

create or replace function public.is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.coach_profiles
    where auth_user_id = auth.uid()
  );
$$;

create or replace function public.current_athlete_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.athletes
  where auth_user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.can_view_workout(workout_row public.workouts)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_coach()
    or coalesce(workout_row.assignment_type, 'everyone') = 'everyone'
    or exists (
      select 1
      from public.workout_assignments wa
      where wa.workout_id = workout_row.id
        and wa.athlete_id in (select public.current_athlete_ids())
    )
$$;

create or replace function public.can_log_workout_exercise(p_workout_exercise_id uuid, p_athlete_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_coach()
    or (
      p_athlete_id in (select public.current_athlete_ids())
      and exists (
        select 1
        from public.workout_exercises we
        join public.workouts w on w.id = we.workout_id
        where we.id = p_workout_exercise_id
          and (
            coalesce(w.assignment_type, 'everyone') = 'everyone'
            or exists (
              select 1
              from public.workout_assignments wa
              where wa.workout_id = w.id
                and wa.athlete_id = p_athlete_id
            )
          )
      )
    )
$$;

drop policy if exists "coach profiles self read" on coach_profiles;
create policy "coach profiles self read" on coach_profiles for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "coach profiles self insert" on coach_profiles;
drop policy if exists "coach profiles coach manage" on coach_profiles;
create policy "coach profiles coach manage" on coach_profiles for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read athletes" on athletes;
drop policy if exists "authenticated manage athletes" on athletes;
drop policy if exists "coaches read athletes" on athletes;
create policy "coaches read athletes" on athletes for select to authenticated using (public.is_coach());
drop policy if exists "athletes read own profile" on athletes;
create policy "athletes read own profile" on athletes for select to authenticated using (id in (select public.current_athlete_ids()));
drop policy if exists "coaches manage athletes" on athletes;
create policy "coaches manage athletes" on athletes for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read cardio benchmarks" on cardio_benchmarks;
drop policy if exists "authenticated manage cardio benchmarks" on cardio_benchmarks;
drop policy if exists "authenticated read cardio benchmarks" on cardio_benchmarks;
create policy "authenticated read cardio benchmarks" on cardio_benchmarks for select to authenticated using (true);
drop policy if exists "coaches manage cardio benchmarks" on cardio_benchmarks;
create policy "coaches manage cardio benchmarks" on cardio_benchmarks for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read strength movements" on strength_movements;
drop policy if exists "authenticated manage strength movements" on strength_movements;
drop policy if exists "authenticated read strength movements" on strength_movements;
create policy "authenticated read strength movements" on strength_movements for select to authenticated using (true);
drop policy if exists "coaches manage strength movements" on strength_movements;
create policy "coaches manage strength movements" on strength_movements for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read warmup templates" on warmup_templates;
drop policy if exists "authenticated manage warmup templates" on warmup_templates;
drop policy if exists "authenticated read warmup templates" on warmup_templates;
create policy "authenticated read warmup templates" on warmup_templates for select to authenticated using (true);
drop policy if exists "coaches manage warmup templates" on warmup_templates;
create policy "coaches manage warmup templates" on warmup_templates for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read programs" on programs;
drop policy if exists "authenticated manage programs" on programs;
drop policy if exists "coaches read programs" on programs;
create policy "coaches read programs" on programs for select to authenticated using (public.is_coach());
drop policy if exists "athletes read assigned programs" on programs;
create policy "athletes read assigned programs" on programs for select to authenticated using (
  exists (
    select 1 from public.athlete_programs ap
    where ap.program_id = programs.id
      and ap.athlete_id in (select public.current_athlete_ids())
  )
);
drop policy if exists "coaches manage programs" on programs;
create policy "coaches manage programs" on programs for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read workouts" on workouts;
drop policy if exists "authenticated manage workouts" on workouts;
drop policy if exists "coaches read workouts" on workouts;
create policy "coaches read workouts" on workouts for select to authenticated using (public.is_coach());
drop policy if exists "athletes read visible workouts" on workouts;
create policy "athletes read visible workouts" on workouts for select to authenticated using (public.can_view_workout(workouts));
drop policy if exists "coaches manage workouts" on workouts;
create policy "coaches manage workouts" on workouts for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read workout exercises" on workout_exercises;
drop policy if exists "authenticated manage workout exercises" on workout_exercises;
drop policy if exists "read visible workout exercises" on workout_exercises;
create policy "read visible workout exercises" on workout_exercises for select to authenticated using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and public.can_view_workout(w)
  )
);
drop policy if exists "coaches manage workout exercises" on workout_exercises;
create policy "coaches manage workout exercises" on workout_exercises for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read athlete programs" on athlete_programs;
drop policy if exists "authenticated manage athlete programs" on athlete_programs;
drop policy if exists "read own athlete programs" on athlete_programs;
create policy "read own athlete programs" on athlete_programs for select to authenticated using (
  public.is_coach() or athlete_id in (select public.current_athlete_ids())
);
drop policy if exists "coaches manage athlete programs" on athlete_programs;
create policy "coaches manage athlete programs" on athlete_programs for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read workout assignments" on workout_assignments;
drop policy if exists "authenticated manage workout assignments" on workout_assignments;
drop policy if exists "read own workout assignments" on workout_assignments;
create policy "read own workout assignments" on workout_assignments for select to authenticated using (
  public.is_coach() or athlete_id in (select public.current_athlete_ids())
);
drop policy if exists "coaches manage workout assignments" on workout_assignments;
create policy "coaches manage workout assignments" on workout_assignments for all to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "authenticated read athlete results" on athlete_workout_results;
drop policy if exists "authenticated manage athlete results" on athlete_workout_results;
drop policy if exists "read own athlete results" on athlete_workout_results;
create policy "read own athlete results" on athlete_workout_results for select to authenticated using (
  public.is_coach()
  or auth_user_id = auth.uid()
  or athlete_id in (select public.current_athlete_ids())
);
drop policy if exists "insert own athlete results" on athlete_workout_results;
create policy "insert own athlete results" on athlete_workout_results for insert to authenticated with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
  )
);
drop policy if exists "update own athlete results" on athlete_workout_results;
create policy "update own athlete results" on athlete_workout_results for update to authenticated using (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
  )
) with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
  )
);
drop policy if exists "delete own athlete results" on athlete_workout_results;
create policy "delete own athlete results" on athlete_workout_results for delete to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);

drop policy if exists "authenticated read athlete prs" on athlete_prs;
drop policy if exists "authenticated manage athlete prs" on athlete_prs;
drop policy if exists "read own athlete prs" on athlete_prs;
create policy "read own athlete prs" on athlete_prs for select to authenticated using (
  public.is_coach()
  or auth_user_id = auth.uid()
  or athlete_id in (select public.current_athlete_ids())
);
drop policy if exists "insert own athlete prs" on athlete_prs;
create policy "insert own athlete prs" on athlete_prs for insert to authenticated with check (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);
drop policy if exists "update own athlete prs" on athlete_prs;
create policy "update own athlete prs" on athlete_prs for update to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
) with check (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);
drop policy if exists "delete own athlete prs" on athlete_prs;
create policy "delete own athlete prs" on athlete_prs for delete to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);

drop policy if exists "authenticated read body scans" on athlete_body_scans;
drop policy if exists "authenticated manage body scans" on athlete_body_scans;
drop policy if exists "read own body scans" on athlete_body_scans;
create policy "read own body scans" on athlete_body_scans for select to authenticated using (
  public.is_coach()
  or auth_user_id = auth.uid()
  or athlete_id in (select public.current_athlete_ids())
);
drop policy if exists "insert own body scans" on athlete_body_scans;
create policy "insert own body scans" on athlete_body_scans for insert to authenticated with check (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);
drop policy if exists "update own body scans" on athlete_body_scans;
create policy "update own body scans" on athlete_body_scans for update to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
) with check (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);
drop policy if exists "delete own body scans" on athlete_body_scans;
create policy "delete own body scans" on athlete_body_scans for delete to authenticated using (
  public.is_coach()
  or (auth_user_id = auth.uid() and athlete_id in (select public.current_athlete_ids()))
);
