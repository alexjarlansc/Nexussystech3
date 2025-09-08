-- Create carriers table if missing (fix)
create table if not exists public.carriers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  taxid text,
  state_registration text,
  rntrc text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  contact_name text,
  vehicle_types text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_carriers_company_id on public.carriers(company_id);

-- Ensure the update trigger exists (depends on public.update_updated_at_column)
-- If the function is present this will create the trigger; if not, it will fail safely when run in sequence where function exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'carriers' AND t.tgname = 'update_carriers_updated_at'
  ) THEN
    BEGIN
      EXECUTE 'CREATE TRIGGER update_carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();';
    EXCEPTION WHEN undefined_function THEN
      -- function not present yet; skip trigger creation
      NULL;
    END;
  END IF;
END$$;

alter table public.carriers enable row level security;

-- Minimal policies: allow authenticated users to read, admins to manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'carriers' AND policyname = 'Company members read carriers'
  ) THEN
  EXECUTE $policy$CREATE POLICY "Company members read carriers" ON public.carriers FOR SELECT USING (auth.uid() IS NOT NULL)$policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'carriers' AND policyname = 'Admins manage carriers'
  ) THEN
  EXECUTE $policy$CREATE POLICY "Admins manage carriers" ON public.carriers FOR ALL USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin')) WITH CHECK (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))$policy$;
  END IF;
END$$;
