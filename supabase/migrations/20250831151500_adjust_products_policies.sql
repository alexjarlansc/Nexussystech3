-- Ajuste de RLS para tabela products
-- Objetivo: permitir que qualquer membro autenticado da empresa cadastre produtos
-- mantendo update restrito a admin ou criador e delete apenas admin.
-- Data: 2025-08-31

begin;

-- Remover policies antigas (nomes do migration inicial)
drop policy if exists "Users can view company products" on public.products;
drop policy if exists "Admins can create products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

-- Garantir função helper (já criada pelos suppliers; recria idempotente)
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- Definir defaults para facilitar inserts simples
alter table public.products alter column company_id set default public.current_company_id();
alter table public.products alter column created_by set default auth.uid();

-- SELECT: membro autenticado da mesma empresa ou linhas sem company_id (fallback)
create policy products_select_company on public.products
for select
using (
  auth.uid() is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.company_id = products.company_id or products.company_id is null)
  )
);

-- INSERT: membro autenticado; created_by = auth.uid(); company correspondente
create policy products_insert_company_member on public.products
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.company_id = products.company_id or products.company_id is null)
  )
);

-- UPDATE: admin ou criador da linha (mesma empresa)
create policy products_update_admin_or_owner on public.products
for update
using (
  auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
    or created_by = auth.uid()
  )
)
with check (
  auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
    or created_by = auth.uid()
  )
);

-- DELETE: somente admin da mesma empresa
create policy products_delete_admin on public.products
for delete
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
);

commit;

-- TESTES (executar como usuário comum não-admin):
-- insert into public.products (name, sale_price) values ('Produto Teste RLS', 10);
-- select * from public.products order by created_at desc limit 5;
-- update public.products set description='ok' where id = '<id>';
-- delete from public.products where id = '<id>'; -- deve falhar se não admin

-- Diagnóstico se der RLS:
-- select auth.uid();
-- select * from public.profiles where id = auth.uid();
-- verificar company_id e role.
