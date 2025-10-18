-- RPC to validate an invite code. Returns the invite row if available (unused and not expired).
-- Create this in the Supabase SQL Editor (or apply via migrations) and it will run as the function owner.

CREATE OR REPLACE FUNCTION public.validate_invite(inv_code text)
RETURNS SETOF public.invite_codes
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.invite_codes ic
  WHERE ic.code = inv_code
    AND ic.used_by IS NULL
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
  LIMIT 1;
$$;

-- Grant execute to anonymous and authenticated so the frontend can call this RPC during signup
GRANT EXECUTE ON FUNCTION public.validate_invite(text) TO anon, authenticated;
