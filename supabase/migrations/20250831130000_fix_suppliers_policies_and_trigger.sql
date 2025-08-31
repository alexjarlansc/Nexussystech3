-- Ajuste definitivo RLS suppliers: trigger created_by + policies simplificadas
begin;

-- 1. Remover policies existentes (inclusive diagnóstica)
drop policy if exists "suppliers_insert_diag" on public.suppliers;
drop policy if exists "suppliers_insert_company_member" on public.suppliers;
drop policy if exists "suppliers_select_company" on public.suppliers;
drop policy if exists "suppliers_update_admin_or_owner" on public.suppliers;
drop policy if exists "suppliers_delete_admin" on public.suppliers;

-- 2. Função trigger para garantir created_by preenchido
create or replace function public.set_suppliers_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.company_id is null then
    select company_id into new.company_id from public.profiles where id = auth.uid();
  end if;
  return new;
end;$$;

-- 3. Criar trigger BEFORE INSERT
create or replace trigger trg_suppliers_set_created_by
before insert on public.suppliers
for each row execute procedure public.set_suppliers_created_by();

-- 4. Policies
-- SELECT: usuário autenticado e (mesma empresa ou criou ou sem company)
create policy "suppliers_select" on public.suppliers
for select
using (
  auth.uid() is not null and (
    suppliers.created_by = auth.uid() or
    suppliers.company_id is null or
    suppliers.company_id in (select company_id from public.profiles where id = auth.uid())
  )
);

-- INSERT: precisa de profile (se existir) e empresa coerente; created_by atribuído via trigger
create policy "suppliers_insert" on public.suppliers
for insert
with check (
  auth.uid() is not null and (
    new.company_id is null or
    new.company_id in (select company_id from public.profiles where id = auth.uid())
  )
);

-- UPDATE: admin ou criador (e mesma empresa se houver)
create policy "suppliers_update" on public.suppliers
for update
using (
  auth.uid() is not null and (
    suppliers.created_by = auth.uid() or
    exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  )
)
with check (
  auth.uid() is not null and (
    suppliers.created_by = auth.uid() or
    exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ) and (
    suppliers.company_id is null or
    suppliers.company_id in (select company_id from public.profiles where id = auth.uid())
  )
);

-- DELETE: somente admin
create policy "suppliers_delete" on public.suppliers
for delete
using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

commit;

-- Testes sugeridos:
-- select auth.uid();
-- select * from public.profiles where id = auth.uid();
-- insert into public.suppliers (name) values ('Teste FINAL 1');
-- insert into public.suppliers (name, company_id) values ('Teste FINAL 2', (select company_id from public.profiles where id=auth.uid()));
-- select id,name,company_id,created_by from public.suppliers order by created_at desc limit 10;
