-- Ensure multi-tenant isolation for public.clients via RLS policies
-- This migration is idempotent and safe to re-run.

-- 1) Add company_id if missing (nullable, reference companies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'company_id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.clients ADD COLUMN company_id uuid NULL REFERENCES public.companies(id)';
    EXCEPTION WHEN undefined_table THEN
      -- table doesn't exist in this environment; no-op
      NULL;
    END;
  END IF;
END$$;

-- 2) Enable RLS
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN undefined_table THEN
    NULL; -- table not present; skip
  END;
END $$;

-- 3) Policies: members of the same company can read/manage; master bypasses
-- Profiles SELECT policy already exists in a separate migration to allow subqueries.
DO $$
BEGIN
  -- SELECT
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='clients_select_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $$CREATE POLICY clients_select_company ON public.clients FOR SELECT USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.company_id = clients.company_id
        )
      )$$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- INSERT
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='clients_insert_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $$CREATE POLICY clients_insert_company ON public.clients FOR INSERT WITH CHECK (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.company_id = clients.company_id
        )
      )$$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- UPDATE
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='clients_update_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $$CREATE POLICY clients_update_company ON public.clients FOR UPDATE USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.company_id = clients.company_id
        )
      )$$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  -- DELETE
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='clients_delete_company';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE $$CREATE POLICY clients_delete_company ON public.clients FOR DELETE USING (
        public.admin_is_master() OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.company_id = clients.company_id
        )
      )$$;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;
END $$;
