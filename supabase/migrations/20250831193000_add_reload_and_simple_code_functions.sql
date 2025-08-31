-- Funções utilitárias para estabilizar geração de código e recarregar PostgREST
-- Data: 2025-08-31 19:30
begin;

-- Função para forçar reload de schema sob demanda via RPC
create or replace function public.reload_postgrest_schema()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst','reload schema');
  return 'ok';
end;$$;
grant execute on function public.reload_postgrest_schema() to authenticated;
grant execute on function public.reload_postgrest_schema() to service_role;

-- Função simples de geração (fallback minimalista) usando apenas a sequence
DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_class where relkind='S' and relname='product_code_seq') THEN
    CREATE SEQUENCE public.product_code_seq START 1;
  END IF;
END $$;

create or replace function public.simple_next_product_code()
returns text
language sql
security definer
set search_path = public
as $$
  select lpad(nextval('public.product_code_seq')::text,6,'0');
$$;
grant execute on function public.simple_next_product_code() to authenticated;
grant execute on function public.simple_next_product_code() to service_role;

-- Reload imediato após criação
notify pgrst, 'reload schema';
commit;
