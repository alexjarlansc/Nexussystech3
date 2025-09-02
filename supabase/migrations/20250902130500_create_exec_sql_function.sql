-- Utility function to execute arbitrary read/write SQL (use carefully). Requires service role key when called.
create or replace function public.exec_sql(p_sql text)
returns setof json
language plpgsql
security definer
set search_path = public
as $$
begin
  return query execute format('select row_to_json(x) from (%s) x', p_sql);
end;
$$;

revoke all on function public.exec_sql(text) from public;
-- (Optional) grant execute to authenticated role if desired; default keep restricted.
