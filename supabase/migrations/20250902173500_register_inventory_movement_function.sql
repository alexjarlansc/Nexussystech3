-- Função unificada para registrar movimentos direto em inventory_movements
-- Objetivo: parar de usar stock_movements e padronizar INSERTs
-- Convenção escolhida (mantendo constraint quantity > 0):
--  ENTADA  -> incrementa estoque (quantity positivo)
--  SAIDA   -> decrementa estoque (quantity positivo; cálculo trata como saída)
--  AJUSTE  -> ajuste manual (positivo = aumenta, negativo = diminui) => Para suportar negativo precisamos relaxar a constraint
-- Ajuste da constraint para permitir negativo apenas para AJUSTE

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname='inventory_movements' AND c.conname='inventory_movements_quantity_check'
  ) THEN
    ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_quantity_check;
  END IF;
END$$;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_quantity_check
  CHECK (
    (type IN ('ENTRADA','SAIDA') AND quantity > 0) OR
    (type = 'AJUSTE' AND quantity <> 0)
  );

-- Função para registrar movimento (aceita signed_qty, converte conforme regra acima)
create or replace function public.register_inventory_movement(
  p_product_id uuid,
  p_operation text,          -- 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  p_quantity numeric,        -- sempre valor absoluto para ENT/SAI, pode ser signed para AJUSTE
  p_reference text default null,
  p_notes text default null
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
DECLARE
  v_type text;
  v_qty numeric;
  v_row jsonb;
BEGIN
  v_type := upper(p_operation);
  IF v_type NOT IN ('ENTRADA','SAIDA','AJUSTE') THEN
    RAISE EXCEPTION 'Operação inválida: %', v_type USING HINT='Use ENTADA, SAIDA ou AJUSTE';
  END IF;

  IF v_type IN ('ENTRADA','SAIDA') THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser > 0 para ENT/SAI';
    END IF;
    v_qty := p_quantity; -- mantemos positivo; cálculo tratará SAIDA como saída
  ELSE
    -- AJUSTE pode ser positivo ou negativo
    IF p_quantity = 0 THEN RAISE EXCEPTION 'AJUSTE zero não permitido'; END IF;
    v_qty := p_quantity; -- pode ser negativo
  END IF;

  INSERT INTO public.inventory_movements(product_id, type, quantity, reference, notes, created_by, company_id)
  SELECT p_product_id,
         v_type,
         v_qty,
         p_reference,
         p_notes,
         auth.uid(),
         pr.company_id
  FROM public.profiles pr
  WHERE pr.user_id = auth.uid()
  LIMIT 1
  RETURNING to_jsonb(inventory_movements.*) INTO v_row;

  IF v_row IS NULL THEN
    -- fallback se não houver profile
    INSERT INTO public.inventory_movements(product_id, type, quantity, reference, notes, created_by)
    VALUES (p_product_id, v_type, v_qty, p_reference, p_notes, auth.uid())
    RETURNING to_jsonb(inventory_movements.*) INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'movement', v_row);
END;$$;

grant execute on function public.register_inventory_movement(uuid,text,numeric,text,text) to authenticated, anon;

comment on function public.register_inventory_movement(uuid,text,numeric,text,text) is 'Registra movimento padronizado em inventory_movements (ENTRADA/SAIDA com qty>0, AJUSTE qty signed).';

-- Atualiza função de cálculo para tratar AJUSTE signed (positivos e negativos)
create or replace function public.calc_product_stock()
returns table(product_id uuid, stock numeric, reserved numeric, available numeric)
security definer
set search_path = public
language plpgsql
as $$
BEGIN
  RETURN QUERY
  WITH inv AS (
    SELECT m.product_id,
      COALESCE(SUM(CASE
        WHEN m.type='ENTRADA' THEN m.quantity
        WHEN m.type='SAIDA' THEN -abs(m.quantity)
        WHEN m.type='AJUSTE' THEN m.quantity  -- já pode ser signed
        ELSE 0 END),0) AS stock
    FROM public.inventory_movements m
    GROUP BY m.product_id
  ), reserved AS (
    SELECT (item->>'productId')::uuid AS product_id,
           SUM( (item->>'quantity')::numeric ) AS reserved
    FROM public.quotes q
    CROSS JOIN LATERAL jsonb_array_elements(q.items) item
    WHERE q.type='PEDIDO'
      AND q.status='Rascunho'
      AND (item->>'productId') IS NOT NULL
    GROUP BY (item->>'productId')
  )
  SELECT p.id,
         COALESCE(inv.stock,0) AS stock,
         COALESCE(reserved.reserved,0) AS reserved,
         (COALESCE(inv.stock,0) - COALESCE(reserved.reserved,0)) AS available
  FROM public.products p
  LEFT JOIN inv ON inv.product_id = p.id
  LEFT JOIN reserved ON reserved.product_id = p.id;
END;$$;

grant execute on function public.calc_product_stock() to authenticated, anon;

create or replace view public.product_stock as
select * from public.calc_product_stock();

grant select on public.product_stock to authenticated, anon;

-- Recria views dependentes se existirem
create or replace view public.inventory as
select
  ps.product_id as id,
  ps.product_id,
  p.code as product_code,
  ps.stock as quantity_on_hand,
  ps.reserved,
  ps.available
from public.product_stock ps
left join public.products p on p.id = ps.product_id;

grant select on public.inventory to authenticated, anon;

create or replace view public.products_with_stock as
select p.*, ps.stock, ps.reserved, ps.available
from public.products p
left join public.product_stock ps on ps.product_id = p.id;

grant select on public.products_with_stock to authenticated, anon;

-- Reload
notify pgrst, 'reload schema';
