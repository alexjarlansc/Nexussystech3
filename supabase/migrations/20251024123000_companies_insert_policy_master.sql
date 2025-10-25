-- Allow only 'master' to INSERT companies via RLS (idempotent)
-- This aligns with the ERP UI: somente Administrador Mestre pode criar empresas.

-- Ensure helper exists
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
alter table if exists public.companies enable row level security;

-- INSERT policy for MASTER
-- Drop-and-create to be idempotent on re-apply
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Companies insert (master)'
  ) THEN
    EXECUTE 'drop policy "Companies insert (master)" on public.companies';
  END IF;
  EXECUTE 'create policy "Companies insert (master)" on public.companies for insert to authenticated with check (public.admin_is_master())';
END $$;
