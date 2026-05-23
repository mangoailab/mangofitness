# Mango Fitness Project Summary

## Repository

- Local path: `/Users/dev/Projects/mango-fitness`
- GitHub remote: `git@github.com:mangoailab/mangofitness.git`
- Main branch: `main`

## Main pages

- `index.html` — public landing page
- `admin.html` — coach portal / workout builder
- `coach-history.html` — coach progress history for all athletes
- `coach-benchmarks.html` — coach benchmark manager for test standards, categories, and leaderboard-visible items only
- `coach-movements.html` — coach movement library for non-benchmark exercises used in workouts/programs
- `athlete.html` — athlete portal / workouts and logging
- `athlete-history.html` — athlete progress history, scoped to signed-in athlete
- `athlete-metrics.html` — athlete body scan upload/history/charts
- `reset-password.html` — password reset

## Backend

- Backend: Supabase Auth + Postgres
- Supabase project ref: `tqjxossmqwmukeeycuua`
- Schema file: `supabase/schema-draft.sql`
- Existing-project RLS migration: `supabase/harden-rls.sql`

## Roles and privacy

- Coaches are identified by rows in `coach_profiles`.
- Lawrence is added as coach/admin with `lawrence.kam@outlook.com`.
- Coaches can view/manage all athletes and all progress history.
- Athletes should only see their own progress history, body scans, PRs, and assigned/class workouts.
- Athlete pages must not link to the coach portal.
- Coach pages do not need an Athlete portal link.

## Home page behavior

- Home page uses a Mango Loan-inspired layout with a larger hero/window, more mobile spacing, and separate Coach Portal / Athlete Portal button cards.

## Coach client management

- Coach portal Add Workout and Clients create flows use the collapsed full-width Add button pattern. Add Workout opens the workout builder; Add Client opens Create Client + Login, which creates the athlete profile and creates/links the Supabase Auth login in one step. Client edits happen inline inside each athlete card with its own Edit/Save controls. Client rows stay collapsed by default and include search to keep the page clean. Athlete Results are the single coach Progress page result view: tables grouped by movement, not stacked cards; the Progress Search/filter card sits at the top and filters those tables. Coach Saved Workouts show programs as the primary view: choose an athlete inside a program card to see that athlete’s logged reps, weights, scores, and notes in the same program layout. Coach Benchmarks manages leaderboard/test standards. Coach Movements manages non-benchmark exercises like Squat Back, Bench Press, Bench Press Dumbbell, and Deadlift for workouts/programs, with a Make Benchmark action when an exercise should move to benchmarks. On 2026-05-19, the live movement library was expanded with `supabase/standard-movements.sql`, adding 71 standard non-benchmark movements across strength, gymnastics, WOD, and cardio. Movement naming preference: use base movement first, then variation/equipment with spaces and no dash, e.g. `Bench Press Dumbbell`, `Squat Back`, `Deadlift Romanian`.
- Coach Saved Workouts month calendar: tapping a day opens the program window; tapping outside closes it. Press-and-hold opens compact icon actions for copy, move, and paste. Keep those actions small/icon-based rather than full text buttons.
- Client cards include athlete login tools, similar to Mango Loan borrower portal tools: Create Login, Find & Link Existing User, and Set Temporary Password. These call the deployed `create-athlete-user` Supabase Edge Function so coaches do not need to manually copy Auth user IDs for normal setup.

## Progress history behavior

- Athlete and coach progress history should stay clean by default: search/type filters and a compact movement overview table, not stacked cards. Expanded athlete strength rows should group same-workout/same-date sets into one workout session, e.g. Bent Over Row shows Set 1 / Set 2 / Set 3 together instead of looking like unrelated logs. Charts should still use the best/heaviest strength result per date. Avoid extra top-level summary stat boxes unless Lawrence asks for them.
- Athlete strength logging should reduce repeated typing and avoid missed saves: set 1 weight auto-fills empty later sets, athletes can tap a suggested weight, logged result fields autosave after typing pauses, and percentage prescriptions like `75%` use estimated 1RM from prior logged weights/reps when available. If no percent exists, prefer programmed target weight, then the athlete's last-used weight. Keep the Log result button as a manual backup.
- Programmed workouts can be marked by athletes as Done using `athlete_workout_statuses` / `public.set_athlete_workout_status`; clicking Workout done again clears it through `public.clear_athlete_workout_status`. Do not show or support Skip in the athlete flow; if a workout is not marked done, treat it as not completed. Status is separate from performance results so it does not create fake logs.
- Athlete-created workout logs are supported for vacation/open-gym/extra work through `public.save_athlete_self_workout`. Athletes can delete only their own athlete-created workouts through `public.delete_athlete_self_workout`; coach-programmed workouts must not show a delete option in athlete UI. These workouts use `assignment_type = 'athlete_created'`, are assigned only to the signed-in athlete, and should be visually distinct from coach programs with the blue/purple self-workout treatment. Athlete-created workouts can contain multiple optional pieces. The form starts empty/collapsed so athletes choose what to add: swim/cardio/WOD only, one strength movement, multiple strength movements, or both. Strength pieces support multiple sets with reps and weight. Swim, cardio/endurance, and WOD pieces each show type-specific fields and then save into compatible workout exercise/result rows. Do not ask athletes to mark PRs in this flow; the app should automatically mark clear PRs when a new log beats prior same-movement history, e.g. Row 2K 7:30 beating prior 8:00.
- Athlete Progress History includes Add Past Benchmark for self-reported historical entries. Athletes can only choose existing coach-managed benchmark movements; the save goes through `public.save_historical_benchmark` and labels notes as self-reported historical benchmark entries.
- Coach/admin pages must require a `coach_profiles` row for the signed-in Auth user. Athlete accounts should see “Coach access required” instead of the coach dashboard, clients page, or coach progress history.
- Forgot Password should follow Mango Loan's preferred pattern: open a separate reset-email card with its own email field, prefilled from sign-in if available, then send the reset link. Do not depend on the sign-in email field alone.

## Current navigation behavior

Athlete pages use fixed nav links:

- Home
- Athlete portal
- Body metrics
- Progress history
- Sign out

The current page remains visible and is slightly bolded, with no bubble/pill styling.

Coach pages use fixed nav links:

- Home
- Coach portal
- Clients
- Benchmarks
- Movements
- Progress history
- Sign out

The current page remains visible and is slightly bolded, with no bubble/pill styling.

- Cardio/WOD programming supports real-world option choices. Coaches can add multiple cardio options such as Row tester and 400m x 4. For interval work, set the Splits count and Split label; athletes enter each split and see an auto-summed total.
