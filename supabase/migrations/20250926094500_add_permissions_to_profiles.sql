-- Migration: adiciona coluna `permissions` ao profile de usuários
-- Executar esta migration para permitir armazenamento de permissões por usuário

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- Opcional: caso queira popular permissões padrão para perfis existentes
-- UPDATE profiles SET permissions = '[]'::jsonb WHERE permissions IS NULL;
