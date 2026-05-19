-- Make leaderboard visibility obey only the coach-managed leaderboard checkbox.
-- Benchmarks can stay as benchmarks while being hidden from athlete leaderboards.

create or replace function public.leaderboard_results()
returns table (
  result_id uuid,
  athlete_id uuid,
  athlete_name text,
  event_name text,
  event_type text,
  score_result text,
  working_weight numeric,
  reps_completed text,
  completed_on date,
  notes text,
  is_pr boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    awr.id as result_id,
    awr.athlete_id,
    coalesce(a.name, 'Athlete') as athlete_name,
    coalesce(we.benchmark_name, sm.name, we.movement_name, we.exercise_name) as event_name,
    case
      when lower(coalesce(we.benchmark_name, we.movement_name, we.exercise_name, '')) ~ '(row 2k|2k row|2000m row|row 2000m|row 3k|3k row|3000m row|row 3000m|row 4k|4k row|4000m row|row 4000m)' then 'row'
      when coalesce(sm.category, '') <> '' then sm.category
      else 'wod'
    end as event_type,
    awr.score_result,
    awr.working_weight,
    awr.reps_completed,
    awr.completed_on,
    case when awr.notes is null then null else left(awr.notes, 120) end as notes,
    awr.is_pr
  from public.athlete_workout_results awr
  join public.athletes a on a.id = awr.athlete_id
  join public.workout_exercises we on we.id = awr.workout_exercise_id
  left join public.strength_movements sm on sm.id::text = we.movement_key or sm.movement_key = we.movement_key or lower(sm.name) = lower(coalesce(we.movement_name, we.exercise_name, ''))
  where
    awr.score_result is not null
    and btrim(awr.score_result) <> ''
    and coalesce(sm.show_on_leaderboard, false);
$$;

grant execute on function public.leaderboard_results() to authenticated;
