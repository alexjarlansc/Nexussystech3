-- Migration: adiciona coluna permissions JSONB à tabela profiles
-- Executar via Supabase SQL ou através do workflow de migrations

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- Adiciona comentário para ajudar administradores
COMMENT ON COLUMN public.profiles.permissions IS 'Array JSON de permissões por usuário, ex: ["products.manage","products.pricing"]';
