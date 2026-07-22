-- MID3 Career — profiles: nickname, card, rackets, match edits
-- Rode no SQL Editor após migration_classic_structure.sql

-- Perfil expandido
alter table public.profiles
  add column if not exists nickname text;

alter table public.profiles
  add column if not exists name_changes_used integer not null default 0;

alter table public.profiles
  add column if not exists name_changes_max integer not null default 3;

alter table public.profiles
  add column if not exists nickname_changed_at timestamptz;

alter table public.profiles
  add column if not exists avatar_id text not null default 'initial';

alter table public.profiles
  add column if not exists height_cm integer;

alter table public.profiles
  add column if not exists age integer;

alter table public.profiles
  add column if not exists backhand text;

alter table public.profiles
  add column if not exists rackets text[] not null default '{}';

alter table public.profiles
  add column if not exists primary_racket text;

-- Unicidade de nickname (permite null nos legados até escolherem)
create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname))
  where nickname is not null;

alter table public.profiles
  drop constraint if exists profiles_avatar_check;

alter table public.profiles
  add constraint profiles_avatar_check
  check (avatar_id in ('ball', 'racket', 'crossed', 'initial'));

alter table public.profiles
  drop constraint if exists profiles_backhand_check;

alter table public.profiles
  add constraint profiles_backhand_check
  check (
    backhand is null
    or backhand in ('one_handed', 'two_handed')
  );

alter table public.profiles
  drop constraint if exists profiles_height_check;

alter table public.profiles
  add constraint profiles_height_check
  check (height_cm is null or (height_cm >= 120 and height_cm <= 230));

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check
  check (age is null or (age >= 10 and age <= 90));

-- Raquetes no set
alter table public.matches
  add column if not exists racket_a text;

alter table public.matches
  add column if not exists racket_b text;

-- Pedidos de edição de set
create table if not exists public.match_edit_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  requested_by_id uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_id uuid references public.profiles (id)
);

create index if not exists match_edit_requests_match_idx
  on public.match_edit_requests (match_id);

create index if not exists match_edit_requests_status_idx
  on public.match_edit_requests (status);

alter table public.match_edit_requests enable row level security;

drop policy if exists "match_edits_select" on public.match_edit_requests;
create policy "match_edits_select" on public.match_edit_requests
  for select to authenticated using (true);

drop policy if exists "match_edits_insert" on public.match_edit_requests;
create policy "match_edits_insert" on public.match_edit_requests
  for insert to authenticated
  with check (requested_by_id = auth.uid());

drop policy if exists "match_edits_update" on public.match_edit_requests;
create policy "match_edits_update" on public.match_edit_requests
  for update to authenticated
  using (true)
  with check (true);

-- Novos usuários: max 2 trocas de nome (legado fica 3 via default da coluna)
-- Trigger de signup: preenche nickname opcional via metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  key_name text;
  nick text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  key_name := lower(regexp_replace(display_name, '\s+', ' ', 'g'));
  nick := nullif(lower(trim(new.raw_user_meta_data ->> 'nickname')), '');

  insert into public.profiles (
    id, name, name_key, nickname, name_changes_max, avatar_id
  )
  values (
    new.id,
    display_name,
    key_name,
    nick,
    2,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'avatar_id'), ''), 'initial')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
