-- Fix RLS policies for public.carriers to allow insert/update by company members
-- Context: users report "new row violates row-level security policy for table carriers"
-- Root cause: previous policies referenced profiles.id instead of profiles.user_id and only allowed admins broadly.
-- This migration recreates clear, tolerant policies and a helper for admin/master detection.

-- Ensure RLS is enabled
alter table if exists public.carriers enable row level security;

-- Drop old/incorrect policies if they exist
drop policy if exists "Company members read carriers" on public.carriers;
drop policy if exists "Admins manage carriers" on public.carriers;

-- Helper function: tolerant check for admin or master
create or replace function public.is_master_or_admin(_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = _uid
      and (
        lower(coalesce(p.role,'')) in ('admin','master','owner','dono')
        or lower(coalesce(p.role,'')) like '%mestre%'
        or lower(coalesce(p.role,'')) like '%master%'
      )
  );
$$;

-- Read for company members (or rows without company_id)
create policy if not exists "Carriers read (company members)" on public.carriers
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.company_id = carriers.company_id or carriers.company_id is null)
  )
);

-- Insert allowed for company members (or rows without company_id)
create policy if not exists "Carriers insert (company members)" on public.carriers
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.company_id = carriers.company_id or carriers.company_id is null)
  )
);

-- Update allowed for admin/master members of the same company
create policy if not exists "Carriers update (admin/master same company)" on public.carriers
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = carriers.company_id
      and public.is_master_or_admin(auth.uid())
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = carriers.company_id
      and public.is_master_or_admin(auth.uid())
  )
);

-- Delete allowed for admin/master members of the same company
create policy if not exists "Carriers delete (admin/master same company)" on public.carriers
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = carriers.company_id
      and public.is_master_or_admin(auth.uid())
  )
);

-- Optional: if carriers table might not exist in some envs, this migration will simply no-op on the ALTER/DROP/CREATE POLICY statements
-- where table is missing. Ensure your base table is created by previous migrations or scripts/ensure_erp_tables.sql.
