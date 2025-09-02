-- Cria hierarquia de grupos de produtos: Categoria (1) > Setor (2) > Sessão (3)
-- e adiciona colunas auxiliares em products (sector, session) para classificação textual rápida.

-- Tabela principal de grupos
create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  level smallint not null check (level in (1,2,3)), -- 1=Categoria 2=Setor 3=Sessão
  name text not null,
  parent_id uuid null references public.product_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_product_groups_company_hierarchy unique (company_id, level, parent_id, name)
);

alter table public.product_groups enable row level security;

-- Política: qualquer usuário da empresa pode ler
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view company product groups'
  ) THEN
    CREATE POLICY "Users can view company product groups" ON public.product_groups
    FOR SELECT USING (
      company_id IN (
        SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Apenas admin pode inserir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can create product groups'
  ) THEN
    CREATE POLICY "Admins can create product groups" ON public.product_groups
    FOR INSERT WITH CHECK (
      company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
    );
  END IF;
END $$;

-- Apenas admin pode atualizar
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can update product groups'
  ) THEN
    CREATE POLICY "Admins can update product groups" ON public.product_groups
    FOR UPDATE USING (
      company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
    ) WITH CHECK (
      company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
    );
  END IF;
END $$;

-- Apenas admin pode deletar
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can delete product groups'
  ) THEN
    CREATE POLICY "Admins can delete product groups" ON public.product_groups
    FOR DELETE USING (
      company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
    );
  END IF;
END $$;

create index if not exists idx_product_groups_company on public.product_groups(company_id);
create index if not exists idx_product_groups_parent on public.product_groups(parent_id);

-- Trigger updated_at
create or replace function public.update_product_groups_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

drop trigger if exists trg_update_product_groups_updated_at on public.product_groups;
create trigger trg_update_product_groups_updated_at
  before update on public.product_groups
  for each row execute function public.update_product_groups_updated_at();

-- Colunas auxiliares em products (texto) caso não existam
alter table public.products
  add column if not exists sector text,
  add column if not exists session text;

-- (Opcional futuro) podemos criar uma foreign key products -> product_groups para sessão final.
-- Mantido simples por enquanto para não quebrar cadastros existentes.
