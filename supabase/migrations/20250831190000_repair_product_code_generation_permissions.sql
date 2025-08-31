-- Recriar função unificada de geração de código com SECURITY DEFINER e garantir permissões
-- Data: 2025-08-31 19:00
begin;

-- Garantir tabela de log (idempotente)
create table if not exists public.product_code_generation_log (
  id bigserial primary key,
  company_id uuid null,
  generated_code text not null,
  sequence_value bigint not null,
  prefix_used text null,
  source_function text not null default 'generate_product_code_info',
  created_at timestamptz not null default now()
);

-- Sequence (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
    CREATE SEQUENCE public.product_code_seq START 1;
  END IF;
END $$;

-- Ajustar ownership se necessário (opcional; comentado)
-- alter sequence public.product_code_seq owned by none;

-- Conceder permissões de uso da sequence
GRANT USAGE, SELECT ON SEQUENCE public.product_code_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.product_code_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.product_code_seq TO anon; -- se quiser permitir geração anônima (opcional)

-- Recriar função unificada retornando JSON com metadados
create or replace function public.generate_product_code_info(p_prefix text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
DECLARE
  v_company_id uuid;
  v_seq bigint;
  v_code text;
  v_prefix text;
BEGIN
  -- Obter company_id do profile do usuário logado (ignorar erros)
  BEGIN
    SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = auth.uid();
  EXCEPTION WHEN others THEN
    v_company_id := null;
  END;

  v_seq := nextval('public.product_code_seq');
  v_prefix := nullif(trim(p_prefix), '');
  IF v_prefix IS NOT NULL THEN
    v_code := v_prefix || lpad(v_seq::text, 6, '0');
  ELSE
    v_code := lpad(v_seq::text, 6, '0');
  END IF;

  -- Registrar log (não bloquear se falhar)
  BEGIN
    INSERT INTO public.product_code_generation_log(company_id, generated_code, sequence_value, prefix_used, source_function)
      VALUES (v_company_id, v_code, v_seq, v_prefix, 'generate_product_code_info');
  EXCEPTION WHEN others THEN
    -- ignorar
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

COMMENT ON FUNCTION public.generate_product_code_info IS 'Gera código de produto único (baseado em sequence) retornando JSON com metadados e registrando log.';

-- Grant execução
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_product_code_info(text) TO anon; -- opcional

-- Forçar PostgREST recarregar schema
notify pgrst, 'reload schema';

commit;
