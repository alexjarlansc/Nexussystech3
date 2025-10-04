-- Migration: Fix admin_update_permissions RPC to handle id OR user_id and create profiles_admin_select policy
-- Date: 2025-09-25

-- Recreate RPC as SECURITY DEFINER. This version updates profiles where user_id = target OR id = target
-- Drop existing function first to allow changing parameter names/signature safely
DROP FUNCTION IF EXISTS public.admin_update_permissions(uuid, jsonb);

create or replace function public.admin_update_permissions(target_id uuid, perms jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean := false;
  updated public.profiles;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  -- Allow the caller to be matched against either profiles.user_id (typical) OR profiles.id
  -- This makes the RPC tolerant to schemas where profile.id may be used as the auth uid.
  select exists(select 1 from public.profiles p where (p.user_id = caller OR p.id = caller) and p.role = 'admin') into is_admin;
  if not is_admin then
    raise exception 'not_authorized';
  end if;

  update public.profiles set permissions = perms, updated_at = now()
  where user_id = target_id OR id = target_id
  returning * into updated;
  return updated;
end;$$;

-- grant execute to authenticated so frontend clients can call the RPC (the function itself checks caller role)
grant execute on function public.admin_update_permissions(uuid, jsonb) to authenticated;

comment on function public.admin_update_permissions(uuid, jsonb) is 'Admin-only RPC to update a users permissions (matches user_id OR id)';

-- Recreate policy defensively: drop if exists, then create (some Postgres versions don't support IF NOT EXISTS on CREATE POLICY)
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE (p.user_id = auth.uid() OR p.id = auth.uid()) AND p.role = 'admin'
  )
);

-- Ensure permissions column exists (idempotent)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- End migration
