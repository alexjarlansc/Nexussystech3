-- Allow reading available invite codes during signup (anon context)
-- Enables RLS and creates a SELECT policy for unused and non-expired invites

DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'invite_codes' AND c.relrowsecurity
  ) THEN
    EXECUTE 'ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Create or replace a permissive policy that allows reading only available invites
DROP POLICY IF EXISTS "read_available_invites" ON public.invite_codes;
CREATE POLICY "read_available_invites" ON public.invite_codes
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (
  used_by IS NULL
  AND (
    expires_at IS NULL OR expires_at > now()
  )
);

-- Optional: index to speed up lookups by code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='invite_codes' AND indexname='idx_invite_codes_code'
  ) THEN
    EXECUTE 'CREATE INDEX idx_invite_codes_code ON public.invite_codes (code)';
  END IF;
END$$;
