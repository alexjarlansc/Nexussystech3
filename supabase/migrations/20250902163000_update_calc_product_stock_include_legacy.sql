-- Atualiza função calc_product_stock para incluir saldos legacy de stock_movements
-- Regra: soma inventory_movements (modelo novo) + stock_movements (signed_qty)
-- Evita dupla contagem: se já existe qualquer movimento em inventory_movements para o produto, ignora legacy desse produto.
create or replace function public.calc_product_stock()
returns table(product_id text, stock numeric, reserved numeric, available numeric)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  with inv as (
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
  ), legacy as (
    select sm.product_id, coalesce(sum(sm.signed_qty),0) as legacy_stock
    from public.stock_movements sm
    group by sm.product_id
  ), base as (
    select coalesce(i.product_id, l.product_id) as product_id,
           (coalesce(i.stock,0) + case when i.product_id is not null then 0 else coalesce(l.legacy_stock,0) end) as stock
    from inv i
    full join legacy l on l.product_id = i.product_id
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
end;$$;

comment on function public.calc_product_stock() is 'Calcula estoque combinando inventory_movements e (se ainda não migrado) stock_movements legacy.';
create or replace view public.product_stock as select * from public.calc_product_stock();
notify pgrst, 'reload schema';
