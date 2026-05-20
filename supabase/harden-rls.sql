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
    and is_pr is not true
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
    and is_pr is not true
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

-- Server-side athlete result save path computes PR flags instead of trusting the browser.
-- Save athlete workout results through a server-side path so athletes cannot choose PR flags.
-- Coaches may still manage PR flags directly; athlete direct table writes are restricted to non-PR rows.

create or replace function public.result_score_number(p_score text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text := btrim(coalesce(p_score, ''));
  v_parts text[];
  v_match text[];
begin
  if v_text = '' then return null; end if;

  if v_text ~ '^\d+:\d{2}(:\d{2})?$' then
    v_parts := string_to_array(v_text, ':');
    if array_length(v_parts, 1) = 2 then
      return (v_parts[1]::numeric * 60) + v_parts[2]::numeric;
    end if;
    return (v_parts[1]::numeric * 3600) + (v_parts[2]::numeric * 60) + v_parts[3]::numeric;
  end if;

  v_match := regexp_match(lower(v_text), '(\d+(?:\.\d+)?)\s*round');
  if v_match is not null then
    return v_match[1]::numeric * 1000 + coalesce((regexp_match(v_text, '\+\s*(\d+(?:\.\d+)?)'))[1]::numeric, 0);
  end if;

  v_match := regexp_match(v_text, '[-+]?[0-9]*\.?[0-9]+');
  if v_match is null then return null; end if;
  return v_match[1]::numeric;
end;
$$;

create or replace function public.result_is_lower_score_better(p_name text, p_score text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_score, '') like '%:%'
    or coalesce(lower(p_name), '') ~ '\m(row|run|mile|bike|ski)\M|for time|\mtime\M'
$$;

create or replace function public.save_athlete_workout_result(
  p_id uuid default null,
  p_athlete_id uuid default null,
  p_workout_exercise_id uuid default null,
  p_completed_on date default current_date,
  p_working_weight numeric default null,
  p_reps_completed text default null,
  p_score_result text default null,
  p_notes text default null,
  p_set_number integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result_id uuid;
  v_exercise record;
  v_token text;
  v_mode text := '';
  v_candidate numeric;
  v_previous_best numeric;
  v_is_pr boolean := false;
begin
  if v_user_id is null then
    raise exception 'Sign in required.';
  end if;
  if p_athlete_id is null then
    raise exception 'Athlete is required.';
  end if;
  if p_workout_exercise_id is null then
    raise exception 'Workout exercise is required.';
  end if;
  if p_athlete_id not in (select public.current_athlete_ids()) then
    raise exception 'You can only save your own results.';
  end if;
  if not public.can_log_workout_exercise(p_workout_exercise_id, p_athlete_id) then
    raise exception 'You cannot log this workout exercise.';
  end if;

  select
    we.id,
    we.exercise_name,
    nullif(btrim(coalesce(we.movement_key, we.movement_name, we.benchmark_key, we.benchmark_name, we.exercise_name)), '') as movement_token
  into v_exercise
  from public.workout_exercises we
  where we.id = p_workout_exercise_id;

  if v_exercise.id is null then
    raise exception 'Workout exercise not found.';
  end if;

  v_token := lower(v_exercise.movement_token);
  if p_working_weight is not null then
    v_mode := 'higher-weight';
    v_candidate := p_working_weight;
  elsif nullif(btrim(coalesce(p_score_result, '')), '') is not null then
    v_mode := case when public.result_is_lower_score_better(v_exercise.exercise_name, p_score_result) then 'lower-score' else 'higher-score' end;
    v_candidate := public.result_score_number(p_score_result);
  end if;

  if v_candidate is not null then
    select case
      when v_mode = 'lower-score' then min(public.result_score_number(r.score_result))
      when v_mode = 'higher-score' then max(public.result_score_number(r.score_result))
      else max(r.working_weight)
    end
    into v_previous_best
    from public.athlete_workout_results r
    join public.workout_exercises we on we.id = r.workout_exercise_id
    where r.athlete_id = p_athlete_id
      and (p_id is null or r.id <> p_id)
      and lower(nullif(btrim(coalesce(we.movement_key, we.movement_name, we.benchmark_key, we.benchmark_name, we.exercise_name)), '')) = v_token
      and (
        (v_mode = 'higher-weight' and r.working_weight is not null)
        or (v_mode in ('lower-score', 'higher-score') and public.result_score_number(r.score_result) is not null)
      );

    v_is_pr := v_previous_best is not null and case
      when v_mode = 'lower-score' then v_candidate < v_previous_best
      else v_candidate > v_previous_best
    end;
  end if;

  if p_id is not null then
    update public.athlete_workout_results
    set
      athlete_id = p_athlete_id,
      auth_user_id = v_user_id,
      workout_exercise_id = p_workout_exercise_id,
      completed_on = coalesce(p_completed_on, current_date),
      working_weight = p_working_weight,
      reps_completed = nullif(btrim(coalesce(p_reps_completed, '')), ''),
      score_result = nullif(btrim(coalesce(p_score_result, '')), ''),
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      set_number = p_set_number,
      is_pr = v_is_pr
    where id = p_id
      and auth_user_id = v_user_id
      and athlete_id = p_athlete_id
    returning id into v_result_id;

    if v_result_id is null then
      raise exception 'Result not found or not editable.';
    end if;
    return v_result_id;
  end if;

  insert into public.athlete_workout_results (
    athlete_id,
    auth_user_id,
    workout_exercise_id,
    completed_on,
    working_weight,
    reps_completed,
    score_result,
    notes,
    set_number,
    is_pr
  ) values (
    p_athlete_id,
    v_user_id,
    p_workout_exercise_id,
    coalesce(p_completed_on, current_date),
    p_working_weight,
    nullif(btrim(coalesce(p_reps_completed, '')), ''),
    nullif(btrim(coalesce(p_score_result, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_set_number,
    v_is_pr
  ) returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_athlete_workout_result(uuid, uuid, uuid, date, numeric, text, text, text, integer) to authenticated;

