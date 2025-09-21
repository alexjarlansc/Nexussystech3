-- Migration: Add code_prefix (Código do fabricante) to products
-- Created: 2025-09-21

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code_prefix text;

-- Optional: you can add an index if you search by this frequently
-- CREATE INDEX IF NOT EXISTS idx_products_code_prefix ON public.products (code_prefix);
