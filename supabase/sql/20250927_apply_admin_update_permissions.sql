-- Apply fix: recreate admin_update_permissions function and adjust policies
-- Run this in Supabase SQL Editor as an admin

-- Drop previous function if exists to allow signature/param changes
DROP FUNCTION IF EXISTS public.admin_update_permissions(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.admin_update_permissions(target_id uuid, perms jsonb)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_admin boolean := false;
  updated public.profiles;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Allow the caller to be matched against either profiles.user_id (typical) OR profiles.id
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE (p.user_id = caller OR p.id = caller) AND p.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
    SET permissions = perms, updated_at = now()
    WHERE user_id = target_id OR id = target_id
    RETURNING * INTO updated;

  RETURN updated;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.admin_update_permissions(uuid, jsonb)
  IS 'Admin-only RPC to update a users permissions (matches user_id OR id)';

-- Recreate/adjust SELECT policy so admin check accepts auth.uid() matching user_id OR id
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE (p.user_id = auth.uid() OR p.id = auth.uid()) AND p.role = 'admin'
    )
  );

-- Recreate admin update policy
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE (p.user_id = auth.uid() OR p.id = auth.uid()) AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE (p.user_id = auth.uid() OR p.id = auth.uid()) AND p.role = 'admin'
    )
  );

-- Ensure permissions column exists
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- End
