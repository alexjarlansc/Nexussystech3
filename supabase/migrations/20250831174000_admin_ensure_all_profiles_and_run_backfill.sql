-- Admin: garantir profiles para todos usuários e rodar backfill de products
-- Data: 2025-08-31
begin;

-- Função admin_ensure_all_profiles: cria profiles (e companies) para usuários sem profile
create or replace function public.admin_ensure_all_profiles()
returns table(action text, affected integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_count int := 0;
  total_users int := 0;
  rec record;
  cid uuid;
begin
  select count(*) into total_users from auth.users;

  for rec in (
    select u.id as uid
      from auth.users u
      left join public.profiles p on p.user_id = u.id
     where p.user_id is null
  ) loop
     cid := public.ensure_profile_for(rec.uid);
     created_count := created_count + 1;
  end loop;

  raise notice 'Profiles criados: % de % usuarios', created_count, total_users;
  return query values ('profiles_created', created_count), ('total_users', total_users);
end;$$;

grant execute on function public.admin_ensure_all_profiles() to service_role;

-- Execução automática (idempotente: rodar novamente não recria perfis já existentes)
DO $$
DECLARE r record; res record; 
BEGIN
  -- cria perfis faltantes
  PERFORM public.admin_ensure_all_profiles();
  -- backfill de products (caso função exista)
  BEGIN
    PERFORM public.admin_backfill_products();
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Função admin_backfill_products ausente - execute migration correspondente antes se necessário';
  END;
END $$;

commit;

-- Verificações pós-migration sugeridas:
-- select * from public.admin_ensure_all_profiles();
-- select * from public.admin_backfill_products();
-- select count(*) from public.products where company_id is null; -- deve ser 0
-- select user_id, company_id, role from public.profiles order by created_at desc limit 20;
