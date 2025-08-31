-- Full recreate product code generation stack
-- Data: 2025-08-31 19:15
begin;

-- Garantir tabela de log
create table if not exists public.product_code_generation_log (
  id bigserial primary key,
  company_id uuid null,
  generated_code text not null,
  sequence_value bigint not null,
  prefix_used text null,
  source_function text not null default 'generate_product_code_info',
  created_at timestamptz not null default now()
);

-- Garantir sequence
DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
    CREATE SEQUENCE public.product_code_seq START 1;
  END IF;
END $$;

-- Permissões sequence
GRANT USAGE, SELECT ON SEQUENCE public.product_code_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.product_code_seq TO service_role;

-- Drop/recreate funções para limpar versões inconsistentes
DROP FUNCTION IF EXISTS public.generate_product_code_info(text);
DROP FUNCTION IF EXISTS public.generate_product_code();

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
  -- Tenta company_id
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
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  RETURN jsonb_build_object(
    'code', v_code,
    'sequence', v_seq,
    'company_id', v_company_id,
    'prefix', v_prefix,
    'source', 'sequence'
  );
END;
$$;

COMMENT ON FUNCTION public.generate_product_code_info IS 'Unified generator returning JSON metadata';
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO service_role;

-- Wrapper simples retornando apenas texto (facilita front / compatibilidade)
CREATE OR REPLACE FUNCTION public.generate_product_code(p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v jsonb;
BEGIN
  v := public.generate_product_code_info(p_prefix);
  RETURN COALESCE(v->>'code','');
END;$$;

COMMENT ON FUNCTION public.generate_product_code IS 'Wrapper textual para generate_product_code_info';
GRANT EXECUTE ON FUNCTION public.generate_product_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_code(text) TO service_role;

-- Selftest (recriar)
DROP FUNCTION IF EXISTS public.selftest_product_code_generation();
CREATE OR REPLACE FUNCTION public.selftest_product_code_generation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v jsonb;
  e text;
BEGIN
  BEGIN
    v := public.generate_product_code_info();
  EXCEPTION WHEN others THEN
    e := sqlerrm;
  END;
  IF e IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', e);
  END IF;
  RETURN jsonb_build_object('ok', true, 'result', v);
END;$$;
GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO service_role;

-- View de última geração (opcional para debug rápido)
CREATE OR REPLACE VIEW public.product_code_generation_last AS
  SELECT * FROM public.product_code_generation_log ORDER BY created_at DESC LIMIT 20;
GRANT SELECT ON public.product_code_generation_last TO authenticated;

-- Forçar reload
notify pgrst, 'reload schema';

commit;
