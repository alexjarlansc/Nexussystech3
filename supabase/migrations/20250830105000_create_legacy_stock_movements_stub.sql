-- Stub de tabela legacy stock_movements
-- Objetivo: impedir falhas nas migrations que referenciam public.stock_movements
-- Caso a tabela real já exista em outro ambiente com mais colunas, este CREATE IF NOT EXISTS
-- não altera a estrutura. Em ambiente novo, fornece colunas mínimas usadas nos cálculos.

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  signed_qty numeric not null,
  type text,
  reason text,
  location text,
  related_sale_id uuid,
  movement_group text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

comment on table public.stock_movements is 'Stub legacy criada para compatibilidade de migrations/calculo de estoque.';

notify pgrst, 'reload schema';
