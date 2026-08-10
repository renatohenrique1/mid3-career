-- Placar do tie-break em sets clássicos 7–6
alter table public.matches
  add column if not exists tiebreak_a integer
    check (tiebreak_a is null or tiebreak_a >= 0);

alter table public.matches
  add column if not exists tiebreak_b integer
    check (tiebreak_b is null or tiebreak_b >= 0);
