-- Allow athletes to log a self-created workout without granting broad workout table writes.
-- Creates one private workout assigned only to the signed-in athlete, with one or more pieces.

create or replace function public.save_athlete_self_workout(
  p_completed_on date,
  p_title text,
  p_exercise_name text,
  p_section_type text,
  p_score_result text default null,
  p_working_weight numeric default null,
  p_reps_completed text default null,
  p_notes text default null,
  p_is_pr boolean default false,
  p_sets jsonb default null,
  p_pieces jsonb default null
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
  v_piece jsonb;
  v_set jsonb;
  v_section text;
  v_exercise_name text;
  v_score text;
  v_notes text;
  v_is_pr boolean;
  v_sets jsonb;
  v_set_number integer;
  v_weight numeric;
  v_reps text;
  v_saved_sets integer;
  v_best_weight numeric;
  v_sort integer := 0;
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

  insert into public.workouts (workout_date, title, notes, workout_format, assignment_type, created_by)
  values (p_completed_on, coalesce(nullif(trim(p_title), ''), 'Self-created workout'), 'Athlete-created workout log.', 'Athlete-created', 'athlete_created', auth.uid())
  returning id into v_workout_id;

  insert into public.workout_assignments (workout_id, athlete_id)
  values (v_workout_id, v_athlete_id);

  if p_pieces is null or jsonb_typeof(p_pieces) <> 'array' or jsonb_array_length(p_pieces) = 0 then
    p_pieces := jsonb_build_array(jsonb_build_object(
      'section', p_section_type,
      'exerciseName', p_exercise_name,
      'score', p_score_result,
      'sets', p_sets,
      'notes', p_notes,
      'isPr', p_is_pr
    ));
  end if;

  for v_piece in select * from jsonb_array_elements(p_pieces)
  loop
    v_section := lower(nullif(trim(coalesce(v_piece ->> 'section', '')), ''));
    if v_section not in ('lifting', 'cardio', 'wod') then v_section := 'cardio'; end if;
    v_exercise_name := nullif(trim(coalesce(v_piece ->> 'exerciseName', '')), '');
    if v_exercise_name is null then continue; end if;
    v_score := nullif(trim(coalesce(v_piece ->> 'score', '')), '');
    v_notes := nullif(trim(coalesce(v_piece ->> 'notes', '')), '');
    v_is_pr := coalesce((v_piece ->> 'isPr')::boolean, false);
    v_sets := v_piece -> 'sets';

    insert into public.workout_exercises (workout_id, exercise_name, section_type, target, notes, sort_order)
    values (
      v_workout_id,
      v_exercise_name,
      v_section,
      case when v_section = 'lifting' then 'Self-created strength log.' else 'Self-created score/time log.' end,
      null,
      v_sort
    ) returning id into v_exercise_id;
    v_sort := v_sort + 1;

    if v_section = 'lifting' then
      v_saved_sets := 0;
      v_best_weight := null;
      if v_sets is not null and jsonb_typeof(v_sets) = 'array' then
        select max(nullif(item ->> 'weight', '')::numeric) into v_best_weight
        from jsonb_array_elements(v_sets) as item
        where nullif(item ->> 'weight', '') is not null;
        for v_set in select * from jsonb_array_elements(v_sets)
        loop
          v_set_number := coalesce(nullif(v_set ->> 'setNumber', '')::integer, v_saved_sets + 1);
          v_weight := nullif(v_set ->> 'weight', '')::numeric;
          v_reps := nullif(trim(coalesce(v_set ->> 'reps', '')), '');
          if v_weight is not null or v_reps is not null then
            insert into public.athlete_workout_results (athlete_id, auth_user_id, workout_exercise_id, completed_on, working_weight, reps_completed, score_result, notes, set_number, is_pr)
            values (v_athlete_id, auth.uid(), v_exercise_id, p_completed_on, v_weight, v_reps, null, v_notes, v_set_number, v_is_pr and v_weight is not distinct from v_best_weight)
            returning id into v_result_id;
            v_saved_sets := v_saved_sets + 1;
          end if;
        end loop;
      end if;
      if v_saved_sets = 0 then
        raise exception 'Enter reps or weight for each strength piece.';
      end if;
    else
      if v_score is null then
        raise exception 'Time or score is required for each cardio/WOD piece.';
      end if;
      insert into public.athlete_workout_results (athlete_id, auth_user_id, workout_exercise_id, completed_on, working_weight, reps_completed, score_result, notes, set_number, is_pr)
      values (v_athlete_id, auth.uid(), v_exercise_id, p_completed_on, null, null, v_score, v_notes, null, v_is_pr)
      returning id into v_result_id;
    end if;
  end loop;

  if v_result_id is null then
    raise exception 'Add at least one workout piece.';
  end if;
  return v_result_id;
end;
$$;

grant execute on function public.save_athlete_self_workout(date, text, text, text, text, numeric, text, text, boolean, jsonb, jsonb) to authenticated;
