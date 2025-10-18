import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

type Row = { id: string; user_id: string; first_name?: string | null; email?: string | null; role?: 'user'|'admin'|'pdv'; permissions?: string[] | null };

export default function UserAdminPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<Row | null>(null);

  const load = async () => {
    try {
      setLoading(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('profiles').select('id,user_id,first_name,email,role,permissions').order('first_name', { ascending: true });
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
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Buscar</Label>
          <Input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="nome ou email" />
        </div>
        <Button variant="outline" onClick={()=>void load()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</Button>
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
              const suspended = Array.isArray(r.permissions) && r.permissions.includes('suspended');
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.first_name || '-'}</td>
                  <td className="p-2">{r.email || '-'}</td>
                  <td className="p-2">{r.role}</td>
                  <td className="p-2">{suspended ? 'Suspenso' : 'Ativo'}</td>
                  <td className="p-2 flex gap-2">
                    {!suspended ? (
                      <Button size="sm" variant="secondary" onClick={()=>void suspend(r, true)}>Suspender</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={()=>void suspend(r, false)}>Reativar</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={()=>requestRemove(r)}>Excluir</Button>
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
    </div>
  );
}
