-- ERP core tables: suppliers, carriers, product_tax, inventory_movements, product_labels and stock view

-- SUPPLIERS (fornecedores)
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  taxid text, -- CNPJ/CPF
  state_registration text, -- IE
  municipal_registration text, -- IM
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  contact_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_suppliers_company_id on public.suppliers(company_id);
create trigger update_suppliers_updated_at before update on public.suppliers for each row execute procedure public.update_updated_at_column();

-- CARRIERS (transportadoras)
create table if not exists public.carriers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  taxid text,
  state_registration text,
  rntrc text, -- registro nacional transporte rodoviario de cargas
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  contact_name text,
  vehicle_types text, -- texto livre
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_carriers_company_id on public.carriers(company_id);
create trigger update_carriers_updated_at before update on public.carriers for each row execute procedure public.update_updated_at_column();

-- PRODUCT TAX (tributos do produto) separado para não inflar tabela principal
create table if not exists public.product_tax (
  product_id text primary key references public.products(id) on delete cascade,
  ncm text,
  cest text,
  cfop text,
  origem text,
  icms_cst text,
  icms_aliq numeric,
  icms_mva numeric,
  pis_cst text,
  pis_aliq numeric,
  cofins_cst text,
  cofins_aliq numeric,
  ipi_cst text,
  ipi_aliq numeric,
  fcp_aliq numeric,
  updated_at timestamptz default now()
);
create trigger update_product_tax_updated_at before update on public.product_tax for each row execute procedure public.update_updated_at_column();

-- INVENTORY MOVEMENTS (controle de estoque)
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  product_id text not null references public.products(id) on delete cascade,
  type text not null check (type in ('ENTRADA','SAIDA','AJUSTE')),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric, -- custo unitário para entradas
  reference text, -- pedido, nf, motivo
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_inventory_mov_company on public.inventory_movements(company_id);
create index if not exists idx_inventory_mov_product on public.inventory_movements(product_id);

-- Estoque atual por produto (view)
create or replace view public.product_stock as
select
  m.product_id,
  coalesce(sum(case when m.type='ENTRADA' then m.quantity when m.type='AJUSTE' and m.quantity>0 then m.quantity else 0 end),0)
  - coalesce(sum(case when m.type='SAIDA' then m.quantity when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity) else 0 end),0) as stock
from public.inventory_movements m
group by m.product_id;

-- PRODUCT LABELS (etiquetas de produto / códigos)
create table if not exists public.product_labels (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  label_type text not null, -- EAN13, CODE128, QRCODE, INTERLEAVED2OF5
  code_value text not null,
  format text, -- ex: 'svg','png'
  extra jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_product_labels_product on public.product_labels(product_id);

-- Enable RLS
alter table public.suppliers enable row level security;
alter table public.carriers enable row level security;
alter table public.product_tax enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.product_labels enable row level security;

-- Basic policies (adjust as needed). Assumes profiles table with role.
-- Read own company data
create policy "Company members read suppliers" on public.suppliers for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));
create policy "Company members read carriers" on public.carriers for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));
create policy "Company members read product tax" on public.product_tax for select using (auth.uid() is not null);
create policy "Company members read inventory movements" on public.inventory_movements for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));
create policy "Company members read product labels" on public.product_labels for select using (auth.uid() is not null);

-- Admin insert/update/delete
create policy "Admins manage suppliers" on public.suppliers for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);
create policy "Admins manage carriers" on public.carriers for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);
create policy "Admins manage product tax" on public.product_tax for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);
create policy "Admins manage inventory movements" on public.inventory_movements for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);
create policy "Admins manage product labels" on public.product_labels for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);
