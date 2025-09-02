-- Unify numbering so numeric part is global (no overlap between ORC and PED)
-- Creates a global sequence and updates next_quote_number to use it.

-- 1. Create global sequence if not exists
create sequence if not exists public.quote_number_seq;

-- 2. Compute current max numeric part from existing quotes (strip prefix before first dash)
DO $$
DECLARE
  max_num bigint;
BEGIN
  SELECT max( (regexp_replace(number,'^[A-Z]+-',''))::bigint ) INTO max_num FROM public.quotes WHERE number ~ '^[A-Z]+-[0-9]+';
  IF max_num IS NULL THEN
    max_num := 0;
  END IF;
  PERFORM setval('public.quote_number_seq', max_num);
END $$;

-- 3. Replace function to use global sequence (10 digit padding)
create or replace function public.next_quote_number(p_type text)
returns text
language plpgsql
as $$
DECLARE
  prefix text;
  new_val bigint;
BEGIN
  IF p_type not in ('ORCAMENTO','PEDIDO') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_type;
  END IF;
  prefix := CASE WHEN p_type='PEDIDO' THEN 'PED' ELSE 'ORC' END;
  SELECT nextval('public.quote_number_seq') INTO new_val;
  RETURN prefix || '-' || lpad(new_val::text,10,'0');
END;$$ volatile;

-- 4. (Optional) Keep old quote_counters table for history, no longer used.
COMMENT ON FUNCTION public.next_quote_number(text) IS 'Gera número global único com parte numérica compartilhada entre ORC e PED (sem sobreposição).';
