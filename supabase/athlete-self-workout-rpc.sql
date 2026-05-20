-- Allow athletes to log a self-created workout without granting broad workout table writes.
-- Creates a private workout assigned only to the signed-in athlete, then saves one result.

create or replace function public.save_athlete_self_workout(
  p_completed_on date,
  p_title text,
  p_exercise_name text,
  p_section_type text,
  p_score_result text default null,
  p_working_weight numeric default null,
  p_reps_completed text default null,
  p_notes text default null,
  p_is_pr boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_workout_id uuid;
  v_exercise_id uuid;
  v_result_id uuid;
  v_section text;
begin
  select id into v_athlete_id
  from public.athletes
  where auth_user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by created_at desc
  limit 1;

  if v_athlete_id is null then
    raise exception 'Athlete profile not found.';
  end if;

  if p_completed_on is null then
    raise exception 'Workout date is required.';
  end if;

  if nullif(trim(coalesce(p_exercise_name, '')), '') is null then
    raise exception 'Movement or workout name is required.';
  end if;

  v_section := lower(nullif(trim(coalesce(p_section_type, '')), ''));
  if v_section not in ('lifting', 'cardio', 'wod') then
    v_section := 'cardio';
  end if;

  insert into public.workouts (
    workout_date,
    title,
    notes,
    workout_format,
    assignment_type,
    created_by
  ) values (
    p_completed_on,
    coalesce(nullif(trim(p_title), ''), 'Self-created workout'),
    'Athlete-created workout log.',
    'Athlete-created',
    'athlete_created',
    auth.uid()
  ) returning id into v_workout_id;

  insert into public.workout_assignments (workout_id, athlete_id)
  values (v_workout_id, v_athlete_id);

  insert into public.workout_exercises (
    workout_id,
    exercise_name,
    section_type,
    target,
    notes,
    sort_order
  ) values (
    v_workout_id,
    trim(p_exercise_name),
    v_section,
    case when v_section = 'lifting' then 'Self-created strength log.' else 'Self-created score/time log.' end,
    null,
    0
  ) returning id into v_exercise_id;

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
    v_athlete_id,
    auth.uid(),
    v_exercise_id,
    p_completed_on,
    p_working_weight,
    nullif(trim(coalesce(p_reps_completed, '')), ''),
    nullif(trim(coalesce(p_score_result, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    case when v_section = 'lifting' then 1 else null end,
    coalesce(p_is_pr, false)
  ) returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_athlete_self_workout(date, text, text, text, text, numeric, text, text, boolean) to authenticated;
