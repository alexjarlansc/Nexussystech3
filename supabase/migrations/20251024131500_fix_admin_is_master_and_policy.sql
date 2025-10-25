-- Make admin_is_master() delegate to is_master() and refresh the master insert policy

-- Ensure helper is tolerant
create or replace function public.admin_is_master()
returns boolean language sql stable as $$
  select coalesce(public.is_master(), false);
$$;

-- Recreate master insert policy to use the updated helper (idempotent drop/create)
alter table if exists public.companies enable row level security;

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
