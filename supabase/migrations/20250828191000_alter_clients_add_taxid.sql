-- Adiciona a coluna taxId na tabela clients, caso não exista
alter table public.clients add column if not exists taxId text;
