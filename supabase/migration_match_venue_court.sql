-- Local e quadra do set
alter table public.matches
  add column if not exists venue text
  check (
    venue is null
    or venue in (
      'ceret',
      'ibirapuera',
      'parque_manchester',
      'parque_da_mooca'
    )
  );

alter table public.matches
  add column if not exists court text
  check (
    court is null
    or court in ('coliseu', 'anexa', 'rachadura', 'saibro')
  );
