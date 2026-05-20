# Mango Fitness Todo / Open Questions

## Verify

- Confirm coach login still works after RLS hardening.
- Confirm athlete login sees only assigned/class workouts and own progress history.
- Confirm body scan upload/history still works for an athlete after RLS hardening.

## Future improvements

- Add clearer coach/admin management flow for assigning coach users.
- Add a secure Supabase Edge Function or backend endpoint for coaches to create/invite athlete Auth users from the Clients page without exposing a service-role key in the browser.
- Add lightweight browser/manual test checklist before every push.
- Improve InBody PDF parsing further using actual PDF text/layout, especially scan date, weight, SMM, and PBF.
- Continue refining the split between coach Movements and Benchmarks; Movements now owns non-benchmark exercises, while Benchmarks owns leaderboard/test standards.

## Security follow-up

- After applying `supabase/loggable-result-rls.sql` in Supabase, manually verify: athlete can log an assigned/everyone workout, athlete cannot log a workout exercise from another athlete's individual workout, and coach result management still works.

## Body scan parser follow-up

- Confirm signed-in athlete body scan parsing still works from the UI after the `parse-body-scan` auth hardening deploy.

## PR verification follow-up

- Manually verify programmed workout logging still autosaves, a clear same-movement strength/time PR is marked by the server, and a direct athlete table write with `is_pr = true` is rejected.

## Workout status verification follow-up

- Manually verify an athlete can mark/clear Done on an assigned/everyone workout, cannot mark an unassigned individual workout by UUID, and direct `athlete_workout_statuses` writes with `status = 'skipped'` are rejected.
