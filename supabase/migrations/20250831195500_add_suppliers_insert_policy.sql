-- Permite que membros autenticados da mesma empresa insiram fornecedores
DO $$ BEGIN
  CREATE POLICY "Company members insert suppliers" ON public.suppliers
    FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND (
        company_id IS NULL
        OR company_id IN (
          SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (Opcional) Se quiser permitir atualização pelos membros da empresa, descomente abaixo
-- DO $$ BEGIN
--   CREATE POLICY "Company members update suppliers" ON public.suppliers
--     FOR UPDATE USING (
--       auth.uid() IS NOT NULL AND (
--         company_id IS NULL OR company_id IN (SELECT company_id FROM public.profiles WHERE id=auth.uid())
--       )
--     ) WITH CHECK (
--       auth.uid() IS NOT NULL AND (
--         company_id IS NULL OR company_id IN (SELECT company_id FROM public.profiles WHERE id=auth.uid())
--       )
--     );
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;
