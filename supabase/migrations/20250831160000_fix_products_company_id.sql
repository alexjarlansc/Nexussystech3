-- Corrige preenchimento de company_id em products
-- Função resiliente + trigger + (opcional) criação de profile automático (desativado por padrão)
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
  -- tenta via user_id
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1;
  -- fallback via id
  if cid is null then
    select company_id into cid from public.profiles where id = auth.uid() limit 1;
  end if;
  return cid;
end;$$;

create or replace function public.set_product_company_id()
returns trigger
language plpgsql
as $$
begin
  if NEW.company_id is null then
    NEW.company_id := public.current_company_id();
  end if;
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;$$;

drop trigger if exists trg_products_set_company on public.products;
create trigger trg_products_set_company
before insert on public.products
for each row execute function public.set_product_company_id();

alter table public.products alter column company_id set default public.current_company_id();
alter table public.products alter column created_by set default auth.uid();

commit;

-- Backfill NÃO realizado aqui porque auth.uid() é nulo em migrations. Rodar manualmente no SQL editor:
--   with c as (select company_id from public.profiles limit 1) update public.products set company_id=(select company_id from c) where company_id is null;
