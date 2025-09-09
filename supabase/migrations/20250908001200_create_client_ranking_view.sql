-- View: clients_received_ranking
-- Ranking de clientes por total recebido no período (6 meses por padrão)
CREATE OR REPLACE VIEW public.clients_received_ranking AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  SUM(r.amount) AS total_received
FROM public.clients c
LEFT JOIN public.receivables r ON r.client_id = c.id AND r.status IS DISTINCT FROM 'cancelado' AND coalesce(r.issue_date::date, r.due_date::date) >= (current_date - interval '6 months')
GROUP BY c.id, c.name
ORDER BY total_received DESC;

COMMENT ON VIEW public.clients_received_ranking IS 'Ranking de clientes por valor recebido nos últimos 6 meses.';
