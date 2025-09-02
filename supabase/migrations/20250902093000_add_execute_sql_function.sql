-- Helper function to allow service role invocation for executing DDL chunks via REST RPC
-- WARNING: Only call with service role key. Provides no filtering; intended for bootstrap scripts only.
create or replace function public.execute_sql(sql text)
returns text
language plpgsql
security definer set search_path=public
as $$
begin
  execute sql;
  return 'ok';
exception when others then
  return 'error: '||sqlerrm;
end;
$$;

revoke all on function public.execute_sql(text) from public;
-- Allow only authenticated (still requires anon/service keys) - service role recommended
grant execute on function public.execute_sql(text) to authenticated;
