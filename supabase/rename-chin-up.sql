-- Rename Chin-Up using the movement naming convention while keeping the stable movement_key.

update public.strength_movements
set name = 'Pull-Up Supinated Grip',
    description = 'Supinated-grip pull-up.'
where movement_key = 'chin-up';
