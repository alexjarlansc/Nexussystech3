-- Adiciona novo valor 'pdv' ao enum user_role para usuários exclusivamente de PDV
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'pdv';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Opcional: atualizar perfis existentes (exemplo comentado)
-- UPDATE profiles SET role = 'pdv' WHERE /* condição */ false;