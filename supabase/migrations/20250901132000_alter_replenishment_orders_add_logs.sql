-- Amplia tabela de pedidos de reposição com campos adicionais e logs
alter table public.replenishment_orders
  add column if not exists updated_at timestamptz default now(),
  add column if not exists notes text,
  add column if not exists external_ref text,
  add column if not exists integration_payload jsonb,
  add column if not exists closed_at timestamptz;

-- Trigger updated_at
create or replace function public.update_replenishment_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_update_replenishment_orders_updated_at') THEN
    create trigger trg_update_replenishment_orders_updated_at
      before update on public.replenishment_orders
      for each row execute function public.update_replenishment_orders_updated_at();
  END IF;
END $$;

-- Logs
create table if not exists public.replenishment_order_logs (
  id bigserial primary key,
  order_id uuid not null references public.replenishment_orders(id) on delete cascade,
  event text not null, -- STATUS_CHANGE, ITEM_EDIT, NOTE, OTHER
  data jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.replenishment_order_logs enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='Company members read repl logs') THEN
    CREATE POLICY "Company members read repl logs" ON public.replenishment_order_logs
      FOR SELECT USING (
        exists(select 1 from public.replenishment_orders o join public.profiles p on p.company_id = o.company_id where o.id = replenishment_order_logs.order_id and p.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='Admins insert repl logs') THEN
    CREATE POLICY "Admins insert repl logs" ON public.replenishment_order_logs
      FOR INSERT WITH CHECK (
        exists(select 1 from public.replenishment_orders o join public.profiles p on p.company_id = o.company_id and p.role='admin' where o.id = replenishment_order_logs.order_id and p.user_id = auth.uid())
      );
  END IF;
END $$;

create index if not exists idx_repl_logs_order on public.replenishment_order_logs(order_id);
comment on table public.replenishment_order_logs is 'Histórico de eventos dos pedidos de reposição.';
