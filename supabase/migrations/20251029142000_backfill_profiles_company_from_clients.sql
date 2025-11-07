-- Backfill profiles.company_id from clients.created_by when missing
-- Idempotent: only updates profiles with company_id IS NULL

-- This attempts to associate user profiles with a company when the user previously created clients
-- and the clients have a company_id set. It updates profiles.company_id where possible.

UPDATE public.profiles p
SET company_id = sub.company_id
FROM (
  SELECT DISTINCT created_by, company_id
  FROM public.clients
  WHERE created_by IS NOT NULL AND company_id IS NOT NULL
) sub
WHERE p.company_id IS NULL
  AND (p.user_id = sub.created_by OR p.id = sub.created_by);

-- Note: This assumes clients.created_by stores either profiles.user_id or profiles.id (both UUID).
-- If your app uses a different field for creator linkage, adjust accordingly.
-- After running, inspect updated profiles:
-- SELECT id, user_id, company_id FROM public.profiles WHERE company_id IS NOT NULL ORDER BY updated_at DESC LIMIT 200;
