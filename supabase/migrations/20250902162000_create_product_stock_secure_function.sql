-- Função que calcula estoque ignorando RLS (security definer)
create or replace function public.calc_product_stock()
returns table(product_id text, stock numeric, reserved numeric, available numeric)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
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
end;$$;

grant execute on function public.calc_product_stock() to authenticated, anon;

-- Recria view usando função (se RLS bloquear leitura direta, função já traz dados)
create or replace view public.product_stock as
select * from public.calc_product_stock();

comment on function public.calc_product_stock() is 'Calcula estoque/reservado/disponível ignorando RLS nas tabelas base (security definer).';
comment on view public.product_stock is 'View wrapper sobre calc_product_stock()';

notify pgrst, 'reload schema';
