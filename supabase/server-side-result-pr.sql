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

drop policy if exists "insert own athlete results" on public.athlete_workout_results;
create policy "insert own athlete results" on public.athlete_workout_results
for insert to authenticated
with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
    and is_pr is not true
  )
);

drop policy if exists "update own athlete results" on public.athlete_workout_results;
create policy "update own athlete results" on public.athlete_workout_results
for update to authenticated
using (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
  )
)
with check (
  public.is_coach()
  or (
    auth_user_id = auth.uid()
    and athlete_id in (select public.current_athlete_ids())
    and public.can_log_workout_exercise(workout_exercise_id, athlete_id)
    and is_pr is not true
  )
);
