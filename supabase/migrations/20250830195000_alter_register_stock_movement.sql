-- Ajusta função para permitir ajuste negativo preservando sinal informado para ADJUSTMENT
create or replace function public.register_stock_movement(
  p_product_id uuid,
  p_qty numeric,
  p_type text,
  p_reason text default null,
  p_location_from text default null,
  p_location_to text default null,
  p_related_sale_id uuid default null,
  p_metadata jsonb default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_group uuid := gen_random_uuid();
  v_row jsonb;
begin
  if p_type = 'TRANSFER' then
    insert into public.stock_movements(product_id, signed_qty, type, reason, location, related_sale_id, movement_group, metadata)
    values (p_product_id, -abs(p_qty), 'TRANSFER_OUT', p_reason, p_location_from, p_related_sale_id, v_group, p_metadata);
    insert into public.stock_movements(product_id, signed_qty, type, reason, location, related_sale_id, movement_group, metadata)
    values (p_product_id, abs(p_qty), 'TRANSFER_IN', p_reason, p_location_to, p_related_sale_id, v_group, p_metadata);
  else
    insert into public.stock_movements(product_id, signed_qty, type, reason, location, related_sale_id, movement_group, metadata)
    values (
      p_product_id,
      case 
        when p_type = 'ADJUSTMENT' then p_qty -- preserva sinal
        when p_type in ('IN','RETURN','EXCHANGE') then abs(p_qty)
        else -abs(p_qty)
      end,
      p_type,
      p_reason,
      coalesce(p_location_from, p_location_to),
      p_related_sale_id,
      v_group,
      p_metadata
    ) returning row_to_json(stock_movements.*)::jsonb into v_row;
  end if;
  return jsonb_build_object('movement_group', v_group, 'ok', true, 'type', p_type, 'qty', p_qty);
end;$$;
