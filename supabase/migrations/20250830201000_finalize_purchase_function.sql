-- Função para fechar compra e gerar movimentações de estoque
create or replace function public.finalize_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_items jsonb;
  v_row record;
begin
  -- Atualiza status somente se ainda aberta
  update public.purchases set status = 'FECHADA'
  where id = p_purchase_id and status = 'ABERTA'
  returning items into v_items;
  if v_items is null then
    return jsonb_build_object('ok', false, 'error', 'Compra não encontrada ou já fechada');
  end if;

  for v_row in
    select (item->>'product_id')::uuid as product_id,
           coalesce((item->>'qty')::numeric,0) as qty
    from jsonb_array_elements(v_items) as item
    where item ? 'product_id'
  loop
    perform public.register_stock_movement(
      v_row.product_id,
      v_row.qty,
      'IN',
      'COMPRA',
      null,
      null,
      null,
      jsonb_build_object('purchase_id', p_purchase_id)
    );
  end loop;
  return jsonb_build_object('ok', true);
end;$$;

grant execute on function public.finalize_purchase(uuid) to anon, authenticated;
