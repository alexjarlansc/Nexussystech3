-- Enable RLS and create company-scoped policies for receivables and receivable_installments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receivables') THEN
    RAISE NOTICE 'table receivables not found, skipping RLS setup';
    RETURN;
  END IF;
END$$;

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_installments ENABLE ROW LEVEL SECURITY;

-- Admins manage all
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivables' AND policyname = 'Admins manage receivables') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage receivables" ON public.receivables FOR ALL
      USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
      WITH CHECK (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivable_installments' AND policyname = 'Admins manage receivable_installments') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage receivable_installments" ON public.receivable_installments FOR ALL
      USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
      WITH CHECK (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
    $policy$;
  END IF;
END$$;

-- Company members see and manage receivables belonging to their company
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivables' AND policyname = 'Company members read receivables') THEN
    EXECUTE $policy$
      CREATE POLICY "Company members read receivables" ON public.receivables FOR SELECT
      USING (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivable_installments' AND policyname = 'Company members read receivable_installments') THEN
    EXECUTE $policy$
      CREATE POLICY "Company members read receivable_installments" ON public.receivable_installments FOR SELECT
      USING (exists (select 1 from public.receivables r where r.id = public.receivable_installments.receivable_id and r.company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1)))
    $policy$;
  END IF;
END$$;

-- Insert/update/delete only if company matches
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivables' AND policyname = 'Company manage own receivables') THEN
    EXECUTE $policy$
      CREATE POLICY "Company manage own receivables" ON public.receivables FOR ALL
      USING (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
      WITH CHECK (company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1))
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'receivable_installments' AND policyname = 'Company manage own receivable_installments') THEN
    EXECUTE $policy$
      CREATE POLICY "Company manage own receivable_installments" ON public.receivable_installments FOR ALL
      USING (exists (select 1 from public.receivables r where r.id = public.receivable_installments.receivable_id and r.company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1)))
      WITH CHECK (exists (select 1 from public.receivables r where r.id = public.receivable_installments.receivable_id and r.company_id = (select company_id from public.profiles where user_id = auth.uid() limit 1)))
    $policy$;
  END IF;
END$$;
