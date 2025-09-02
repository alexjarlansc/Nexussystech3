-- Idempotent creation of core ERP tables if missing (minimal schema)
DO $$
BEGIN
  -- SUPPLIERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers') THEN
    CREATE TABLE public.suppliers (
      id uuid primary key default gen_random_uuid(),
      company_id uuid references public.companies(id) on delete set null,
      created_by uuid references auth.users(id) on delete set null,
      name text not null,
      taxid text,
      phone text,
      email text,
      address text,
      city text,
      state text,
      zip text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Company members read suppliers" ON public.suppliers
      FOR SELECT USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR company_id IN (SELECT company_id FROM public.profiles WHERE id=auth.uid())));
    CREATE POLICY IF NOT EXISTS "Admins manage suppliers" ON public.suppliers
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK (TRUE);
  END IF;

  -- CARRIERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='carriers') THEN
    CREATE TABLE public.carriers (
      id uuid primary key default gen_random_uuid(),
      company_id uuid references public.companies(id) on delete set null,
      created_by uuid references auth.users(id) on delete set null,
      name text not null,
      taxid text,
      rntrc text,
      phone text,
      email text,
      address text,
      city text,
      state text,
      zip text,
      vehicle_types text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Company members read carriers" ON public.carriers
      FOR SELECT USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR company_id IN (SELECT company_id FROM public.profiles WHERE id=auth.uid())));
    CREATE POLICY IF NOT EXISTS "Admins manage carriers" ON public.carriers
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK (TRUE);
  END IF;

  -- PRODUCT_TAX
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_tax') THEN
    CREATE TABLE public.product_tax (
      product_id text primary key,
      ncm text,
      cest text,
      cfop text,
      origem text,
      icms_cst text,
      icms_aliq numeric,
      pis_cst text,
      pis_aliq numeric,
      cofins_cst text,
      cofins_aliq numeric,
      updated_at timestamptz default now()
    );
    ALTER TABLE public.product_tax ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Company members read product tax" ON public.product_tax
      FOR SELECT USING (auth.uid() IS NOT NULL);
    CREATE POLICY IF NOT EXISTS "Admins manage product tax" ON public.product_tax
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK (TRUE);
  END IF;

  -- INVENTORY_MOVEMENTS
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_movements') THEN
    CREATE TABLE public.inventory_movements (
      id uuid primary key default gen_random_uuid(),
      company_id uuid references public.companies(id) on delete set null,
      created_by uuid references auth.users(id) on delete set null,
      product_id text not null,
      type text not null,
      quantity numeric not null,
      unit_cost numeric,
      reference text,
      notes text,
      created_at timestamptz default now()
    );
    ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Company members read inventory movements" ON public.inventory_movements
      FOR SELECT USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR company_id IN (SELECT company_id FROM public.profiles WHERE id=auth.uid())));
    CREATE POLICY IF NOT EXISTS "Admins manage inventory movements" ON public.inventory_movements
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK (TRUE);
  END IF;

  -- PRODUCT_LABELS
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_labels') THEN
    CREATE TABLE public.product_labels (
      id uuid primary key default gen_random_uuid(),
      product_id text not null,
      label_type text not null,
      code_value text not null,
      format text,
      extra jsonb,
      created_at timestamptz default now()
    );
    ALTER TABLE public.product_labels ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Company members read product labels" ON public.product_labels
      FOR SELECT USING (auth.uid() IS NOT NULL);
    CREATE POLICY IF NOT EXISTS "Admins manage product labels" ON public.product_labels
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK (TRUE);
  END IF;
END $$;
