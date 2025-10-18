-- Fix ensure_profile to set id = auth.uid() and user_id = auth.uid()
-- Date: 2025-10-18
begin;

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
    -- Create a bare profile with id=user_id and no company binding
    INSERT INTO public.profiles(id, user_id, role)
    VALUES (u_id, u_id, 'user')
    RETURNING * INTO prof;
  END IF;
  RETURN prof;
END;$$;

commit;
