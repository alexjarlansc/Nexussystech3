-- Script manual idempotente para reparo da geração de código de produtos
-- Uso: colar no SQL Editor do Supabase e executar inteiro
begin;

DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
    CREATE SEQUENCE public.product_code_seq START 1;
  END IF;
END $$;

create table if not exists public.product_code_generation_log (
  id bigserial primary key,
  company_id uuid null,
  generated_code text not null,
  sequence_value bigint not null,
  prefix_used text null,
  source_function text not null default 'generate_product_code_info',
  created_at timestamptz not null default now()
);

grant usage, select on sequence public.product_code_seq to authenticated;
grant usage, select on sequence public.product_code_seq to service_role;

DROP FUNCTION IF EXISTS public.generate_product_code_info(text);
DROP FUNCTION IF EXISTS public.generate_product_code(text);
DROP FUNCTION IF EXISTS public.generate_product_code();
DROP FUNCTION IF EXISTS public.selftest_product_code_generation();

CREATE OR REPLACE FUNCTION public.generate_product_code_info(p_prefix text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_company_id uuid;
  v_seq bigint;
  v_code text;
  v_prefix text;
BEGIN
  BEGIN
    SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = auth.uid();
  EXCEPTION WHEN others THEN
    v_company_id := NULL;
  END;
  v_seq := nextval('public.product_code_seq');
  v_prefix := NULLIF(trim(p_prefix), '');
  IF v_prefix IS NOT NULL THEN
    v_code := v_prefix || lpad(v_seq::text, 6, '0');
  ELSE
    v_code := lpad(v_seq::text, 6, '0');
  END IF;
  BEGIN
    INSERT INTO public.product_code_generation_log(company_id, generated_code, sequence_value, prefix_used, source_function)
    VALUES (v_company_id, v_code, v_seq, v_prefix, 'generate_product_code_info');
  EXCEPTION WHEN others THEN END;
  RETURN jsonb_build_object(
    'code', v_code,
    'sequence', v_seq,
    'company_id', v_company_id,
    'prefix', v_prefix,
    'source', 'sequence'
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_product_code(p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE v jsonb; BEGIN v := public.generate_product_code_info(p_prefix); RETURN COALESCE(v->>'code',''); END;$$;
GRANT EXECUTE ON FUNCTION public.generate_product_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_code(text) TO service_role;

CREATE OR REPLACE FUNCTION public.selftest_product_code_generation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE v jsonb; e text; BEGIN BEGIN v := public.generate_product_code_info(); EXCEPTION WHEN others THEN e := sqlerrm; END; IF e IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error',e); END IF; RETURN jsonb_build_object('ok',true,'result',v); END;$$;
GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO service_role;

CREATE OR REPLACE VIEW public.product_code_generation_last AS
  SELECT * FROM public.product_code_generation_log ORDER BY created_at DESC LIMIT 20;
GRANT SELECT ON public.product_code_generation_last TO authenticated;

notify pgrst, 'reload schema';
commit;

-- Testes:
-- select selftest_product_code_generation();
-- select generate_product_code_info();
-- select generate_product_code();
-- select * from product_code_generation_last;
