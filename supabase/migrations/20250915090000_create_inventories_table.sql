-- Create inventories table used by frontend to save inventory sessions
-- Data: 2025-09-15

create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  items jsonb not null,
  description text,
  created_at timestamptz default now()
);

create index if not exists idx_inventories_company on public.inventories(company_id);
create index if not exists idx_inventories_created_at on public.inventories(created_at);

-- enable RLS
alter table public.inventories enable row level security;

-- Policies: allow authenticated users of the same company to read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='inventories' AND policyname='Company members read inventories'
  ) THEN
    EXECUTE $$create policy "Company members read inventories" on public.inventories
      for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));$$;
  END IF;
END$$;

-- Policies: allow creators and admins to insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='inventories' AND policyname='Allow insert inventories for creators'
  ) THEN
    EXECUTE $$create policy "Allow insert inventories for creators" on public.inventories
      for insert with check (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));$$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='inventories' AND policyname='Admins manage inventories'
  ) THEN
    EXECUTE $$create policy "Admins manage inventories" on public.inventories
      for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);$$;
  END IF;
END$$;

-- trigger or helper not required here

-- notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
