-- Tabela de contadores de orçamentos/pedidos
create table if not exists public.quote_counters (
  type text primary key, -- 'ORCAMENTO' ou 'PEDIDO'
  last_value bigint not null default 0
);

-- Função para gerar próximo número atômico
create or replace function public.next_quote_number(p_type text)
returns text
language plpgsql
as $$
declare
  prefix text;
  new_val bigint;
begin
  if p_type not in ('ORCAMENTO','PEDIDO') then
    raise exception 'Tipo inválido: %', p_type;
  end if;
  prefix := case when p_type = 'PEDIDO' then 'PED' else 'ORC' end;
  insert into public.quote_counters(type,last_value) values (p_type,1)
  on conflict (type) do update set last_value = public.quote_counters.last_value + 1
  returning last_value into new_val;
  return prefix || '-' || lpad(new_val::text,6,'0');
end;
$$ volatile;
