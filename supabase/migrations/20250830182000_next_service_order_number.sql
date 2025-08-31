-- Sequência e função para gerar número de Ordem de Serviço
create sequence if not exists service_orders_number_seq;

create or replace function public.next_service_order_number()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('service_orders_number_seq');
  return 'OS' || to_char(now(),'YYMMDD') || lpad(v_seq::text,5,'0');
end;$$;

grant execute on function public.next_service_order_number() to anon, authenticated;