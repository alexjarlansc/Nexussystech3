-- 'master' enum value is added by 20251019105900_add_master_role_enum.sql

-- Update helper function to consider 'admin' or 'master' as admin-equivalent
create or replace function public.admin_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and (p.role = 'admin' or p.role = 'master')
  );
$$;

-- Optionally: promote a known email to master (idempotent safeguard)
-- Note: requires a session with rights; otherwise run in SQL editor as service role
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower('alexjarlansc23@gmail.com') limit 1;
  if v_user_id is not null then
    update public.profiles set role = 'master' where user_id = v_user_id;
  end if;
end $$;
