-- Create a view that consolidates product stock with groups, last sale date and basic pricing
-- This view is intended to speed up the 'Estoque Completo' report by aggregating on the DB side.
CREATE OR REPLACE VIEW public.report_stock_full AS
SELECT
  p.id AS product_id,
  p.code,
  p.name,
  p.product_group_id,
  pg.name AS session_name,
  parent.name AS sector_name,
  gparent.name AS category_name,
  ps.stock::numeric AS stock,
  ps.reserved::numeric AS reserved,
  COALESCE(p.cost_price, 0)::numeric AS cost_price,
  COALESCE(p.sale_price, p.price, 0)::numeric AS sale_price,
  -- total values
  (COALESCE(p.cost_price,0) * COALESCE(ps.stock,0))::numeric AS total_cost_value,
  (COALESCE(COALESCE(p.sale_price,p.price),0) * COALESCE(ps.stock,0))::numeric AS total_sale_value,
  -- last sale (inventory_movements type = 'SAIDA')
  (SELECT max(im.created_at) FROM public.inventory_movements im WHERE im.product_id = p.id AND im.type = 'SAIDA') AS last_sale_at
FROM public.products p
LEFT JOIN public.product_stock ps ON ps.product_id = p.id
LEFT JOIN public.product_groups pg ON pg.id = p.product_group_id
LEFT JOIN public.product_groups parent ON parent.id = pg.parent_id
LEFT JOIN public.product_groups gparent ON gparent.id = parent.parent_id;

-- Grant select to anon/public if needed (adjust based on your RLS/roles)
-- GRANT SELECT ON public.report_stock_full TO anon;
