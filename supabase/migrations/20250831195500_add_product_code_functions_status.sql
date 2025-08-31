-- Função de diagnóstico do estado das funções de geração de código
-- Data: 2025-08-31 19:55
begin;
create or replace function public.product_code_functions_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
DECLARE v jsonb; BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'args', pg_get_function_arguments(p.oid),
    'rettype', pg_get_function_result(p.oid),
    'secdef', p.prosecdef,
    'volatility', p.provolatile,
    'schema', n.nspname
  ))
  INTO v
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'product_code_code',
      'product_code_info',
      'generate_product_code_info',
      'generate_product_code',
      'simple_next_product_code',
      'selftest_product_code_generation'
    );
  RETURN jsonb_build_object(
    'functions', COALESCE(v, '[]'::jsonb),
    'now', now()
  );
END;$$;

grant execute on function public.product_code_functions_status() to authenticated;
notify pgrst, 'reload schema';
commit;
