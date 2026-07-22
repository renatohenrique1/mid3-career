-- Permite participantes atualizarem um set (ex.: aprovação de edição)
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
