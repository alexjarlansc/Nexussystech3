-- Migration: atualizar função and view product_stock para incluir product_name e product_code
-- Gera product_id, product_code, product_name, stock, reserved, available

CREATE OR REPLACE FUNCTION public.calc_product_stock()
RETURNS TABLE(
  product_id text,
  product_code text,
  product_name text,
  stock numeric,
  reserved numeric,
  available numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH inv AS (
    SELECT m.product_id,
      COALESCE(SUM(CASE
        WHEN m.type='ENTRADA' THEN m.quantity
        WHEN m.type='AJUSTE' AND m.quantity>0 THEN m.quantity
        ELSE 0 END),0)
      - COALESCE(SUM(CASE
        WHEN m.type='SAIDA' THEN m.quantity
        WHEN m.type='AJUSTE' AND m.quantity<0 THEN ABS(m.quantity)
        ELSE 0 END),0) AS stock
    FROM public.inventory_movements m
    GROUP BY m.product_id
  ),
  legacy AS (
    SELECT sm.product_id,
           COALESCE(SUM(sm.signed_qty),0) AS legacy_stock
    FROM public.stock_movements sm
    GROUP BY sm.product_id
  ),
  base AS (
    SELECT COALESCE(i.product_id,l.product_id) AS product_id,
           (COALESCE(i.stock,0) +
            CASE WHEN i.product_id IS NOT NULL THEN 0 ELSE COALESCE(l.legacy_stock,0) END) AS stock
    FROM inv i
    FULL JOIN legacy l ON l.product_id = i.product_id
  ),
  reserved AS (
    SELECT (item->>'productId') AS product_id,
           SUM( (item->>'quantity')::numeric ) AS reserved
    FROM public.quotes q
    CROSS JOIN LATERAL jsonb_array_elements(q.items) item
    WHERE q.type='PEDIDO'
      AND q.status='Rascunho'
      AND (item->>'productId') IS NOT NULL
    GROUP BY (item->>'productId')
  )
  SELECT COALESCE(b.product_id, r.product_id) AS product_id,
         p.code::text AS product_code,
         p.name::text AS product_name,
         b.stock,
         COALESCE(r.reserved,0) AS reserved,
         (COALESCE(b.stock,0) - COALESCE(r.reserved,0)) AS available
  FROM base b
  FULL OUTER JOIN reserved r ON r.product_id = b.product_id
  LEFT JOIN public.products p ON p.id::text = COALESCE(b.product_id, r.product_id);
END;
$$;

CREATE OR REPLACE VIEW public.product_stock AS
SELECT product_id, product_code, product_name, stock, reserved, available FROM public.calc_product_stock();

GRANT EXECUTE ON FUNCTION public.calc_product_stock() TO authenticated, anon;
GRANT SELECT ON public.product_stock TO authenticated, anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
