-- Corrigir produtos com code = 'sample_code' gerando códigos válidos
-- Data: 2025-08-31 20:00
begin;
-- Garante função simples existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='simple_next_product_code') THEN
    CREATE OR REPLACE FUNCTION public.simple_next_product_code()
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$select lpad(nextval('public.product_code_seq')::text,6,'0');$$;
    GRANT EXECUTE ON FUNCTION public.simple_next_product_code() TO authenticated;
  END IF;
END $$;

-- Atualiza em lote (sem prefixo)
UPDATE public.products
SET code = public.simple_next_product_code()
WHERE code = 'sample_code';

commit;
