-- View de sugestão de reposição com base em estoque atual (product_stock) e limites min/max em products
create or replace view public.product_replenishment as
select
  p.id,
  p.code,
  p.name,
  coalesce(ps.stock,0) as stock,
  p.stock_min,
  p.stock_max,
  (p.stock_min is not null and coalesce(ps.stock,0) < p.stock_min) as below_min,
  case when p.stock_max is not null then greatest(p.stock_max - coalesce(ps.stock,0),0) end as order_suggested_qty
from public.products p
left join public.product_stock ps on ps.product_id = p.id
where p.stock_min is not null and p.stock_max is not null;

comment on view public.product_replenishment is 'Sugestões de reposição: produtos com limites definidos; order_suggested_qty = quantidade sugerida para atingir estoque máximo.';
