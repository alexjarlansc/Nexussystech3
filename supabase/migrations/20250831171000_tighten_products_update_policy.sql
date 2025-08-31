-- Aperto de segurança: restringe UPDATE de products para mesma empresa após backfill
-- Data: 2025-08-31
begin;

drop policy if exists products_update_admin_or_owner on public.products;

create policy products_update_admin_or_owner on public.products
for update using (
  auth.uid() is not null and (
    (created_by = auth.uid() and company_id = public.current_company_id()) OR exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = products.company_id
        and p.role = 'admin'
    )
  )
)
with check (
  auth.uid() is not null and (
    (created_by = auth.uid() and company_id = public.current_company_id()) OR exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = products.company_id
        and p.role = 'admin'
    )
  )
);

commit;

-- Executar somente depois de executar o backfill para evitar bloquear ajustes massivos.