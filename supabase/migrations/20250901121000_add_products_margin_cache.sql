-- Adiciona coluna opcional para armazenar última margem calculada / aplicada
-- Forward compatible: coluna pode ser removida sem quebrar lógica (frontend testa ou ignora)
-- Down migration: apenas remove a coluna

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS margin_cache numeric(12,4);

COMMENT ON COLUMN public.products.margin_cache IS 'Última margem (%) calculada/aplicada pelo módulo de precificação';

-- Opcional: backfill inicial baseado em relação entre sale_price e cost_price (ignorando tributos)
DO $$
DECLARE r RECORD; c NUMERIC; v NUMERIC; m NUMERIC; BEGIN
  FOR r IN SELECT id, cost_price, COALESCE(sale_price, price) AS sp FROM public.products LOOP
    IF r.cost_price IS NOT NULL AND r.cost_price > 0 AND r.sp IS NOT NULL THEN
      c := r.cost_price; v := r.sp; m := ((v - c)/c)*100;
      UPDATE public.products SET margin_cache = ROUND(m::numeric,4) WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Down
-- BEGIN;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS margin_cache;
-- COMMIT;
