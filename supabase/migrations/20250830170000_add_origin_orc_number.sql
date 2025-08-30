-- Adiciona coluna para armazenar o número original de orçamento ao converter em pedido
alter table quotes add column if not exists origin_orc_number text;

-- Opcional: índice para buscas futuras (não único)
create index if not exists quotes_origin_orc_number_idx on quotes(origin_orc_number);