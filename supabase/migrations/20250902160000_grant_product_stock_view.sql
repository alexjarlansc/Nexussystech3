-- Garante permissão de SELECT na view product_stock para roles do PostgREST
DO $$
BEGIN
  -- Concede para authenticated
  EXECUTE 'GRANT SELECT ON public.product_stock TO authenticated';
  -- Concede para anon (se necessário para páginas públicas)
  EXECUTE 'GRANT SELECT ON public.product_stock TO anon';
END$$;

-- Força reload de schema
NOTIFY pgrst, 'reload schema';
