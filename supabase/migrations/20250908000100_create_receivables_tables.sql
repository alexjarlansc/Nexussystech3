-- Migration: criar tabelas básicas para Contas a Receber
-- Cria: clients, products, receivables, receivable_installments, payments, receivables_history

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  taxid text null,
  email text null,
  phone text null,
  address text null,
  payment_terms text null,
  credit_limit numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text null,
  description text not null,
  unit_price numeric not null default 0,
  tax_rate numeric default 0,
  sale_conditions text default 'avista',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  receivable_number text not null,
  client_id uuid references public.clients(id) on delete set null,
  supplier_id uuid references public.clients(id) on delete set null,
  description text,
  issue_date date,
  due_date date,
  amount numeric default 0,
  status text default 'pendente',
  payment_method text null,
  document_type text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.receivable_installments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid references public.receivables(id) on delete cascade,
  installment_number int not null,
  due_date date,
  amount numeric default 0,
  paid boolean default false,
  paid_at timestamptz null,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid references public.receivables(id) on delete cascade,
  amount numeric default 0,
  paid_at timestamptz default now(),
  method text null,
  reference text null,
  proof_url text null,
  created_at timestamptz default now()
);

create table if not exists public.receivables_history (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid references public.receivables(id) on delete cascade,
  action text not null,
  details jsonb null,
  created_by uuid null,
  created_at timestamptz default now()
);

-- Índices básicos
create index if not exists idx_receivables_client_id on public.receivables(client_id);
create index if not exists idx_receivables_supplier_id on public.receivables(supplier_id);
create index if not exists idx_receivables_due_date on public.receivables(due_date);
create index if not exists idx_installments_receivable_id on public.receivable_installments(receivable_id);
