-- View de saldo por produto e local
create or replace view public.product_stock_by_location as
select 
  product_id,
  coalesce(location,'__SEM_LOCAL__') as location,
  sum(signed_qty) as qty,
  max(created_at) as last_movement_at
from public.stock_movements
group by product_id, coalesce(location,'__SEM_LOCAL__');
