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

Planned backend: Supabase Auth + Postgres.

Main tables planned:
- `athletes`
- `programs`
- `program_weeks`
- `workouts`
- `workout_exercises`
- `athlete_workout_results`
- `athlete_prs`
