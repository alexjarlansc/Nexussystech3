-- Índice único para garantir unicidade de código por empresa (ignora códigos nulos)
-- Data: 2025-08-31 19:50
begin;
create unique index concurrently if not exists idx_products_company_code_unique
  on public.products (company_id, code)
  where code is not null;
commit;
