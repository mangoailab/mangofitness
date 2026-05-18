# Mango Fitness Project Summary

## Repository

- Local path: `/Users/dev/Projects/mango-fitness`
- GitHub remote: `git@github.com:mangoailab/mangofitness.git`
- Main branch: `main`

## Main pages

- `index.html` — public landing page
- `admin.html` — coach portal / workout builder
- `coach-history.html` — coach progress history for all athletes
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

- Coach portal Add Workout and Clients create flows use the collapsed full-width Add button pattern. Add Workout opens the workout builder; Add Client opens Create Client + Login, which creates the athlete profile and creates/links the Supabase Auth login in one step. Client edits happen inline inside each athlete card with its own Edit/Save controls. Client rows stay collapsed by default and include search to keep the page clean. Athlete Results live on the Coach Progress History page, not the workout builder page; the Progress Search/filter card sits at the top of the Progress page.
- Client cards include athlete login tools, similar to Mango Loan borrower portal tools: Create Login, Find & Link Existing User, and Set Temporary Password. These call the deployed `create-athlete-user` Supabase Edge Function so coaches do not need to manually copy Auth user IDs for normal setup.

## Progress history behavior

- Athlete and coach progress history should stay clean by default: search/type filters and a compact movement overview table, not stacked cards. Expanded rows should show a chart plus Date/Score/Notes for cardio or Date/Weight/Reps/Set/Notes for strength so logs like Back Squat @ 8 reps are clear. Avoid extra top-level summary stat boxes unless Lawrence asks for them.
- Athlete strength logging should reduce repeated typing: set 1 weight auto-fills empty later sets, athletes can tap a suggested weight, and percentage prescriptions like `75%` use estimated 1RM from prior logged weights/reps when available. If no percent exists, prefer programmed target weight, then the athlete's last-used weight.
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
- Progress history
- Sign out

The current page remains visible and is slightly bolded, with no bubble/pill styling.
