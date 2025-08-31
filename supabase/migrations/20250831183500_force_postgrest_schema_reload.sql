-- Forçar PostgREST a recarregar schema (funções/sequence novas para geração de código)
-- Data: 2025-08-31
begin;
notify pgrst, 'reload schema';
commit;

-- Após aplicar, tente novamente: select public.next_product_code_simple();