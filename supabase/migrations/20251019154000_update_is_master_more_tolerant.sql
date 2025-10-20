-- Make is_master() detection more tolerant to localized/variant role strings
-- Date: 2025-10-19
begin;

create or replace function public.is_master()
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        lower(coalesce(p.role, '')) in ('master','mestre','owner','dono')
        or lower(coalesce(p.role, '')) like '%master%'
        or lower(coalesce(p.role, '')) like '%mestre%'
      )
  );
$$;

commit;