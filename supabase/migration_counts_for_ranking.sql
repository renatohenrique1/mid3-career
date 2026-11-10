-- Sets fora do ranking. O default true mantém os sets já registrados contando.
alter table public.matches
  add column if not exists counts_for_ranking boolean not null default true;
