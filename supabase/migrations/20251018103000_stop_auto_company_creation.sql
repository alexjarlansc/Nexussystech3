-- Stop auto-creating companies/profiles on new auth users and make ensure_profile non-creating
-- Date: 2025-10-18
begin;

-- 1) Drop trigger that auto-creates company/profile on new auth.users, if exists
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;

-- Keep the function for reference but make it no-op to avoid dependency drop issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- no-op: do not auto-create company/profile
  RETURN NEW;
END;$$;

-- 2) Rework ensure_profile to only ensure a profiles row exists and NEVER create companies
-- Create a lightweight ensure_profile_safe that doesn't create companies
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u_id uuid := auth.uid();
  prof public.profiles;
BEGIN
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'no auth user';
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE user_id = u_id LIMIT 1;
  IF prof.user_id IS NULL THEN
    -- Create a bare profile without company binding; association must come from an invite or admin action
    INSERT INTO public.profiles(user_id, role)
    VALUES (u_id, 'user')
    RETURNING * INTO prof;
  END IF;
  RETURN prof;
END;$$;

commit;
