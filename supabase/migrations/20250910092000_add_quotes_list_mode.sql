-- Migration: adiciona coluna boolean list_mode em quotes (modo lista sem imagens)
-- Idempotente: cria a coluna apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'list_mode'
  ) THEN
    ALTER TABLE public.quotes
    ADD COLUMN list_mode boolean NOT NULL DEFAULT false;
  END IF;
EXCEPTION WHEN others THEN
  -- Se algo inesperado ocorrer, levantar o erro para não mascarar problemas
  RAISE;
END$$;
