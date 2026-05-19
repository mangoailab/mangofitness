-- Movement naming cleanup: base movement first, variation/equipment after it, no dash.
-- Keeps existing movement_key values stable so workout history and references do not break.

update public.strength_movements
set name = case movement_key
  when 'back-squat' then 'Squat Back'
  when 'front-squat' then 'Squat Front'
  when 'dumbbell-bench-press' then 'Bench Press Dumbbell'
  when 'incline-chest-press' then 'Chest Press Incline'
  when 'incline-db-chest-press' then 'Chest Press Incline Dumbbell'
  when 'incline-dumbbell-press' then 'Chest Press Incline Dumbbell'
  when 'incline-close-grip-press' then 'Chest Press Incline Close Grip'
  when 'seated-shoulder-press' then 'Shoulder Press Seated'
  when 'romanian-deadlift' then 'Deadlift Romanian'
  when 'dumbbell-row' then 'Row Dumbbell'
  when 'ring-row' then 'Row Ring'
  when 'dumbbell-clean' then 'Clean Dumbbell'
  when 'dumbbell-snatch' then 'Snatch Dumbbell'
  when 'dumbbell-thruster' then 'Thruster Dumbbell'
  when 'dumbbell-lunge' then 'Lunge Dumbbell'
  when 'front-dumbbell-lunge' then 'Lunge Front Dumbbell'
  else name
end
where movement_key in (
  'back-squat',
  'front-squat',
  'dumbbell-bench-press',
  'incline-chest-press',
  'incline-db-chest-press',
  'incline-dumbbell-press',
  'incline-close-grip-press',
  'seated-shoulder-press',
  'romanian-deadlift',
  'dumbbell-row',
  'ring-row',
  'dumbbell-clean',
  'dumbbell-snatch',
  'dumbbell-thruster',
  'dumbbell-lunge',
  'front-dumbbell-lunge'
);
