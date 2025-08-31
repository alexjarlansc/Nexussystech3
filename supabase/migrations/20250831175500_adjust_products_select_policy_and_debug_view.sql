-- Ajuste de visibilidade products: permitir admin ver todos produtos da company e facilitar debug
-- Data: 2025-08-31
begin;

-- Recria policy de select incluindo fallback para admin mesmo se current_company_id() retornar null
drop policy if exists products_select_company on public.products;
create policy products_select_company on public.products
for select using (
  auth.uid() is not null and (
    -- match direto pela company
    (company_id is not null and company_id = public.current_company_id())
    OR
    -- se current_company_id() for null (profile não carregado ainda) mas o usuário é admin em alguma company daquele registro
    exists (
      select 1 from public.profiles p
       where p.user_id = auth.uid()
         and p.company_id = public.products.company_id
         and p.role = 'admin'
    )
  )
);

-- View debug (service_role) para conferir contagem por company e status
create or replace view public.debug_products_counts as
select company_id, count(*) as total,
  count(*) filter (where status = 'ATIVO') as ativos,
  count(*) filter (where status = 'INATIVO') as inativos
from public.products
group by company_id
order by company_id;

comment on view public.debug_products_counts is 'Somente para depuração: contagem de products por company_id (usar via service_role).';

grant select on public.debug_products_counts to service_role;

commit;

-- Testes sugeridos:
-- select * from public.debug_products_counts;
-- select * from public.products limit 5; -- via service_role
-- Aplicar ensure_profile_for se current_company_id() ainda vier null.