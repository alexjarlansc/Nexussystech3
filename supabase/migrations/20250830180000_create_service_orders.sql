-- Dependências (UUID)
create extension if not exists pgcrypto;

-- Tabela de Ordens de Serviço
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  status text not null default 'ABERTA', -- ABERTA, EM_EXECUCAO, CONCLUIDA, CANCELADA
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_snapshot jsonb,
  origin_quote_id uuid references public.quotes(id) on delete set null,
  description text,
  items jsonb not null default '[]'::jsonb, -- serviços lançados
  subtotal numeric,
  discount numeric,
  total numeric,
  notes text
);

create index if not exists idx_service_orders_company on public.service_orders(company_id);
create index if not exists idx_service_orders_number on public.service_orders(number);
create index if not exists idx_service_orders_status on public.service_orders(status);

-- trigger updated_at
create or replace function public.update_updated_at_column() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

create trigger update_service_orders_updated_at before update on public.service_orders for each row execute procedure public.update_updated_at_column();

alter table public.service_orders enable row level security;
create policy "Company members read service orders" on public.service_orders for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));
create policy "Admins manage service orders" on public.service_orders for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);