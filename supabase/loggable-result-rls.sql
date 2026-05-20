-- Tighten athlete result writes so an athlete can only log exercises
-- from workouts that are visible/assigned to that athlete.

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
  )
);
