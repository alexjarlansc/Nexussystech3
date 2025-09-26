-- Migration: criar tabela margins

create table if not exists margins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  percent numeric not null,
  company_id uuid null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

-- Índice por company para consultas rápidas
create index if not exists idx_margins_company on margins(company_id);

-- Grant basic privileges (ajuste conforme políticas RLS existentes)
-- grant select, insert, update, delete on margins to postgres;
