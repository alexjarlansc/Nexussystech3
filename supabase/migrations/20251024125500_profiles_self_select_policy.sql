-- Allow authenticated users to SELECT their own profile row
-- This is required because multiple RLS policies (e.g., on companies) reference public.profiles
-- in subqueries using auth.uid(). Without a SELECT policy here, those EXISTS checks always fail.

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure policy exists (use DROP + CREATE because some Postgres versions don't support IF NOT EXISTS on CREATE POLICY)
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT
  USING (
    -- allow matching by user_id (uuid) or by id (some setups store caller as id)
    user_id = auth.uid()::uuid OR id = auth.uid()::uuid
  );

-- Optional: admins can select any profile (keep minimal for now)
-- CREATE POLICY IF NOT EXISTS profiles_admin_select ON public.profiles
--   FOR SELECT
--   USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
