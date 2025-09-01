-- Deduplicate product images so each product has its own (or becomes NULL) before enforcing uniqueness.
-- Step 1: Null out duplicate references (keeps first product per image_url)
WITH ranked AS (
  SELECT id, image_url,
         ROW_NUMBER() OVER (PARTITION BY image_url ORDER BY id) AS rn
  FROM products
  WHERE image_url IS NOT NULL
)
UPDATE products p
SET image_url = NULL
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- Step 2: (Optional) If you prefer copying images instead of NULL, use an external script (see scripts/fix_product_images.ts).
-- Step 3: Enforce uniqueness at database level (can be commented out if you still want to allow shared images)
DO $$ BEGIN
  -- Drop old index if exists (idempotent)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'products_image_url_key_unique_not_null') THEN
    EXECUTE 'DROP INDEX products_image_url_key_unique_not_null';
  END IF;
  EXECUTE 'CREATE UNIQUE INDEX products_image_url_key_unique_not_null ON products(image_url) WHERE image_url IS NOT NULL';
END $$;
