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
