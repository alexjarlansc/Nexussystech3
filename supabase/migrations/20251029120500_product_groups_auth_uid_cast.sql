-- Fix product_groups policies to cast auth.uid() to uuid
-- Idempotent: drop existing policies and recreate with auth.uid()::uuid

DO $$
BEGIN
  -- Ensure table exists and RLS enabled
  BEGIN
    EXECUTE 'ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Drop existing policies if present (safe)
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS product_groups_select_company ON public.product_groups';
    EXECUTE 'DROP POLICY IF EXISTS product_groups_insert_company ON public.product_groups';
    EXECUTE 'DROP POLICY IF EXISTS product_groups_update_company ON public.product_groups';
    EXECUTE 'DROP POLICY IF EXISTS product_groups_delete_company ON public.product_groups';
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Recreate SELECT policy using auth.uid()::uuid
  BEGIN
    EXECUTE $policy$CREATE POLICY product_groups_select_company ON public.product_groups FOR SELECT USING (
      public.admin_is_master() OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()::uuid
          AND p.company_id = product_groups.company_id
      )
    )$policy$;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Recreate INSERT policy using auth.uid()::uuid
  -- Use direct equality to the caller's profile.company_id to avoid permission issues with EXISTS subqueries
  BEGIN
    EXECUTE $policy$CREATE POLICY product_groups_insert_company ON public.product_groups FOR INSERT WITH CHECK (
      public.admin_is_master() OR (
        company_id IS NOT NULL AND company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()::uuid
        )
      )
    )$policy$;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Recreate UPDATE policy using auth.uid()::uuid
  BEGIN
    EXECUTE $policy$CREATE POLICY product_groups_update_company ON public.product_groups FOR UPDATE USING (
      public.admin_is_master() OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()::uuid
          AND p.company_id = product_groups.company_id
      )
    )$policy$;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Recreate DELETE policy using auth.uid()::uuid
  BEGIN
    EXECUTE $policy$CREATE POLICY product_groups_delete_company ON public.product_groups FOR DELETE USING (
      public.admin_is_master() OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()::uuid
          AND p.company_id = product_groups.company_id
      )
    )$policy$;
  EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;