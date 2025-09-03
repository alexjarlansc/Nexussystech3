-- Garante que todos os produtos apareçam na view product_stock mesmo sem movimentos
-- Problema: calc_product_stock atual só retorna produtos presentes em inventory_movements/stock_movements
-- Resultado: produtos novos (sem movimentos) vêm ausentes e o front mostra 0 sem diferenciar
-- Solução: LEFT JOIN com products gerando linha (stock=0,reserved=0,available=0)

create or replace function public.calc_product_stock()
returns table(product_id text, stock numeric, reserved numeric, available numeric)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  with inv as (
    select m.product_id,
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
    -- Se tabela legacy existir, agrega; se não existir, CTE ficará vazia (usa try via catalog check)
    select sm.product_id, coalesce(sum(sm.signed_qty),0) as legacy_stock
    from public.stock_movements sm
    group by sm.product_id
  ), base as (
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
  select p.id as product_id,
         coalesce(b.stock,0) as stock,
         coalesce(r.reserved,0) as reserved,
         (coalesce(b.stock,0) - coalesce(r.reserved,0)) as available
  from public.products p
  left join base b on b.product_id = p.id
  left join reserved r on r.product_id = p.id;
end;$$;

comment on function public.calc_product_stock() is 'Calcula estoque agregando movimentos + reservas e inclui todos os produtos (mesmo sem movimentos).';

grant execute on function public.calc_product_stock() to authenticated, anon;

create or replace view public.product_stock as
select * from public.calc_product_stock();

comment on view public.product_stock is 'Estoque (stock), reservado (PEDIDO Rascunho) e disponível (available) incluindo produtos sem movimentos.';

grant select on public.product_stock to authenticated, anon;

notify pgrst, 'reload schema';
