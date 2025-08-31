-- Sequência e função para gerar códigos numéricos de produtos
-- Data: 2025-08-31
begin;

-- Sequence inicia em 1000 (ajuste se quiser outro ponto de partida)
create sequence if not exists public.product_code_seq start 1000 increment 1;

-- Função que retorna próximo código apenas números (sem padding ou com padding opcional)
create or replace function public.next_product_code(p_pad boolean default true, p_size int default 6)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v bigint; out_code text; begin
  select nextval('public.product_code_seq') into v;
  if p_pad then
    out_code := lpad(v::text, greatest(p_size, length(v::text)), '0');
  else
    out_code := v::text;
  end if;
  return out_code;
end;$$;

grant usage, select on sequence public.product_code_seq to authenticated, anon, service_role;
grant execute on function public.next_product_code(boolean,int) to authenticated, anon, service_role;

commit;

-- Uso:
-- select public.next_product_code();          -- ex: 001005
-- select public.next_product_code(false);     -- ex: 1006
-- select public.next_product_code(true,8);    -- ex: 00001007