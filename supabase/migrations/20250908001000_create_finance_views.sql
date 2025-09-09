-- View: finance_totals_per_period
-- Retorna totais de recebíveis e payables por período (dia/mes/ano)
CREATE OR REPLACE VIEW public.finance_totals_per_period AS
SELECT
  date_trunc('month', coalesce(r.issue_date::timestamp, r.due_date::timestamp))::date AS period_start,
  SUM(CASE WHEN r.status IS DISTINCT FROM 'cancelado' THEN r.amount ELSE 0 END) AS total_receivables
FROM public.receivables r
GROUP BY 1
UNION ALL
SELECT
  date_trunc('month', coalesce(p.issue_date::timestamp, p.due_date::timestamp))::date AS period_start,
  -SUM(CASE WHEN p.status IS DISTINCT FROM 'cancelado' THEN p.amount ELSE 0 END) AS total_receivables
FROM public.payables p
GROUP BY 1;

COMMENT ON VIEW public.finance_totals_per_period IS 'View combinada para receitas (positivas) e despesas (negativas) por mês.';
