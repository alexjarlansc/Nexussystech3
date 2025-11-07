-- Backfill clients.company_id from profiles.company_id when missing
-- Idempotent: only updates clients with company_id IS NULL

-- This migration attempts to set the company_id of clients that were created
-- before the application populated the company_id column. It uses the clients.created_by
-- field (which typically stores either profiles.user_id or profiles.id) to join to profiles
-- and copy a non-null profiles.company_id.

BEGIN;

UPDATE public.clients c
SET company_id = p.company_id
FROM public.profiles p
WHERE c.company_id IS NULL
  AND p.company_id IS NOT NULL
  AND (
    (c.created_by IS NOT NULL AND c.created_by = p.user_id) OR
    (c.created_by IS NOT NULL AND c.created_by = p.id)
  );

COMMIT;

-- Quick checks (run after migration in SQL editor):
-- SELECT count(*) FROM public.clients WHERE company_id IS NULL;
-- SELECT id, name, company_id, created_by FROM public.clients WHERE company_id IS NULL LIMIT 50;