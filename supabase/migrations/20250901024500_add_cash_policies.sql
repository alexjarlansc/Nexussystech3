-- Políticas RLS para caixas (sessions e movements)
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY cash_sessions_select ON public.cash_register_sessions
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_sessions_insert ON public.cash_register_sessions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_sessions_update ON public.cash_register_sessions
    FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cash_register_movements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY cash_mov_select ON public.cash_register_movements
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cash_mov_insert ON public.cash_register_movements
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;