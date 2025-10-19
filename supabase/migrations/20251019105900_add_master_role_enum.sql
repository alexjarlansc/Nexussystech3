-- Add new 'master' role to enum user_role in a separate migration
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'master';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
