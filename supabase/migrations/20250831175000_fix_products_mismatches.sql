-- Corrigir mismatches de products (company_id diferente do company do criador) e preencher nulos
-- Data: 2025-08-31
begin;

create or replace function public.admin_fix_product_mismatches()
returns table(action text, affected integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reassigned_null int := 0;
  v_fixed_mismatch int := 0;
  v_orphan_assigned int := 0;
  v_cnt int;
  v_first_company uuid;
  v_any_user uuid;
begin
  -- 1. Reatribuir products com company_id null onde criador tem profile
  update public.products p
     set company_id = pr.company_id
    from public.profiles pr
   where p.company_id is null
     and p.created_by = pr.user_id
     and pr.company_id is not null;
  get diagnostics v_cnt = row_count;
  v_reassigned_null := coalesce(v_cnt,0);

  -- 2. Corrigir mismatch (company_id diferente do company do criador)
  update public.products p
     set company_id = pr.company_id
    from public.profiles pr
   where p.created_by = pr.user_id
     and pr.company_id is not null
     and p.company_id is not null
     and p.company_id <> pr.company_id;
  get diagnostics v_cnt = row_count;
  v_fixed_mismatch := coalesce(v_cnt,0);

  -- 3. Garantir company para remanescentes nulos
  select id into v_first_company from public.companies order by created_at asc limit 1;
  if v_first_company is null then
     select id into v_any_user from auth.users limit 1;
     if v_any_user is null then
        raise exception 'Sem usuários para criar company padrão';
     end if;
     insert into public.companies(name) values('Empresa '||substring(v_any_user::text,1,8)) returning id into v_first_company;
  end if;

  update public.products p
     set company_id = v_first_company
   where p.company_id is null;
  get diagnostics v_cnt = row_count;
  v_orphan_assigned := coalesce(v_cnt,0);

  return query values
    ('reassigned_null', v_reassigned_null),
    ('fixed_mismatch', v_fixed_mismatch),
    ('orphan_assigned', v_orphan_assigned);
end;$$;

grant execute on function public.admin_fix_product_mismatches() to service_role;

-- Execução automática ao aplicar migration (idempotente)
DO $$
DECLARE r record; 
BEGIN
  PERFORM public.admin_fix_product_mismatches();
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabelas necessárias não disponíveis - verifique ordem das migrations';
END $$;

commit;

-- Uso manual:
-- select * from public.admin_fix_product_mismatches();
-- Diagnóstico depois:
-- select * from public.audit_products_snapshot();
-- select * from public.audit_products_integrity where mismatch_creator_company or missing_company limit 50;
