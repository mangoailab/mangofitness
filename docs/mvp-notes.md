# Mango Fitness MVP Notes

## Roles

### Coach/Admin
The coach logs in and manages training.

Core actions:
1. Create athlete accounts
2. Create weekly programs
3. Add daily workouts
4. Assign workouts/programs to athletes
5. Review athlete working weights, PRs, and progress

### Athlete
The athlete logs in and sees only their own training.

Core actions:
1. View today’s workout
2. Enter working weight for each exercise
3. Enter results/notes
4. Record PRs
5. View progress over time

## Workout data needed

Each workout can include:
- Date
- Day title, e.g. Monday Lower Body
- Exercise name
- Sets
- Reps
- Target weight or percentage
- RPE / effort target
- Notes

Each athlete result can include:
- Completed weight
- Reps completed
- PR checkbox/value
- Notes
- Date completed

## UI preference

Match related pages exactly where possible. Reuse shared CSS early instead of copying styles manually page by page.
