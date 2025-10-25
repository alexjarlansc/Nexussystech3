-- Broaden first-company INSERT to users (not only admins)
-- Users or admins without a company may insert one company.

alter table if exists public.companies enable row level security;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Companies insert (admin first company)'
  ) THEN
    EXECUTE 'drop policy "Companies insert (admin first company)" on public.companies';
  END IF;

  EXECUTE 'create policy "Companies insert (first company)" on public.companies
           for insert to authenticated
           with check (
             exists (
               select 1 from public.profiles p
               where p.user_id = auth.uid()
                 and (p.role = ''admin'' or p.role = ''user'')
                 and p.company_id is null
             )
           )';
END $$;
