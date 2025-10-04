-- Migration: RPC to allow admins to update a user's permissions safely
-- Creates a SECURITY DEFINER function that updates profiles.permissions only when caller is an admin
-- Drop previous function if it exists to allow changing the signature safely
DROP FUNCTION IF EXISTS public.admin_update_permissions(uuid, jsonb);

create or replace function public.admin_update_permissions(target_user_id uuid, perms jsonb)
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

  update public.profiles set permissions = perms, updated_at = now() where user_id = target_user_id returning * into updated;
  return updated;
end;$$;

comment on function public.admin_update_permissions(uuid, jsonb) is 'Admin-only RPC to update a users permissions';
