-- Add text overload for ensure_profile_for + defensive recreation
-- Data: 2025-08-31
begin;

-- (Re)create canonical uuid version (idempotente)
create or replace function public.ensure_profile_for(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  if p_user is null then
    raise exception 'Parâmetro p_user não pode ser nulo';
  end if;
  select company_id into cid from public.profiles where user_id = p_user limit 1;
  if cid is not null then
    return cid;
  end if;
  -- cria nova company
  insert into public.companies (name) values ('Empresa '||substring(p_user::text,1,8)) returning id into cid;
  -- cria profile admin
  insert into public.profiles (user_id, company_id, role) values (p_user, cid, 'admin');
  return cid;
end;$$;

grant execute on function public.ensure_profile_for(uuid) to service_role;

-- Overload que aceita text para conveniência (faz cast p/ uuid)
create or replace function public.ensure_profile_for(p_user text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uuid uuid;
begin
  if p_user is null or length(trim(p_user)) = 0 then
    raise exception 'Parâmetro p_user (text) vazio';
  end if;
  begin
    v_uuid := p_user::uuid;
  exception when invalid_text_representation then
    raise exception 'Valor "%" não é um UUID válido para ensure_profile_for', p_user
      using errcode = '22P02';
  end;
  return public.ensure_profile_for(v_uuid);
end;$$;

grant execute on function public.ensure_profile_for(text) to service_role;

commit;

-- Uso:
-- select public.ensure_profile_for('c0c2e2ab-1234-5678-9abc-def012345678'); -- aceita text
-- select public.ensure_profile_for('c0c2e2ab-1234-5678-9abc-def012345678'::uuid); -- uuid direto
-- Listar usuários: select id, email from auth.users limit 20;
-- Criar profiles faltantes: select public.ensure_profile_for(id) from auth.users u left join profiles p on p.user_id = u.id where p.user_id is null;
