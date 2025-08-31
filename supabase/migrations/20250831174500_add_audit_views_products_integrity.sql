-- Auditoria de integridade: products / companies / profiles
-- Data: 2025-08-31
begin;

-- View detalhada por produto
create or replace view public.audit_products_integrity as
select
  p.id                            as product_id,
  p.name                          as product_name,
  p.company_id,
  (c.id is not null)              as company_exists,
  p.created_by,
  (pr.user_id is not null)        as creator_profile_exists,
  case
    when p.created_by is not null
     and pr.company_id is not null
     and p.company_id is not null
     and p.company_id <> pr.company_id then true
    else false
  end                             as mismatch_creator_company,
  (p.company_id is null)          as missing_company,
  (p.created_by is null)          as missing_created_by,
  p.created_at,
  p.updated_at
from public.products p
left join public.companies c on c.id = p.company_id
left join public.profiles pr on pr.user_id = p.created_by;

comment on view public.audit_products_integrity is 'Diagnóstico linha a linha de integridade dos products (company/profile/mismatch).';

-- View resumo geral
create or replace view public.audit_products_summary as
select
  (select count(*) from public.products)                                        as total_products,
  (select count(*) from public.products where company_id is null)               as products_without_company,
  (select count(*) from public.products where created_by is null)               as products_without_creator,
  (select count(*) from public.audit_products_integrity where mismatch_creator_company) as products_mismatch_creator_company,
  (select count(*) from public.audit_products_integrity where missing_company and not missing_created_by) as products_with_creator_missing_company,
  (select count(*) from public.audit_products_integrity where missing_created_by and not missing_company) as products_with_company_missing_creator;

comment on view public.audit_products_summary is 'Resumo agregado de integridade dos products.';

-- View agregada por company
create or replace view public.audit_products_per_company as
select
  c.id as company_id,
  c.name as company_name,
  count(p.id)                                   as products_total,
  count(p.id) filter (where p.company_id is null) as products_null_company,
  count(p.id) filter (where p.created_by is null) as products_no_creator,
  count(p.id) filter (where p.created_by is not null) as products_with_creator
from public.companies c
left join public.products p on p.company_id = c.id
group by c.id, c.name
union all
-- linha síntese para produtos totalmente sem company (caso existam)
select
  null::uuid as company_id,
  '(SEM COMPANY)' as company_name,
  count(p2.id) as products_total,
  count(p2.id) as products_null_company,
  count(p2.id) filter (where p2.created_by is null) as products_no_creator,
  count(p2.id) filter (where p2.created_by is not null) as products_with_creator
from public.products p2
where p2.company_id is null;

comment on view public.audit_products_per_company is 'Contagem de products por company + linha para registros sem company.';

-- Função para obter snapshot (segurança: service_role ou admin; retorna sempre 1 linha de summary)
create or replace function public.audit_products_snapshot()
returns table(
  total_products bigint,
  products_without_company bigint,
  products_without_creator bigint,
  products_mismatch_creator_company bigint,
  products_with_creator_missing_company bigint,
  products_with_company_missing_creator bigint,
  generated_at timestamptz
) language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select s.total_products,
           s.products_without_company,
           s.products_without_creator,
           s.products_mismatch_creator_company,
           s.products_with_creator_missing_company,
           s.products_with_company_missing_creator,
           now() as generated_at
      from public.audit_products_summary s;
end;$$;

comment on function public.audit_products_snapshot() is 'Retorna uma linha com resumo atual de integridade dos products.';

grant select on public.audit_products_integrity to service_role;
grant select on public.audit_products_summary to service_role;
grant select on public.audit_products_per_company to service_role;
grant execute on function public.audit_products_snapshot() to service_role;

commit;

-- Uso sugerido:
-- select * from public.audit_products_snapshot();
-- select * from public.audit_products_summary;
-- select * from public.audit_products_per_company order by company_name nulls last;
-- select * from public.audit_products_integrity where missing_company or mismatch_creator_company limit 50;
