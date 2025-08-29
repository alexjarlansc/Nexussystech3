-- Criação da tabela de orçamentos (quotes) no Supabase
create table quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  type text not null, -- ORCAMENTO ou PEDIDO
  created_at timestamp with time zone default now(),
  validity_days integer not null,
  vendor jsonb not null, -- nome, telefone, email
  client_id uuid references clients(id),
  client_snapshot jsonb not null, -- snapshot do cliente no momento
  items jsonb not null, -- array de produtos/serviços
  freight numeric,
  payment_method text,
  payment_terms text,
  notes text,
  status text,
  subtotal numeric,
  total numeric,
  company_id uuid,
  created_by uuid
);

-- Índice para busca rápida por empresa
create index quotes_company_id_idx on quotes(company_id);

-- Índice para busca por número
create index quotes_number_idx on quotes(number);
