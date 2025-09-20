-- Migration: create purchase_requests table

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NULL,
  company_id uuid NULL,
  items jsonb NOT NULL, -- [{product_id, product_code, qty, notes}]
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | APROVADA | REJEITADA | CANCELADA
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS purchase_requests_company_idx ON public.purchase_requests(company_id);
CREATE INDEX IF NOT EXISTS purchase_requests_created_at_idx ON public.purchase_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_requests_status_idx ON public.purchase_requests(status);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY purchase_requests_select ON public.purchase_requests FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY purchase_requests_insert ON public.purchase_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY purchase_requests_update ON public.purchase_requests FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY purchase_requests_delete ON public.purchase_requests FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.purchase_requests IS 'Solicitações de compras (rascunhos e pedidos para aprovação)';
