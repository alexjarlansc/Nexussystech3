-- Consolidated audit + backfill for clients/company relationship
-- Idempotent. Run as ADMIN (Supabase SQL Editor with service-role or project Owner).
--
-- Actions:
-- 1) Show counts and samples before changes
-- 2) Backfill profiles.company_id from clients.created_by (only where profiles.company_id IS NULL)
-- 3) Backfill clients.company_id from profiles.company_id (only where clients.company_id IS NULL)
-- 4) Show counts and samples after changes
--
-- NOTE: review the sample rows before running if you want to inspect manually.

BEGIN;

-- Audit counts BEFORE
SELECT
  (SELECT count(*) FROM public.profiles) AS profiles_total,
  (SELECT count(*) FROM public.profiles WHERE company_id IS NULL) AS profiles_company_null,
  (SELECT count(*) FROM public.clients) AS clients_total,
  (SELECT count(*) FROM public.clients WHERE company_id IS NULL) AS clients_company_null;

-- Sample profiles missing company_id
SELECT id, user_id, role, created_at, updated_at
FROM public.profiles
WHERE company_id IS NULL
LIMIT 20;

-- Sample clients missing company_id
SELECT id, name, created_by, company_id, email
FROM public.clients
WHERE company_id IS NULL
ORDER BY id
LIMIT 50;

-- Backfill 1: profiles.company_id from clients.created_by
WITH updated_profiles AS (
  UPDATE public.profiles p
  SET company_id = sub.company_id
  FROM (
    SELECT DISTINCT created_by, company_id
    FROM public.clients
    WHERE created_by IS NOT NULL AND company_id IS NOT NULL
  ) sub
  WHERE p.company_id IS NULL
    AND (
      p.user_id = sub.created_by OR p.id = sub.created_by
    )
  RETURNING p.id
)
SELECT COUNT(*) AS profiles_updated_count FROM updated_profiles;

-- Backfill 2: clients.company_id from profiles.company_id
WITH updated_clients AS (
  UPDATE public.clients c
  SET company_id = p.company_id
  FROM public.profiles p
  WHERE c.company_id IS NULL
    AND p.company_id IS NOT NULL
    AND (
      (c.created_by IS NOT NULL AND c.created_by = p.user_id) OR
      (c.created_by IS NOT NULL AND c.created_by = p.id)
    )
  RETURNING c.id
)
SELECT COUNT(*) AS clients_updated_count FROM updated_clients;

-- Audit counts AFTER
SELECT
  (SELECT count(*) FROM public.profiles) AS profiles_total_after,
  (SELECT count(*) FROM public.profiles WHERE company_id IS NULL) AS profiles_company_null_after,
  (SELECT count(*) FROM public.clients) AS clients_total_after,
  (SELECT count(*) FROM public.clients WHERE company_id IS NULL) AS clients_company_null_after;

-- Sample remaining clients still missing company_id (if any)
SELECT id, name, created_by, company_id, email
FROM public.clients
WHERE company_id IS NULL
ORDER BY id
LIMIT 50;

COMMIT;

-- End of script
