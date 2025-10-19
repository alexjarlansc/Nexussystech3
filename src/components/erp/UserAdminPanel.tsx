import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// removed Select import as company picking now uses a separate modal with search

type Row = { id: string; user_id: string; first_name?: string | null; email?: string | null; role?: 'user'|'admin'|'pdv'|'master'; permissions?: string[] | null };

type Company = { id: string; name: string };

export default function UserAdminPanel() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPass, setCPass] = useState('');
  const [cCompanyId, setCCompanyId] = useState<string | undefined>(undefined);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [edgeHealth, setEdgeHealth] = useState<'checking'|'ok'|'unreachable'>('checking');
  const [edgeMsg, setEdgeMsg] = useState<string | null>(null);

  useEffect(()=>{
    const t = setTimeout(()=>setDebouncedSearch(companySearch), 300);
    return ()=>clearTimeout(t);
  },[companySearch]);

  // memoized loader for companies based on debounced search
  const loadCompanies = useCallback(async () => {
    try {
      const s = debouncedSearch.trim();
      const query = s
        ? supabase.from('companies').select('id,name').ilike('name', `%${s}%`).order('name')
        : supabase.from('companies').select('id,name').order('name');
      const { data, error } = await query;
      if (error) throw error;
      setCompanies(((data as unknown) as Company[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar empresas');
    }
  }, [debouncedSearch]);

  // when company picker is open and debounced search changes, reload companies
  useEffect(() => {
    if (companyPickerOpen) {
      void loadCompanies();
    }
  }, [companyPickerOpen, loadCompanies]);

  // Edge Function health check (reutilizável)
  const checkEdge = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-create-user', { body: {} });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('failed to send a request') || msg.includes('failed to fetch') || msg.includes('network')) {
          setEdgeHealth('unreachable'); setEdgeMsg('Função Edge indisponível. Verifique deploy e SUPABASE_SERVICE_ROLE_KEY.');
        } else {
          setEdgeHealth('ok'); setEdgeMsg(null);
        }
      } else {
        setEdgeHealth('ok'); setEdgeMsg(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao verificar função Edge';
      const low = msg.toLowerCase();
      if (low.includes('failed to send a request') || low.includes('failed to fetch') || low.includes('network')) {
        setEdgeHealth('unreachable'); setEdgeMsg('Função Edge indisponível. Verifique deploy e SUPABASE_SERVICE_ROLE_KEY.');
      } else {
        setEdgeHealth('ok'); setEdgeMsg(null);
      }
    }
  }, []);

  // Health check on mount
  useEffect(() => { void checkEdge(); }, [checkEdge]);

  const load = async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id,user_id,first_name,email,role,permissions')
        .order('first_name', { ascending: true });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRows(((data as any) || []) as Row[]);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  

  const suspend = async (r: Row, on: boolean) => {
    if (r.role === 'master') { toast.error('Operação não permitida: Administrador Mestre é imune a suspensão.'); return; }
    try {
      const current = Array.isArray(r.permissions) ? r.permissions : [];
      const next = on ? Array.from(new Set([...current, 'suspended'])) : current.filter(p => p !== 'suspended');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('profiles').update({ permissions: next }).eq('id', r.id);
      if (error) throw error;
      toast.success(on ? 'Usuário suspenso' : 'Usuário reativado');
      void load();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao alterar suspensão');
    }
  };

  const requestRemove = (r: Row) => { setRowToDelete(r); setConfirmOpen(true); };
  const confirmRemove = async () => {
    const r = rowToDelete; if (!r) return;
    if (r.role === 'master') { toast.error('Operação não permitida: Administrador Mestre não pode ser excluído.'); setConfirmOpen(false); setRowToDelete(null); return; }
    try {
      // Tenta exclusão definitiva via Edge Function (auth + profile)
      try {
        const { error: fxErr } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: r.user_id } });
        if (fxErr) throw fxErr;
        toast.success('Usuário excluído definitivamente');
      } catch (fxE) {
        // Fallback: remove apenas o perfil (mantém auth)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: delErr } = await (supabase as any).from('profiles').delete().eq('id', r.id);
        if (delErr) throw delErr;
        toast.success('Perfil excluído (auth preservado)');
      }
      setConfirmOpen(false); setRowToDelete(null);
      void load();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao excluir perfil');
    }
  };

  const filtered = rows.filter(r => {
    const q = filter.toLowerCase();
    return !q || (r.first_name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      {edgeHealth === 'unreachable' && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">Função admin-create-user indisponível</div>
              <div>{edgeMsg || 'Verifique o deploy da função e a secret SUPABASE_SERVICE_ROLE_KEY.'}</div>
              <div className="mt-1 text-xs">Dica: veja {`supabase/functions/README-deploy.md`} para o passo a passo.</div>
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={()=>void checkEdge()}>Re-testar</Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Buscar</Label>
          <Input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="nome ou email" />
        </div>
        <Button variant="outline" onClick={()=>void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</Button>
        {(profile?.role === 'master') && (
          <Button onClick={()=>{
            setCreateOpen(true); void loadCompanies();
          }}>Criar Usuário</Button>
        )}
      </div>
      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Perfil</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Nenhum usuário</td></tr>
            )}
            {filtered.map((r)=>{
          const suspended = r.role === 'master' ? false : (Array.isArray(r.permissions) && r.permissions.includes('suspended'));
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.first_name || '-'}</td>
                  <td className="p-2">{r.email || '-'}</td>
                  <td className="p-2">{r.role}</td>
                  <td className="p-2">{suspended ? 'Suspenso' : 'Ativo'}</td>
                  <td className="p-2 flex gap-2">
                    {!suspended ? (
                      <Button size="sm" variant="secondary" onClick={()=>void suspend(r, true)} disabled={r.role === 'master'}>{r.role === 'master' ? 'Mestre (imune)' : 'Suspender'}</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={()=>void suspend(r, false)} disabled={r.role === 'master'}>{r.role === 'master' ? 'Mestre (imune)' : 'Reativar'}</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={()=>requestRemove(r)} disabled={r.role === 'master'}>{r.role === 'master' ? 'Mestre (imune)' : 'Excluir'}</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
  <p className="text-xs text-muted-foreground">A exclusão definitiva usa uma Função Edge (admin-delete-user). Se não estiver disponível, somente o perfil é removido.</p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil de {rowToDelete?.first_name || rowToDelete?.email || rowToDelete?.user_id}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={()=>{ setConfirmOpen(false); setRowToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={()=>void confirmRemove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome Completo *</Label>
              <Input value={cName} onChange={(e)=>setCName(e.target.value)} placeholder="Nome completo" required autoComplete="name" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={cEmail} onChange={(e)=>setCEmail(e.target.value)} placeholder="email@exemplo.com" required autoComplete="email" />
            </div>
            <div>
              <Label>Senha * (mín. 6)</Label>
              <Input type="password" value={cPass} onChange={(e)=>setCPass(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" />
            </div>
            <div>
              <Label>Empresa *</Label>
              <div className="flex gap-2">
                <Input readOnly value={companies.find(c=>c.id===cCompanyId)?.name || ''} placeholder="Selecione uma empresa" onClick={()=>{ setCompanyPickerOpen(true); void loadCompanies(); }} />
                <Button type="button" variant="outline" onClick={()=>{ setCompanyPickerOpen(true); void loadCompanies(); }}>Selecionar</Button>
              </div>
              {!cCompanyId && <p className="mt-1 text-xs text-red-500">Selecione uma empresa</p>}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setCreateOpen(false)}>Cancelar</Button>
              {(profile?.role === 'master') && (
                <Button
                  disabled={!cName.trim() || !cEmail.trim() || cPass.length < 6 || !cCompanyId}
                  onClick={async ()=>{
                  if (!cName.trim() || !cEmail.trim() || !cPass) { toast.error('Preencha nome, email e senha'); return; }
                  if (!cCompanyId) { toast.error('Selecione uma empresa'); return; }
                  try {
                    // Garante que temos sessão válida para a chamada da Edge Function
                    const sessRes = await supabase.auth.getSession();
                    const hasSession = !!sessRes.data?.session;
                    if (!hasSession) { toast.error('Sessão expirada. Faça login novamente.'); return; }
                    type FxOk = { ok: true; user_id: string };
                    type FxErr = { error: string };
                    const { data, error } = await supabase.functions.invoke('admin-create-user', { body: { email: cEmail.trim(), password: cPass, first_name: cName.trim(), company_id: cCompanyId } });
                    if (error) throw error;
                    const resp = data as FxOk | FxErr | null;
                    if (!resp || (resp as FxErr).error) throw new Error((resp as FxErr)?.error || 'Falha ao criar usuário');
                    toast.success('Usuário criado com sucesso');
                    setCreateOpen(false);
                    setCName(''); setCEmail(''); setCPass(''); setCCompanyId(undefined);
                    void load();
                  } catch (e) {
                    console.error(e);
                    const baseMsg = e instanceof Error ? e.message : 'Falha ao criar usuário';
                    const lower = (baseMsg || '').toLowerCase();
                    const finalMsg = (lower.includes('failed to send a request') || lower.includes('failed to fetch') || lower.includes('network'))
                      ? 'Falha ao chamar a função Edge (admin-create-user). Verifique se a função está deployada e com SUPABASE_SERVICE_ROLE_KEY configurada.'
                      : baseMsg;
                    toast.error(finalMsg);
                  }
                }}>Criar</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Picker Modal */}
      <Dialog open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Buscar</Label>
              <Input value={companySearch} onChange={(e)=>setCompanySearch(e.target.value)} placeholder="nome da empresa" />
            </div>
            <div className="max-h-64 overflow-auto border rounded">
              {companies.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhuma empresa encontrada</div>
              ) : (
                <ul>
                  {companies.map(c=> (
                    <li key={c.id} className="p-2 border-b hover:bg-muted cursor-pointer" onClick={()=>{ setCCompanyId(c.id); setCompanyPickerOpen(false); }}>
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={()=>setCompanyPickerOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
