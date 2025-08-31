-- Health & Repair completo para products / profiles / companies
-- Data: 2025-08-31
begin;

-- 1. Wrapper ensure_profile() (caso frontend chame sem parâmetro)
create or replace function public.ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    return null; -- contexto service_role ou anônimo
  end if;
  return public.ensure_profile_for(uid);
end;$$;

grant execute on function public.ensure_profile() to service_role;

-- 2. Função de health check agregada
create or replace function public.admin_products_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare snapshot jsonb := '{}'::jsonb;
begin
  -- tenta usar audit views (podem não existir se migration não aplicada)
  begin
    select jsonb_build_object(
      'snapshot', row_to_json(s.*),
      'counts_per_company', (select jsonb_agg(row_to_json(c.*)) from public.debug_products_counts c),
      'missing_company', (select count(*) from public.products where company_id is null)
    ) into snapshot
    from public.audit_products_snapshot() s;
  exception when undefined_table or undefined_function then
    snapshot := jsonb_build_object(
      'total_products', (select count(*) from public.products),
      'missing_company', (select count(*) from public.products where company_id is null)
    );
  end;
  return snapshot;
end;$$;

grant execute on function public.admin_products_health_check() to service_role;

-- 3. Função de reparo completo
create or replace function public.admin_full_products_repair(run_fix boolean default true)
returns table(step text, info jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- garantir perfis
  begin
    if run_fix then
      return query select 'admin_ensure_all_profiles'::text, to_jsonb(r) from public.admin_ensure_all_profiles() r;
    else
      return query select 'admin_ensure_all_profiles (skipped)'::text, jsonb_build_object('skipped',true);
    end if;
  exception when undefined_function then
    return query select 'admin_ensure_all_profiles (missing)'::text, jsonb_build_object('error','function missing');
  end;

  -- mismatches
  begin
    if run_fix then
      return query select 'admin_fix_product_mismatches'::text, to_jsonb(r) from public.admin_fix_product_mismatches() r;
    else
      return query select 'admin_fix_product_mismatches (skipped)'::text, jsonb_build_object('skipped',true);
    end if;
  exception when undefined_function then
    return query select 'admin_fix_product_mismatches (missing)'::text, jsonb_build_object('error','function missing');
  end;

  -- backfill legacy
  begin
    if run_fix then
      return query select 'admin_backfill_products'::text, to_jsonb(r) from public.admin_backfill_products() r;
    else
      return query select 'admin_backfill_products (skipped)'::text, jsonb_build_object('skipped',true);
    end if;
  exception when undefined_function then
    return query select 'admin_backfill_products (missing)'::text, jsonb_build_object('error','function missing');
  end;

  -- health final
  return query select 'health_check_final'::text, public.admin_products_health_check();
end;$$;

grant execute on function public.admin_full_products_repair(boolean) to service_role;

-- 4. Execução automática (aplica reparos)
DO $$
BEGIN
  PERFORM public.admin_full_products_repair(true);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Falha ao executar admin_full_products_repair: %', SQLERRM;
END $$;

commit;

-- Uso manual:
-- select * from public.admin_full_products_repair(true);  -- executa reparos
-- select * from public.admin_full_products_repair(false); -- apenas relata (onde possível)
-- select public.admin_products_health_check();
-- select public.ensure_profile();