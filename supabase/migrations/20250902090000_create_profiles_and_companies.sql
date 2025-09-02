-- Create companies and profiles tables if missing (idempotent)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_company on public.profiles(company_id);
create index if not exists idx_profiles_user_id on public.profiles(user_id);

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
DECLARE
  u_id uuid := auth.uid();
  prof public.profiles;
  comp public.companies;
BEGIN
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'no auth user';
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = u_id;
  IF prof.id IS NULL THEN
    -- create company if none exists just for this user
    INSERT INTO public.companies(name) VALUES ('Empresa ' || substr(u_id::text,1,8)) RETURNING * INTO comp;
    INSERT INTO public.profiles(id,user_id,company_id,role) VALUES (u_id,u_id,comp.id,'admin') RETURNING * INTO prof;
  END IF;
  RETURN prof;
END;$$;

-- Basic RLS enabling (if not yet enabled)
alter table public.companies enable row level security;
alter table public.profiles enable row level security;

create policy if not exists "Profiles self access" on public.profiles for select using (auth.uid() = id);
create policy if not exists "Profiles self insert" on public.profiles for insert with check (auth.uid() = id);
create policy if not exists "Profiles self update" on public.profiles for update using (auth.uid() = id);

create policy if not exists "Companies read" on public.companies for select using (auth.uid() is not null);
