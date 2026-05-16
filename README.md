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

Current MVP behavior:
- Coach dashboard saves workouts and exercises to Supabase.
- Athlete portal reads workouts from Supabase and writes results to Supabase.
- RLS policies are intentionally permissive for signed-in users while the prototype is being built. Tighten these before production.
