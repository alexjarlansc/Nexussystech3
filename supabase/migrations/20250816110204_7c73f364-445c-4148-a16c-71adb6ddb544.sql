-- Remover coluna last_name e adicionar phone e email no profiles
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS last_name,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;