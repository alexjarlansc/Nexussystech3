-- Allow Administrador Mestre to update companies (needed to adjust user_quota)
-- Date: 2025-10-19
begin;

-- helper function to detect master
create or replace function public.is_master()
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and lower(coalesce(p.role, '')) in ('master','mestre','owner')
  );
$$;

-- ensure RLS is enabled
alter table if exists public.companies enable row level security;

-- allow master to update companies (app constrains what is changed; primarily user_quota)
create policy if not exists "Companies update (master)" on public.companies
for update
using (public.is_master())
with check (public.is_master());

commit;