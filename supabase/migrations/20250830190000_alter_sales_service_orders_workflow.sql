-- Adiciona sale_type em sales e vínculo service_sale_id em service_orders
alter table public.sales add column if not exists sale_type text default 'PRODUCT';
create index if not exists idx_sales_sale_type on public.sales(sale_type);

alter table public.service_orders add column if not exists service_sale_id uuid references public.sales(id) on delete set null;
create index if not exists idx_service_orders_service_sale_id on public.service_orders(service_sale_id);

-- Comentários
comment on column public.sales.sale_type is 'PRODUCT ou SERVICE';
comment on column public.service_orders.service_sale_id is 'Pedido de serviço gerado a partir da OS';