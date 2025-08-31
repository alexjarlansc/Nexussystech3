-- Criação de estrutura de Vendas (PDV)
-- Função geradora de número sequencial (prefixo VEN-)
DO $$ BEGIN
  CREATE SEQUENCE IF NOT EXISTS public.sale_number_seq START 1;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.next_sale_number()
RETURNS text AS $$
DECLARE
  n bigint;
BEGIN
  SELECT nextval('public.sale_number_seq') INTO n;
  RETURN 'VEN-' || lpad(n::text, 6, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Tabela principal de vendas
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  quote_id uuid NULL REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_snapshot jsonb NOT NULL,
  vendor jsonb NULL,
  operator_id uuid NULL,
  items jsonb NOT NULL,
  payments jsonb NULL,
  payment_plan jsonb NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  freight numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'FINALIZADA',
  payment_status text NOT NULL DEFAULT 'PAGO',
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_company_idx ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS sales_quote_idx ON public.sales(quote_id);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON public.sales(created_at DESC);

-- RLS e políticas se ainda não aplicadas
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY sales_select ON public.sales FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sales_insert ON public.sales FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sales_update ON public.sales FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sales_delete ON public.sales FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
