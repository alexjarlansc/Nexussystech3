-- Allow 'admin' to INSERT a first company when they don't belong to any company (idempotent)
-- Keeps 'master' insertion allowed by existing policy; this only covers the self-serve first company case.

-- Ensure RLS is enabled
alter table if exists public.companies enable row level security;

-- Create or replace the policy that allows admins with no company to insert one company
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Companies insert (admin first company)'
  ) THEN
    EXECUTE 'drop policy "Companies insert (admin first company)" on public.companies';
  END IF;

  -- Admins can insert only if they are not yet associated to any company
  EXECUTE 'create policy "Companies insert (admin first company)" on public.companies
           for insert to authenticated
           with check (
             exists (
               select 1 from public.profiles p
               where p.user_id = auth.uid()
                 and p.role = ''admin''
                 and p.company_id is null
             )
           )';
END $$;
