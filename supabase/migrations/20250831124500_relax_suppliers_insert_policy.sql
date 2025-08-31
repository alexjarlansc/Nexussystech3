-- Relaxa a policy de INSERT em suppliers para diagnosticar falha RLS
begin;
-- Remove policy anterior específica
drop policy if exists "suppliers_insert_company_member" on public.suppliers;

-- Policy diagnóstica mais permissiva (qualquer usuário autenticado)
create policy "suppliers_insert_diag" on public.suppliers
for insert
with check (
  auth.uid() is not null
);
commit;

-- Após testar, se funcionar, revisar se o problema era ausência de registro em profiles ou company_id divergente.
-- Testes sugeridos:
--  select auth.uid(), auth.role();
--  select * from public.profiles where id = auth.uid();
--  insert into public.suppliers (name) values ('Teste DIAG 1');
--  select id,name,company_id,created_by from public.suppliers order by created_at desc limit 5;
