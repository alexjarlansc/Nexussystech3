-- Ensure invite_codes has company_id to bind users to a selected company
-- Date: 2025-10-18
begin;

-- Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invite_codes' AND column_name='company_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.invite_codes ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL';
  END IF;
END$$;

-- Optional: index for company_id lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='invite_codes' AND indexname='idx_invite_codes_company_id'
  ) THEN
    EXECUTE 'CREATE INDEX idx_invite_codes_company_id ON public.invite_codes(company_id)';
  END IF;
END$$;

commit;
