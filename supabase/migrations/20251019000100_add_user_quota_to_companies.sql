-- Add per-company user quota with default 3
begin;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS user_quota integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.companies.user_quota IS 'Max number of users allowed for this company (adjustable by master).';

commit;
