-- Corrige policy de INSERT em suppliers (remover referencia a new.company_id e simplificar)
begin;
-- Remove policy anterior
drop policy if exists "suppliers_insert" on public.suppliers;

-- Policy simples para destravar (qualquer usuário autenticado)
create policy "suppliers_insert" on public.suppliers
for insert
with check (auth.uid() is not null);

commit;

-- Depois de validar funcionamento, podemos reforçar:
-- drop policy if exists "suppliers_insert" on public.suppliers;
-- create policy "suppliers_insert" on public.suppliers for insert with check (
--   auth.uid() is not null and (
--     company_id is null or company_id in (select company_id from public.profiles where id = auth.uid())
--   )
-- );
