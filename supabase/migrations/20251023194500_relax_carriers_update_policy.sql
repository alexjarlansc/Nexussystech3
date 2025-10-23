-- Relax carriers RLS to allow all authenticated roles (company members) to insert and update rows from their own company
-- Keep delete restricted to admin/master to avoid destructive actions by usuários comuns

alter table if exists public.carriers enable row level security;

-- Drop stricter update policy (admin/master only) if present
drop policy if exists "Carriers update (admin/master same company)" on public.carriers;

-- Ensure read & insert policies exist (idempotent) — if they already exist, they won't be duplicated
create policy if not exists "Carriers read (company members)" on public.carriers
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.company_id = carriers.company_id or carriers.company_id is null)
  )
);

create policy if not exists "Carriers insert (company members)" on public.carriers
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.company_id = carriers.company_id or carriers.company_id is null)
  )
);

-- New: allow UPDATE for any authenticated member of the same company (not only admin/master)
create policy if not exists "Carriers update (company members)" on public.carriers
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = carriers.company_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = carriers.company_id
  )
);

-- Note: delete remains restricted (see previous migration 20251023193000_fix_carriers_rls). If you also want delete for all members,
-- uncomment below at your own risk.
-- drop policy if exists "Carriers delete (admin/master same company)" on public.carriers;
-- create policy if not exists "Carriers delete (company members)" on public.carriers
-- for delete to authenticated
-- using (
--   exists (
--     select 1 from public.profiles p
--     where p.user_id = auth.uid()
--       and p.company_id = carriers.company_id
--   )
-- );
