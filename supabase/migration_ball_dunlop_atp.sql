-- Inclui Dunlop ATP nas bolas permitidas
alter table public.matches drop constraint if exists matches_ball_check;

alter table public.matches
  add constraint matches_ball_check check (
    ball is null
    or ball in (
      'inni_tournament',
      'inni_clay',
      'wilson_rg',
      'wilson_us_open',
      'dunlop_atp'
    )
  );
