-- Combined migration: allow all authenticated users to create product_groups for their company
-- Idempotent and safe to run in SQL editor

-- 1) Ensure profiles SELECT policy that allows the caller to read their profile
-- (drop/create to support PG versions that don't support CREATE POLICY IF NOT EXISTS)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT
  USING (
    -- match caller either by user_id (uuid) or id
    user_id = auth.uid()::uuid OR id = auth.uid()::uuid
  );

-- 2) Ensure product_groups has company_id and enable RLS
ALTER TABLE IF EXISTS public.product_groups ADD COLUMN IF NOT EXISTS company_id uuid NULL REFERENCES public.companies(id);
ALTER TABLE IF EXISTS public.product_groups ENABLE ROW LEVEL SECURITY;

-- 3) Recreate robust policies on product_groups
DROP POLICY IF EXISTS product_groups_select_company ON public.product_groups;
DROP POLICY IF EXISTS product_groups_insert_company ON public.product_groups;
DROP POLICY IF EXISTS product_groups_update_company ON public.product_groups;
DROP POLICY IF EXISTS product_groups_delete_company ON public.product_groups;

-- SELECT: allow master admins or users in same company
CREATE POLICY product_groups_select_company ON public.product_groups
  FOR SELECT
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = product_groups.company_id
      )
    )
  );

-- INSERT: allow master admins or any authenticated user whose profile.company_id matches NEW.company_id
CREATE POLICY product_groups_insert_company ON public.product_groups
  FOR INSERT WITH CHECK (
    public.admin_is_master() OR (
      company_id IS NOT NULL AND company_id = (
        SELECT p.company_id FROM public.profiles p WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
      )
    )
  );

-- UPDATE: allow master admins or users in same company
CREATE POLICY product_groups_update_company ON public.product_groups
  FOR UPDATE
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = product_groups.company_id
      )
    )
  );

-- DELETE: allow master admins or users in same company
CREATE POLICY product_groups_delete_company ON public.product_groups
  FOR DELETE
  USING (
    public.admin_is_master() OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.user_id = auth.uid()::uuid OR p.id = auth.uid()::uuid)
          AND p.company_id = product_groups.company_id
      )
    )
  );

-- 4) Quick sanity queries (optional to run after applying):
-- SELECT policy names
-- SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='product_groups';

-- Check a user's profile and company
-- SELECT * FROM public.profiles WHERE user_id = '<UID>'::uuid;

-- Test if the profile-company subselect returns a value
-- SELECT (SELECT p.company_id FROM public.profiles p WHERE p.user_id = '<UID>'::uuid) AS profile_company;

-- End of migration
