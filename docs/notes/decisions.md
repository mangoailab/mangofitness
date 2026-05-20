# Mango Fitness Decisions

## UI/navigation

- Home page should follow the Mango Loan style Lawrence likes: larger centered window, more mobile vertical spacing, and separate Coach/Athlete portal button cards. Since the Mango Fitness logo already includes the branding, do not duplicate it with a large text heading in the hero.
- Keep related pages visually consistent. Match markup/classes/CSS, not just approximate appearance.
- Athlete navigation should stay fixed across athlete pages; highlight the current page with slightly bolder text only.
- Do not use a bubble/pill around the active nav item.
- Athlete-facing pages should not include a Coach portal link.
- Coach-facing pages should not include an Athlete portal link.

## Progress history

- Athletes can only view their own progress history.
- Coaches can view progress history for all athletes.
- Coach progress history lives at `coach-history.html`.

## Programming/workouts

- Keep weekly calendar layout for Saved Workouts.
- Keep class/everyone vs individual athlete programming model.
- Coach Saved Workouts filter: Everyone/class shows group workouts; selecting an athlete shows only that athlete's individual workouts.
- Keep collapsible Workout Builder sections to reduce scrolling.

## Security/RLS

- RLS should enforce privacy at the database level, not just in the UI.
- Broad authenticated `using (true) with check (true)` policies are not acceptable for production behavior.
- Coaches are granted access through `coach_profiles`.
- Athletes are matched by `athletes.auth_user_id` or email where needed.

## Git workflow

- Always ask Lawrence before running `git push`, even if code is committed and ready.

## Result logging security

- Athlete result writes must check both identity and workout access. `athlete_workout_results` insert/update policies use `public.can_log_workout_exercise(workout_exercise_id, athlete_id)` so athletes can only log exercises from class/everyone workouts or workouts assigned to that athlete. Coaches remain allowed through `public.is_coach()`.

## Body scan AI parser security

- `parse-body-scan` must verify a valid Supabase user session inside the Edge Function before calling OpenAI. Anonymous requests and invalid bearer tokens should return 401 before any AI/API spend happens.

## PR trust boundary

- Athlete-facing workout result saves use `public.save_athlete_workout_result(...)` so the server calculates `is_pr` from prior same-movement history instead of trusting a browser-provided PR flag. Direct athlete insert/update policies require `is_pr is not true`; coaches can still manage PR flags directly.

## Workout status integrity

- Athlete workout status stays binary: `done` or no status. `public.set_athlete_workout_status(...)` rejects anything except `done` and checks `public.can_mark_workout_status(workout_id, athlete_id)` so athletes can only mark workouts that are class/everyone or assigned to them.
