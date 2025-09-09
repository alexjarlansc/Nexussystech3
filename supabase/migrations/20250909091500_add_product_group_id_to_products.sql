-- Migration: adicionar coluna product_group_id em products, índice, fk e trigger para popular campos textuais
-- Data: 2025-09-09
-- OBS: esta migration verifica existência da coluna antes de adicionar para ser mais resiliente.

-- 1) adicionar coluna (se não existir)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_group_id uuid;

-- 2) criar índice para busca
CREATE INDEX IF NOT EXISTS idx_products_product_group_id ON public.products(product_group_id);

-- 3) tentar criar foreign key (silencioso se product_groups não existir ainda)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_groups') THEN
    BEGIN
      ALTER TABLE public.products
        ADD CONSTRAINT fk_products_product_group_id FOREIGN KEY (product_group_id) REFERENCES public.product_groups(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      -- constraint já existe, ignorar
      NULL;
    END;
  END IF;
END$$;

-- 4) Trigger function para popular campos category text baseado no FK (antes de inserir/atualizar)
CREATE OR REPLACE FUNCTION public.set_product_group_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sess_name text;
  sector_id uuid;
  sector_name text;
  category_id uuid;
  category_name text;
BEGIN
  -- se não fornecido, não altera
  IF NEW.product_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pg.name, pg.parent_id INTO sess_name, sector_id FROM public.product_groups pg WHERE pg.id = NEW.product_group_id LIMIT 1;
  IF sess_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF sector_id IS NOT NULL THEN
    SELECT pg2.name, pg2.parent_id INTO sector_name, category_id FROM public.product_groups pg2 WHERE pg2.id = sector_id LIMIT 1;
  END IF;

  IF category_id IS NOT NULL THEN
    SELECT pg3.name INTO category_name FROM public.product_groups pg3 WHERE pg3.id = category_id LIMIT 1;
  END IF;

  -- Prioriza category > sector > session
  NEW.category = COALESCE(category_name, sector_name, sess_name, NEW.category);
  RETURN NEW;
END;
$$;

-- 5) Criar trigger (substitui a existente se houver)
DROP TRIGGER IF EXISTS trg_set_product_group_text ON public.products;
CREATE TRIGGER trg_set_product_group_text
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_product_group_text();

-- FIM
