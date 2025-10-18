-- Policies to allow normal users to delete only budgets (ORCAMENTO) and block deletion of sales (PEDIDO)
-- Idempotent recreation approach: drop if exists then create

-- Ensure RLS is enabled on quotes
alter table if exists public.quotes enable row level security;

-- Allow selecting quotes for company members (basic read policy if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_select_company'
  ) THEN
    EXECUTE $$CREATE POLICY quotes_select_company ON public.quotes FOR SELECT USING (
      -- Company members can read; admins can read all
      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
      OR (company_id = current_company_id())
      OR (created_by = auth.uid())
    )$$;
  END IF;
END $$;

-- Allow delete budgets (ORCAMENTO) for company members or creators
DROP POLICY IF EXISTS quotes_delete_budgets ON public.quotes;
CREATE POLICY quotes_delete_budgets ON public.quotes FOR DELETE USING (
  -- Admins may delete any quote
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  OR (
    type = 'ORCAMENTO'
    AND (
      company_id = current_company_id()
      OR created_by = auth.uid()
    )
  )
);

-- Explicitly deny delete of PEDIDO for non-admins by not matching the above policy.
-- Optionally add a comment for clarity
COMMENT ON POLICY quotes_delete_budgets ON public.quotes IS 'Admins can delete any; non-admins can only delete ORCAMENTO of their company or own';
