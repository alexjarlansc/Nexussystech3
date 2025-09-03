-- View de compatibilidade legacy "inventory".
-- Objetivo: atender código antigo que fazia SELECT em public.inventory buscando
-- colunas (id, product_code, quantity_on_hand) e retornava 0 após a migração
-- para o novo modelo baseado em product_stock.
-- Mapeamento:
--  id -> product_id (UUID/text do produto)
--  product_id -> product_id (duplicado para manter compat)
--  product_code -> products.code (pode ser NULL se produto ainda não tem code)
--  quantity_on_hand -> product_stock.stock
--  reserved -> product_stock.reserved
--  available -> product_stock.available
--
-- Segurança: a view depende de product_stock que já é baseada na função
-- security definer calc_product_stock(), então ignora RLS das tabelas base.
-- Grant de SELECT dado a authenticated/anon para manter paridade.

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

comment on view public.inventory is 'Compat: espelha product_stock para código legado (id, product_code, quantity_on_hand, reserved, available).';

grant select on public.inventory to authenticated, anon;

-- Força reload do PostgREST para expor a nova view imediatamente
notify pgrst, 'reload schema';
