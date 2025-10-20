import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import invokeFunction from '@/lib/functions';
import type { Profile } from '@/hooks/authTypes';

type SimpleProfile = { user_id: string; first_name?: string | null; email?: string | null; role?: string | null };

export default function AdminCompanyUsers(){
  const { profile } = useAuth() as { profile: Profile | null };
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<SimpleProfile[]>([]);
  const [quota, setQuota] = useState<number>(3);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [creating, setCreating] = useState(false);
  const [edgeHealthCreate, setEdgeHealthCreate] = useState<'checking'|'ok'|'unreachable'>('checking');
  const [edgeHealthMsg, setEdgeHealthMsg] = useState<string | null>(null);

  const companyId = (profile as Profile | null)?.company_id as string | undefined;
  const rawRole = String(profile?.role || '').toLowerCase();
  const isAdmin = rawRole.includes('admin');
  const isMaster = rawRole.includes('master') || rawRole.includes('mestre') || rawRole.includes('owner');

  const load = useCallback(async () => {
    if (!companyId) return setProfiles([]);
    setLoading(true);
    try {
      // use supabase client with permissive typing here
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      // fetch company quota first (best-effort)
      try {
        // 1) Tente via função Edge com service role (mais confiável com RLS)
        const fx = await invokeFunction<{ ok?: boolean; user_quota?: number }>('company-get-quota', { body: { company_id: companyId }, verbose: true });
        if (fx.ok && typeof fx.data?.user_quota === 'number') {
          setQuota(fx.data.user_quota);
        } else {
          // 2) Fallback: query direta (sujeita a RLS/cache)
          const qr = await sb.from('companies').select('user_quota').eq('id', companyId).limit(1).single();
          const qerr = (qr as { error?: { message?: string } | null }).error;
          if (!qerr && qr && typeof (qr as { data?: unknown }).data === 'object' && (qr as { data?: { user_quota?: unknown } }).data) {
            const uq = Number(((qr as { data: { user_quota?: unknown } }).data.user_quota) ?? 3);
            if (!Number.isNaN(uq) && uq > 0) setQuota(uq);
          }
        }
      } catch (_) { /* ignore quota fetch failure */ }
      let q = sb.from('profiles').select('user_id, first_name, email, role').eq('company_id', companyId).order('first_name');
      let res = await q;
      if (res?.error) {
        const msg = String(res.error?.message || res.error || 'erro');
        if (/42703|column\s+"?first_name"?\s+does not exist/i.test(msg)) {
          q = sb.from('profiles').select('user_id, email, role').eq('company_id', companyId).order('user_id');
          res = await q;
        }
      }
      if (res?.error) throw res.error;
      setProfiles(((res?.data as unknown) as SimpleProfile[]) || []);
    } catch (e) {
      console.error('AdminCompanyUsers load error', e);
      toast.error('Falha ao carregar usuários da empresa');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  // Health-check da função admin-create-user quando abrir o modal
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setEdgeHealthCreate('checking'); setEdgeHealthMsg(null);
        const res = await invokeFunction<{ ok?: boolean }>('admin-create-user', { body: { health: true } });
        if (!res.ok) {
          setEdgeHealthCreate('unreachable');
          setEdgeHealthMsg('Função admin-create-user indisponível. Verifique o deploy e a configuração da Service Role.');
        } else {
          setEdgeHealthCreate(res.data?.ok ? 'ok' : 'unreachable');
          setEdgeHealthMsg(res.data?.ok ? null : 'Função admin-create-user indisponível. Verifique o deploy e a configuração da Service Role.');
        }
      } catch {
        setEdgeHealthCreate('unreachable');
        setEdgeHealthMsg('Função admin-create-user indisponível. Verifique o deploy e a configuração da Service Role.');
      }
    })();
  }, [open]);

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
            if (typeof c.message === 'string' && c.message) return c.message;
            if (typeof c.body === 'string' && c.body) {
              try { const parsed = JSON.parse(c.body); if (parsed && typeof parsed.error === 'string') return parsed.error; } catch { /* ignore */ }
            }
          }
        }
        if (typeof any.message === 'string' && any.message) return any.message;
      }
    } catch { /* ignore */ }
    return null;
  };

  // Realtime: atualiza quota quando houver UPDATE na empresa
  useEffect(() => {
    if (!open || !companyId) return;
    const channel = supabase.channel(`company-quota:${companyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies', filter: `id=eq.${companyId}` }, (payload: { new?: Record<string, unknown> } | null) => {
        try {
          const rec = payload && payload.new && typeof payload.new === 'object' ? (payload.new as Record<string, unknown>) : undefined;
          const uqRaw = rec && 'user_quota' in rec ? (rec.user_quota as unknown) : undefined;
          const uqNum = typeof uqRaw === 'string' ? Number(uqRaw) : (typeof uqRaw === 'number' ? uqRaw : NaN);
          const uq = Number.isFinite(uqNum) ? uqNum : NaN;
          if (Number.isFinite(uq) && uq > 0) setQuota(uq);
        } catch {/* noop */}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {/* noop */} };
  }, [open, companyId]);

  const canCreate = () => {
    // Only non-master admins of the company may create up to 3 users for their company.
    if (!isAdmin) return false;
    if (isMaster) return false;
    return (profiles.length < quota);
  };

  const createUser = async () => {
    if (!companyId) { toast.error('Empresa inválida'); return; }
    if (!canCreate()) { toast.error('Limite de usuários atingido ou permissão insuficiente'); return; }
    if (!newName.trim() || !newEmail.trim() || (newPass || '').length < 6) { toast.error('Preencha nome, email e senha (min 6)'); return; }
    if (edgeHealthCreate !== 'ok') { toast.error(edgeHealthMsg || 'Função admin-create-user indisponível.'); return; }
    try {
      setCreating(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) { toast.error('Sessão inválida/expirada'); setCreating(false); return; }
      const res = await invokeFunction('admin-create-user', { body: { email: newEmail.trim(), password: newPass, first_name: newName.trim(), company_id: companyId, role: 'user' }, verbose: true });
      if (!res.ok) {
        const msg = (res as { ok: false; error?: string }).error || 'Falha ao criar usuário';
        console.error('AdminCompanyUsers create error (Edge result)', res);
        throw new Error(msg);
      }
      toast.success('Usuário criado com sucesso');
      setNewName(''); setNewEmail(''); setNewPass('');
      await load();
    } catch (e) {
      const raw = extractEdgeError(e) || (e instanceof Error ? e.message : 'Falha ao criar usuário');
      const l = raw.toLowerCase();
      const friendly = l.includes('failed to fetch') || l.includes('failed to send a request') || l.includes('network')
        ? 'Falha ao acessar a função Edge (admin-create-user). Verifique se está deployada e com Service Role configurada.'
        : (l.includes('token inválido') || l.includes('não autenticado') || l.includes('401')
          ? 'Sessão inválida/expirada. Faça login novamente.'
          : raw);
      console.error('AdminCompanyUsers create error', e);
      toast.error(friendly);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!companyId || !isAdmin}>
        Gerenciar usuários da minha empresa
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setProfiles([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usuários da minha empresa</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Empresa: {companyId || '—'}</div>
            <div>
              <div className="mb-2 text-sm font-medium">Usuários</div>
              <div className="overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Papel</th></tr></thead>
                  <tbody>
                    {profiles.map(p => (
                      <tr key={p.user_id} className="border-t"><td className="p-2">{p.first_name || '-'}</td><td className="p-2">{p.email || '-'}</td><td className="p-2">{p.role || '-'}</td></tr>
                    ))}
                    {profiles.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum usuário</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {edgeHealthCreate !== 'ok' && (
              <div className="p-2 rounded border text-xs text-amber-800 bg-amber-50">
                {edgeHealthMsg || 'Função administrativa de criação de usuário indisponível. Veja scripts/deploy_edge_functions.ps1 para deploy.'}
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium">Criar novo usuário (limite: {quota})</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Nome completo" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <Input placeholder="Senha" value={newPass} onChange={e => setNewPass(e.target.value)} type="password" />
              </div>
              <div className="mt-2 flex gap-2">
                <Button onClick={createUser} disabled={!canCreate() || creating || edgeHealthCreate !== 'ok'}>{creating ? 'Criando...' : 'Criar usuário'}</Button>
                <Button variant="outline" onClick={() => { setOpen(false); setProfiles([]); }}>Fechar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
