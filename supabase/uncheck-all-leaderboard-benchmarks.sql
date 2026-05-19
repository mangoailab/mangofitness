-- Uncheck all benchmark movements from the athlete leaderboard.
-- Keeps movement/benchmark records intact; only disables leaderboard visibility.

update public.strength_movements
set show_on_leaderboard = false
where show_on_leaderboard = true;
