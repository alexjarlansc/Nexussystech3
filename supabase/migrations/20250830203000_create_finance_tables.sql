-- Sequences & number generators
DO $$ BEGIN CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq START 1; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE SEQUENCE IF NOT EXISTS public.receivable_number_seq START 1; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE SEQUENCE IF NOT EXISTS public.payroll_number_seq START 1; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.next_payable_number() RETURNS text AS $$
DECLARE n bigint; BEGIN SELECT nextval('public.payable_number_seq') INTO n; RETURN 'PAG-'|| lpad(n::text,6,'0'); END; $$ LANGUAGE plpgsql VOLATILE;
CREATE OR REPLACE FUNCTION public.next_receivable_number() RETURNS text AS $$
DECLARE n bigint; BEGIN SELECT nextval('public.receivable_number_seq') INTO n; RETURN 'REC-'|| lpad(n::text,6,'0'); END; $$ LANGUAGE plpgsql VOLATILE;
CREATE OR REPLACE FUNCTION public.next_payroll_number() RETURNS text AS $$
DECLARE n bigint; BEGIN SELECT nextval('public.payroll_number_seq') INTO n; RETURN 'FOL-'|| lpad(n::text,6,'0'); END; $$ LANGUAGE plpgsql VOLATILE;

-- Payables
CREATE TABLE IF NOT EXISTS public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number text UNIQUE NOT NULL,
  invoice_number text NULL,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_snapshot jsonb NULL,
  description text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ABERTO', -- ABERTO | PARCIAL | PAGO | CANCELADO
  payment_date timestamptz NULL,
  notes text NULL,
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payables_due_idx ON public.payables(due_date);
CREATE INDEX IF NOT EXISTS payables_status_idx ON public.payables(status);

-- Receivables
CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_number text UNIQUE NOT NULL,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  client_snapshot jsonb NULL,
  description text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  received_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ABERTO', -- ABERTO | PARCIAL | RECEBIDO | CANCELADO
  receipt_date timestamptz NULL,
  notes text NULL,
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receivables_due_idx ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS receivables_status_idx ON public.receivables(status);

-- Payroll (simplificado)
CREATE TABLE IF NOT EXISTS public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_number text UNIQUE NOT NULL,
  reference_month text NOT NULL, -- formato YYYY-MM
  employee_name text NOT NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ABERTA', -- ABERTA | PROCESSADA | PAGA | CANCELADA
  payment_date timestamptz NULL,
  notes text NULL,
  company_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_ref_idx ON public.payroll(reference_month);
CREATE INDEX IF NOT EXISTS payroll_status_idx ON public.payroll(status);

-- RLS
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY payables_select ON public.payables FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payables_insert ON public.payables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payables_update ON public.payables FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payables_delete ON public.payables FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY receivables_select ON public.receivables FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY receivables_insert ON public.receivables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY receivables_update ON public.receivables FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY receivables_delete ON public.receivables FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY payroll_select ON public.payroll FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payroll_insert ON public.payroll FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payroll_update ON public.payroll FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY payroll_delete ON public.payroll FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT EXECUTE ON FUNCTION public.next_payable_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receivable_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_payroll_number() TO anon, authenticated;
