-- Função de autodiagnóstico geração de código
-- Data: 2025-08-31 19:05
begin;
create or replace function public.selftest_product_code_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_attempt jsonb;
  v_err text;
BEGIN
  BEGIN
    v_attempt := public.generate_product_code_info();
  EXCEPTION WHEN others THEN
    v_err := sqlerrm;
  END;
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', v_err
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'result', v_attempt
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.selftest_product_code_generation() TO service_role;
notify pgrst, 'reload schema';
commit;
