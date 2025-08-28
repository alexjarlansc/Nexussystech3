-- Criação da tabela clients para Supabase
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  taxId text,
  phone text,
  email text,
  address text,
  company_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now()
);
