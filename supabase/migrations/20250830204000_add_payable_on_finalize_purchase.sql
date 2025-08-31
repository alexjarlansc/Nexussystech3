-- Adiciona criação automática de título a pagar ao finalizar compra
-- Safe redefinition da função finalize_purchase para também gerar payables
CREATE OR REPLACE FUNCTION public.finalize_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items jsonb;
  v_row record;
  v_purchase record;
  v_payable_number text;
BEGIN
  -- Busca a compra ainda aberta
  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id AND status = 'ABERTA';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Compra não encontrada ou já fechada');
  END IF;

  -- Atualiza status e captura itens
  UPDATE public.purchases SET status = 'FECHADA' WHERE id = p_purchase_id RETURNING items INTO v_items;

  -- Movimenta estoque
  FOR v_row IN
    SELECT (item->>'product_id')::uuid AS product_id,
           COALESCE((item->>'qty')::numeric,0) AS qty
    FROM jsonb_array_elements(v_items) AS item
    WHERE item ? 'product_id'
  LOOP
    PERFORM public.register_stock_movement(
      v_row.product_id,
      v_row.qty,
      'IN',
      'COMPRA',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('purchase_id', p_purchase_id)
    );
  END LOOP;

  -- Gera contas a pagar (único título simples se houver total > 0)
  IF COALESCE(v_purchase.total,0) > 0 THEN
    SELECT public.next_payable_number() INTO v_payable_number;
    INSERT INTO public.payables (
      payable_number, supplier_id, supplier_snapshot, description, issue_date, due_date, amount, paid_amount, status, notes, company_id, created_by
    ) VALUES (
      v_payable_number,
      v_purchase.supplier_id,
      v_purchase.supplier_snapshot,
      'Compra '|| v_purchase.purchase_number,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      v_purchase.total,
      0,
      'ABERTO',
      v_purchase.notes,
      v_purchase.company_id,
      v_purchase.created_by
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;$$;

COMMENT ON FUNCTION public.finalize_purchase(uuid) IS 'Fecha compra, gera movimentos de estoque e título a pagar simples';
