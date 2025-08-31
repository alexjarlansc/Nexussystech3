-- Garante geração automática de código e elimina 'sample_code'
-- Data: 2025-08-31 20:10
begin;

-- Função utilitária de geração simples (caso não exista)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='product_code_code') THEN
    -- fallback mínimo
    IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
      CREATE SEQUENCE public.product_code_seq START 1;
    END IF;
    CREATE OR REPLACE FUNCTION public.product_code_code()
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$select lpad(nextval('public.product_code_seq')::text,6,'0');$$;
    GRANT EXECUTE ON FUNCTION public.product_code_code() TO authenticated;
  END IF;
END $$;

-- Trigger para forçar código válido
CREATE OR REPLACE FUNCTION public.ensure_product_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' OR NEW.code = 'sample_code' THEN
    NEW.code := public.product_code_code();
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_products_ensure_code ON public.products;
CREATE TRIGGER trg_products_ensure_code
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.ensure_product_code();

-- Corrigir já existentes
UPDATE public.products SET code = public.product_code_code() WHERE code = 'sample_code';

notify pgrst, 'reload schema';
commit;
