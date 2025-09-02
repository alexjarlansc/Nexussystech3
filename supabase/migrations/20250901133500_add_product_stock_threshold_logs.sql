-- Log de alterações de estoque mínimo e máximo dos produtos
-- Cria tabela de auditoria e trigger que registra cada mudança em products.stock_min / products.stock_max

create table if not exists public.product_stock_threshold_logs (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  old_stock_min numeric(14,4),
  new_stock_min numeric(14,4),
  old_stock_max numeric(14,4),
  new_stock_max numeric(14,4),
  reason text,
  created_at timestamptz default now()
);

alter table public.product_stock_threshold_logs enable row level security;

-- Políticas de leitura: membros da empresa
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Company members read stock threshold logs') THEN
    CREATE POLICY "Company members read stock threshold logs" ON public.product_stock_threshold_logs
      FOR SELECT USING (
        company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
      );
  END IF;
END $$;

-- Políticas de inserção: somente via trigger (auth.uid() != null e admin); razão opcional
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins insert stock threshold logs') THEN
    CREATE POLICY "Admins insert stock threshold logs" ON public.product_stock_threshold_logs
      FOR INSERT WITH CHECK (
        company_id IN (
          SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

create index if not exists idx_product_stock_threshold_logs_product on public.product_stock_threshold_logs(product_id);
create index if not exists idx_product_stock_threshold_logs_company on public.product_stock_threshold_logs(company_id);

comment on table public.product_stock_threshold_logs is 'Histórico de alterações de estoque mínimo/máximo dos produtos.';

-- Função / trigger: registra mudança de stock_min ou stock_max
create or replace function public.log_product_stock_threshold_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  -- Só logar se houve alteração relevante
  if (TG_OP = 'UPDATE') and (
       (OLD.stock_min is distinct from NEW.stock_min) or
       (OLD.stock_max is distinct from NEW.stock_max)
     ) then
    -- Verifica admin (se profiles existe)
    select exists(
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.company_id = OLD.company_id and pr.role = 'admin'
    ) into v_is_admin;

    insert into public.product_stock_threshold_logs(
      product_id, company_id, changed_by,
      old_stock_min, new_stock_min, old_stock_max, new_stock_max, reason
    ) values (
      OLD.id, OLD.company_id, case when v_is_admin then auth.uid() else null end,
      OLD.stock_min, NEW.stock_min, OLD.stock_max, NEW.stock_max, coalesce(current_setting('app.stock_threshold_reason', true), null)
    );
  end if;
  return NEW;
end;$$;

-- Trigger (caso ainda não exista)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_stock_threshold_change') THEN
    CREATE TRIGGER trg_log_stock_threshold_change
      BEFORE UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_threshold_change();
  END IF;
END $$;

-- Função auxiliar opcional para ajustar limites com razão (evita manipular current_setting manualmente)
create or replace function public.set_product_stock_threshold(
  p_product_id uuid,
  p_stock_min numeric(14,4),
  p_stock_max numeric(14,4),
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_is_admin boolean;
begin
  select company_id into v_company from public.products where id = p_product_id;
  if v_company is null then
    raise exception 'Produto não encontrado';
  end if;
  select exists(
    select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.company_id = v_company and pr.role='admin'
  ) into v_is_admin;
  if not v_is_admin then
    raise exception 'Usuário não autorizado a alterar limites deste produto';
  end if;
  if p_reason is not null then
    perform set_config('app.stock_threshold_reason', p_reason, true);
  end if;
  update public.products
    set stock_min = p_stock_min, stock_max = p_stock_max
  where id = p_product_id;
  -- Limpa razão
  if p_reason is not null then
    perform set_config('app.stock_threshold_reason', '', true);
  end if;
end;$$;

grant execute on function public.set_product_stock_threshold(uuid,numeric,numeric,text) to authenticated;

-- Política SELECT explícita para função operar dentro do RLS dos products (já existente)
-- Consultas de relatório já podem usar a view product_replenishment_view existente.
