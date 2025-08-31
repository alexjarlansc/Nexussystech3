-- Adiciona coluna de ativacao em suppliers
begin;
alter table public.suppliers add column if not exists is_active boolean default true;
-- Opcional: marcar nulos antigos como true
update public.suppliers set is_active = true where is_active is null;
commit;
