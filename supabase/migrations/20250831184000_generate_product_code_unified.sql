-- Funções unificadas para geração robusta de código de produto com logging e prefixo opcional
-- Data: 2025-08-31
begin;

-- Tabela de log (idempotente)
create table if not exists public.product_code_generation_log(
  id bigserial primary key,
  generated_at timestamptz not null default now(),
  user_id uuid null,
  prefix text null,
  pad_size int null,
  raw_code text null,
  final_code text null,
  attempts jsonb null,
  success boolean not null default true
);
alter table public.product_code_generation_log enable row level security;
do $$ begin
  create policy product_code_generation_log_select on public.product_code_generation_log for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- (Re)garantir sequência
do $$ begin
  perform 1 from pg_class where relkind='S' and relname='product_code_seq';
  if not found then
    create sequence public.product_code_seq start 1000 increment 1;
  end if;
end $$;

grant usage, select on sequence public.product_code_seq to authenticated, anon, service_role;

-- Função unificada (retorna somente o código)
create or replace function public.generate_product_code(
  p_prefix text default null,
  p_pad_size int default 6,
  p_max_tries int default 10
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text; v_raw text; v_try int := 0; v_att jsonb := '[]'::jsonb; v_prefix text := coalesce(nullif(trim(p_prefix),''), null); v_exists int; v_current text; v_err text; begin
  if p_pad_size < 1 then p_pad_size := 6; end if;
  if p_max_tries < 1 then p_max_tries := 5; end if;
  -- tenta usar funções existentes primeiro
  begin
    select public.next_product_code_simple() into v_current; v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code_simple','code',v_current));
  exception when others then v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code_simple','error',sqlstate)); end;
  if v_current is null then
    begin select public.next_product_code_plain() into v_current; v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code_plain','code',v_current));
    exception when others then v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code_plain','error',sqlstate)); end;
  end if;
  if v_current is null then
    begin select public.next_product_code(true,p_pad_size) into v_current; v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code(param)','code',v_current));
    exception when others then v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code(param)','error',sqlstate)); end;
  end if;
  if v_current is null then
    begin select public.next_product_code() into v_current; v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code(default)','code',v_current));
    exception when others then v_att := v_att || jsonb_build_array(jsonb_build_object('fn','next_product_code(default)','error',sqlstate)); end;
  end if;

  -- fallback direto na sequência
  if v_current is null then
    loop
      v_try := v_try + 1;
      select nextval('public.product_code_seq') into v_raw;
      if v_prefix is not null then
        v_code := v_prefix || lpad(v_raw, greatest(p_pad_size, length(v_raw)), '0');
      else
        v_code := lpad(v_raw, greatest(p_pad_size, length(v_raw)), '0');
      end if;
      exit; -- sequência sempre gera
      exit when v_try >= 1; -- segurança
    end loop;
    v_att := v_att || jsonb_build_array(jsonb_build_object('fn','sequence_fallback','code',v_code));
  else
    v_raw := v_current;
    if v_prefix is not null then
      v_code := v_prefix || v_current;
    else
      v_code := v_current;
    end if;
  end if;

  -- Garantir unicidade (até p_max_tries)
  while v_try < p_max_tries loop
    select count(*) into v_exists from public.products where code = v_code;
    exit when v_exists = 0;
    v_try := v_try + 1;
    select nextval('public.product_code_seq') into v_raw;
    v_code := coalesce(v_prefix,'') || lpad(v_raw, greatest(p_pad_size, length(v_raw)), '0');
    v_att := v_att || jsonb_build_array(jsonb_build_object('collision_retry',v_try,'new',v_code));
  end loop;
  if v_exists > 0 then
    v_err := 'Não foi possível gerar código único após '||p_max_tries||' tentativas';
    insert into public.product_code_generation_log(user_id,prefix,pad_size,raw_code,final_code,attempts,success)
      values (auth.uid(), v_prefix, p_pad_size, v_raw, null, v_att || jsonb_build_array(jsonb_build_object('error',v_err)), false);
    raise exception '%', v_err using errcode='P0001';
  end if;
  insert into public.product_code_generation_log(user_id,prefix,pad_size,raw_code,final_code,attempts,success)
    values (auth.uid(), v_prefix, p_pad_size, v_raw, v_code, v_att, true);
  return v_code;
end;$$;

grant execute on function public.generate_product_code(text,int,int) to authenticated, anon, service_role;

-- Wrapper JSON para debug
create or replace function public.generate_product_code_info(p_prefix text default null, p_pad_size int default 6)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_code text; v_log jsonb; begin
  begin
    v_code := public.generate_product_code(p_prefix,p_pad_size,10);
  exception when others then
    return jsonb_build_object('ok',false,'error',sqlerrm);
  end;
  select to_jsonb(l) into v_log from public.product_code_generation_log l where l.final_code = v_code order by l.generated_at desc limit 1;
  return jsonb_build_object('ok',true,'code',v_code,'log',v_log);
end;$$;

grant execute on function public.generate_product_code_info(text,int) to authenticated, anon, service_role;

commit;

-- Testes:
-- select public.generate_product_code();
-- select public.generate_product_code('PRD-',6,10);
-- select public.generate_product_code_info();