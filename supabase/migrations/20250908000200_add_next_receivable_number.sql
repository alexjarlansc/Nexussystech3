-- Migration: criar sequence e função RPC next_receivable_number
create sequence if not exists public.receivable_number_seq;

create or replace function public.next_receivable_number()
returns text language plpgsql as $$
declare
  v nextval bigint;
  formatted text;
begin
  select nextval('public.receivable_number_seq') into v;
  formatted := lpad(v::text, 6, '0');
  return 'RCV' || formatted;
end;
$$;
