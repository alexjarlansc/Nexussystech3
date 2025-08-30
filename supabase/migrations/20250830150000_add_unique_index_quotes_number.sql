-- Resolve números duplicados existentes antes de criar índice único
WITH dups AS (
  SELECT id, number, ROW_NUMBER() OVER (PARTITION BY number ORDER BY created_at) AS rn
  FROM quotes
)
UPDATE quotes q
SET number = number || '-D' || LPAD(rn::text,2,'0')
FROM dups
WHERE q.id = dups.id AND dups.rn > 1;

-- Cria índice único para garantir que não haverá mais números repetidos
CREATE UNIQUE INDEX IF NOT EXISTS quotes_number_unique_idx ON quotes(number);

-- (Opcional futuro) Criar tabela de contadores para geração atômica
-- CREATE TABLE IF NOT EXISTS quote_counters (
--   type text PRIMARY KEY,
--   last_value bigint NOT NULL DEFAULT 0
-- );
-- Função de próxima numeração poderia ser adicionada em migração separada.
