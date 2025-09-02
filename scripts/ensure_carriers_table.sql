-- Idempotent check & creation for public.carriers (minimal subset)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='carriers'
  ) THEN
    -- Create minimal structure (full structure should come from migration 20250830120000)
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
END $$;
