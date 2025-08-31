-- Diagnóstico e teste automático da geração de códigos de produto
-- Data: 2025-08-31
begin;

-- Função que retorna múltiplos códigos em uma única chamada para testar concorrência / permissões
create or replace function public.test_product_code_generation(p_samples int default 3)
returns table(seq int, code_simple text, code_param text, code_plain text)
language plpgsql
security definer
set search_path = public
as $$
declare i int := 0; c1 text; c2 text; c3 text; begin
  if p_samples < 1 then p_samples := 1; end if;
  while i < p_samples loop
    i := i + 1;
    begin c1 := public.next_product_code_simple(); exception when others then c1 := '[ERR:'||sqlstate||']'; end;
    begin c2 := public.next_product_code(true,6); exception when others then c2 := '[ERR:'||sqlstate||']'; end;
    begin c3 := public.next_product_code_plain(); exception when others then c3 := '[ERR:'||sqlstate||']'; end;
    return query select i, c1, c2, c3;
  end loop;
end;$$;

grant execute on function public.test_product_code_generation(int) to authenticated, anon, service_role;

-- Executa 1 rodada de teste e registra em NOTICE (não impede commit)
do $$
declare r record; begin
  begin
    for r in select * from public.test_product_code_generation(2) loop
      raise notice 'TEST CODE GEN % -> simple=%, param=%, plain=%', r.seq, r.code_simple, r.code_param, r.code_plain;
    end loop;
  exception when others then
    raise notice 'Falha ao testar geração de código: % (%).', sqlerrm, sqlstate;
  end;
end $$;

commit;

-- Uso manual:
-- select * from public.test_product_code_generation(5);