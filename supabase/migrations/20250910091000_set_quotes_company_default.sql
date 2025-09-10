-- Ensure quotes.company_id defaults to current_company_id() and created_by default
begin;

create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid;
begin
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1;
  if cid is null then
    select company_id into cid from public.profiles where id = auth.uid() limit 1;
  end if;
  return cid;
end;$$;

alter table public.quotes alter column company_id set default public.current_company_id();
alter table public.quotes alter column created_by set default auth.uid();

commit;
