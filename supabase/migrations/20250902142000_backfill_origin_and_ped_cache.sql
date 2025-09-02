-- Backfill ped_number_cache para pedidos legados
update quotes
  set ped_number_cache = number
where type='PEDIDO' and ped_number_cache is null;

-- OBS: origin_orc_number só pode ser preenchido se já existir registro confiável.
-- Sem histórico de vínculo não é possível reconstruir o ORC original perdido.
-- (Mantemos como NULL onde não houver dado.)
