-- Function: finance_cashflow(start_date date, end_date date)
-- Retorna série diária de saldo (entradas - saídas) acumulado no período
CREATE OR REPLACE FUNCTION public.finance_cashflow(start_date date, end_date date)
RETURNS TABLE(day date, balance numeric)
LANGUAGE sql STABLE AS $$
WITH days AS (
  SELECT generate_series(start_date::timestamp, end_date::timestamp, '1 day')::date AS day
),
entries AS (
  SELECT coalesce(issue_date::date, due_date::date) AS day, SUM(amount) AS in_amount
  FROM public.receivables
  WHERE coalesce(issue_date::date, due_date::date) BETWEEN start_date AND end_date
  AND status IS DISTINCT FROM 'cancelado'
  GROUP BY 1
),
exits AS (
  SELECT coalesce(issue_date::date, due_date::date) AS day, SUM(amount) AS out_amount
  FROM public.payables
  WHERE coalesce(issue_date::date, due_date::date) BETWEEN start_date AND end_date
  AND status IS DISTINCT FROM 'cancelado'
  GROUP BY 1
),
daily AS (
  SELECT d.day, COALESCE(e.in_amount,0) - COALESCE(x.out_amount,0) AS net
  FROM days d
  LEFT JOIN entries e ON e.day = d.day
  LEFT JOIN exits x ON x.day = d.day
  ORDER BY d.day
)
SELECT day, SUM(net) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance
FROM daily;
$$;

COMMENT ON FUNCTION public.finance_cashflow(start_date date, end_date date) IS 'Retorna série diária acumulada de saldo no intervalo.';
