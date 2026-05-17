# Mango Fitness Decisions

## UI/navigation

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
