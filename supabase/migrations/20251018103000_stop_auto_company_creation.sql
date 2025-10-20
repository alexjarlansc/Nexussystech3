-- Stop auto-creating companies/profiles on new auth users and make ensure_profile non-creating
-- Date: 2025-10-18
begin;

-- 1) Drop trigger that auto-creates company/profile on new auth.users, if exists
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;

-- 1) Remove any legacy handle_new_user function to avoid auto-creation of entities
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2) Rework ensure_profile to only ensure a profiles row exists and NEVER create companies
-- Create a lightweight ensure_profile_safe that doesn't create companies
-- If an existing ensure_profile() has a different return type, DROP it first to avoid 42P13
DROP FUNCTION IF EXISTS public.ensure_profile() CASCADE;

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
  -- If no profile was found, prof will be NULL — check the composite itself before accessing fields
  IF prof IS NULL THEN
    -- Create a bare profile without company binding; association must come from an invite or admin action
    INSERT INTO public.profiles(user_id, role)
    VALUES (u_id, 'user')
    RETURNING * INTO prof;
  END IF;
  RETURN prof;
END;$$;

commit;
