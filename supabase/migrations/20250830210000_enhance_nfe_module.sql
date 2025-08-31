-- Enhance NF-e module: config, taxes, audit, corrections, DANFe, receivable integration

-- 1. Config table
CREATE TABLE IF NOT EXISTS public.nfe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  environment text NOT NULL DEFAULT 'TEST', -- TEST|PROD
  series integer NOT NULL DEFAULT 1,
  last_number integer NOT NULL DEFAULT 0,
  csc_id text NULL,
  csc_token text NULL,
  cert_pfx_base64 text NULL,
  cert_password text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nfe_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY nfe_config_select ON public.nfe_config FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_config_upsert ON public.nfe_config FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY nfe_config_update ON public.nfe_config FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Product fiscal fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cfop text NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cest text NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cst text NULL; -- CST ou CSOSN
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS origin text NULL; -- 0..8
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icms_rate numeric(7,4) NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pis_rate numeric(7,4) NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cofins_rate numeric(7,4) NULL;

-- 3. Audit table
CREATE TABLE IF NOT EXISTS public.nfe_audit (
  id bigserial PRIMARY KEY,
  invoice_id uuid NOT NULL,
  action text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NULL,
  new_data jsonb NULL,
  user_id uuid NULL
);
ALTER TABLE public.nfe_audit ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY nfe_audit_select ON public.nfe_audit FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.trg_nfe_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.nfe_audit(invoice_id, action, new_data, user_id) VALUES(NEW.id,'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO public.nfe_audit(invoice_id, action, old_data, new_data, user_id) VALUES(NEW.id,'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO public.nfe_audit(invoice_id, action, old_data, user_id) VALUES(OLD.id,'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;

DO $$ BEGIN
  CREATE TRIGGER nfe_invoices_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.nfe_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_nfe_audit();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Functions
-- Upsert config (single row per company simplest) - using first row if exists
CREATE OR REPLACE FUNCTION public.upsert_nfe_config(p_environment text, p_series integer, p_csc_id text, p_csc_token text, p_cert_pfx_base64 text, p_cert_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid; BEGIN
  SELECT id INTO v_id FROM public.nfe_config LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.nfe_config(environment,series,csc_id,csc_token,cert_pfx_base64,cert_password) VALUES(p_environment,p_series,p_csc_id,p_csc_token,p_cert_pfx_base64,p_cert_password);
  ELSE
    UPDATE public.nfe_config SET environment=p_environment, series=p_series, csc_id=p_csc_id, csc_token=p_csc_token, cert_pfx_base64=p_cert_pfx_base64, cert_password=p_cert_password, updated_at=now() WHERE id=v_id;
  END IF;
  RETURN jsonb_build_object('ok',true);
END;$$;

CREATE OR REPLACE FUNCTION public.get_nfe_config()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v jsonb; BEGIN
  SELECT to_jsonb(t) INTO v FROM public.nfe_config t LIMIT 1;
  RETURN v;
END;$$;

-- Compute taxes placeholder: fill taxes array inside invoices.items
CREATE OR REPLACE FUNCTION public.compute_nfe_taxes(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; v_item jsonb; v_new_items jsonb := '[]'::jsonb; idx int := 0; v_prod record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id=p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  FOR v_item IN SELECT jsonb_array_elements(v_inv.items) AS itm LOOP
    idx := idx + 1;
    SELECT * INTO v_prod FROM public.products WHERE id = (v_item.itm->>'product_id')::uuid;
    v_new_items := v_new_items || jsonb_build_array(
      (v_item.itm || jsonb_build_object(
        'taxes', jsonb_build_object(
          'ICMS', jsonb_build_object('rate', coalesce(v_prod.icms_rate,0), 'value', round( coalesce(v_prod.icms_rate,0) * ( (v_item.itm->>'total')::numeric / 100 ),2)),
          'PIS', jsonb_build_object('rate', coalesce(v_prod.pis_rate,0), 'value', round( coalesce(v_prod.pis_rate,0) * ( (v_item.itm->>'total')::numeric / 100 ),2)),
          'COFINS', jsonb_build_object('rate', coalesce(v_prod.cofins_rate,0), 'value', round( coalesce(v_prod.cofins_rate,0) * ( (v_item.itm->>'total')::numeric / 100 ),2))
        ),
        'ncm', v_prod.ncm, 'cfop', v_prod.cfop, 'cest', v_prod.cest, 'cst', v_prod.cst, 'origin', v_prod.origin
      ))
    );
  END LOOP;
  UPDATE public.nfe_invoices SET items = v_new_items WHERE id = p_invoice_id;
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Generate XML (simplified) using current items
CREATE OR REPLACE FUNCTION public.generate_nfe_xml(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; v_xml text; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  v_xml := '<NFe><infNFe versao="4.00"><ide><nNF>'||v_inv.nfe_number||'</nNF><serie>'||v_inv.series||'</serie></ide><detItens>'||
    (SELECT string_agg('<det><nItem>'||(i.ordinality)::text||'</nItem><prod><cProd>'||coalesce(i.elem->>'product_id','0')||'</cProd><xProd>'||coalesce(i.elem->>'description','ITEM')||'</xProd><qCom>'||coalesce(i.elem->>'quantity','1')||'</qCom><vUnCom>'||coalesce(i.elem->>'unit_price','0')||'</vUnCom><vProd>'||coalesce(i.elem->>'total','0')||'</vProd></prod></det>','') FROM jsonb_array_elements(v_inv.items) WITH ORDINALITY AS i(elem, ordinality))||'</detItens></infNFe></NFe>';
  UPDATE public.nfe_invoices SET xml_draft = v_xml WHERE id = p_invoice_id;
  RETURN jsonb_build_object('ok',true,'xml',v_xml);
END;$$;

-- Modify sign to require xml_draft
CREATE OR REPLACE FUNCTION public.sign_nfe(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.xml_draft IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Gerar XML primeiro'); END IF;
  IF v_inv.status <> 'DRAFT' THEN RETURN jsonb_build_object('ok',false,'error','Status inválido'); END IF;
  UPDATE public.nfe_invoices SET status='SIGNED', xml_signed = xml_draft WHERE id = p_invoice_id;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'STATUS',jsonb_build_object('new','SIGNED'));
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Transmit: simulate rejection if missing any item NCM
CREATE OR REPLACE FUNCTION public.transmit_nfe(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; v_missing boolean := false; v_item jsonb; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status NOT IN ('SIGNED','SENT') THEN RETURN jsonb_build_object('ok',false,'error','Status inválido'); END IF;
  FOR v_item IN SELECT jsonb_array_elements(v_inv.items) AS itm LOOP
    IF NOT (v_item.itm ? 'ncm') THEN v_missing := true; EXIT; END IF;
  END LOOP;
  IF v_missing THEN
    UPDATE public.nfe_invoices SET status='REJECTED', rejection_reason='Falta NCM em item' WHERE id = p_invoice_id;
    INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'STATUS',jsonb_build_object('new','REJECTED','reason','Falta NCM'));
    RETURN jsonb_build_object('ok',false,'error','Rejeitada: falta NCM');
  END IF;
  UPDATE public.nfe_invoices SET status='AUTHORIZED', authorized_at = now(), xml_protocol = 'PROTO-'||substr(md5(random()::text),1,10) WHERE id = p_invoice_id;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'STATUS',jsonb_build_object('new','AUTHORIZED'));
  -- 9. Generate receivable if not exists
  PERFORM 1 FROM public.receivables WHERE sale_id = v_inv.sale_id LIMIT 1;
  IF NOT FOUND AND v_inv.sale_id IS NOT NULL THEN
    PERFORM public.next_receivable_number(); -- ensure sequence increments even if not used directly
    INSERT INTO public.receivables (receivable_number, sale_id, description, due_date, amount, received_amount, status)
      VALUES (public.next_receivable_number(), v_inv.sale_id, 'NF-e '||v_inv.nfe_number, CURRENT_DATE + INTERVAL '30 days', v_inv.total_invoice, 0, 'ABERTO');
  END IF;
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Cancel with 24h rule
CREATE OR REPLACE FUNCTION public.cancel_nfe(p_invoice_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status <> 'AUTHORIZED' THEN RETURN jsonb_build_object('ok',false,'error','Somente autorizada'); END IF;
  IF now() - v_inv.authorized_at > INTERVAL '24 hours' THEN RETURN jsonb_build_object('ok',false,'error','Prazo cancelamento excedido'); END IF;
  UPDATE public.nfe_invoices SET status='CANCELLED', cancelled_at = now(), rejection_reason = p_reason WHERE id = p_invoice_id;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'CANCEL',jsonb_build_object('reason',p_reason));
  RETURN jsonb_build_object('ok',true);
END;$$;

-- Correction letter
CREATE OR REPLACE FUNCTION public.add_nfe_correction(p_invoice_id uuid, p_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT id,status INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NF-e não encontrada'); END IF;
  IF v_inv.status NOT IN ('AUTHORIZED','REJECTED') THEN RETURN jsonb_build_object('ok',false,'error','Status não permite CC-e'); END IF;
  INSERT INTO public.nfe_events(invoice_id,event_type,payload) VALUES(p_invoice_id,'CCORRECAO',jsonb_build_object('text',p_text));
  RETURN jsonb_build_object('ok',true);
END;$$;

-- DANFe HTML
CREATE OR REPLACE FUNCTION public.generate_danfe_html(p_invoice_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_inv record; BEGIN
  SELECT * INTO v_inv FROM public.nfe_invoices WHERE id = p_invoice_id; IF NOT FOUND THEN RETURN '<html><body>NF-e não encontrada</body></html>'; END IF;
  RETURN '<html><body><h1>DANFe (Mock)</h1><p>Número: '||v_inv.nfe_number||'</p><p>Status: '||v_inv.status||'</p></body></html>';
END;$$;

GRANT EXECUTE ON FUNCTION public.upsert_nfe_config(text,integer,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nfe_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_nfe_taxes(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_nfe_xml(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_nfe_correction(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_danfe_html(uuid) TO anon, authenticated;
-- sign_nfe, transmit_nfe, cancel_nfe already granted earlier (redefined here)
