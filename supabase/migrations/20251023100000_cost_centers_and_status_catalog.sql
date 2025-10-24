-- Create cost_centers and status_catalog tables with RLS and basic policies
-- Timestamp: 2025-10-23

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- cost_centers table
create table if not exists public.cost_centers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now()
);

alter table public.cost_centers enable row level security;

-- Basic policies: authenticated users can read their company's rows; insert/update/delete limited to same company; delete suggested to admins only at app layer
create policy cost_centers_select on public.cost_centers for select using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = cost_centers.company_id
  )
);
create policy cost_centers_insert on public.cost_centers for insert with check (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = cost_centers.company_id
  )
);
create policy cost_centers_update on public.cost_centers for update using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = cost_centers.company_id
  )
) with check (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = cost_centers.company_id
  )
);
create policy cost_centers_delete on public.cost_centers for delete using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = cost_centers.company_id
  )
);

-- status_catalog table
create table if not exists public.status_catalog (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  domain text not null check (domain in ('ORCAMENTO','PEDIDO')),
  name text not null,
  sort_order int not null default 0,
  color text null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now()
);

alter table public.status_catalog enable row level security;

create policy status_catalog_select on public.status_catalog for select using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = status_catalog.company_id
  )
);
create policy status_catalog_insert on public.status_catalog for insert with check (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = status_catalog.company_id
  )
);
create policy status_catalog_update on public.status_catalog for update using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = status_catalog.company_id
  )
) with check (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = status_catalog.company_id
  )
);
create policy status_catalog_delete on public.status_catalog for delete using (
  exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = status_catalog.company_id
  )
);

-- helpful indexes
create index if not exists idx_cost_centers_company on public.cost_centers(company_id);
create index if not exists idx_status_catalog_company_domain on public.status_catalog(company_id, domain);
