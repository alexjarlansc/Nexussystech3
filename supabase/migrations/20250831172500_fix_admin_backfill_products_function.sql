-- Fix admin_backfill_products: corrigir uso incorreto de GET DIAGNOSTICS
-- Data: 2025-08-31
begin;

create or replace function public.admin_backfill_products()
returns table(action text, affected integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  cnt int;
  reassigned int := 0;
  orphaned int := 0;
  first_company uuid;
  any_user uuid;
begin
  -- garantir pelo menos uma company
  select id into first_company from public.companies order by created_at asc limit 1;
  if first_company is null then
    select id into any_user from auth.users limit 1;
    if any_user is null then
      raise exception 'Nenhum usuário encontrado para criar company padrão';
    end if;
    insert into public.companies (name) values ('Empresa '||substring(any_user::text,1,8)) returning id into first_company;
  end if;

  -- loop usuários criadores sem company atribuída
  for rec in (
    select distinct created_by as uid
    from public.products
    where company_id is null and created_by is not null
  ) loop
    perform public.ensure_profile_for(rec.uid);
    update public.products p
      set company_id = pr.company_id
      from public.profiles pr
      where p.created_by = pr.user_id
        and p.created_by = rec.uid
        and p.company_id is null;
    get diagnostics cnt = row_count;
    reassigned := reassigned + coalesce(cnt,0);
  end loop;

  -- produtos ainda sem company (sem created_by ou sem profile)
  update public.products
     set company_id = first_company
   where company_id is null;
  get diagnostics cnt = row_count;
  orphaned := orphaned + coalesce(cnt,0);

  return query values
    ('reassigned_users', reassigned),
    ('orphaned_assigned', orphaned);
end;$$;

grant execute on function public.admin_backfill_products() to service_role;

commit;