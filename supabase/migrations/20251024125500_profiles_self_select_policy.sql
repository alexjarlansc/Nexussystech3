-- Allow authenticated users to SELECT their own profile row
-- This is required because multiple RLS policies (e.g., on companies) reference public.profiles
-- in subqueries using auth.uid(). Without a SELECT policy here, those EXISTS checks always fail.

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS profiles_self_select ON public.profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Optional: admins can select any profile (keep minimal for now)
-- CREATE POLICY IF NOT EXISTS profiles_admin_select ON public.profiles
--   FOR SELECT
--   USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
