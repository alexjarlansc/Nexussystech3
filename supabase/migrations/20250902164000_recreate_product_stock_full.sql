-- Recriação completa de função e view de estoque com coluna available
-- Inclui integração legacy (stock_movements) + novo modelo (inventory_movements)
-- Safe idempotent (create or replace)

-- Função principal
create or replace function public.calc_product_stock()
returns table(product_id text, stock numeric, reserved numeric, available numeric)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  with inv as (
    select
      m.product_id,
      coalesce(sum(case
        when m.type='ENTRADA' then m.quantity
        when m.type='AJUSTE' and m.quantity>0 then m.quantity
        else 0 end),0)
      - coalesce(sum(case
        when m.type='SAIDA' then m.quantity
        when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity)
        else 0 end),0) as stock
    from public.inventory_movements m
    group by m.product_id
  ), legacy as (
    select sm.product_id, coalesce(sum(sm.signed_qty),0) as legacy_stock
    from public.stock_movements sm
    group by sm.product_id
  ), base as (
    -- Se já existe linha em inventory_movements para o produto, ignora legado para evitar duplicar
    select coalesce(i.product_id, l.product_id) as product_id,
           (coalesce(i.stock,0) + case when i.product_id is not null then 0 else coalesce(l.legacy_stock,0) end) as stock
    from inv i
    full join legacy l on l.product_id = i.product_id
  ), reserved as (
    select (item->>'productId') as product_id,
           sum( (item->>'quantity')::numeric ) as reserved
    from public.quotes q
    cross join lateral jsonb_array_elements(q.items) item
    where q.type='PEDIDO' and q.status='Rascunho' and (item->>'productId') is not null
    group by (item->>'productId')
  )
  select coalesce(b.product_id, r.product_id) as product_id,
         b.stock,
         coalesce(r.reserved,0) as reserved,
         (coalesce(b.stock,0) - coalesce(r.reserved,0)) as available
  from base b
  full outer join reserved r on r.product_id = b.product_id;
end;$$;

comment on function public.calc_product_stock() is 'Calcula estoque agregando inventory_movements + legado stock_movements (se produto sem movimentos novos), e reserva de PEDIDO Rascunho.';

grant execute on function public.calc_product_stock() to authenticated, anon;

-- View wrapper
create or replace view public.product_stock as
select * from public.calc_product_stock();

comment on view public.product_stock is 'Estoque (stock), reservado (PEDIDO Rascunho) e disponível (available).';

grant select on public.product_stock to authenticated, anon;

-- Função opcional para migrar definitivamente legado para inventory_movements
-- Só insere entradas para produtos que NÃO têm movimentos na tabela nova
create or replace function public.migrate_legacy_stock_to_inventory(ref_text text default 'Migracao Legacy')
returns integer
security definer
set search_path = public
language plpgsql
as $$
declare inserted_count int := 0;
begin
  with legacy as (
    select sm.product_id, sum(sm.signed_qty) legacy_stock
    from public.stock_movements sm
    group by sm.product_id
  ), already as (
    select distinct product_id from public.inventory_movements
  ), to_insert as (
    select l.product_id, l.legacy_stock from legacy l
    left join already a on a.product_id = l.product_id
    where a.product_id is null and l.legacy_stock > 0
  )
  insert into public.inventory_movements(product_id, type, quantity, reference)
  select product_id, 'ENTRADA', legacy_stock, ref_text from to_insert
  returning 1; -- só para contar

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;$$;

comment on function public.migrate_legacy_stock_to_inventory is 'Copiar saldos positivos de stock_movements para inventory_movements como ENTRADA quando produto ainda não tem movimentos novos.';

grant execute on function public.migrate_legacy_stock_to_inventory(text) to authenticated, anon;

-- Função de debug rápida
create or replace function public.debug_stock_overview()
returns json
security definer
set search_path = public
language plpgsql
as $$
declare js json;
begin
  select json_build_object(
    'inv_movements', (select count(*) from public.inventory_movements),
    'legacy_movements', (select count(*) from public.stock_movements),
    'products_inv', (select count(distinct product_id) from public.inventory_movements),
    'products_legacy', (select count(distinct product_id) from public.stock_movements),
    'product_stock_columns', (select json_agg(column_name) from information_schema.columns where table_schema='public' and table_name='product_stock'),
    'sample', (select json_agg(x) from (select * from public.product_stock order by available desc nulls last limit 10) x)
  ) into js;
  return js;
end;$$;

grant execute on function public.debug_stock_overview() to authenticated, anon;

-- Reload PostgREST
notify pgrst, 'reload schema';
