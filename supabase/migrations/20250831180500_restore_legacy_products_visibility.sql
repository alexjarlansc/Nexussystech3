-- Restaurar visibilidade de produtos legados (company_id null) e atribuir company do usuário admin
-- Data: 2025-08-31
begin;

-- 1. Capturar uma company alvo (company do primeiro admin ou primeira company existente)
do $$
declare v_company uuid; v_admin uuid; begin
  select pr.company_id, pr.user_id into v_company, v_admin
    from public.profiles pr
    where pr.role = 'admin' and pr.company_id is not null
    order by pr.created_at asc limit 1;
  if v_company is null then
    -- cria uma company se não existir nenhuma
    insert into public.companies(name) values('Empresa Default Legacy') returning id into v_company;
  end if;
  -- Atribuir todos products sem company
  update public.products set company_id = v_company where company_id is null;
  raise notice 'Produtos legacy atualizados para company %', v_company;
end $$;

-- 2. Policy de select temporária (inclui company_id null para admin enquanto durar migração)
drop policy if exists products_select_company on public.products;
create policy products_select_company on public.products
for select using (
  auth.uid() is not null and (
    (company_id is not null and company_id = public.current_company_id())
    OR exists (
      select 1 from public.profiles p
       where p.user_id = auth.uid()
         and p.company_id = public.products.company_id
         and p.role = 'admin'
    )
    OR (
      company_id is null and exists (
        select 1 from public.profiles p2
         where p2.user_id = auth.uid()
           and p2.role = 'admin'
      )
    )
  )
);

comment on policy products_select_company on public.products is 'Policy ajustada para permitir admin ver registros ainda com company_id null (temporário).';

commit;

-- Pós verificação manual: depois que count(*) where company_id is null for 0, pode-se remover condição extra.
-- Verificar: select count(*) from public.products where company_id is null;