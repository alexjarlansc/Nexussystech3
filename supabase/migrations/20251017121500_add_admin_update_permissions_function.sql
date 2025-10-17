-- Ensure permissions column exists
alter table if exists public.profiles
  add column if not exists permissions jsonb default '[]'::jsonb;

-- Helper: check if current user is admin
create or replace function public.admin_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- RPC: update permissions for a given profile id or user id (uuid)
create or replace function public.admin_update_permissions(target_id uuid, perms jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.profiles;
begin
  if not public.admin_is_admin() then
    raise exception 'Only admins can update permissions';
  end if;

  update public.profiles as pr
     set permissions = coalesce(perms, '[]'::jsonb)
   where pr.id = target_id or pr.user_id = target_id
  returning pr.* into updated_row;

  if updated_row.id is null then
    raise exception 'Profile not found for id=%', target_id;
  end if;

  return updated_row;
end;
$$;

-- Overload: accept text[] and cast to jsonb
create or replace function public.admin_update_permissions(target_id uuid, perms text[])
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_update_permissions(target_id, to_jsonb(perms));
end;
$$;

-- Grants for authenticated users to call the RPC
grant execute on function public.admin_update_permissions(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_permissions(uuid, text[]) to authenticated;

-- Optional: allow anon to call? usually not desirable
-- grant execute on function public.admin_update_permissions(uuid, jsonb) to anon;
-- grant execute on function public.admin_update_permissions(uuid, text[]) to anon;
