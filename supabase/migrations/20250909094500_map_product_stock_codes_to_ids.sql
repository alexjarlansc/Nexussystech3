-- Migration safe helper: map product_stock.product_id values that contain product.code into UUIDs
-- It does NOT overwrite the original product_stock.product_id column.
-- Instead it:
-- 1) creates a backup of product_stock
-- 2) adds a nullable column product_id_resolved (uuid)
-- 3) attempts to match product_stock.product_id to products.id or products.code and fills product_id_resolved
-- 4) creates a view product_stock_resolved for review
-- After review you can choose to apply the resolved values back to product_stock (instructions at bottom)

BEGIN;

-- 1) backup
DROP TABLE IF EXISTS public.product_stock_backup_20250909;
CREATE TABLE public.product_stock_backup_20250909 AS TABLE public.product_stock;

-- 2) add resolved column
ALTER TABLE public.product_stock
  ADD COLUMN IF NOT EXISTS product_id_resolved uuid;

-- 3) populate resolved column
-- Attempt matches in two ways:
--  - if product_stock.product_id equals products.id (text/uuid comparison)
--  - if product_stock.product_id equals products.code (legacy systems)

-- First try matching by UUID equality when possible
UPDATE public.product_stock ps
SET product_id_resolved = p.id
FROM public.products p
WHERE (ps.product_id IS NOT NULL)
  AND (
    ps.product_id = p.id::text
    OR ps.product_id = p.code
  )
  AND ps.product_id_resolved IS NULL;

-- 4) create resolved view for easy inspection
DROP VIEW IF EXISTS public.product_stock_resolved;
CREATE VIEW public.product_stock_resolved AS
SELECT
  ps.*, 
  ps.product_id_resolved,
  p.code AS product_code,
  p.name AS product_name,
  p.cost_price,
  p.sale_price
FROM public.product_stock ps
LEFT JOIN public.products p ON p.id = ps.product_id_resolved;

COMMIT;

-- === INSTRUCTIONS AFTER REVIEW ===
-- 1) Inspect rows that still have no product_id_resolved:
--    SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NULL LIMIT 200;
-- 2) Inspect mapped rows:
--    SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NOT NULL LIMIT 200;
-- 3) If everything looks correct and you want to replace the original ids, you can run (after making a new backup):
--    -- a) ensure product_stock.product_id is of type text (if it's uuid, you'll need to ALTER TYPE carefully)
--    -- b) update product_stock set product_id = product_id_resolved::text WHERE product_id_resolved IS NOT NULL;
--    -- c) (optional) drop the product_id_resolved column
-- Example safe update (manual step):
-- BEGIN;
-- UPDATE public.product_stock ps SET product_id = ps.product_id_resolved::text WHERE ps.product_id_resolved IS NOT NULL;
-- COMMIT;

-- NOTE: Do not run the destructive update until you have validated mappings and have a backup. If product_stock.product_id column has uuid type, you may instead want to ALTER the column type to uuid and update to the uuid values rather than casting to text.
