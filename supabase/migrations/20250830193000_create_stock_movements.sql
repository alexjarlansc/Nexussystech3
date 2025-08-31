-- Tabela de movimentos de estoque unificada
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  location text null,
  signed_qty numeric not null,
  type text not null, -- IN, OUT, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, RETURN, EXCHANGE
  reason text null,
  related_sale_id uuid null references public.sales(id) on delete set null,
  movement_group uuid null, -- agrupa linhas de uma mesma transferência
  company_id uuid null references public.companies(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_type on public.stock_movements(type);
create index if not exists idx_stock_movements_group on public.stock_movements(movement_group);
create index if not exists idx_stock_movements_company on public.stock_movements(company_id);

alter table public.stock_movements enable row level security;

-- Políticas simples (ajuste conforme necessidade de multi-empresa)
DO $$ BEGIN
  CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY stock_movements_update ON public.stock_movements FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY stock_movements_delete ON public.stock_movements FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

comment on table public.stock_movements is 'Histórico detalhado de movimentos de estoque';
comment on column public.stock_movements.signed_qty is 'Quantidade com sinal (positiva entra, negativa sai)';
