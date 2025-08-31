-- Ajuste de RLS para tabela suppliers
-- Permitir que qualquer usuário autenticado (membro da empresa) selecione e insira fornecedores
-- mantendo regras mais restritas para update/delete.
-- Data: 2025-08-31

begin;

-- 1. Remover policies antigas (se existirem)
drop policy if exists "Company members read suppliers" on public.suppliers;
drop policy if exists "Admins manage suppliers" on public.suppliers;

-- 2. Função helper para company_id atual do usuário
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- 3. Definir defaults (facilita inserts sem enviar manualmente)
alter table public.suppliers alter column company_id set default public.current_company_id();
alter table public.suppliers alter column created_by set default auth.uid();

-- 4. Novas policies
-- SELECT: membro autenticado da mesma empresa (ou linhas sem company_id)
create policy "suppliers_select_company" on public.suppliers
for select
using (
  auth.uid() is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.company_id = suppliers.company_id or suppliers.company_id is null)
  )
);

-- INSERT: membro autenticado; created_by = auth.uid(); company_id coerente
create policy "suppliers_insert_company_member" on public.suppliers
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.company_id = suppliers.company_id or suppliers.company_id is null)
  )
);

-- UPDATE: admin ou criador da linha
create policy "suppliers_update_admin_or_owner" on public.suppliers
for update
using (
  auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
    or created_by = auth.uid()
  )
)
with check (
  auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
    or created_by = auth.uid()
  )
);

-- DELETE: somente admin
create policy "suppliers_delete_admin" on public.suppliers
for delete
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

commit;

-- TESTES SUGERIDOS (rodar no SQL editor do Supabase logado como usuário normal):
-- insert into public.suppliers (name, taxid) values ('Fornecedor Teste RLS','12345678900000');
-- select * from public.suppliers order by created_at desc limit 5;
-- update public.suppliers set notes='ok' where id = '<id-da-linha>';
-- delete from public.suppliers where id = '<id-da-linha>';  -- deve falhar se não for admin

-- Caso ainda dê "violates row-level security" execute:
--   select auth.uid();
--   select * from public.profiles where id = auth.uid();
-- e verifique se o company_id do profile não é nulo e corresponde às linhas.
