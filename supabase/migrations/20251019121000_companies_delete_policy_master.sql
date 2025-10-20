-- Allow only 'master' to DELETE (and optionally UPDATE) companies via RLS
-- Idempotent: (re)create helper and policies safely

-- Helper: check if current auth user is MASTER
create or replace function public.admin_is_master()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'master'
  );
$$;

-- Ensure RLS is enabled (no-op if already enabled)
alter table public.companies enable row level security;

-- DELETE policy for MASTER
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'companies' and policyname = 'Companies delete (master)'
  ) then
    execute 'drop policy "Companies delete (master)" on public.companies';
  end if;
  execute 'create policy "Companies delete (master)" on public.companies for delete using (public.admin_is_master())';
end $$;

-- UPDATE policy for MASTER (to allow suspend/edits globally)
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'companies' and policyname = 'Companies update (master)'
  ) then
    execute 'drop policy "Companies update (master)" on public.companies';
  end if;
  execute 'create policy "Companies update (master)" on public.companies for update using (public.admin_is_master())';
end $$;
