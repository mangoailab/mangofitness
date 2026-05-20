-- Athlete self-reported historical benchmark entries.
-- Uses existing coach-managed benchmark movements only and writes into athlete_workout_results
-- through a stable hidden workout/exercise record so existing history/leaderboard views keep working.

create or replace function public.save_historical_benchmark(
  p_movement_id uuid,
  p_completed_on date,
  p_score_result text default null,
  p_working_weight numeric default null,
  p_reps_completed text default null,
  p_notes text default null,
  p_is_pr boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_athlete_id uuid;
  v_movement record;
  v_workout_id uuid;
  v_exercise_id uuid;
  v_result_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required.';
  end if;

  select id into v_athlete_id
  from public.athletes
  where auth_user_id = v_user_id
  order by created_at desc
  limit 1;

  if v_athlete_id is null then
    raise exception 'No athlete profile is linked to this account.';
  end if;

  select id, movement_key, name, category into v_movement
  from public.strength_movements
  where id = p_movement_id
    and is_benchmark = true;

  if v_movement.id is null then
    raise exception 'Choose an existing benchmark.';
  end if;

  update public.workouts
  set assignment_type = 'system_history'
  where title = 'Historical Benchmarks'
    and workout_date = '1900-01-01'
    and coalesce(assignment_type, '') <> 'system_history';

  select id into v_workout_id
  from public.workouts
  where title = 'Historical Benchmarks'
    and workout_date = '1900-01-01'
  order by created_at asc
  limit 1;

  if v_workout_id is null then
    insert into public.workouts (workout_date, title, notes, workout_format, assignment_type)
    values ('1900-01-01', 'Historical Benchmarks', 'System workout for athlete-entered historical benchmark records.', 'Benchmark History', 'system_history')
    returning id into v_workout_id;
  end if;

  if v_workout_id is null then
    raise exception 'Could not prepare historical benchmark workout.';
  end if;

  select id into v_exercise_id
  from public.workout_exercises
  where workout_id = v_workout_id
    and benchmark_key = coalesce(v_movement.movement_key, v_movement.id::text)
  order by created_at asc
  limit 1;

  if v_exercise_id is null then
    insert into public.workout_exercises (
      workout_id,
      exercise_name,
      benchmark_key,
      benchmark_name,
      movement_key,
      movement_name,
      section_type,
      notes,
      sort_order
    ) values (
      v_workout_id,
      v_movement.name,
      coalesce(v_movement.movement_key, v_movement.id::text),
      v_movement.name,
      coalesce(v_movement.movement_key, v_movement.id::text),
      v_movement.name,
      coalesce(v_movement.category, 'strength'),
      'Historical benchmark placeholder exercise.',
      0
    )
    returning id into v_exercise_id;
  end if;

  insert into public.athlete_workout_results (
    athlete_id,
    auth_user_id,
    workout_exercise_id,
    completed_on,
    working_weight,
    reps_completed,
    notes,
    score_result,
    is_pr
  ) values (
    v_athlete_id,
    v_user_id,
    v_exercise_id,
    coalesce(p_completed_on, current_date),
    p_working_weight,
    nullif(btrim(coalesce(p_reps_completed, '')), ''),
    nullif(btrim(concat_ws(' ', 'Self-reported historical benchmark.', nullif(p_notes, ''))), ''),
    nullif(btrim(coalesce(p_score_result, '')), ''),
    coalesce(p_is_pr, true)
  )
  returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_historical_benchmark(uuid, date, text, numeric, text, text, boolean) to authenticated;
