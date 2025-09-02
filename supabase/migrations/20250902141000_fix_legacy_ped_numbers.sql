-- Corrige pedidos legados cujo sufixo numérico coincide com o do orçamento original
-- Reatribui novo número PED até que a parte numérica difira
DO $$
DECLARE
  r RECORD;
  newn text;
  orcnum text;
  pednum text;
BEGIN
  FOR r IN
    SELECT id, number, origin_orc_number, ped_number_cache
    FROM quotes
    WHERE type='PEDIDO'
      AND origin_orc_number IS NOT NULL
  LOOP
    orcnum := regexp_replace(r.origin_orc_number,'^[A-Z]+-','');
    pednum := regexp_replace(r.number,'^[A-Z]+-','');
    IF orcnum = pednum THEN
      -- gera até diferir
      LOOP
        newn := next_quote_number('PEDIDO');
        EXIT WHEN regexp_replace(newn,'^[A-Z]+-','') <> orcnum;
      END LOOP;
      UPDATE quotes
        SET number = newn,
            ped_number_cache = COALESCE(ped_number_cache, newn)
        WHERE id = r.id;
    ELSIF r.ped_number_cache IS NULL THEN
      -- Garantir cache preenchido
      UPDATE quotes SET ped_number_cache = r.number WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
