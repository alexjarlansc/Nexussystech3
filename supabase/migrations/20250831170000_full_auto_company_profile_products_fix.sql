-- Migração completa: criação automática de company/profile + correção definitiva de products
-- Data: 2025-08-31
-- Objetivos:
--  * Garantir que todo novo usuário tenha company e profile (role=admin inicial)
--  * Função current_company_id resiliente com erro explícito se faltar profile
--  * Função ensure_profile() para usuários antigos sem profile
--  * Trigger + defaults para products (company_id / created_by)
--  * (Re)criar policies consistentes de products
--  * Ferramenta de backfill (função) opcional para products sem company_id
--  * Testes SQL ao final
-- Observação: auth.uid() é NULL em migrações automáticas, portanto backfill real deve ser executado manualmente após deploy usando função helper.

begin;

-- 1. Função current_company_id (somente leitura; erro claro se faltar)
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid;
begin
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1;
  if cid is null then
    select company_id into cid from public.profiles where id = auth.uid() limit 1;
  end if;
  if cid is null then
    raise exception 'Profile/Company inexistente para usuario % - execute ensure_profile()', auth.uid() using errcode='P0001';
  end if;
  return cid;
end;$$;

-- 2. Função ensure_profile() (cria company + profile se necessário)
create or replace function public.ensure_profile()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare cid uuid; uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Usuário não autenticado';
  end if;
  -- já existe profile?
  select company_id into cid from public.profiles where user_id = uid limit 1;
  if cid is not null then
    return cid;
  end if;
  -- cria company
  insert into public.companies (name) values ('Empresa '||substring(uid::text,1,8)) returning id into cid;
  -- cria profile admin
  insert into public.profiles (user_id, company_id, role) values (uid, cid, 'admin');
  return cid;
end;$$;

grant execute on function public.ensure_profile() to authenticated;

-- 3. Trigger para novos usuários no auth.users (cria automaticamente company/profile)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  -- Cria company
  insert into public.companies (name) values ('Empresa '||substring(new.id::text,1,8)) returning id into cid;
  -- Cria profile admin
  insert into public.profiles (user_id, company_id, role) values (new.id, cid, 'admin');
  return new;
end;$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4. Trigger/defaults para products (idempotente)
create or replace function public.set_product_defaults()
returns trigger
language plpgsql
as $$
begin
  if NEW.company_id is null then
    begin
      NEW.company_id := public.current_company_id();
    exception when others then
      -- Tenta criar profile on-the-fly
      perform public.ensure_profile();
      NEW.company_id := public.current_company_id();
    end;
  end if;
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;$$;

drop trigger if exists trg_products_set_defaults on public.products;
create trigger trg_products_set_defaults
before insert on public.products
for each row execute function public.set_product_defaults();

alter table public.products
  alter column company_id set default public.current_company_id(),
  alter column created_by set default auth.uid();

-- 5. Policies de products (limpa e recria)
drop policy if exists products_select_company        on public.products;
drop policy if exists products_insert_company_member on public.products;
drop policy if exists products_update_admin_or_owner on public.products;
drop policy if exists products_delete_admin          on public.products;

create policy products_select_company on public.products
for select using (
  auth.uid() is not null and company_id = public.current_company_id()
);

create policy products_insert_company_member on public.products
for insert with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and company_id = public.current_company_id()
);

create policy products_update_admin_or_owner on public.products
for update using (
  auth.uid() is not null and (
    created_by = auth.uid() OR exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = products.company_id
        and p.role = 'admin'
    )
  )
)
with check (
  auth.uid() is not null and (
    created_by = auth.uid() OR exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = products.company_id
        and p.role = 'admin'
    )
  )
);

create policy products_delete_admin on public.products
for delete using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = products.company_id
      and p.role = 'admin'
  )
);

-- 6. Função de backfill (executar manualmente depois: select * from public.backfill_products_company(false,true); )
create or replace function public.backfill_products_company(
  use_current boolean default true,
  dry_run boolean default true
)
returns table(id uuid, old_company uuid, new_company uuid, changed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  if use_current then
    target := public.current_company_id();
  end if;
  return query
  with rows as (
    select p.id, p.company_id as old_company,
           case when p.company_id is null then target else p.company_id end as new_company
    from public.products p
    where (p.company_id is null and target is not null)
  ), upd as (
    update public.products pr
      set company_id = r.new_company
    from rows r
    where pr.id = r.id and not dry_run
    returning pr.id, r.old_company, pr.company_id as new_company
  )
  select coalesce(u.id,r.id) id, r.old_company, r.new_company, (r.old_company is distinct from r.new_company) changed
  from rows r
  left join upd u on u.id = r.id;
end;$$;

grant execute on function public.backfill_products_company(boolean, boolean) to authenticated;

commit;

-- ================= TESTES MANUAIS APÓS DEPLOY =================
-- 1) Autenticado no SQL editor:
--    select public.ensure_profile(); -- garante profile
--    select public.current_company_id();
-- 2) Inserir produto:
--    insert into public.products (name, price) values ('Produto Pós-Fix', 10.00) returning id, company_id, created_by;
-- 3) Listar:
--    select id,name,company_id from public.products order by created_at desc limit 5;
-- 4) Backfill (dry run / real):
--    select * from public.backfill_products_company(true, true);  -- ver o que mudaria
--    select * from public.backfill_products_company(true, false); -- aplicar
-- ==============================================================
