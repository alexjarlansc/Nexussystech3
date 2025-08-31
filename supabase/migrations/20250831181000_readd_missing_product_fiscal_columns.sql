-- Re-adicionar colunas fiscais ausentes em products (corrige erro PGRST204 cest)
-- Data: 2025-08-31
begin;

alter table public.products add column if not exists ncm text null;
alter table public.products add column if not exists cfop text null;
alter table public.products add column if not exists cest text null;
alter table public.products add column if not exists cst text null;
alter table public.products add column if not exists origin text null;
alter table public.products add column if not exists icms_rate numeric(7,4) null;
alter table public.products add column if not exists pis_rate numeric(7,4) null;
alter table public.products add column if not exists cofins_rate numeric(7,4) null;

commit;

-- Após aplicar, fazer uma requisição GET em /rest/v1/products para forçar recarregar schema cache ou aguardar ~1min.