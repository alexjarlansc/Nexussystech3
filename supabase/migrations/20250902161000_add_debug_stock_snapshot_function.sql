-- Função de debug para diagnosticar porque estoque aparece 0
create or replace function public.debug_stock_snapshot()
returns json
security definer
set search_path = public
language plpgsql
as $$
declare
  total_mov int;
  total_products int;
  prod_with_mov int;
  sample json;
begin
  select count(*) into total_mov from public.inventory_movements;
  select count(*) into total_products from public.products;
  select count(distinct product_id) into prod_with_mov from public.inventory_movements;
  select json_agg(x) into sample from (
    select m.product_id,
           ( coalesce(sum(case when m.type='ENTRADA' then m.quantity when m.type='AJUSTE' and m.quantity>0 then m.quantity else 0 end),0)
             - coalesce(sum(case when m.type='SAIDA' then m.quantity when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity) else 0 end),0) ) as stock
    from public.inventory_movements m
    group by m.product_id
    order by stock desc nulls last
    limit 10
  ) x;
  return json_build_object(
    'total_movements', total_mov,
    'total_products', total_products,
    'products_with_movements', prod_with_mov,
    'sample_top10', sample
  );
end;$$;

grant execute on function public.debug_stock_snapshot() to authenticated, anon;

notify pgrst, 'reload schema';
