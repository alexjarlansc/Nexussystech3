import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

type CompanyRow = { id: string; name: string | null; suspended?: boolean | null };

export default function CompanyAdminPanel() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<CompanyRow | null>(null);
  const [missingColumn, setMissingColumn] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [rlsIssue, setRlsIssue] = useState<string | null>(null);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: del, error } = await (supabase as any).from('companies').delete().eq('id', r.id).select('id');
      if (error) throw error;
      if (!del || (Array.isArray(del) && del.length === 0)) {
        toast.error('Empresa não excluída (RLS ou não encontrada). Ajuste políticas RLS/Permissões.');
        return;
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
                  <td className="p-2">{r.name || '-'}</td>
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
