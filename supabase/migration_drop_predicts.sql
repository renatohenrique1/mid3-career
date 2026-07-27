-- Remove mini-game de previsões ATP (se a migration anterior foi aplicada).
drop table if exists public.predict_picks cascade;
drop table if exists public.predict_events cascade;
