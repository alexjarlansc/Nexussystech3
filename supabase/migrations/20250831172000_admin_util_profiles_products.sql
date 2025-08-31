-- Admin utilities: criar profile/empresa para usuários existentes e backfill de products sem depender de auth.uid()
-- Data: 2025-08-31
begin;

-- 1. Função ensure_profile_for(user_uuid)
create or replace function public.ensure_profile_for(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  if p_user is null then
    raise exception 'Parâmetro p_user não pode ser nulo';
  end if;
  select company_id into cid from public.profiles where user_id = p_user limit 1;
  if cid is not null then
    return cid;
  end if;
  -- cria nova company
  insert into public.companies (name) values ('Empresa '||substring(p_user::text,1,8)) returning id into cid;
  -- cria profile admin
  insert into public.profiles (user_id, company_id, role) values (p_user, cid, 'admin');
  return cid;
end;$$;

grant execute on function public.ensure_profile_for(uuid) to service_role;

-- 2. Função admin_backfill_products() - percorre products sem company e corrige
create or replace function public.admin_backfill_products()
returns table(action text, affected integer)
language plpgsql
security definer
set search_path = public
as $$
declare rec record; cnt int; reassigned int; orphaned int; default_company uuid; first_company uuid;
begin
  select id into first_company from public.companies order by created_at asc limit 1;

  -- para cada usuário criador sem profile cria profile/company e ajusta
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
        and p.company_id is null
      returning 1 into cnt;
    get diagnostics reassigned = reassigned + coalesce(cnt,0);
  end loop;

  -- Produtos sem created_by ou ainda null -> atribui à primeira company existente
  update public.products
  set company_id = coalesce(first_company, (select public.ensure_profile_for((select id from auth.users limit 1))))
  where company_id is null;
  get diagnostics orphaned = row_count;

  return query values ('reassigned_users', coalesce(reassigned,0)), ('orphaned_assigned', coalesce(orphaned,0));
end;$$;

grant execute on function public.admin_backfill_products() to service_role;

commit;

-- USO (no SQL editor como superuser ou via service role):
-- select public.ensure_profile_for('<uuid-do-usuario>');
-- select * from public.admin_backfill_products();
-- Depois faça: select count(*) from public.products where company_id is null; -- deve ser 0