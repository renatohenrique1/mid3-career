-- MID3 Career — migration: estrutura clássica + datas
-- Rode no SQL Editor do Supabase se o projeto já existia antes desta mudança.

alter table public.tournaments
  add column if not exists structure text;

alter table public.tournaments
  add column if not exists starts_on date;

alter table public.tournaments
  add column if not exists ends_on date;

-- Remove constraint antiga se existir e recria
alter table public.tournaments
  drop constraint if exists tournaments_structure_check;

alter table public.tournaments
  add constraint tournaments_structure_check
  check (
    structure is null
    or structure in ('round_robin', 'points_league', 'round_robin_double')
  );

alter table public.tournaments
  drop constraint if exists tournaments_dates_check;

alter table public.tournaments
  add constraint tournaments_dates_check
  check (
    starts_on is null
    or ends_on is null
    or ends_on >= starts_on
  );
