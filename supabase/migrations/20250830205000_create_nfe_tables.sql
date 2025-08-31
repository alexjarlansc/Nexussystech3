-- NFe basic tables & functions (mock implementation)
DO $$ BEGIN CREATE SEQUENCE IF NOT EXISTS public.nfe_number_seq START 1; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.next_nfe_number()
RETURNS text AS $$
DECLARE n bigint; BEGIN SELECT nextval('public.nfe_number_seq') INTO n; RETURN lpad(n::text,9,'0'); END; $$ LANGUAGE plpgsql VOLATILE;

-- Header
CREATE TABLE IF NOT EXISTS public.nfe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_number text UNIQUE NOT NULL,
  series integer NOT NULL DEFAULT 1,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  client_snapshot jsonb NULL,
  emit_snapshot jsonb NULL, -- dados emitente (empresa)
  items jsonb NOT NULL, -- redundante com nfe_items, usado para rápido
  total_products numeric(14,2) NOT NULL DEFAULT 0,
  total_invoice numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT', -- DRAFT|SIGNED|SENT|AUTHORIZED|REJECTED|CANCELLED
  environment text NOT NULL DEFAULT 'TEST', -- TEST|PROD
  xml_draft text NULL,
  xml_signed text NULL,
  xml_protocol text NULL,
  rejection_reason text NULL,
  authorized_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nfe_invoices_status_idx ON public.nfe_invoices(status);
CREATE INDEX IF NOT EXISTS nfe_invoices_created_idx ON public.nfe_invoices(created_at DESC);

-- Items
CREATE TABLE IF NOT EXISTS public.nfe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.nfe_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 0,
  unit_price numeric(14,6) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  taxes jsonb NULL
);
CREATE INDEX IF NOT EXISTS nfe_items_invoice_idx ON public.nfe_items(invoice_id);

-- Events (cancellation, correction, status notes)
CREATE TABLE IF NOT EXISTS public.nfe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.nfe_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- CANCEL|CCORRECAO|STATUS
  payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX IF NOT EXISTS nfe_events_invoice_idx ON public.nfe_events(invoice_id);

ALTER TABLE public.nfe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY nfe_invoices_select ON public.nfe_invoices FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_invoices_insert ON public.nfe_invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_invoices_update ON public.nfe_invoices FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_invoices_delete ON public.nfe_invoices FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY nfe_items_select ON public.nfe_items FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_items_insert ON public.nfe_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_items_update ON public.nfe_items FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_items_delete ON public.nfe_items FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY nfe_events_select ON public.nfe_events FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_events_insert ON public.nfe_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mock signing (just copies draft)
CREATE OR REPLACE FUNCTION public.sign_nfe(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status <> 'DRAFT' THEN RETURN jsonb_build_object('ok',false,'error','Status inválido'); END IF;
  UPDATE public.nfe_invoices SET status='SIGNED', xml_signed = coalesce(xml_draft,'<xml/>') WHERE id = p_invoice_id;
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Mock transmit (authorize instantly)
CREATE OR REPLACE FUNCTION public.transmit_nfe(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status NOT IN ('SIGNED','SENT') THEN RETURN jsonb_build_object('ok',false,'error','Status inválido'); END IF;
  UPDATE public.nfe_invoices SET status='AUTHORIZED', authorized_at = now(), xml_protocol = 'PROTO-'||substr(md5(random()::text),1,10) WHERE id = p_invoice_id;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'STATUS',jsonb_build_object('new','AUTHORIZED'));
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Mock cancel
CREATE OR REPLACE FUNCTION public.cancel_nfe(p_invoice_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status <> 'AUTHORIZED' THEN RETURN jsonb_build_object('ok',false,'error','Somente autorizada pode cancelar'); END IF;
  UPDATE public.nfe_invoices SET status='CANCELLED', cancelled_at = now(), rejection_reason = p_reason WHERE id = p_invoice_id;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'CANCEL',jsonb_build_object('reason',p_reason));
  RETURN jsonb_build_object('ok',true);
END;$$;

GRANT EXECUTE ON FUNCTION public.next_nfe_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_nfe(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transmit_nfe(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_nfe(uuid,text) TO anon, authenticated;

COMMENT ON TABLE public.nfe_invoices IS 'NF-e headers (mock)';
COMMENT ON TABLE public.nfe_items IS 'NF-e items';
COMMENT ON TABLE public.nfe_events IS 'NF-e events (status/cancel/corrections)';
