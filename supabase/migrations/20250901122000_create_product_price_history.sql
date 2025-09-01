-- Cria tabela de histórico de alterações de preços de produtos
BEGIN;

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id            bigserial PRIMARY KEY,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid NULL REFERENCES auth.users(id),
  old_price     numeric(18,4),
  new_price     numeric(18,4),
  old_cost      numeric(18,4),
  new_cost      numeric(18,4),
  old_margin    numeric(18,4),
  new_margin    numeric(18,4),
  old_icms      numeric(10,4),
  new_icms      numeric(10,4),
  old_pis       numeric(10,4),
  new_pis       numeric(10,4),
  old_cofins    numeric(10,4),
  new_cofins    numeric(10,4),
  context       jsonb
);

CREATE INDEX IF NOT EXISTS product_price_history_product_id_idx ON public.product_price_history (product_id, changed_at DESC);

-- RLS (opcional simples)
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_price_history' AND policyname='pph_select'
  ) THEN
    CREATE POLICY pph_select ON public.product_price_history FOR SELECT TO authenticated USING ( true );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_price_history' AND policyname='pph_insert'
  ) THEN
    CREATE POLICY pph_insert ON public.product_price_history FOR INSERT TO authenticated WITH CHECK ( true );
  END IF;
END $$;

COMMENT ON TABLE public.product_price_history IS 'Histórico de alterações de preço / margem e tributos.';

COMMIT;

-- Down
-- BEGIN;
-- DROP TABLE IF EXISTS public.product_price_history;
-- COMMIT;
