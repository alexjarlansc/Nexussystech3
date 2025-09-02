-- Associa produtos à sessão (nível 3) da hierarquia de product_groups
alter table public.products
  add column if not exists product_group_id uuid references public.product_groups(id) on delete set null;

-- Índice para filtros
create index if not exists idx_products_product_group_id on public.products(product_group_id);

-- (Opcional futuro) Trigger para copiar nomes de categoria/sector/session para colunas texto
create or replace function public.fill_product_group_names()
returns trigger language plpgsql as $$
declare
  v_session record;
  v_sector record;
  v_category record;
begin
  if new.product_group_id is null then
    return new;
  end if;
  select * into v_session from public.product_groups where id = new.product_group_id;
  if v_session.level <> 3 then
    -- força somente nível 3
    raise exception 'product_group_id deve apontar para nível 3 (Sessão)';
  end if;
  select * into v_sector from public.product_groups where id = v_session.parent_id; -- nível 2
  select * into v_category from public.product_groups where id = v_sector.parent_id; -- nível 1
  new.session := v_session.name;
  if v_sector.id is not null then new.sector := v_sector.name; end if;
  if v_category.id is not null then new.category := v_category.name; end if;
  return new;
end;$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_fill_product_group_names') then
    create trigger trg_fill_product_group_names
      before insert or update of product_group_id on public.products
      for each row execute function public.fill_product_group_names();
  end if;
end$$;