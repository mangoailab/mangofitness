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

## Historical benchmark system workout

- `public.save_historical_benchmark(...)` reuses one `Historical Benchmarks` system workout instead of inserting blindly. The placeholder workout uses `assignment_type = 'system_history'`, and normal app workout queries exclude `system_history` so it does not appear as a class/athlete workout.

## Cardio options and split logging

- Coach-programmed cardio can include multiple options inside the Cardio / WOD section. Athlete UI frames multiple cardio rows as “Choose the cardio option you did.” Interval options use the cardio row `Splits` count and `Split label` fields, then athletes log each split and the app auto-sums the total time.

## Athlete cardio option UI

- When a workout has multiple cardio options, the athlete UI should be choose-first: show compact option cards with Choose/Selected buttons, expand only the selected option's logging fields, and keep any already-logged option selected when returning.
- Athlete-created cardio logging should explicitly include swim language because some athletes are swimmers. Keep swim/endurance pieces in the cardio data section, but the self-log form must let the athlete choose Swim, Cardio/endurance, or WOD and show fields that fit that type: swim distance/stroke/pool/pace, cardio modality/distance/score, or WOD format/result.
- After an athlete saves a self-created workout or "own cardio" log, the athlete page should select the newly created workout before refreshing so the saved entry remains visible instead of returning to the prior program card.
- Partner WOD team-result forms must reload their existing result id, score, and notes after save. Without that, autosave creates data but the rerendered partner form looks blank and later edits can insert duplicates instead of updating the original row.

## Split time mobile entry

- Athlete split logging should use separate minute and second number inputs instead of requiring a colon in one field, because mobile keyboards may not show an easy minute/colon option.

## Split total behavior

- Split total should be calculated from all visible minute/second rows using form elements directly. Store the calculated total only once on the first split row notes, and strip old `Total:` fragments before saving to avoid duplicated total text.
