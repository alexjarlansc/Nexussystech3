-- Ensure multi-tenant isolation for public.product_groups via RLS policies
-- Idempotent migration: safe to re-run

-- 1) Add company_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_groups' AND column_name = 'company_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.product_groups ADD COLUMN company_id uuid NULL REFERENCES public.companies(id)';
    EXCEPTION WHEN undefined_table THEN
      -- table doesn't exist; no-op
      NULL;
    END;
  END IF;
END$$;

-- 2) Enable RLS
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN undefined_table THEN NULL; -- skip if table absent
  END;
END $$;

-- 3) Create/select policies
DO $$
BEGIN
  -- SELECT
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_groups' AND policyname='product_groups_select_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $policy$CREATE POLICY product_groups_select_company ON public.product_groups FOR SELECT USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()::uuid
            AND p.company_id = product_groups.company_id
        )
      )$policy$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- INSERT
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_groups' AND policyname='product_groups_insert_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $policy$CREATE POLICY product_groups_insert_company ON public.product_groups FOR INSERT WITH CHECK (
        public.admin_is_master() OR (
          company_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()::uuid
              AND p.company_id = company_id
          )
        )
      )$policy$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- UPDATE
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_groups' AND policyname='product_groups_update_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $policy$CREATE POLICY product_groups_update_company ON public.product_groups FOR UPDATE USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()::uuid
            AND p.company_id = product_groups.company_id
        )
      )$policy$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- DELETE
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_groups' AND policyname='product_groups_delete_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $policy$CREATE POLICY product_groups_delete_company ON public.product_groups FOR DELETE USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()::uuid
            AND p.company_id = product_groups.company_id
        )
      )$policy$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;
END $$;
