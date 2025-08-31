-- Reparo robusto geração de código de produto
-- Data: 2025-08-31
begin;

-- (Re)cria sequence com ownership neutra
do $$ begin
  perform 1 from pg_class where relkind='S' and relname='product_code_seq';
  if not found then
    create sequence public.product_code_seq start 1000 increment 1;
  end if;
end $$;

-- Garantir permissões mínimas
grant usage, select on sequence public.product_code_seq to authenticated, anon, service_role;

-- Função principal (parametrizada)
create or replace function public.next_product_code(p_pad boolean default true, p_size int default 6)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v bigint; out_code text; begin
  select nextval('public.product_code_seq') into v;
  if p_pad then
    out_code := lpad(v::text, greatest(coalesce(p_size,6), length(v::text)), '0');
  else
    out_code := v::text;
  end if;
  return out_code;
end;$$;

-- Função simples sem parâmetros
create or replace function public.next_product_code_simple()
returns text
language sql
security definer
set search_path = public
as $$ select public.next_product_code(true,6); $$;

-- Versão sem padding explícito
create or replace function public.next_product_code_plain()
returns text
language sql
security definer
set search_path = public
as $$ select public.next_product_code(false,6); $$;

grant execute on function public.next_product_code(boolean,int) to authenticated, anon, service_role;
grant execute on function public.next_product_code_simple() to authenticated, anon, service_role;
grant execute on function public.next_product_code_plain() to authenticated, anon, service_role;

commit;

-- Testes:
-- select public.next_product_code();
-- select public.next_product_code_simple();
-- select public.next_product_code_plain();