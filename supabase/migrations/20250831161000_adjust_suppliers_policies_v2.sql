-- Ajuste avançado de RLS e defaults da tabela suppliers
-- Inclui função resiliente current_company_id, trigger para garantir company_id/created_by
-- e policies simplificadas utilizando a função.
-- Data: 2025-08-31

begin;

-- 1. Função resiliente (idempotente) - já pode existir em outra migration
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid;
begin
  -- tenta via user_id (estrutura mais comum)
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1;
  -- fallback via id (caso perfis antigos usem id = auth.uid())
  if cid is null then
    select company_id into cid from public.profiles where id = auth.uid() limit 1;
  end if;
  return cid;
end;$$;

-- 2. Trigger para garantir preenchimento
create or replace function public.set_supplier_defaults()
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

drop trigger if exists trg_suppliers_set_defaults on public.suppliers;
create trigger trg_suppliers_set_defaults
before insert on public.suppliers
for each row execute function public.set_supplier_defaults();

-- 3. Defaults nas colunas
alter table public.suppliers alter column company_id set default public.current_company_id();
alter table public.suppliers alter column created_by set default auth.uid();

-- 4. Indexes úteis (idempotentes)
create index if not exists idx_suppliers_company_id on public.suppliers(company_id);
create index if not exists idx_suppliers_created_by on public.suppliers(created_by);

-- 5. Remover policies antigas para recriar
drop policy if exists "suppliers_select_company" on public.suppliers;
drop policy if exists "suppliers_insert_company_member" on public.suppliers;
drop policy if exists "suppliers_update_admin_or_owner" on public.suppliers;
drop policy if exists "suppliers_delete_admin" on public.suppliers;

-- 6. Policies novas
-- SELECT: membro da mesma empresa
create policy "suppliers_select_company" on public.suppliers
for select using (
  auth.uid() is not null and suppliers.company_id = public.current_company_id()
);

-- INSERT: membro da empresa (company_id alocado via trigger/default) e created_by = auth.uid()
create policy "suppliers_insert_company_member" on public.suppliers
for insert with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and company_id = public.current_company_id()
);

-- UPDATE: admin da empresa ou criador
create policy "suppliers_update_admin_or_owner" on public.suppliers
for update using (
  auth.uid() is not null and (
    created_by = auth.uid() OR exists (
      select 1 from public.profiles p
      where (p.user_id = auth.uid() or p.id = auth.uid())
        and p.company_id = suppliers.company_id
        and p.role = 'admin'
    )
  )
)
with check (
  auth.uid() is not null and (
    created_by = auth.uid() OR exists (
      select 1 from public.profiles p
      where (p.user_id = auth.uid() or p.id = auth.uid())
        and p.company_id = suppliers.company_id
        and p.role = 'admin'
    )
  )
);

-- DELETE: somente admin da empresa
create policy "suppliers_delete_admin" on public.suppliers
for delete using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p
    where (p.user_id = auth.uid() or p.id = auth.uid())
      and p.company_id = suppliers.company_id
      and p.role = 'admin'
  )
);

commit;

-- Testes sugeridos (executar autenticado como usuário não-admin e depois admin):
-- select auth.uid();
-- select user_id,id,company_id,role from public.profiles where user_id = auth.uid() or id = auth.uid();
-- insert into public.suppliers (name,taxid) values ('Fornecedor Teste','12345678900000');
-- select id,name,company_id,created_by from public.suppliers order by created_at desc limit 5;
-- update public.suppliers set notes='ok' where id = '<id>';
-- delete from public.suppliers where id = '<id>'; -- deve falhar se não for admin

-- Diagnóstico rápido se der RLS:
--   select auth.uid();
--   select user_id,id,company_id,role from public.profiles where user_id = auth.uid() or id = auth.uid();
--   select id,name,company_id,created_by from public.suppliers where created_by = auth.uid();
