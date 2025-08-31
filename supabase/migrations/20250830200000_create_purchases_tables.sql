-- Sequência e função para número de compra
DO $$ BEGIN
  CREATE SEQUENCE IF NOT EXISTS public.purchase_number_seq START 1;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.next_purchase_number()
RETURNS text AS $$
DECLARE
  n bigint;
BEGIN
  SELECT nextval('public.purchase_number_seq') INTO n;
  RETURN 'COMP-' || lpad(n::text, 6, '0');
END;$$ LANGUAGE plpgsql VOLATILE;

-- Tabela principal de compras
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number text UNIQUE NOT NULL,
  purchase_type text NOT NULL DEFAULT 'NORMAL', -- NORMAL | RETURN | EXCHANGE
  original_purchase_id uuid NULL REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_snapshot jsonb NULL,
  items jsonb NOT NULL, -- [{product_id, qty, unit_cost, total}]
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  freight numeric(14,2) NOT NULL DEFAULT 0,
  taxes jsonb NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ABERTA', -- ABERTA | FECHADA | CANCELADA
  xml_access_key text NULL,
  xml_raw text NULL,
  notes text NULL,
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_company_idx ON public.purchases(company_id);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS purchases_type_idx ON public.purchases(purchase_type);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY purchases_select ON public.purchases FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY purchases_insert ON public.purchases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY purchases_update ON public.purchases FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY purchases_delete ON public.purchases FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.purchases IS 'Registros de compras e retornos';
COMMENT ON COLUMN public.purchases.original_purchase_id IS 'Compra de origem em caso de retorno/troca';
