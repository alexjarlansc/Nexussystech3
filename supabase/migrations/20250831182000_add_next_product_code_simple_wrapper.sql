-- Wrapper simples para geração de código sem parâmetros
-- Data: 2025-08-31
begin;

create or replace function public.next_product_code_simple()
returns text
language sql
security definer
set search_path = public
as $$
  select public.next_product_code(true,6);
$$;

grant execute on function public.next_product_code_simple() to authenticated, anon, service_role;

commit;

-- Teste: select public.next_product_code_simple();