-- Migration safe helper: map product_stock.product_id values that contain product.code into UUIDs
-- It does NOT overwrite the original product_stock.product_id column.
-- Instead it:
-- 1) creates a backup of product_stock
-- 2) adds a nullable column product_id_resolved (uuid)
-- 3) attempts to match product_stock.product_id to products.id or products.code and fills product_id_resolved
-- 4) creates a view product_stock_resolved for review
-- After review you can choose to apply the resolved values back to product_stock (instructions at bottom)

-- Use a resilient approach: if `public.product_stock` is a VIEW we cannot ALTER it.
-- In that case we create a working table with the same rows plus `product_id_resolved`.
-- If it's a real table we try to ALTER it in-place; both flows produce a
-- `public.product_stock_resolved` view for inspection.

BEGIN;

DO $$
DECLARE
  is_view boolean;
  target_table text;
BEGIN
  -- detect whether product_stock is a view
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'product_stock'
  ) INTO is_view;

  -- always create a backup (use SELECT so it works for tables and views)
  EXECUTE 'DROP TABLE IF EXISTS public.product_stock_backup_20250909';
  EXECUTE 'CREATE TABLE public.product_stock_backup_20250909 AS SELECT * FROM public.product_stock';

  IF is_view THEN
    -- create a working table from the view with a nullable uuid column
    EXECUTE 'DROP TABLE IF EXISTS public.product_stock_working_20250909';
    EXECUTE 'CREATE TABLE public.product_stock_working_20250909 AS SELECT ps.*, NULL::uuid AS product_id_resolved FROM public.product_stock ps';
    target_table := 'public.product_stock_working_20250909';
  ELSE
    -- product_stock is a real table: try to add the column in-place
    BEGIN
      EXECUTE 'ALTER TABLE public.product_stock ADD COLUMN IF NOT EXISTS product_id_resolved uuid';
      target_table := 'public.product_stock';
    EXCEPTION WHEN OTHERS THEN
      -- if anything unexpected happens, fall back to creating a working table
      EXECUTE 'DROP TABLE IF EXISTS public.product_stock_working_20250909';
      EXECUTE 'CREATE TABLE public.product_stock_working_20250909 AS SELECT ps.*, NULL::uuid AS product_id_resolved FROM public.product_stock ps';
      target_table := 'public.product_stock_working_20250909';
    END;
  END IF;

  -- populate resolved column on the chosen target (table or working table)
  -- We must handle cases where ps.product_id is uuid or text. Detect the column type
  -- and run the appropriate UPDATE to avoid uuid = text operator errors.
  DECLARE
    col_data_type text;
    is_uuid_col boolean := false;
  BEGIN
    SELECT data_type INTO col_data_type
    FROM information_schema.columns
    WHERE table_schema = split_part(target_table, '.', 1)
      AND table_name = split_part(target_table, '.', 2)
      AND column_name = 'product_id'
    LIMIT 1;

    IF col_data_type IS NOT NULL AND lower(col_data_type) = 'uuid' THEN
      is_uuid_col := true;
    END IF;

    IF is_uuid_col THEN
      -- product_id is uuid: compare to products.id (uuid) or cast to text to compare to products.code
      EXECUTE format(
        'UPDATE %s ps SET product_id_resolved = p.id FROM public.products p WHERE (ps.product_id IS NOT NULL) AND (ps.product_id = p.id OR ps.product_id::text = p.code) AND ps.product_id_resolved IS NULL',
        target_table
      );
    ELSE
      -- product_id is text (or unknown): compare to products.id::text or products.code
      EXECUTE format(
        'UPDATE %s ps SET product_id_resolved = p.id FROM public.products p WHERE (ps.product_id IS NOT NULL) AND (ps.product_id = p.id::text OR ps.product_id = p.code) AND ps.product_id_resolved IS NULL',
        target_table
      );
    END IF;
  END;

  -- create a unified view to inspect results regardless of the underlying target
  EXECUTE 'DROP VIEW IF EXISTS public.product_stock_resolved';
  EXECUTE format(
    'CREATE VIEW public.product_stock_resolved AS SELECT ps.*, ps.product_id_resolved, p.code AS product_code, p.name AS product_name, p.cost_price, p.sale_price FROM %s ps LEFT JOIN public.products p ON p.id = ps.product_id_resolved',
    target_table
  );
END$$;

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
