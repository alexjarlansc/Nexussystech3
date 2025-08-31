-- Ajuste definitivo de RLS para products (corrige uso incorreto de p.id vs p.user_id)
-- Data: 2025-08-31
begin;

-- 1. Função resiliente (idempotente)
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid;
begin
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1; -- caminho correto
  if cid is null then
    select company_id into cid from public.profiles where id = auth.uid() limit 1; -- fallback (caso legado)
  end if;
  return cid;
end;$$;

-- 2. Trigger para preencher defaults
create or replace function public.set_product_defaults()
returns trigger
language plpgsql
as $$
begin
  if NEW.company_id is null then
    NEW.company_id := public.current_company_id();
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

alter table public.products alter column company_id set default public.current_company_id();
alter table public.products alter column created_by set default auth.uid();

-- 3. Dropar policies anteriores (qualquer nome conhecido)
drop policy if exists "Users can view company products" on public.products;
drop policy if exists "Admins can create products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;
drop policy if exists products_select_company on public.products;
drop policy if exists products_insert_company_member on public.products;
drop policy if exists products_update_admin_or_owner on public.products;
drop policy if exists products_delete_admin on public.products;

-- 4. Novas policies consistentes
-- SELECT: qualquer membro da empresa
create policy products_select_company on public.products
for select using (
  auth.uid() is not null
  and company_id = public.current_company_id()
);

-- INSERT: membro da empresa (company_id preenchido pelo trigger/default)
create policy products_insert_company_member on public.products
for insert with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and company_id = public.current_company_id()
);

-- UPDATE: admin da empresa ou criador
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

-- DELETE: somente admin
create policy products_delete_admin on public.products
for delete using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = products.company_id
      and p.role = 'admin'
  )
);

commit;

-- TESTES (após deploy, autenticado):
-- select auth.uid();
-- select user_id,company_id,role from public.profiles where user_id = auth.uid();
-- insert into public.products (name, price) values ('Produto Teste Ajuste', 1.99);
-- select id,name,company_id,created_by from public.products order by created_at desc limit 5;
-- update public.products set description='ok' where id='<id>';
-- delete from public.products where id='<id>'; -- deve falhar para não-admin

-- Diagnóstico se a lista vier vazia:
--   select count(*) total, count(*) filter (where company_id=public.current_company_id()) visiveis from public.products;
--   select policyname, qual from pg_policies where tablename='products';
--   select current_setting('request.jwt.claim.sub', true) jwt_sub;
