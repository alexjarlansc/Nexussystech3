-- Recria view product_stock para incluir coluna available (stock - reserved)
create or replace view public.product_stock as
with base as (
  select
    m.product_id,
    coalesce(sum(case
      when m.type='ENTRADA' then m.quantity
      when m.type='AJUSTE' and m.quantity>0 then m.quantity
      else 0 end),0)
    - coalesce(sum(case
      when m.type='SAIDA' then m.quantity
      when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity)
      else 0 end),0) as stock
  from public.inventory_movements m
  group by m.product_id
), reserved as (
  select (item->>'productId') as product_id,
         sum( (item->>'quantity')::numeric ) as reserved
  from public.quotes q
  cross join lateral jsonb_array_elements(q.items) item
  where q.type='PEDIDO' and q.status='Rascunho' and (item->>'productId') is not null
  group by (item->>'productId')
)
select coalesce(b.product_id, r.product_id) as product_id,
       b.stock,
       coalesce(r.reserved,0) as reserved,
       (coalesce(b.stock,0) - coalesce(r.reserved,0)) as available
from base b
full outer join reserved r on r.product_id = b.product_id;

comment on view public.product_stock is 'Estoque (stock), reservado em pedidos rascunho (reserved) e disponível (available).';

notify pgrst, 'reload schema';
