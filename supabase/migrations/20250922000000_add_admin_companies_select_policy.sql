-- Allow admins to view all companies
-- Adds a policy that allows users with profile.role = 'admin' to SELECT from public.companies

-- Note: ensure this migration is applied after initial tables are created and RLS enabled.

CREATE POLICY "Admins can view all companies"
ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
