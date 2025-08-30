-- Caixa: sessões e movimentos
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  operator_id uuid NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  opening_amount numeric(14,2) NOT NULL DEFAULT 0,
  closing_amount numeric(14,2) NULL,
  status text NOT NULL DEFAULT 'ABERTO',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_sessions_company_idx ON public.cash_register_sessions(company_id);
CREATE INDEX IF NOT EXISTS cash_sessions_status_idx ON public.cash_register_sessions(status);

CREATE TABLE IF NOT EXISTS public.cash_register_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  type text NOT NULL, -- ENTRADA, SAIDA, SANGRIA, SUPRIMENTO, VENDA
  amount numeric(14,2) NOT NULL,
  description text NULL,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  operator_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_mov_session_idx ON public.cash_register_movements(session_id);
CREATE INDEX IF NOT EXISTS cash_mov_type_idx ON public.cash_register_movements(type);