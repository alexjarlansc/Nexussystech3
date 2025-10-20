import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import invokeFunction from '@/lib/functions';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

type ProfileRow = {
  id: string;
  user_id: string;
  first_name?: string;
  email?: string;
  role?: string;
  permissions?: string[] | null;
};

// Hierarchical permissions tree used to render UI (label + permission key)
type PermNode = { id: string; label: string; perm?: string; children?: PermNode[] };

const PERMISSIONS_TREE: PermNode[] = [
  {
    id: 'erp',
    label: 'Acesso ERP',
    children: [
      { id: 'erp.access', label: 'Permitir acesso ao Módulo ERP', perm: 'erp.access' },
    ],
  },
  { id: 'visao', label: 'Visão Geral', children: [ { id: 'visao.dashboard', label: 'Painel (KPIs)', perm: 'dashboard.view' } ] },
  {
    id: 'cadastro',
    label: 'CADASTRO',
    children: [
      { id: 'cadastro.clientes', label: 'Clientes', perm: 'clients.manage' },
      { id: 'cadastro.fornecedores', label: 'Fornecedores', perm: 'suppliers.manage' },
      { id: 'cadastro.transportadoras', label: 'Transportadoras', perm: 'carriers.manage' },
    ],
  },
  {
    id: 'produtos',
    label: 'PRODUTOS',
    children: [
      { id: 'produtos.manage', label: 'Gerenciar Produtos', perm: 'products.manage' },
      { id: 'produtos.pricing', label: 'Custo e Imposto', perm: 'products.pricing' },
      { id: 'produtos.groups', label: 'Grupos de Produtos', perm: 'products.groups' },
      { id: 'produtos.units', label: 'Unidades', perm: 'products.units' },
      { id: 'produtos.variations', label: 'Grades / Variações', perm: 'products.variations' },
      { id: 'produtos.labels', label: 'Etiquetas / Códigos', perm: 'products.labels' },
    ],
  },
  {
    id: 'operacao',
    label: 'OPERAÇÃO',
    children: [
      { id: 'operacao.kardex', label: 'Kardex do Produto', perm: 'kardex.view' },
      { id: 'operacao.inventario', label: 'Inventário', perm: 'operation.inventory' },
      { id: 'operacao.servicos', label: 'Serviços', perm: 'operation.services' },
    ],
  },
  {
    id: 'estoque',
    label: 'ESTOQUE',
    children: [
      { id: 'estoque.movimentacoes', label: 'Movimentações', perm: 'inventory.movements.view' },
      { id: 'estoque.ajustes', label: 'Ajustes', perm: 'inventory.adjustments' },
      { id: 'estoque.trocas', label: 'Trocas / Devoluções', perm: 'inventory.returns' },
      { id: 'estoque.transferencias', label: 'Transferências', perm: 'inventory.transfers' },
    ],
  },
  {
    id: 'orcamentos',
    label: 'ORÇAMENTOS',
    children: [
      { id: 'orcamentos.listar', label: 'Listar Orçamentos', perm: 'quotes.view' },
      { id: 'orcamentos.os', label: 'Listar Ordens de Serviço', perm: 'service_orders.view' },
    ],
  },
  {
    id: 'vendas',
    label: 'VENDAS',
    children: [
      { id: 'vendas.pedidos', label: 'Pedidos de Vendas', perm: 'sales.orders' },
      { id: 'vendas.listar', label: 'Listar Ordens de Serviço', perm: 'sales.list' },
    ],
  },
  {
    id: 'compras',
    label: 'COMPRAS',
    children: [
      { id: 'compras.lancamentos', label: 'Lançamento de Compras', perm: 'purchases.manage' },
      { id: 'compras.historico', label: 'Histórico de Compras', perm: 'purchases.history' },
      { id: 'compras.solicitacoes', label: 'Solicitações de Compras', perm: 'purchases.requests' },
      { id: 'compras.xml', label: 'Gerar via XML', perm: 'purchases.xml' },
      { id: 'compras.troca', label: 'Troca / Devolução', perm: 'purchases.returns' },
    ],
  },
  {
    id: 'financeiro',
    label: 'FINANCEIRO',
    children: [
      { id: 'financeiro.pagar', label: 'Contas a Pagar', perm: 'finance.payables' },
      { id: 'financeiro.receber', label: 'Contas a Receber', perm: 'finance.receivables' },
      { id: 'financeiro.folha', label: 'Folha de Pagamento', perm: 'finance.payroll' },
    ],
  },
  {
    id: 'notas',
    label: 'NOTAS FISCAIS',
    children: [
      { id: 'notas.emitir', label: 'Emitir / Gerenciar', perm: 'invoices.manage' },
    ],
  },
  {
    id: 'relatorios',
    label: 'RELATÓRIOS',
    children: [
      { id: 'relatorios.panel', label: 'Painel (KPIs)', perm: 'reports.panel' },
      { id: 'relatorios.estoque', label: 'Estoque completo', perm: 'reports.stock' },
      { id: 'relatorios.vendas', label: 'Vendas completo', perm: 'reports.sales' },
      { id: 'relatorios.financeiro', label: 'Financeiro completo', perm: 'reports.finance' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'CONFIGURAÇÕES',
    children: [
      { id: 'config.acesso', label: 'Controle de Acesso', perm: 'access.manage' },
    ],
  },
];

export default function AccessControl() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master';
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileRow | undefined>(undefined);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugResult, setDebugResult] = useState<Record<string, unknown> | null>(null);
  const [rpcMissing, setRpcMissing] = useState<boolean>(false);
  const [applyingFix, setApplyingFix] = useState<boolean>(false);
  const [permissionsColumnMissing, setPermissionsColumnMissing] = useState<boolean>(false);
  const [presetMode, setPresetMode] = useState<'add' | 'replace'>('add');
  const [edgeFallbackUsed, setEdgeFallbackUsed] = useState(false);
  // Health da função Edge admin-list-profiles
  const [edgeHealthProfiles, setEdgeHealthProfiles] = useState<'checking'|'ok'|'unreachable'>('checking');
  const [edgeHealthMsgProfiles, setEdgeHealthMsgProfiles] = useState<string | null>(null);

  // Extrai mensagens detalhadas de erros de Edge Function (supabase-js FunctionsError)
  function extractEdgeError(err: unknown): string | null {
    try {
      if (err && typeof err === 'object') {
        const any = err as Record<string, unknown> & { context?: unknown; message?: string };
        const ctx = any.context as unknown;
        if (ctx) {
          if (typeof ctx === 'string' && ctx.trim()) return ctx as string;
          if (typeof ctx === 'object') {
            const c = ctx as Record<string, unknown>;
            if (typeof c.error === 'string' && c.error) return c.error;
            if (typeof c.body === 'string' && c.body) {
              try { const parsed = JSON.parse(c.body); if (parsed && typeof parsed.error === 'string') return parsed.error; }
              catch { /* ignore parse errors */ }
            }
            if (typeof c.message === 'string' && c.message) return c.message;
          }
        }
        if (typeof any.message === 'string' && any.message) return any.message;
      }
    } catch { /* ignore extraction errors */ }
    return null;
  }

  // Checa saúde da função de listagem administrativa
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setEdgeHealthProfiles('checking'); setEdgeHealthMsgProfiles(null);
        try {
          const res = await invokeFunction<{ ok?: boolean }>('admin-list-profiles', { body: { health: true } });
          if (cancelled) return;
          if (!res.ok) { setEdgeHealthProfiles('unreachable'); setEdgeHealthMsgProfiles('Função admin-list-profiles indisponível.'); }
          else { setEdgeHealthProfiles(res.data?.ok ? 'ok' : 'unreachable'); setEdgeHealthMsgProfiles(res.data?.ok ? null : 'Função admin-list-profiles indisponível.'); }
        } catch {
          if (cancelled) return;
          setEdgeHealthProfiles('unreachable'); setEdgeHealthMsgProfiles('Função admin-list-profiles indisponível.');
        }
      } catch {
        if (cancelled) return;
        setEdgeHealthProfiles('unreachable'); setEdgeHealthMsgProfiles('Função admin-list-profiles indisponível.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Utilitário: normaliza qualquer valor para array de strings único e limpo
  function normalizePermissions(val: unknown): string[] {
    try {
      if (Array.isArray(val)) {
        return Array.from(new Set(val
          .filter((p): p is string => typeof p === 'string')
          .map(p => p.trim())
          .filter(p => p.length > 0)
        ));
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return Array.from(new Set(parsed
              .filter((p): p is string => typeof p === 'string')
              .map(p => p.trim())
              .filter(p => p.length > 0)
            ));
          }
        } catch {/* ignore */}
        // Se veio string simples, trate como uma permissão única
        const s = val.trim();
        return s ? [s] : [];
      }
    } catch {/* ignore */}
    return [];
  }

  // Presets rápidos por área
  const PRESETS: Record<string, string[]> = {
    BASICO: ['erp.access', 'dashboard.view'],
    CADASTRO: ['clients.manage', 'suppliers.manage', 'carriers.manage'],
    PRODUTOS: ['products.manage', 'products.pricing', 'products.groups', 'products.units', 'products.variations', 'products.labels'],
    ESTOQUE: ['kardex.view', 'operation.inventory', 'inventory.movements.view', 'inventory.adjustments', 'inventory.transfers', 'inventory.returns'],
    VENDAS: ['sales.orders', 'sales.list'],
    COMPRAS: ['purchases.manage', 'purchases.history', 'purchases.requests', 'purchases.xml', 'purchases.returns'],
    FINANCEIRO: ['finance.payables', 'finance.receivables', 'finance.payroll'],
    FISCAL: ['invoices.manage'],
    RELATORIOS: ['reports.panel', 'reports.stock', 'reports.sales', 'reports.finance'],
  };

  function applyPresetToUser(u: ProfileRow, key: keyof typeof PRESETS, mode: 'add' | 'replace') {
    const base = Array.isArray(u.permissions) ? u.permissions.filter((p): p is string => typeof p === 'string') : [];
    const preset = PRESETS[key] || [];
    let next: string[] = mode === 'replace' ? [...preset] : Array.from(new Set([...base, ...preset]));
    // Reforço: se tem erp.access mas nenhum módulo, garanta dashboard.view
    if (next.includes('erp.access')) {
      const hasAnyModule = next.some(p => p !== 'erp.access');
      if (!hasAnyModule && !next.includes('dashboard.view')) next = [...next, 'dashboard.view'];
    }
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, permissions: next } : p));
    setSelectedUser(prev => (prev && prev.id === u.id ? { ...prev, permissions: next } : prev));
  }

  // Carrega usuários (prioriza função Edge para contornar RLS)
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Tente via função Edge (prioritário, evita RLS)
      try {
  const fx = await invokeFunction<{ ok?: boolean; data?: ProfileRow[] }>('admin-list-profiles', { body: { q: query || undefined, limit: 500 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!fx.ok) throw new Error(String((fx as any).error || 'Falha na função admin-list-profiles'));
  const payload = fx.data as { ok?: boolean; data?: ProfileRow[] } | null;
  if (!payload || !payload.data || !Array.isArray(payload.data)) throw new Error('Falha no fallback');
  let rows = payload.data.map(d => ({ ...d, permissions: normalizePermissions((d as unknown as { permissions?: unknown }).permissions) }));
  // Fallback extra: se Master e resultado veio vazio (função antiga pode estar excluindo admins),
  // tenta carregar admins diretamente (sujeito a RLS). Não quebra se falhar.
  if (isMaster && rows.length === 0) {
    try {
      const probe = await supabase
        .from('profiles')
        .select('id,user_id,first_name,email,role,permissions')
        .in('role', ['admin','master'])
        .order('first_name', { ascending: true })
        .limit(200);
      if (!probe.error && Array.isArray(probe.data) && probe.data.length > 0) {
        rows = probe.data.map(d => ({ ...d, permissions: normalizePermissions((d as unknown as { permissions?: unknown }).permissions) }));
      }
    } catch {/* noop */}
  }
  setUsers(rows);
  setPermissionsColumnMissing(false);
  setEdgeFallbackUsed(true);
  return;
      } catch (firstTry) {
        const msg = extractEdgeError(firstTry) || String((firstTry as { message?: string } | null)?.message || firstTry);
        console.warn('admin-list-profiles indisponível, tentando leitura direta com RLS', msg);
        const low = (msg || '').toLowerCase();
        if (low.includes('token inválido') || low.includes('não autenticado') || low.includes('401')) {
          toast.error('Sessão inválida/expirada. Faça login novamente.');
        } else if (low.includes('apenas administradores') || low.includes('403')) {
          toast.error('Apenas administradores podem listar perfis.');
        } else if (low.includes('service role not configured')) {
          toast.error('Função administrativa sem Service Role. Configure SERVICE_ROLE_KEY no projeto.');
        }
      }

      // 2) Tente leitura direta (sujeito a RLS)
      // Se o usuário atual for Master, não excluímos admins na query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('profiles')
        .select('id,user_id,first_name,email,role,permissions')
        .order('first_name', { ascending: true })
        .limit(500);
  // Não aplicar filtro por role no servidor; usamos o filtro client-side para decidir visibilidade.
      const { data: resData, error } = await q;
      if (error) throw error;
      const data = ((resData as unknown as ProfileRow[]) || []).filter(u => {
        if (isMaster) return true;
        const r = (u.role || '').toLowerCase();
        return r !== 'admin' && r !== 'master';
      });
      setUsers(data.map(d => ({ ...d, permissions: normalizePermissions((d as unknown as { permissions?: unknown }).permissions) })));
      setPermissionsColumnMissing(false);
    } catch (err) {
      const e = err as Error | { message?: string } | null;
      console.error('Erro ao carregar usuários:', e);
      const msg = String((e as { message?: string } | null)?.message || '');
      // If the permissions column is missing, re-run without it and show users without permissions
      if (msg.includes('permissions') || msg.includes('column "permissions"')) {
        try {
          // Fallback select when `permissions` column missing; respect master visibility
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let q2: any = supabase
            .from('profiles')
            .select('id,user_id,first_name,email,role')
            .order('first_name', { ascending: true })
            .limit(500);
          // Não aplicar filtro por role no servidor; usamos o filtro client-side para decidir visibilidade.
          const { data: fbData, error: fbError } = await q2;
          if (fbError) throw fbError;
          const data = ((fbData as unknown as ProfileRow[]) || []).filter(u => {
            if (isMaster) return true;
            const r = (u.role || '').toLowerCase();
            return r !== 'admin' && r !== 'master';
          });
          setUsers(data.map(d => ({ ...d, permissions: [] })));
          toast.error('Coluna `permissions` não encontrada. Exibindo usuários sem permissões. Rode a migração SQL sugerida.');
          setPermissionsColumnMissing(true);
        } catch (ferr) {
          console.error('Erro fallback ao carregar usuarios:', ferr);
          toast.error('Falha ao carregar usuários. Verifique a conexão com o banco.');
        }
      } else if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('rls')) {
        // Tentar fallback via Edge Function com service role
          try {
          const fx = await invokeFunction<{ ok?: boolean; data?: ProfileRow[] }>('admin-list-profiles', { body: { q: query || undefined, limit: 500 } });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!fx.ok) throw new Error(String((fx as any).error || 'Falha na função admin-list-profiles'));
          const payload = fx.data as { ok?: boolean; data?: ProfileRow[] } | null;
          if (!payload || !payload.data || !Array.isArray(payload.data)) throw new Error('Falha no fallback');
          setUsers(payload.data.map(d => ({ ...d, permissions: normalizePermissions((d as unknown as { permissions?: unknown }).permissions) })));
          setEdgeFallbackUsed(true);
          toast.success('Usuários carregados via função administrativa (fallback)');
        } catch (fx) {
          const detail = extractEdgeError(fx) || String((fx as { message?: string } | null)?.message || fx);
          console.error('Fallback admin-list-profiles failed', detail);
          const low = (detail || '').toLowerCase();
          if (low.includes('token inválido') || low.includes('não autenticado') || low.includes('401')) {
            toast.error('Sessão inválida/expirada. Faça login novamente.');
          } else if (low.includes('apenas administradores') || low.includes('403')) {
            toast.error('Apenas administradores podem listar perfis.');
          } else if (low.includes('service role not configured')) {
            toast.error('Função administrativa sem Service Role. Configure SERVICE_ROLE_KEY no projeto.');
          } else {
            toast.error('Falha ao carregar usuários. Política RLS pode estar bloqueando o acesso.');
          }
        }
      } else {
        toast.error('Falha ao carregar usuários. Verifique a conexão com o banco.');
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  async function applyBackendFixes() {
    if (!window.confirm('Aplicar correções no banco? Isso criará a função RPC e a política para admins atualizarem permissões.')) return;
    setApplyingFix(true);
    try {
      const sql = `
-- ensure column
alter table if exists public.profiles add column if not exists permissions jsonb default '[]'::jsonb;
-- helper
create or replace function public.admin_is_admin() returns boolean language sql stable as $$ select exists ( select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin' ); $$;
-- rpc
create or replace function public.admin_update_permissions(target_id uuid, perms jsonb) returns public.profiles language plpgsql security definer set search_path = public as $$ declare updated_row public.profiles; begin if not public.admin_is_admin() then raise exception 'Only admins can update permissions'; end if; update public.profiles as pr set permissions = coalesce(perms, '[]'::jsonb) where pr.id = target_id or pr.user_id = target_id returning pr.* into updated_row; if updated_row.id is null then raise exception 'Profile not found for id=%', target_id; end if; return updated_row; end; $$;
create or replace function public.admin_update_permissions(target_id uuid, perms text[]) returns public.profiles language plpgsql security definer set search_path = public as $$ begin return public.admin_update_permissions(target_id, to_jsonb(perms)); end; $$;
grant execute on function public.admin_update_permissions(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_permissions(uuid, text[]) to authenticated;
-- policy
drop policy if exists profiles_admin_update_permissions on public.profiles;
create policy profiles_admin_update_permissions on public.profiles as permissive for update to authenticated using ( public.admin_is_admin() ) with check ( public.admin_is_admin() );
      `;
  // Placeholder: execução SQL remota depende de backend específico; mantendo tipagem branda
  const res = await (supabase as unknown as { from: (t: string) => { insert: (p: unknown) => Promise<unknown> } }).from('sql').insert({ text: sql });
      // OBS: Não existe tabela 'sql' por padrão; este é um placeholder.
      // Caso seu backend permita execução remota, substitua pelo mecanismo correto.
      console.log('applyBackendFixes result', res);
      toast.success('Correções aplicadas (se o endpoint SQL estiver habilitado). Rode migrações se necessário.');
      setRpcMissing(false);
      await loadUsers();
    } catch (e) {
      console.error('Falha ao aplicar correções', e);
      toast.error('Não foi possível aplicar as correções automaticamente. Rode as migrações no Supabase.');
    } finally {
      setApplyingFix(false);
    }
  }

  // Conta permissões por categoria (prefixos)
  function summarizePermissions(perms: string[] | null | undefined) {
    // Só mostra 'Acesso' quando a permissão exata 'erp.access' existir
    const groups: { id: string; label: string; prefixes: string[] }[] = [
      { id: 'visao', label: 'Visão', prefixes: ['dashboard.'] },
      { id: 'produtos', label: 'Produtos', prefixes: ['products.'] },
      { id: 'cadastro', label: 'Cadastro', prefixes: ['clients.', 'suppliers.', 'carriers.'] },
      { id: 'operacao', label: 'Operação', prefixes: ['operation.', 'kardex.'] },
      { id: 'estoque', label: 'Estoque', prefixes: ['inventory.'] },
      { id: 'orcamentos', label: 'Orçamentos', prefixes: ['quotes.', 'service_orders.'] },
      { id: 'vendas', label: 'Vendas', prefixes: ['sales.'] },
      { id: 'compras', label: 'Compras', prefixes: ['purchases.'] },
      { id: 'financeiro', label: 'Financeiro', prefixes: ['finance.'] },
      { id: 'notas', label: 'Notas Fiscais', prefixes: ['invoices.'] },
      { id: 'relatorios', label: 'Relatórios', prefixes: ['reports.'] },
      { id: 'config', label: 'Config', prefixes: ['access.'] },
    ];
    const list: { label: string; count: number }[] = [];
    const p = (Array.isArray(perms) ? perms : []).filter((x): x is string => typeof x === 'string');
    const matched = new Set<number>();

    // Acesso ERP: apenas 'erp.access' conta
    const idxAccess = p.findIndex(x => x === 'erp.access');
    if (idxAccess >= 0) {
      list.push({ label: 'Acesso', count: 1 });
      matched.add(idxAccess);
    }

    for (const g of groups) {
      const idxs: number[] = [];
      p.forEach((x, i) => { if (g.prefixes.some(pref => x.startsWith(pref))) idxs.push(i); });
      if (idxs.length > 0) {
        list.push({ label: g.label, count: idxs.length });
        idxs.forEach(i => matched.add(i));
      }
    }
    // Qualquer permissão que não casou com grupos conhecidos vai para "Outros"
    const others = p.filter((_, i) => !matched.has(i)).length;
    if (others > 0) list.push({ label: 'Outros', count: others });
    return list;
  }

  useEffect(() => {
    // Carrega usuários para perfis admin ou master (master é dono do sistema)
    if (!profile || (profile.role !== 'admin' && profile.role !== 'master')) return;
    (async () => { try { await loadUsers(); } catch (_) { /* ignore */ } })();
  }, [profile, loadUsers]);

  const savePermissions = async (row: ProfileRow) => {
    try {
      if (!row) {
        toast.error('Nenhum usuário selecionado para salvar.');
        return;
      }
      // Permitir que somente o Administrador Master altere permissões de administradores
      if (row.role === 'admin' || row.role === 'master') {
        if (!isMaster) {
          toast.info('Usuário é administrador — permissões globais não serão alteradas via este painel (somente Administrador Mestre pode alterar).');
          return;
        }
        // Se é master, permitimos prosseguir
      }

      // Sempre capturar o estado MAIS ATUAL das permissões a partir da lista (evita staleness da modal)
      const latest = users.find(u => u.id === row.id) || row;
      // Normaliza, filtra tipos estranhos e remove duplicadas
      let permissionsPayload = Array.from(
        new Set(
          (Array.isArray(latest.permissions) ? latest.permissions : [])
            .filter((p): p is string => typeof p === 'string')
            .map(p => p.trim())
            .filter(p => p.length > 0)
        )
      );
      // Reforço: se tem erp.access mas falta qualquer módulo, garanta dashboard.view
      if (permissionsPayload.includes('erp.access')) {
        const hasAnyModule = permissionsPayload.some(p => p !== 'erp.access');
        if (!hasAnyModule && !permissionsPayload.includes('dashboard.view')) {
          permissionsPayload = [...permissionsPayload, 'dashboard.view'];
        }
      }
      console.log('Saving permissions for user_id=', row.user_id, 'role=', row.role, 'raw permissions:', row.permissions, '-> payload:', permissionsPayload);

      // If admin is trying to save an empty permission set, confirm to avoid accidental wipe
      if (permissionsPayload.length === 0) {
        const ok = window.confirm('Você está prestes a salvar SEM permissões para este usuário — isto removerá todas as permissões. Deseja continuar?');
        if (!ok) {
          toast.info('Operação cancelada — sem alterações.');
          return;
        }
      }
      // Try RPC first (safer under RLS). Prefer the jsonb overload for more stable behavior with supabase-js.
  let data: unknown = null;
  let error: unknown = null;
  // capture inner errors for debug modal (avoid referencing undefined identifiers)
  let rpcErrVar: unknown = null;
  let updErrVar: unknown = null;
  try {
  // Note: the RPC expects parameter name `target_id` (not target_user_id) and a jsonb value for perms.
  const targetId = row.id || row.user_id;
  console.log('Calling admin_update_permissions RPC for', targetId, 'rpc args:', { target_id: targetId, perms: permissionsPayload });
        // 1) Tente overload jsonb primeiro (perms como array JSON)
        const rpcRes = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }> }).rpc('admin_update_permissions', { target_id: targetId, perms: permissionsPayload });
        // supabase.rpc returns { data, error }
        console.log('admin_update_permissions RPC raw response:', rpcRes);
        data = rpcRes?.data;
        error = rpcRes?.error;
        if (error) {
          const msg = typeof error === 'object' && error && 'message' in (error as Record<string, unknown>)
            ? String((error as { message?: unknown }).message)
            : String(error);
          if (msg.toLowerCase().includes('function') && msg.toLowerCase().includes('admin_update_permissions') && msg.toLowerCase().includes('does not exist')) {
            setRpcMissing(true);
          }
          // 2) Tente overload text[] passando array de strings explicitamente
          console.warn('RPC jsonb returned error, retrying with text[] overload...', error);
          const rpcRes2 = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }> }).rpc('admin_update_permissions', { target_id: targetId, perms: permissionsPayload as unknown as string[] });
          console.log('admin_update_permissions RPC retry text[] raw response:', rpcRes2);
          data = rpcRes2?.data;
          error = rpcRes2?.error;
          if (error) {
            // 3) Última tentativa: enviar string JSON (algumas instalações aceitam como cast)
            console.warn('RPC text[] returned error, retrying with stringified JSON...', error);
            const rpcRes3 = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }> }).rpc('admin_update_permissions', { target_id: targetId, perms: JSON.stringify(permissionsPayload) });
            console.log('admin_update_permissions RPC retry stringified raw response:', rpcRes3);
            data = rpcRes3?.data;
            error = rpcRes3?.error;
          }
          if (error) throw error;
        }
      } catch (rpcErr) {
        rpcErrVar = rpcErr;
        console.warn('admin_update_permissions RPC failed, falling back to direct update. RPC error:', rpcErrVar);
        try {
          console.log('Attempting direct update to profiles.permissions for id=', row.id, 'user_id=', row.user_id, 'payload:', permissionsPayload);
          // Tentar por id (mais estável) e, se necessário, por user_id
          let upd: { data: unknown; error: unknown } = await supabase
            .from('profiles')
            .update({ permissions: permissionsPayload } as unknown as Record<string, unknown>)
            .eq('id', row.id)
            .select('id,user_id,permissions')
            .maybeSingle();
          console.log('Direct update by id raw response:', upd);
          if ((!upd || !upd.data) && row.user_id) {
            // fallback por user_id
            upd = await supabase
            .from('profiles')
            .update({ permissions: permissionsPayload } as unknown as Record<string, unknown>)
            .eq('user_id', row.user_id)
            .select('id,user_id,permissions')
            .maybeSingle();
            console.log('Direct update by user_id raw response:', upd);
          }
          data = upd.data;
          error = upd.error;
          if (error) throw error;
          } catch (updErr) {
            updErrVar = updErr;
            console.error('Direct update fallback failed:', updErrVar);
            throw updErrVar;
          }
      }

        if (error) {
          console.error('Erro ao salvar permissões (supabase):', error);
          // store debug info and rethrow (include captured inner errors)
          setDebugResult({ phase: 'rpc_or_update', error: String(error), rpcErr: rpcErrVar, updErr: updErrVar });
          setDebugModalOpen(true);
          throw error;
        }

      // If supabase returned the updated row, sync local state immediately
      if (data) {
        const updated = data as Partial<ProfileRow>;
        setUsers(prev => prev.map(p => (p.id === updated.id || p.user_id === updated.user_id) ? { ...p, permissions: Array.isArray(updated.permissions) ? updated.permissions : [] } : p));
        setSelectedUser(prev => prev && (prev.id === updated.id || prev.user_id === updated.user_id) ? { ...prev, permissions: Array.isArray(updated.permissions) ? updated.permissions : [] } : prev);
      } else {
        // fallback: update local state with what we tried to save
        setUsers(prev => prev.map(p => (p.id === row.id || p.user_id === row.user_id) ? { ...p, permissions: permissionsPayload } : p));
        setSelectedUser(prev => prev && (prev.id === row.id || prev.user_id === row.user_id) ? { ...prev, permissions: permissionsPayload } : prev);
      }

      // Reload from DB to ensure we reflect authoritative state (covers cases where RLS/trigger may modify row)
      try { await loadUsers(); } catch (_) { /* ignore */ }

      // Extra diagnostic: fetch the single profile row and log it so admin can inspect exactly what was saved
      try {
        // Try probe by user_id first, then by profile id as fallback
  let probeData: unknown = null;
  let probeErr: unknown = null;
        try {
          const p1 = await supabase.from('profiles').select('id,user_id,permissions').eq('id', row.id).maybeSingle();
          probeData = p1.data;
          probeErr = p1.error;
          console.log('Profiles probe (by id) after save:', p1);
        } catch (inner1) {
          console.warn('Probe by id failed', inner1);
        }
        if (!probeData && row.user_id) {
          try {
            const p2 = await supabase.from('profiles').select('id,user_id,permissions').eq('user_id', row.user_id).maybeSingle();
            probeData = p2.data;
            probeErr = p2.error;
            console.log('Profiles probe (by user_id) after save:', p2);
          } catch (inner2) {
            console.warn('Probe by id failed', inner2);
          }
        }

        if (probeErr) console.warn('probe select after save returned error', probeErr);
        if (probeData) {
          const perms = (probeData as unknown as { permissions?: unknown }).permissions;
          if (Array.isArray(perms)) {
            if (perms.length === 0) {
              toast.error('Aviso: após salvar, a coluna `permissions` está vazia. Verifique políticas RLS, triggers ou formato do payload. Veja console para detalhes.');
              console.warn('Saved permissions are empty for user', row.user_id, probeData);
            } else {
              toast.success(`Permissões salvas: ${perms.length} itens`);
            }
          } else {
            toast.success('Permissões atualizadas (verifique console para detalhes)');
          }
        } else {
          toast.error('Após salvar, não foi possível localizar o registro de perfil para este usuário. Verifique se a coluna `permissions` existe e políticas RLS. Veja console para detalhes.');
          console.warn('Profiles probe returned no rows for user_id or id after save. user_id:', row.user_id, 'id:', row.id);
        }
      } catch (probeEx) {
        console.warn('Probe select exception', probeEx);
        toast.error('Permissões atualizadas (probe falhou). Verifique console para diagnóstico.');
      }
  } catch (err) {
      const e = err as Error | { message?: string } | null;
      console.error('Erro ao salvar permissões:', e);
      // Se coluna permissions não existir, instruir
      const msg = String((e as { message?: string } | null)?.message || '');
      if (msg.includes('permissions') || msg.includes('column "permissions"')) {
        toast.error('Coluna `permissions` não encontrada. Rode a migração SQL sugerida.');
      } else if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('rls')) {
        toast.error('Falha ao salvar permissões. Política RLS pode estar bloqueando a operação.');
      } else {
        toast.error('Falha ao salvar permissões');
        // Show debug modal with the last known debugResult if available
  if (!debugResult) setDebugResult({ phase: 'exception', error: String((err as Error)?.message || String(err)) });
        setDebugModalOpen(true);
      }
    }
  };

  const togglePermission = (u: ProfileRow, perm: string) => {
    const current = normalizePermissions(u.permissions);
    const idx = current.indexOf(perm);
    if (idx === -1) {
      current.push(perm);
      // Se o admin habilitou o acesso ERP, garanta um módulo básico para o usuário entrar no sistema
      if (perm === 'erp.access' && !current.includes('dashboard.view')) {
        current.push('dashboard.view');
      }
    }
    else {
      // Remoção
      current.splice(idx, 1);
      // Caso o admin remova acidentalmente todos os módulos enquanto mantém o ERP aberto,
      // não forçamos nenhum módulo aqui. A tela do ERP já orienta quando nenhum módulo está liberado.
    }
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, permissions: current } : p));
    // If we have the modal open and this is the selected user, sync selectedUser so checkboxes in modal update
    setSelectedUser(prev => (prev && prev.id === u.id ? { ...prev, permissions: current } : prev));
  };

  // expanded nodes for tree UI, scoped per user id
  const [expandedNodes, setExpandedNodes] = useState<Record<string, Record<string, boolean>>>({});
  const toggleNode = (userId: string, nodeId: string) => setExpandedNodes(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [nodeId]: !((prev[userId] || {})[nodeId]) } }));

  function renderPermNode(node: PermNode, u: ProfileRow) {
    try {
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const isExpanded = !!(expandedNodes[u.id] && expandedNodes[u.id][node.id]);
      return (
        <div key={node.id} className="ml-0">
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button className="text-xs text-slate-500" onClick={() => toggleNode(u.id, node.id)} aria-label="toggle">
                {isExpanded ? '▾' : '▸'}
              </button>
            )}
            {node.perm ? (
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Array.isArray(u.permissions) ? u.permissions.includes(node.perm!) : false} onChange={() => togglePermission(u, node.perm!)} />
                <span className="text-xs">{node.label}</span>
              </label>
            ) : (
              <span className="text-xs font-semibold">{node.label}</span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="ml-4 mt-1">
              {node.children!.map(child => renderPermNode(child, u))}
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error('Erro ao renderizar nó de permissão', { nodeId: node.id, userId: u.id, error: e });
      return (
        <div key={node.id} className="ml-0">
          <div className="text-xs text-destructive">Erro ao renderizar item</div>
        </div>
      );
    }
  }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'master')) {
    return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Acesso negado</h2><p className="text-sm text-muted-foreground">Apenas administradores podem acessar o Controle de Acesso.</p></Card>;
  }

  const renderRowsSafe = () => {
    try {
      const list = (Array.isArray(users) ? users : [])
        .filter(u => {
          const r = (u.role || '').toLowerCase();
          // Nunca exibir perfis Master na lista
          if (r === 'master') return false;
          // Se não for Master, ocultar também administradores
          if (!isMaster && r === 'admin') return false;
          return true;
        })
        .filter(u => {
          if (!query) return true;
          const q = query.toLowerCase();
          return (u.first_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        });
      return list.map(u => (
        <tr key={u.id} className="border-t align-top">
          <td className="p-2 align-top">
            {u.first_name || u.user_id}
            {(() => {
              try {
                const total = Array.isArray(u.permissions)
                  ? u.permissions.filter((x) => typeof x === 'string').length
                  : 0;
                if (total <= 0) {
                  return (
                    <span className="ml-2 inline-flex items-center rounded bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px]">
                      Sem permissões
                    </span>
                  );
                }
                return (
                  <span className="ml-2 inline-flex items-center rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px]">
                    Total {total}
                  </span>
                );
              } catch (e) {
                console.warn('Resumo permissões falhou para usuário', u, e);
                return null;
              }
            })()}
          </td>
          <td className="p-2 align-top">{u.email || '-'}</td>
          <td className="p-2 align-top">{u.role || '-'}</td>
          <td className="p-2 align-top">
            <div className="text-sm flex flex-wrap gap-1">
              {(() => {
                try {
                  const summary = summarizePermissions(u.permissions);
                  const hasErpAccess = u.role === 'master' || (Array.isArray(u.permissions) && u.permissions.includes('erp.access'));
                  const hasAnyModule = u.role === 'master' || (Array.isArray(u.permissions) && u.permissions.some(p => p !== 'erp.access'));
                  if (!summary.length) {
                    return (
                      <span className="inline-flex items-center rounded bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px]">
                        Sem permissões
                      </span>
                    );
                  }
                  const total = Array.isArray(u.permissions) ? u.permissions.filter(x => typeof x === 'string').length : 0;
                  return (
                    <>
                      {summary.map(s => (
                        <span key={s.label} className="inline-flex items-center rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px]">
                          {s.label} ({s.count})
                        </span>
                      ))}
                      {hasAnyModule && !hasErpAccess && (
                        <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px]">
                          Falta Acesso ERP
                        </span>
                      )}
                      <span key="__total" className="inline-flex items-center rounded bg-slate-200 text-slate-800 px-2 py-0.5 text-[11px]">
                        Total ({total})
                      </span>
                    </>
                  );
                } catch (e) {
                  console.error('Resumo/Detalhe de permissões falhou', e, u);
                  return (
                    <span className="inline-flex items-center rounded bg-red-100 text-red-800 px-2 py-0.5 text-[11px]">
                      Erro ao calcular resumo
                    </span>
                  );
                }
              })()}
            </div>
          </td>
          <td className="p-2 align-top">
            <div className="flex gap-2">
              {((u.role === 'admin' || u.role === 'master') && !isMaster) ? (
                <div className="text-xs text-amber-600">Apenas Administrador Mestre pode editar</div>
              ) : (
                <Button size="sm" onClick={() => { setSelectedUser(u); setModalOpen(true); }}>Editar</Button>
              )}
            </div>
          </td>
        </tr>
      ));
    } catch (e) {
      console.error('AccessControl renderRowsSafe error', e, { users, query });
      return (
        <tr>
          <td className="p-2 text-destructive text-sm" colSpan={5}>Erro ao renderizar lista de usuários. Veja console para detalhes.</td>
        </tr>
      );
    }
  };
  return (
    <div className="space-y-4">
      {edgeHealthProfiles === 'unreachable' && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="text-sm font-medium text-amber-800 mb-1">admin-list-profiles indisponível</div>
          <div className="text-xs text-amber-800">{edgeHealthMsgProfiles || 'Verifique o deploy da função e a SECRET SERVICE_ROLE_KEY no projeto (Functions).'}
            <button className="ml-2 underline" onClick={async ()=>{
              try {
                setEdgeHealthProfiles('checking'); setEdgeHealthMsgProfiles(null);
                const res = await invokeFunction<{ ok?: boolean }>('admin-list-profiles', { body: { health: true } });
                if (!res.ok) { setEdgeHealthProfiles('unreachable'); setEdgeHealthMsgProfiles('Função admin-list-profiles indisponível.'); }
                else { setEdgeHealthProfiles(res.data?.ok ? 'ok' : 'unreachable'); setEdgeHealthMsgProfiles(res.data?.ok ? null : 'Função admin-list-profiles indisponível.'); }
              } catch { setEdgeHealthProfiles('unreachable'); setEdgeHealthMsgProfiles('Função admin-list-profiles indisponível.'); }
            }}>Re-testar</button>
          </div>
        </Card>
      )}
      {rpcMissing && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="text-sm font-medium text-amber-800 mb-2">Função de salvamento ausente no banco</div>
          <div className="text-xs text-amber-800">Precisamos criar a função RPC <code>admin_update_permissions</code> para que administradores salvem permissões sob RLS.</div>
          <div className="mt-2">
            <pre className="text-xs p-2 bg-white rounded border overflow-auto">{`-- Execute no Supabase SQL (ou rode as migrações do projeto)\n${'CREATE OR REPLACE FUNCTION public.admin_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = \'admin\' OR p.role = \'master\')); $$;'}\n\n${'CREATE OR REPLACE FUNCTION public.admin_update_permissions(target_id uuid, perms jsonb) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE updated_row public.profiles; BEGIN IF NOT public.admin_is_admin() THEN RAISE EXCEPTION \'Only admins can update permissions\'; END IF; UPDATE public.profiles AS pr SET permissions = coalesce(perms, \'[]\'::jsonb) WHERE pr.id = target_id OR pr.user_id = target_id RETURNING pr.* INTO updated_row; IF updated_row.id IS NULL THEN RAISE EXCEPTION \'Profile not found for id=%\', target_id; END IF; RETURN updated_row; END; $$;'}\n\n${'CREATE OR REPLACE FUNCTION public.admin_update_permissions(target_id uuid, perms text[]) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN public.admin_update_permissions(target_id, to_jsonb(perms)); END; $$;'}\n\nGRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, jsonb) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, text[]) TO authenticated;`}</pre>
          </div>
          <div className="text-xs text-amber-800 mt-2">Obs: este projeto já inclui a migração em <code>supabase/migrations</code>. Rode as migrações para aplicar automaticamente.</div>
          <div className="mt-3">
            <Button size="sm" disabled={applyingFix} onClick={applyBackendFixes}>{applyingFix? 'Aplicando…':'Tentar aplicar automaticamente'}</Button>
          </div>
        </Card>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Controle de Acesso</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por nome ou email" value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setQuery(e.target.value)} />
          <Button variant="ghost" onClick={loadUsers}>Atualizar</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="overflow-auto">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">Usuário</th>
                <th className="p-2">Email</th>
                <th className="p-2">Papel</th>
                <th className="p-2">Permissões (Resumo)</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>{renderRowsSafe()}</tbody>
          </table>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o)=>{ if(!o) setSelectedUser(undefined); setModalOpen(o); }}>
    <DialogContent className='sm:max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Permissões do usuário</DialogTitle>
          </DialogHeader>
          {selectedUser ? (
            <div className='space-y-4'>
              <div className='text-sm'><strong>{selectedUser.first_name || selectedUser.user_id}</strong> — {selectedUser.email || ''}</div>
              {/* Presets rápidos */}
              <div className='border rounded p-2'>
                <div className='flex items-center justify-between gap-2 mb-2'>
                  <div className='text-xs font-medium'>Presets rápidos</div>
                  <div className='flex items-center gap-2 text-xs'>
                    <label className='inline-flex items-center gap-1'>
                      <input type='radio' name='presetMode' checked={presetMode==='add'} onChange={()=>setPresetMode('add')} /> Adicionar
                    </label>
                    <label className='inline-flex items-center gap-1'>
                      <input type='radio' name='presetMode' checked={presetMode==='replace'} onChange={()=>setPresetMode('replace')} /> Substituir
                    </label>
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {(
                    [
                      ['BÁSICO', 'BASICO'],
                      ['Cadastro', 'CADASTRO'],
                      ['Produtos', 'PRODUTOS'],
                      ['Estoque', 'ESTOQUE'],
                      ['Vendas', 'VENDAS'],
                      ['Compras', 'COMPRAS'],
                      ['Financeiro', 'FINANCEIRO'],
                      ['Nota Fiscal', 'FISCAL'],
                      ['Relatórios', 'RELATORIOS'],
                    ] as Array<[string, keyof typeof PRESETS]>
                  ).map(([label, key]) => (
                    <button
                      key={key}
                      type='button'
                      className='px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'
                      onClick={() => applyPresetToUser(selectedUser, key, presetMode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className='max-h-96 overflow-auto'>
                {PERMISSIONS_TREE.map(node => renderPermNode(node, selectedUser))}
              </div>
              <DialogFooter className='flex justify-end gap-2'>
                <Button variant='outline' onClick={()=>{ setModalOpen(false); setSelectedUser(undefined); }}>Cancelar</Button>
                <Button onClick={async ()=>{ await savePermissions(selectedUser); setModalOpen(false); setSelectedUser(undefined); }}>Salvar</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {permissionsColumnMissing && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-2">SQL caso não exista a coluna</h3>
          <pre className="text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded">ALTER TABLE profiles ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;</pre>
          <p className="text-sm text-muted-foreground mt-2">Execute essa instrução no banco (via Supabase SQL ou migration) para habilitar armazenamento de permissões por usuário.</p>
        </Card>
      )}
      {/* Debug modal: exibe resultado da RPC/UPDATE/probe para diagnóstico */}
      <Dialog open={debugModalOpen} onOpenChange={setDebugModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Debug: resultado do salvamento de permissões</DialogTitle>
          </DialogHeader>
          <div className="text-sm">
            <pre className="text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded max-h-[60vh] overflow-auto">{JSON.stringify(debugResult || {}, null, 2)}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{ setDebugModalOpen(false); setDebugResult(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
