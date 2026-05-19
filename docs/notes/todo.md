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

## Next session notes — 2026-05-18

- Confirmed Alex demo athlete login works: `alex.demo@mangofitness.local` with temporary demo password `AlexDemo2026!`.
- In Athlete Portal, confirm previous-history suggestions appear for Alex on matching movements such as Backsquat, Incline Chest press, and Pull up.
- Recheck coach-only guard: Lawrence said Alex “can login into coach”; DB check showed Alex auth user is not in `coach_profiles`, so clarify whether this meant “can’t” or if a stale coach session/cache was involved.
- Confirmed Mango Loan-style forgot-password separate reset-email card works.
