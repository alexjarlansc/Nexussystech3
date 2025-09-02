-- Remove função utilitária de ajuste de limites (não mais necessária)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_product_stock_threshold'
  ) THEN
    DROP FUNCTION public.set_product_stock_threshold(uuid, numeric, numeric, text);
  END IF;
END $$;

-- Caso queira reverter, recriar a função a partir da migration 20250901133500_add_product_stock_threshold_logs.sql