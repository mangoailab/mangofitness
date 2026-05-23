# Mango Fitness

Mango Fitness is a coach + athlete workout tracking app.

## MVP

Coach/admin can:
- Sign in
- Create weekly training programs
- Assign workouts to athletes
- Add daily workout details
- View athlete progress over time

Athletes can:
- Sign in
- See today’s workout
- Enter working weights
- Enter PRs
- Track progress history

## Planned pages

- `index.html` — landing page
- `admin.html` — coach/admin dashboard
- `athlete.html` — athlete portal
- `reset-password.html` — password reset

## Backend

Backend: Supabase Auth + Postgres.

To create/update the MVP database, apply:

```sql
supabase/schema-draft.sql
```

Main tables:
- `athletes`
- `programs`
- `workouts`
- `workout_exercises`
- `athlete_workout_results`
- `athlete_prs`

Current behavior:
- Coach dashboard saves workouts and exercises to Supabase.
- Athlete portal reads visible workouts and writes results for the signed-in athlete.
- RLS is scoped by role: coaches are listed in `coach_profiles`; athletes can only access their own profile/results/scans plus visible workouts.

To harden an existing Supabase project, apply:

```sql
supabase/harden-rls.sql
```

Before applying, create/link the coach Auth user and add that user to `coach_profiles`, otherwise the coach portal will be locked out by design.

## Edge Functions

AI-backed features run through Supabase Edge Functions so API keys stay server-side.

- `parse-body-scan` parses body scan uploads.
- `program-workout` drafts and improves coach workout builder programs.

Required function secrets:

```sh
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
