-- Tabelas para presets e histórico de impressão de etiquetas
create table if not exists public.label_print_presets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  label_width_mm int not null,
  label_height_mm int not null,
  font_scale numeric(6,3) not null default 1,
  price_source text not null, -- sale_price | manual
  manual_price text,
  include_qr boolean default false,
  layout text default 'single', -- single | sheet
  columns int default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  preset_snapshot jsonb,
  params jsonb,
  total_labels int not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.label_print_job_items (
  id bigserial primary key,
  job_id uuid not null references public.label_print_jobs(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  qty int not null,
  price numeric(14,4),
  code text,
  name text
);

alter table public.label_print_presets enable row level security;
alter table public.label_print_jobs enable row level security;
alter table public.label_print_job_items enable row level security;

-- Policies (company membership)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_presets_select') THEN
    CREATE POLICY label_print_presets_select ON public.label_print_presets FOR SELECT USING (
      company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_presets_insert') THEN
    CREATE POLICY label_print_presets_insert ON public.label_print_presets FOR INSERT WITH CHECK (
      company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_jobs_select') THEN
    CREATE POLICY label_print_jobs_select ON public.label_print_jobs FOR SELECT USING (
      company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_jobs_insert') THEN
    CREATE POLICY label_print_jobs_insert ON public.label_print_jobs FOR INSERT WITH CHECK (
      company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_job_items_select') THEN
    CREATE POLICY label_print_job_items_select ON public.label_print_job_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.label_print_jobs j JOIN public.profiles pr ON pr.company_id=j.company_id WHERE j.id=label_print_job_items.job_id AND pr.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='label_print_job_items_insert') THEN
    CREATE POLICY label_print_job_items_insert ON public.label_print_job_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.label_print_jobs j JOIN public.profiles pr ON pr.company_id=j.company_id WHERE j.id=label_print_job_items.job_id AND pr.user_id = auth.uid())
    );
  END IF;
END $$;

create index if not exists idx_label_print_jobs_company on public.label_print_jobs(company_id);
create index if not exists idx_label_print_job_items_job on public.label_print_job_items(job_id);
create index if not exists idx_label_print_presets_company on public.label_print_presets(company_id);

comment on table public.label_print_presets is 'Presets configuráveis para geração de etiquetas.';
comment on table public.label_print_jobs is 'Histórico de lotes de impressão de etiquetas.';
comment on table public.label_print_job_items is 'Itens pertencentes ao histórico de impressão.';