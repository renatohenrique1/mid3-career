-- MID3 Career — schema Supabase
-- Cole no SQL Editor do projeto (Dashboard → SQL → New query) e rode uma vez.
-- Depois: Authentication → Providers → Email → desative "Confirm email".

-- Extensão para UUID (já costuma existir no Supabase)
create extension if not exists "pgcrypto";

-- Perfis (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  name_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists profiles_name_key_idx on public.profiles (name_key);

-- Torneios
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'finished')),
  format text not null default 'classic'
    check (format in ('classic', 'tb', 'fh', 'bh', 'fifteen_forty')),
  structure text
    check (
      structure is null
      or structure in ('round_robin', 'points_league', 'round_robin_double')
    ),
  starts_on date,
  ends_on date,
  winner_id uuid references public.profiles (id),
  finished_at timestamptz,
  check (
    starts_on is null
    or ends_on is null
    or ends_on >= starts_on
  )
);

create index if not exists tournaments_created_at_idx
  on public.tournaments (created_at desc);

-- Participantes
create table if not exists public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

-- Sets (torneio ou avulso)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments (id) on delete set null,
  match_date date not null,
  surface text not null check (surface in ('hard', 'clay')),
  player_a_id uuid not null references public.profiles (id),
  player_b_id uuid not null references public.profiles (id),
  games_a integer not null check (games_a >= 0),
  games_b integer not null check (games_b >= 0),
  duration_minutes integer check (
    duration_minutes is null
    or (duration_minutes > 0 and duration_minutes <= 600)
  ),
  ball text check (
    ball is null
    or ball in (
      'inni_tournament',
      'inni_clay',
      'wilson_rg',
      'wilson_us_open'
    )
  ),
  created_at timestamptz not null default now(),
  recorded_by_id uuid not null references public.profiles (id),
  check (player_a_id <> player_b_id),
  check (games_a <> games_b)
);

create index if not exists matches_created_at_idx
  on public.matches (created_at desc);
create index if not exists matches_tournament_id_idx
  on public.matches (tournament_id);

-- Cria profile automaticamente no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  key_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  key_name := lower(regexp_replace(display_name, '\s+', ' ', 'g'));

  insert into public.profiles (id, name, name_key)
  values (new.id, display_name, key_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.matches enable row level security;

-- Grupo pequeno: autenticados leem tudo; escritas com regras simples
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "tournaments_select" on public.tournaments;
create policy "tournaments_select" on public.tournaments
  for select to authenticated using (true);

drop policy if exists "tournaments_insert" on public.tournaments;
create policy "tournaments_insert" on public.tournaments
  for insert to authenticated
  with check (auth.uid() = created_by_id);

drop policy if exists "tournaments_update" on public.tournaments;
create policy "tournaments_update" on public.tournaments
  for update to authenticated
  using (auth.uid() = created_by_id)
  with check (auth.uid() = created_by_id);

drop policy if exists "participants_select" on public.tournament_participants;
create policy "participants_select" on public.tournament_participants
  for select to authenticated using (true);

drop policy if exists "participants_insert" on public.tournament_participants;
create policy "participants_insert" on public.tournament_participants
  for insert to authenticated
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by_id = auth.uid()
    )
  );

drop policy if exists "matches_select" on public.matches;
create policy "matches_select" on public.matches
  for select to authenticated using (true);

drop policy if exists "matches_insert" on public.matches;
create policy "matches_insert" on public.matches
  for insert to authenticated
  with check (auth.uid() = recorded_by_id);

drop policy if exists "matches_delete" on public.matches;
create policy "matches_delete" on public.matches
  for delete to authenticated
  using (auth.uid() = recorded_by_id);

drop policy if exists "matches_update_participants" on public.matches;
create policy "matches_update_participants" on public.matches
  for update to authenticated
  using (
    auth.uid() = player_a_id
    or auth.uid() = player_b_id
    or auth.uid() = recorded_by_id
  )
  with check (
    auth.uid() = player_a_id
    or auth.uid() = player_b_id
    or auth.uid() = recorded_by_id
  );
