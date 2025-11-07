-- Ensure clients.company_id/created_by are always set on insert
-- Idempotent: safe to run multiple times
-- Applies defaults and a BEFORE INSERT trigger using current_company_id()/auth.uid()

begin;

-- 0) Safety: ensure column exists and referenced properly
alter table if exists public.clients
  add column if not exists company_id uuid null references public.companies(id) on delete set null,
  add column if not exists created_by uuid null;

-- 1) Helper: current_company_id() (reuse if already exists elsewhere)
-- Note: We don't change semantics if function already exists; just ensure it's present.
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare cid uuid;
begin
  -- try profile by user_id
  select company_id into cid from public.profiles where user_id = auth.uid() limit 1;
  if cid is null then
    -- some older datasets used profiles.id == auth.uid()
    select company_id into cid from public.profiles where id = auth.uid() limit 1;
  end if;
  return cid; -- may be null; trigger below attempts ensure_profile() if available
end;$$;

-- 2) Optional helper: ensure_profile() might exist; we won't redefine it here.
-- We'll call it defensively inside the trigger only if present.

-- 3) Defaults (also applied by trigger just in case)
alter table if exists public.clients
  alter column company_id set default public.current_company_id(),
  alter column created_by set default auth.uid();

-- 4) Trigger function to set defaults before insert (handles missing profile case gracefully)
create or replace function public.set_client_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- company_id
  if NEW.company_id is null then
    begin
      NEW.company_id := public.current_company_id();
    exception when others then
      -- Try to create/ensure profile if helper exists, then retry
      begin
        perform 1 from pg_proc where proname = 'ensure_profile' and pronamespace = 'public'::regnamespace;
        if found then
          perform public.ensure_profile();
          NEW.company_id := public.current_company_id();
        end if;
      exception when others then
        -- leave as null if still failing; RLS will block if required
        null;
      end;
    end;
  end if;

  -- created_by
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;

  return NEW;
end;$$;

drop trigger if exists trg_clients_set_defaults on public.clients;
create trigger trg_clients_set_defaults
before insert on public.clients
for each row execute function public.set_client_defaults();

-- 5) Helpful indexes
create index if not exists idx_clients_company_id on public.clients(company_id);
create index if not exists idx_clients_created_by on public.clients(created_by);

-- 6) Optional backfill for existing rows (idempotent best-effort)
update public.clients c
  set company_id = p.company_id
from public.profiles p
where c.company_id is null
  and p.company_id is not null
  and (c.created_by = p.user_id or c.created_by = p.id);

commit;
