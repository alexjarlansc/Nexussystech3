-- Extend products table with richer ERP fields
-- Safe additive changes (IF NOT EXISTS) so migration can run multiple times
-- NOTE: Legacy column "price" kept for backward compatibility; new field sale_price added.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS stock_min numeric(14,4),
  ADD COLUMN IF NOT EXISTS stock_max numeric(14,4),
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS cost_price numeric(14,4),
  ADD COLUMN IF NOT EXISTS sale_price numeric(14,4),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS validity_date date,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_terms text;

-- Fiscal fields already added in previous enhance_nfe_module migration (ncm, cfop, cest, cst, origin, icms_rate, pis_rate, cofins_rate).

-- Unique SKU per company (allow multiple NULL codes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_company_code'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT uq_products_company_code UNIQUE (company_id, code);
  END IF;
END$$;

-- Optional trigger to keep legacy price column in sync with sale_price when inserting/updating
-- Create helper function if absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'sync_product_price'
  ) THEN
    CREATE OR REPLACE FUNCTION public.sync_product_price()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.sale_price IS NOT NULL THEN
        NEW.price := COALESCE(NEW.sale_price, NEW.price);
      ELSIF TG_OP = 'INSERT' AND NEW.price IS NOT NULL AND NEW.sale_price IS NULL THEN
        NEW.sale_price := NEW.price; -- backfill if only legacy provided
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_product_price'
  ) THEN
    CREATE TRIGGER trg_sync_product_price
      BEFORE INSERT OR UPDATE ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_product_price();
  END IF;
END$$;

-- Indexes for common searches
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products USING gin (to_tsvector('simple', name));
