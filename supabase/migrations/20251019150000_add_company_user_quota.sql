-- Add per-company user quota to limit how many users can be created by admins of that company
-- Date: 2025-10-19
begin;

alter table if exists public.companies
  add column if not exists user_quota integer not null default 3;

comment on column public.companies.user_quota is 'Maximum number of users allowed for this company (admins can create up to this number). Default 3.';

commit;