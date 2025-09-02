-- Tabela para armazenar pedidos de reposição gerados a partir da view product_replenishment
create table if not exists public.replenishment_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  status text default 'ABERTO', -- ABERTO / EM_PROCESSO / FECHADO
  items jsonb not null -- lista de itens sugeridos {product_id, code, name, stock, stock_min, stock_max, order_suggested_qty}
);

alter table public.replenishment_orders enable row level security;

-- Política de leitura: membros da empresa
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Company members read replenishment orders'
  ) THEN
    CREATE POLICY "Company members read replenishment orders" ON public.replenishment_orders
      FOR SELECT USING (
        company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
      );
  END IF;
END $$;

-- Política de inserção: admin da empresa
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins insert replenishment orders'
  ) THEN
    CREATE POLICY "Admins insert replenishment orders" ON public.replenishment_orders
      FOR INSERT WITH CHECK (
        company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
      );
  END IF;
END $$;

create index if not exists idx_replenishment_orders_company on public.replenishment_orders(company_id);
comment on table public.replenishment_orders is 'Pedidos de reposição gerados automaticamente a partir de limites de estoque.';
