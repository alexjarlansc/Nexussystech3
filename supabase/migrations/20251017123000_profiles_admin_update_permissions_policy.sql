-- Ensure permissions column exists (idempotent)
alter table if exists public.profiles
  add column if not exists permissions jsonb default '[]'::jsonb;

-- Helper (idempotent): check if current user is admin
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

-- Row Level Security policy to allow admins to update any profile (for managing permissions)
-- Drop existing with same name to avoid duplicates on re-run
drop policy if exists profiles_admin_update_permissions on public.profiles;
create policy profiles_admin_update_permissions
on public.profiles
as permissive
for update
to authenticated
using (
  public.admin_is_admin()
)
with check (
  public.admin_is_admin()
);
