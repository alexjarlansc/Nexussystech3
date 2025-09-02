-- Corrige criação idempotente de inventory_movements + policies sem usar "IF NOT EXISTS" direto em CREATE POLICY
-- Data: 2025-09-01

-- 1. Função de updated_at (segura repetir)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. Tabela (idempotente)
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  product_id text not null references public.products(id) on delete cascade,
  type text not null check (type in ('ENTRADA','SAIDA','AJUSTE')),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric,
  reference text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_inventory_mov_company on public.inventory_movements(company_id);
create index if not exists idx_inventory_mov_product on public.inventory_movements(product_id);

-- 3. View de estoque (recria)
create or replace view public.product_stock as
select
  m.product_id,
  coalesce(sum(case when m.type='ENTRADA' then m.quantity when m.type='AJUSTE' and m.quantity>0 then m.quantity else 0 end),0)
  - coalesce(sum(case when m.type='SAIDA' then m.quantity when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity) else 0 end),0) as stock
from public.inventory_movements m
group by m.product_id;

-- 4. RLS
alter table public.inventory_movements enable row level security;

-- 5. Policies (idempotentes via DO blocks porque CREATE POLICY não aceita IF NOT EXISTS na sua versão)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='inventory_movements' AND policyname='Company members read inventory movements'
  ) THEN
    EXECUTE $$create policy "Company members read inventory movements" on public.inventory_movements
      for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));$$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='inventory_movements' AND policyname='Admins manage inventory movements'
  ) THEN
    EXECUTE $$create policy "Admins manage inventory movements" on public.inventory_movements
      for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);$$;
  END IF;
END$$;

-- 6. Opcional: trigger updated_at (comentado, só habilite se adicionar coluna updated_at)
-- alter table public.inventory_movements add column if not exists updated_at timestamptz;
-- create or replace trigger update_inventory_movements_updated_at
--   before update on public.inventory_movements
--   for each row execute function public.update_updated_at_column();

-- 7. Forçar reload do cache do PostgREST
NOTIFY pgrst, 'reload schema';
