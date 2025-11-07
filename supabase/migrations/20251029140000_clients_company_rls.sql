-- Ensure multi-tenant isolation for public.clients via RLS policies
-- Idempotent migration: safe to re-run

-- 1) Add company_id column if missing
ALTER TABLE IF EXISTS public.clients ADD COLUMN IF NOT EXISTS company_id uuid NULL REFERENCES public.companies(id);

-- 2) Enable RLS
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;

-- 3) Recreate policies for clients
DROP POLICY IF EXISTS clients_select_company ON public.clients;
DROP POLICY IF EXISTS clients_insert_company ON public.clients;
DROP POLICY IF EXISTS clients_update_company ON public.clients;
DROP POLICY IF EXISTS clients_delete_company ON public.clients;

-- SELECT: allow master admins or users in same company
CREATE POLICY clients_select_company ON public.clients
  FOR SELECT
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = public.clients.company_id
      )
    )
  );

-- INSERT: allow master admins or any authenticated user whose profile.company_id matches the inserted company_id
CREATE POLICY clients_insert_company ON public.clients
  FOR INSERT WITH CHECK (
    public.admin_is_master() OR (
      company_id IS NOT NULL AND company_id = (
        SELECT p.company_id FROM public.profiles p WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
      )
    )
  );

-- UPDATE: allow master admins or users in same company
CREATE POLICY clients_update_company ON public.clients
  FOR UPDATE
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = public.clients.company_id
      )
    )
  );

-- DELETE: allow master admins or users in same company
CREATE POLICY clients_delete_company ON public.clients
  FOR DELETE
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = public.clients.company_id
      )
    )
  );

-- Optional checks (run after applying):
-- SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='clients';
-- SELECT id, name, company_id FROM public.clients LIMIT 50;
-- SELECT id, user_id, company_id FROM public.profiles WHERE user_id = '<USER_UUID>'::uuid;
