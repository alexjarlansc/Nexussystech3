-- Migration: políticas RLS de exemplo para tabelas profiles e products
-- Revisar e adaptar antes de aplicar em produção. Testar no ambiente de desenvolvimento.

-- Habilita RLS em products e profiles
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Permite SELECT em products para administradores ou usuários com permissões relacionadas a produtos
CREATE POLICY IF NOT EXISTS products_select_by_permission ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role = 'admin'
          OR p.permissions @> ' ["products.manage"]'::jsonb
          OR p.permissions @> ' ["products.pricing"]'::jsonb
          OR p.permissions @> ' ["products.groups"]'::jsonb
          OR p.permissions @> ' ["products.units"]'::jsonb
          OR p.permissions @> ' ["products.variations"]'::jsonb
          OR p.permissions @> ' ["products.labels"]'::jsonb
        )
    )
    -- ou permitir quando o usuário pertence à mesma company (fallback)
    OR EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.user_id = auth.uid() AND p2.company_id = public.products.company_id
    )
  );

-- Permite INSERT/UPDATE/DELETE em products apenas para administradores ou usuários com 'products.manage'
CREATE POLICY IF NOT EXISTS products_manage_by_permission ON public.products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR p.permissions @> '["products.manage"]'::jsonb)
    )
  );

-- Profiles: permitir que usuário atual atualize seu próprio perfil (exceto permissões)
-- e permitir que administradores atualizem qualquer perfil (incluindo permissions).
-- OBS: RLS por si só não protege campos individuais; considere usar triggers ou stored procedures
-- se precisar evitar que usuários alterem a coluna permissions diretamente.

CREATE POLICY IF NOT EXISTS profiles_self_update ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS profiles_admin_update ON public.profiles
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Nota: essas políticas são um ponto de partida. Teste e ajuste:
-- - A checagem de permissões usa "@> '["permission"]'::jsonb" para arrays JSONB.
-- - Para operações sensíveis (alterar permissions) recomendo criar uma RPC (stored procedure)
--   que somente admins podem chamar, em vez de permitir UPDATE direto pelos clientes.
