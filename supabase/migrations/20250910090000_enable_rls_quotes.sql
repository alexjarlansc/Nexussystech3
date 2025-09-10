-- Enable RLS and create company-scoped policies for quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quotes') THEN
    RAISE NOTICE 'table quotes not found, skipping RLS setup';
    RETURN;
  END IF;
END$$;

-- enable row level security
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- allow admins to manage all
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'Admins manage quotes') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage quotes" ON public.quotes
      FOR ALL
      USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
      WITH CHECK (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
    $policy$;
  END IF;
END$$;

-- Company members can select quotes belonging to their company
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'Company members read quotes') THEN
    EXECUTE $policy$
      CREATE POLICY "Company members read quotes" ON public.quotes FOR SELECT
      USING (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
    $policy$;
  END IF;
END$$;

-- Company members can insert quotes with check on company_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'Company insert quotes') THEN
    EXECUTE $policy$
      CREATE POLICY "Company insert quotes" ON public.quotes FOR INSERT
      WITH CHECK (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
    $policy$;
  END IF;
END$$;

-- Company members can update/delete their own quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'Company manage own quotes') THEN
    EXECUTE $policy$
      CREATE POLICY "Company manage own quotes" ON public.quotes FOR ALL
      USING (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
      WITH CHECK (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
    $policy$;
  END IF;
END$$;
