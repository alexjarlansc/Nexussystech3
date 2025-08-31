-- Wrappers zero-arg para evitar falha de cache (PostgREST procurando função sem parâmetros)
-- Data: 2025-08-31 19:45
begin;

-- Garantir base
DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
    CREATE SEQUENCE public.product_code_seq START 1;
  END IF;
END $$;

-- Certificar função principal existe (não recria lógica se já ok)
-- (Se não existir, cria mínima)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='generate_product_code_info'
  ) THEN
    EXECUTE $$CREATE FUNCTION public.generate_product_code_info(p_prefix text DEFAULT NULL)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS 'DECLARE v_seq bigint; v_code text; BEGIN v_seq:=nextval(''public.product_code_seq''); IF p_prefix IS NOT NULL AND length(trim(p_prefix))>0 THEN v_code:=trim(p_prefix)||lpad(v_seq::text,6,''0''); ELSE v_code:=lpad(v_seq::text,6,''0''); END IF; RETURN jsonb_build_object(''code'',v_code,''sequence'',v_seq); END;' $$;
  END IF;
END $$;

-- Zero-arg JSON wrapper
create or replace function public.product_code_info()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
DECLARE v jsonb; BEGIN v := public.generate_product_code_info(); RETURN v; END;$$;

-- Zero-arg TEXT wrapper
create or replace function public.product_code_code()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
DECLARE v jsonb; BEGIN v := public.generate_product_code_info(); RETURN v->>'code'; END;$$;

grant execute on function public.product_code_info() to authenticated;
grant execute on function public.product_code_info() to service_role;
grant execute on function public.product_code_code() to authenticated;
grant execute on function public.product_code_code() to service_role;

notify pgrst, 'reload schema';
commit;
