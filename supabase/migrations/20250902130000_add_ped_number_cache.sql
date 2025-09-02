-- Add ped_number_cache column to store the first generated PED number for a quote
alter table quotes add column if not exists ped_number_cache text;

-- Backfill for existing pedidos so future reversion/conversion cycles keep same number
update quotes set ped_number_cache = number
where type = 'PEDIDO' and ped_number_cache is null;
