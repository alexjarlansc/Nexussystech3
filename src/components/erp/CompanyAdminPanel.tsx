import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import invokeFunction from '@/lib/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { isMasterRole } from '@/lib/permissions';

type CompanyRow = { id: string; name: string | null; suspended?: boolean | null };
type UserRow = { user_id: string; first_name: string | null; email: string | null; role: string | null };

export default function CompanyAdminPanel() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<CompanyRow | null>(null);
  const [missingColumn, setMissingColumn] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [rlsIssue, setRlsIssue] = useState<string | null>(null);
  // Modal de usuários por empresa
  const [usersOpen, setUsersOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companyQuota, setCompanyQuota] = useState<number | null>(null);
  const [companyForUsers, setCompanyForUsers] = useState<CompanyRow | null>(null);
  // Form de criação de usuário (somente Mestre)
  const { profile } = useAuth();
  const isMaster = isMasterRole(profile?.role || null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'user'|'admin'|'pdv'>('user');
  const [newCargo, setNewCargo] = useState('');
  const [creating, setCreating] = useState(false);
  // Health da função Edge admin-create-user
  const [edgeHealthCreate, setEdgeHealthCreate] = useState<'checking'|'ok'|'unreachable'>('checking');
  const [edgeHealthMsg, setEdgeHealthMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
  setMissingColumn(false);
  setTableMissing(false);
  setRlsIssue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('companies').select('id,name,suspended').order('name');
      if (error) {
        const msg = (error && typeof error === 'object' && 'message' in error) ? String((error as Record<string, unknown>).message) : String(error);
        // Tabela ausente
        if (/relation\s+"?companies"?\s+does not exist|42P01/i.test(msg)) {
          setTableMissing(true);
          throw error;
        }
        // Falta coluna suspended
        if (/column\s+"?suspended"?\s+does not exist|42703/i.test(msg)) {
          setMissingColumn(true);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: d2, error: e2 } = await (supabase as any).from('companies').select('id,name').order('name');
          if (e2) throw e2;
          setRows(((d2 as unknown) as CompanyRow[]) || []);
          return;
        }
        // RLS / permissão negada
        if (/permission denied|RLS|row level security|42501/i.test(msg)) {
          setRlsIssue(msg);
        }
        throw error;
      }
      setRows(((data as unknown) as CompanyRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCompanyUsers = async (r: CompanyRow) => {
    setCompanyForUsers(r);
    setUsersOpen(true);
    setUsersError(null);
    setUsers([]);
    setCompanyQuota(null);
    // health-check leve da função de criação (executa quando o modal abre)
    (async () => {
      try {
        setEdgeHealthCreate('checking'); setEdgeHealthMsg(null);
        const res = await invokeFunction<{ ok?: boolean }>('admin-create-user', { body: { health: true } });
        if (!res.ok) { setEdgeHealthCreate('unreachable'); setEdgeHealthMsg('Função Edge indisponível. Verifique deploy e SUPABASE_SERVICE_ROLE_KEY.'); }
        else {
          setEdgeHealthCreate(res.data?.ok ? 'ok' : 'unreachable');
          setEdgeHealthMsg(res.data?.ok ? null : 'Função Edge indisponível. Verifique deploy e SUPABASE_SERVICE_ROLE_KEY.');
        }
      } catch {
        setEdgeHealthCreate('unreachable'); setEdgeHealthMsg('Função Edge indisponível. Verifique deploy e SUPABASE_SERVICE_ROLE_KEY.');
      }
    })();
    try {
      setUsersLoading(true);
      // fetch company quota (service role via Edge; fallback client)
      try {
        const fx = await invokeFunction<{ ok?: boolean; user_quota?: number }>('company-get-quota', { body: { company_id: r.id }, verbose: true });
        if (fx.ok && typeof fx.data?.user_quota === 'number') {
          setCompanyQuota(fx.data.user_quota);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const qr: any = await (supabase as any).from('companies').select('user_quota').eq('id', r.id).limit(1).single();
          if (!qr?.error && qr?.data && typeof qr.data.user_quota !== 'undefined') setCompanyQuota(Number(qr.data.user_quota) || 3);
        }
      } catch { /* noop */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any)
        .from('profiles')
        .select('user_id, first_name, email, role')
        .eq('company_id', r.id)
        .order('first_name', { ascending: true });
      // Primeira tentativa com todas as colunas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any = await query;
      if (res.error) {
        const msg = String(res.error?.message || res.error);
        // 42703: undefined_column
  if (/42703|column\s+"?email"?\s+does not exist/i.test(msg)) {
          // Remover email
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query = (supabase as any)
            .from('profiles')
            .select('user_id, first_name, role')
            .eq('company_id', r.id)
            .order('first_name', { ascending: true });
          res = await query;
        }
        if (res.error) {
          const msg2 = String(res.error?.message || res.error);
          if (/42703|column\s+"?first_name"?\s+does not exist/i.test(msg2)) {
            // Remover first_name
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = (supabase as any)
              .from('profiles')
              .select('user_id, role')
              .eq('company_id', r.id)
              .order('user_id', { ascending: true });
            res = await query;
          }
        }
      }
      if (res.error) throw res.error;
      setUsers((((res.data as unknown) as UserRow[]) || []).filter(Boolean));
    } catch (e) {
      console.error('Falha ao carregar usuários da empresa', e);
      let msg = 'Erro ao carregar usuários';
      const maybe = e as unknown;
      if (maybe && typeof maybe === 'object' && 'message' in (maybe as Record<string, unknown>)) {
        const m = (maybe as Record<string, unknown>).message;
        if (typeof m === 'string' && m.trim()) msg = m;
      }
      setUsersError(msg);
      try { toast.error(msg); } catch {/* noop */}
    } finally {
      setUsersLoading(false);
    }
  };

  const createUserForCompany = async () => {
    if (!isMaster) { toast.error('Somente o Administrador Mestre pode criar usuários'); return; }
    if (!companyForUsers?.id) { toast.error('Empresa inválida'); return; }
    if (edgeHealthCreate !== 'ok') { toast.error(edgeHealthMsg || 'Função admin-create-user indisponível. Verifique o deploy e secrets.'); return; }
    const name = newName.trim(); const email = newEmail.trim(); const pwd = newPass;
    if (!name || !email || pwd.length < 6) { toast.error('Preencha nome, email e senha (min 6)'); return; }
    try {
      setCreating(true);
      // garantir sessão válida para enviar Authorization
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) { toast.error('Sessão expirada. Faça login novamente.'); setCreating(false); return; }
  const r = await invokeFunction<{ ok?: boolean }>('admin-create-user', { body: { email, password: pwd, first_name: name, company_id: companyForUsers.id, role: newRole, cargo: newCargo.trim() || null }, verbose: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!r.ok) throw new Error(String((r as any).error || 'Falha ao criar usuário'));
      const res = r.data as { ok?: boolean } | null;
      if (!res || !res.ok) throw new Error('Falha ao criar usuário');
      toast.success('Usuário criado com sucesso');
      setNewName(''); setNewEmail(''); setNewPass(''); setNewRole('user'); setNewCargo('');
      // recarregar lista
      if (companyForUsers) await openCompanyUsers(companyForUsers);
    } catch (e) {
      console.error(e);
      // Extrai mensagem detalhada vinda da Edge Function (error.context)
      const extractEdgeError = (err: unknown): string | null => {
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
      };
      const raw = extractEdgeError(e) || (e instanceof Error ? e.message : 'Falha ao criar usuário');
      const l = (raw || '').toLowerCase();
      const friendly = l.includes('failed to send a request') || l.includes('failed to fetch') || l.includes('network')
        ? 'Falha ao acessar a função Edge (admin-create-user). Verifique deploy e secrets.'
        : (l.includes('token inválido') || l.includes('não autenticado') || l.includes('401')
          ? 'Sessão inválida/expirada. Faça login novamente.'
          : raw);
      toast.error(friendly);
    } finally {
      setCreating(false);
    }
  };

  const suspend = async (r: CompanyRow, on: boolean) => {
    try {
      // Try to update suspended flag; detect missing column and inform user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: upd, error } = await (supabase as any).from('companies').update({ suspended: on }).eq('id', r.id).select('id,suspended');
      if (error) {
        const msg = (error && typeof error === 'object' && 'message' in error) ? String((error as Record<string, unknown>).message) : String(error);
        if (/column\s+"?suspended"?\s+does not exist|42703/i.test(msg)) {
          setMissingColumn(true);
          toast.error('Coluna "suspended" não existe na tabela companies. aplique a migration sugerida abaixo.');
          return;
        }
        throw error;
      }
      if (!upd || (Array.isArray(upd) && upd.length === 0)) {
        toast.error('Sem permissão para alterar status (RLS). Verifique políticas.');
        return;
      }
      toast.success(on ? 'Empresa suspensa' : 'Empresa reativada');
      void load();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao alterar suspensão');
    }
  };

  const requestRemove = (r: CompanyRow) => { setRowToDelete(r); setConfirmOpen(true); };
  const confirmRemove = async () => {
    const r = rowToDelete; if (!r) return;
    try {
      // Primeiro tenta via função Edge com service role (somente Mestre), bypass RLS de client
      try {
        const fx = await invokeFunction('admin-delete-company', { body: { company_id: r.id } });
        if (!fx.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fxErr = (fx as any).error;
          const extractEdgeError = (err: unknown): string | null => {
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
          };
          const detail = extractEdgeError(fxErr) || String((fxErr as { message?: string } | null)?.message || fxErr);
          const low = (detail || '').toLowerCase();
          if (low.includes('token inválido') || low.includes('não autenticado') || low.includes('401')) {
            toast.error('Sessão inválida/expirada. Faça login novamente.');
          } else if (low.includes('somente o administrador mestre') || low.includes('apenas') || low.includes('403')) {
            toast.error('Somente o Administrador Mestre pode excluir empresas.');
          } else if (low.includes('service role not configured')) {
            toast.error('Função administrativa sem Service Role. Configure SERVICE_ROLE_KEY nas Functions.');
          } else {
            toast.error(detail || 'Falha ao excluir empresa via função administrativa.');
          }
          throw fxErr;
        }
      } catch (fx) {
        // Fallback: tentativa direta (sujeita a RLS). Mantém compatibilidade com ambientes sem a função
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: del, error } = await (supabase as any).from('companies').delete().eq('id', r.id).select('id');
        if (error) throw error;
        if (!del || (Array.isArray(del) && del.length === 0)) {
          toast.error('Empresa não excluída (RLS ou não encontrada). Ajuste políticas RLS/Permissões.');
          return;
        }
      }
      toast.success('Empresa excluída');
      setConfirmOpen(false); setRowToDelete(null);
      void load();
    } catch (e) {
      console.error(e);
      let msg = 'Falha ao excluir empresa';
      const maybe = e as unknown;
      if (maybe && typeof maybe === 'object' && 'message' in (maybe as Record<string, unknown>)) {
        const m = (maybe as Record<string, unknown>).message as string;
        if (m) msg = `${msg}: ${m}`;
      }
      toast.error(msg + '. Verifique dependências (FK) e permissões RLS.');
    }
  };

  const filtered = rows.filter(r => {
    const q = filter.toLowerCase();
    return !q || (r.name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      {tableMissing && (
        <div className="p-3 border rounded bg-amber-50 text-amber-800 text-xs leading-relaxed">
          <div className="font-medium mb-1">Tabela companies ausente</div>
          <div>Crie a tabela no Supabase antes de continuar. SQL sugerido:</div>
          <pre className="mt-2 p-2 bg-amber-100 rounded overflow-x-auto">{`create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  suspended boolean not null default false,
  created_at timestamptz default now()
);

alter table public.companies enable row level security;`}</pre>
          <div className="mt-2">Depois, recarregue esta página.</div>
        </div>
      )}
      {rlsIssue && (
        <div className="p-3 border rounded bg-amber-50 text-amber-800 text-xs leading-relaxed">
          <div className="font-medium mb-1">Permissão negada para companies</div>
          <div className="mb-2">Mensagem do banco: <code>{rlsIssue}</code></div>
          <div>Se deseja permitir leitura para admin, aplique uma política como:</div>
          <pre className="mt-2 p-2 bg-amber-100 rounded overflow-x-auto">{`-- habilite RLS se ainda não estiver ativo
alter table public.companies enable row level security;

-- leitura para admins (baseada em profiles.role)
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

create policy if not exists "Companies read (admin)" on public.companies
for select using (public.is_admin());

-- opcional: permitir que cada usuário leia apenas a própria empresa
create policy if not exists "Companies read (own)" on public.companies
for select using (exists(
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.company_id = companies.id
));`}</pre>
          <div className="mt-2">Depois, recarregue esta página.</div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Buscar</Label>
          <Input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="nome da empresa" />
        </div>
        <Button variant="outline" onClick={()=>void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</Button>
      </div>

      {missingColumn && (
        <div className="p-3 border rounded bg-amber-50 text-amber-800 text-xs leading-relaxed">
          <div className="font-medium mb-1">Coluna "suspended" ausente em companies</div>
          <div>Para habilitar suspensão de empresas, adicione a coluna no Supabase:</div>
          <pre className="mt-2 p-2 bg-amber-100 rounded overflow-x-auto">{`ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;`}</pre>
          <div className="mt-2">Depois, recarregue esta página.</div>
        </div>
      )}

      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Empresa</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma empresa</td></tr>
            )}
            {filtered.map((r)=>{
              const suspended = !!r.suspended;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    <button
                      type="button"
                      className="underline decoration-dotted hover:decoration-solid text-left"
                      onClick={() => openCompanyUsers(r)}
                      title="Ver usuários desta empresa"
                    >
                      {r.name || '-'}
                    </button>
                  </td>
                  <td className="p-2">{suspended ? 'Suspensa' : 'Ativa'}</td>
                  <td className="p-2 flex gap-2">
                    {!suspended ? (
                      <Button size="sm" variant="secondary" onClick={()=>void suspend(r, true)} disabled={missingColumn}>Suspender</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={()=>void suspend(r, false)} disabled={missingColumn}>Reativar</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={()=>requestRemove(r)}>Excluir</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Usuários da Empresa */}
      <Dialog open={usersOpen} onOpenChange={(o)=>{ setUsersOpen(o); if(!o){ setCompanyForUsers(null); setUsers([]); setUsersError(null); }}}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Usuários da Empresa</DialogTitle>
            <DialogDescription>
              {companyForUsers?.name ? `Empresa: ${companyForUsers.name}` : (companyForUsers?.id ? `Empresa #${companyForUsers.id}` : '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Formulário de criação de usuário removido por decisão operacional */}
            {usersLoading && <div className="text-sm text-muted-foreground">Carregando usuários…</div>}
            {usersError && (
              <div className="p-2 rounded border text-xs text-amber-800 bg-amber-50">
                {usersError}
              </div>
            )}
            {!usersLoading && !usersError && users.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum usuário vinculado a esta empresa.</div>
            )}
            {!usersLoading && users.length > 0 && (
              <div className="overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">E-mail</th>
                      <th className="text-left p-2">Papel</th>
                      <th className="text-left p-2">User ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-t">
                        <td className="p-2">{u.first_name || '-'}</td>
                        <td className="p-2">{u.email || '-'}</td>
                        <td className="p-2">{u.role || '-'}</td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">{u.user_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isMaster && (
              <div className="flex items-center gap-2">
                <Label htmlFor="quota">Limite de usuários</Label>
                <Input id="quota" type="number" min={1} className="w-24" value={companyQuota ?? ''} onChange={e=>setCompanyQuota(Number(e.target.value)||1)} />
                <Button size="sm" onClick={async ()=>{
                  if (!companyForUsers?.id) return;
                  const qn = Number(companyQuota||0); if (!qn || qn<1) { toast.error('Informe um limite válido'); return; }
                  try {
                    // Verifica sessão para garantir Authorization na Edge Function
                    const { data: sess } = await supabase.auth.getSession();
                    if (!sess?.session) { toast.error('Sessão inválida/expirada. Faça login novamente.'); return; }
                    // Tenta via função administrativa (service role) primeiro
                    const fx = await invokeFunction<{ ok?: boolean; user_quota?: number }>('admin-update-company', { body: { company_id: companyForUsers.id, user_quota: qn }, verbose: true });
                    if (fx.ok !== true) {
                      const errMsg = (fx as { ok: false; error?: string }).error ?? 'Falha ao atualizar via função';
                      throw new Error(errMsg);
                    }
                    const newQ = typeof fx.data?.user_quota === 'number' ? fx.data.user_quota : qn;
                    setCompanyQuota(newQ);
                    toast.success('Limite atualizado');
                    // Recarrega quota após salvar
                    try {
                      const fx2 = await invokeFunction<{ ok?: boolean; user_quota?: number }>('company-get-quota', { body: { company_id: companyForUsers.id }, verbose: true });
                      if (fx2.ok && typeof fx2.data?.user_quota === 'number') setCompanyQuota(fx2.data.user_quota);
                    } catch { /* ignore */ }
                  } catch (fxerr) {
                    // Fallback: tentativa direta (sujeita a RLS)
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any).from('companies').update({ user_quota: qn }).eq('id', companyForUsers.id);
                      if (error) throw error;
                      toast.success('Limite atualizado');
                      // Recarrega quota após salvar
                      try {
                        const fx2 = await invokeFunction<{ ok?: boolean; user_quota?: number }>('company-get-quota', { body: { company_id: companyForUsers.id }, verbose: true });
                        if (fx2.ok && typeof fx2.data?.user_quota === 'number') setCompanyQuota(fx2.data.user_quota);
                      } catch { /* ignore */ }
                    } catch (e) {
                      const msg = (e && typeof e === 'object' && 'message' in (e as Record<string, unknown>)) ? String((e as Record<string, unknown>).message) : 'Falha ao atualizar limite';
                      toast.error(msg);
                    }
                  }
                }}>Salvar</Button>
                <div className="text-xs text-muted-foreground">Use para ajustar a quantidade de usuários permitidos para a empresa.</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{rowToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={()=>{ setConfirmOpen(false); setRowToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={()=>void confirmRemove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
