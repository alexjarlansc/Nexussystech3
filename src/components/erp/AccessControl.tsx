import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
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

const PRODUCT_PERMISSIONS = [
  'products.manage',
  'products.pricing',
  'products.groups',
  'products.units',
  'products.variations',
  'products.labels',
];

export default function AccessControl() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    loadUsers();
  }, [profile]);

  async function loadUsers() {
    setLoading(true);
    try {
      // Busca perfis
      const { data, error } = await supabase
        .from('profiles')
        .select('id,user_id,first_name,email,role,permissions')
        .order('first_name', { ascending: true })
        .limit(500);

      if (error) throw error;
  setUsers(((data as unknown as ProfileRow[]) || []));
    } catch (err) {
      const e = err as Error | { message?: string } | null;
      console.error('Erro ao carregar usuários:', e);
      toast.error('Falha ao carregar usuários. Verifique a conexão com o banco.');
    } finally {
      setLoading(false);
    }
  }

  const savePermissions = async (row: ProfileRow) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(({ permissions: row.permissions || [] } as unknown) as Record<string, unknown>)
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Permissões atualizadas');
      await loadUsers();
    } catch (err) {
      const e = err as Error | { message?: string } | null;
      console.error('Erro ao salvar permissões:', e);
      // Se coluna permissions não existir, instruir
      const msg = String((e as { message?: string } | null)?.message || '');
      if (msg.includes('permissions')) {
        toast.error('Coluna `permissions` não encontrada. Rode a migração SQL sugerida.');
      } else {
        toast.error('Falha ao salvar permissões');
      }
    }
  };

  const togglePermission = (u: ProfileRow, perm: string) => {
    const current = Array.isArray(u.permissions) ? [...u.permissions] : [];
    const idx = current.indexOf(perm);
    if (idx === -1) current.push(perm);
    else current.splice(idx, 1);
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, permissions: current } : p));
  };

  if (!profile || profile.role !== 'admin') {
    return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Acesso negado</h2><p className="text-sm text-muted-foreground">Apenas administradores podem acessar o Controle de Acesso.</p></Card>;
  }

  return (
    <div className="space-y-4">
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
                <th className="p-2">Permissões (Produtos)</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u=>{
                if(!query) return true;
                const q = query.toLowerCase();
                return (u.first_name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q);
              }).map(u => (
                <tr key={u.id} className="border-t align-top">
                  <td className="p-2 align-top">{u.first_name || u.user_id}</td>
                  <td className="p-2 align-top">{u.email || '-'}</td>
                  <td className="p-2 align-top">{u.role || '-'}</td>
                  <td className="p-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_PERMISSIONS.map(p => (
                        <label key={p} className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={Array.isArray(u.permissions) ? u.permissions.includes(p) : false} onChange={()=>togglePermission(u,p)} />
                          <span className="text-xs">{p}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={()=>savePermissions(u)}>Salvar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-2">SQL caso não exista a coluna</h3>
        <pre className="text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded">ALTER TABLE profiles ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;</pre>
        <p className="text-sm text-muted-foreground mt-2">Execute essa instrução no banco (via Supabase SQL ou migration) para habilitar armazenamento de permissões por usuário.</p>
      </Card>
    </div>
  );
}
