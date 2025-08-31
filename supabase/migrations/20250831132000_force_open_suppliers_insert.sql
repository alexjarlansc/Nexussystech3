-- Policy totalmente aberta para INSERT em suppliers (diagnóstico final)
begin;
-- Remove policy atual de insert
DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;

CREATE POLICY "suppliers_insert_any" ON public.suppliers
FOR INSERT
WITH CHECK (true);
commit;

-- Após validar funcionamento, substituir por versão restrita novamente.
