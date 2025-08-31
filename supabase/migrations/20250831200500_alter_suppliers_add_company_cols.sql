-- Garante colunas company_id e created_by em suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS company_id uuid references public.companies(id) on delete set null,
  ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id) on delete set null;
