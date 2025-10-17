import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    if (!profile || profile.role !== 'admin') return;
    loadUsers();
  }, [profile]);

  async function loadUsers() {
    setLoading(true);
    try {
      // Busca perfis
      const res = await supabase
        .from('profiles')
        .select('id,user_id,first_name,email,role,permissions')
        // ocultar administradores diretamente na consulta
        .neq('role', 'admin')
        .order('first_name', { ascending: true })
        .limit(500);

  if (res.error) throw res.error;
  // Filtro defensivo extra caso role venha nulo/indefinido
  const data = ((res.data as unknown as ProfileRow[]) || []).filter(u => (u.role || '').toLowerCase() !== 'admin');
      // Normalize permissions to array when present
      setUsers(data.map(d => ({ ...d, permissions: Array.isArray(d.permissions) ? d.permissions : [] })));
  setPermissionsColumnMissing(false);
    } catch (err) {
      const e = err as Error | { message?: string } | null;
      console.error('Erro ao carregar usuários:', e);
      const msg = String((e as { message?: string } | null)?.message || '');
      // If the permissions column is missing, re-run without it and show users without permissions
      if (msg.includes('permissions') || msg.includes('column "permissions"')) {
        try {
          const fallback = await supabase
            .from('profiles')
            .select('id,user_id,first_name,email,role')
            .neq('role', 'admin')
            .order('first_name', { ascending: true })
            .limit(500);
          if (fallback.error) throw fallback.error;
          const data = ((fallback.data as unknown as ProfileRow[]) || []).filter(u => (u.role || '').toLowerCase() !== 'admin');
          setUsers(data.map(d => ({ ...d, permissions: [] })));
          toast.error('Coluna `permissions` não encontrada. Exibindo usuários sem permissões. Rode a migração SQL sugerida.');
          setPermissionsColumnMissing(true);
        } catch (ferr) {
          console.error('Erro fallback ao carregar usuarios:', ferr);
          toast.error('Falha ao carregar usuários. Verifique a conexão com o banco.');
        }
      } else if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('rls')) {
        toast.error('Falha ao carregar usuários. Política RLS pode estar bloqueando o acesso.');
      } else {
        toast.error('Falha ao carregar usuários. Verifique a conexão com o banco.');
      }
    } finally {
      setLoading(false);
    }
  }

  const savePermissions = async (row: ProfileRow) => {
    try {
      if (!row) {
        toast.error('Nenhum usuário selecionado para salvar.');
        return;
      }
      if (row.role === 'admin') {
        toast.info('Usuário é administrador — permissões globais não serão alteradas via este painel.');
        return;
      }

      // Sempre capturar o estado MAIS ATUAL das permissões a partir da lista (evita staleness da modal)
      const latest = users.find(u => u.id === row.id) || row;
      // Normaliza, filtra tipos estranhos e remove duplicadas
      const permissionsPayload = Array.from(
        new Set(
          (Array.isArray(latest.permissions) ? latest.permissions : [])
            .filter((p): p is string => typeof p === 'string')
            .map(p => p.trim())
            .filter(p => p.length > 0)
        )
      );
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
    const current = Array.isArray(u.permissions) ? [...u.permissions] : [];
    const idx = current.indexOf(perm);
    if (idx === -1) current.push(perm);
    else current.splice(idx, 1);
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, permissions: current } : p));
    // If we have the modal open and this is the selected user, sync selectedUser so checkboxes in modal update
    setSelectedUser(prev => (prev && prev.id === u.id ? { ...prev, permissions: current } : prev));
  };

  // expanded nodes for tree UI, scoped per user id
  const [expandedNodes, setExpandedNodes] = useState<Record<string, Record<string, boolean>>>({});
  const toggleNode = (userId: string, nodeId: string) => setExpandedNodes(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [nodeId]: !((prev[userId] || {})[nodeId]) } }));

  function renderPermNode(node: PermNode, u: ProfileRow) {
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
  }

  if (!profile || profile.role !== 'admin') {
    return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Acesso negado</h2><p className="text-sm text-muted-foreground">Apenas administradores podem acessar o Controle de Acesso.</p></Card>;
  }

  return (
    <div className="space-y-4">
      {rpcMissing && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="text-sm font-medium text-amber-800 mb-2">Função de salvamento ausente no banco</div>
          <div className="text-xs text-amber-800">Precisamos criar a função RPC <code>admin_update_permissions</code> para que administradores salvem permissões sob RLS.</div>
          <div className="mt-2">
            <pre className="text-xs p-2 bg-white rounded border overflow-auto">{`-- Execute no Supabase SQL (ou rode as migrações do projeto)\n${'CREATE OR REPLACE FUNCTION public.admin_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = \'admin\'); $$;'}\n\n${'CREATE OR REPLACE FUNCTION public.admin_update_permissions(target_id uuid, perms jsonb) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE updated_row public.profiles; BEGIN IF NOT public.admin_is_admin() THEN RAISE EXCEPTION \'Only admins can update permissions\'; END IF; UPDATE public.profiles AS pr SET permissions = coalesce(perms, \'[]\'::jsonb) WHERE pr.id = target_id OR pr.user_id = target_id RETURNING pr.* INTO updated_row; IF updated_row.id IS NULL THEN RAISE EXCEPTION \'Profile not found for id=%\', target_id; END IF; RETURN updated_row; END; $$;'}\n\n${'CREATE OR REPLACE FUNCTION public.admin_update_permissions(target_id uuid, perms text[]) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN public.admin_update_permissions(target_id, to_jsonb(perms)); END; $$;'}\n\nGRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, jsonb) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, text[]) TO authenticated;`}</pre>
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
            <tbody>
              {users
                // Garantia extra: nunca listar administradores
                .filter(u => (u.role || '').toLowerCase() !== 'admin')
                .filter(u=>{
                  if(!query) return true;
                  const q = query.toLowerCase();
                  return (u.first_name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q);
                })
                .map(u => (
                <tr key={u.id} className="border-t align-top">
                  <td className="p-2 align-top">
                    {u.first_name || u.user_id}
                    {(() => {
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
                    })()}
                  </td>
                  <td className="p-2 align-top">{u.email || '-'}</td>
                  <td className="p-2 align-top">{u.role || '-'}</td>
                  <td className="p-2 align-top">
                    <div className="text-sm flex flex-wrap gap-1">
                      {(() => {
                        const summary = summarizePermissions(u.permissions);
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
                            <span key="__total" className="inline-flex items-center rounded bg-slate-200 text-slate-800 px-2 py-0.5 text-[11px]">
                              Total ({total})
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={()=>{ setSelectedUser(u); setModalOpen(true); }}>Editar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
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
