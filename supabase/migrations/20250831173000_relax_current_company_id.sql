-- Ajuste: tornar current_company_id não bloqueante em contexto sem auth.uid()
-- e oferecer variante strict para depuração.
-- Data: 2025-08-31
begin;

-- Variante strict (mantém comportamento de erro para debug manual)
create or replace function public.current_company_id_strict()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid; uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sem auth.uid() no contexto atual' using errcode='P0001';
  end if;
  select company_id into cid from public.profiles where user_id = uid limit 1;
  if cid is null then
    select company_id into cid from public.profiles where id = uid limit 1;
  end if;
  if cid is null then
    raise exception 'Profile/Company inexistente para usuario %', uid using errcode='P0001';
  end if;
  return cid;
end;$$;

-- Função usada em policies / defaults: agora silenciosa (retorna NULL se não disponível)
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid; uid uuid := auth.uid();
begin
  if uid is null then
    return null; -- contexto service_role ou migração
  end if;
  select company_id into cid from public.profiles where user_id = uid limit 1;
  if cid is null then
    select company_id into cid from public.profiles where id = uid limit 1;
  end if;
  return cid; -- pode ser null; policies que comparam company_id = null resultarão false (seguro)
end;$$;

commit;

-- Para diagnosticar manualmente use: select public.current_company_id_strict();