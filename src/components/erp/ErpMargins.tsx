import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Margin = { id: string; name: string; percent: number; created_at: string; company_id?: string | null; created_by?: string | null };

export default function ErpMargins() {
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; percent: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { profile, user } = useAuth();

  async function handleSave() {
    if (!name) { toast.error('Nome é obrigatório'); return; }
    const p = parseFloat(percent.replace(',', '.'));
    if (isNaN(p) || p < 0) { toast.error('Percentual inválido'); return; }
    try {
      const payload = {
        name,
        percent: p,
        company_id: profile?.company_id || null,
        created_by: user?.id || null
      };
  // supabase client typings for this project are strict; cast to unknown then to Postgrest response-like
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertRes = await ((supabase as any).from('margins')).insert(payload).select().single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = insertRes as { data?: Margin | null; error?: any };
      if (error) throw error;
  toast.success(`Margem "${data?.name}" salva (${Number(data?.percent ?? 0)}%)`);
      setName(''); setPercent('');
      fetchMargins();
    } catch (err: unknown) {
      console.error('Erro ao salvar margem:', err);
      const msg = (err && typeof err === 'object' && 'message' in err) ? (err as { message?: unknown }).message : String(err);
      toast.error('Erro ao salvar margem: ' + (String(msg || 'desconhecido')));
    }
  }

  const fetchMargins = useCallback(async () => {
    setLoading(true);
    try {
  // use any cast to work around strict generated supabase types for new table 'margins'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = ((supabase as any).from('margins')).select('*').order('created_at', { ascending: false });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp: { data?: Margin[] | null; error?: any } = await query;
      if (resp.error) throw resp.error;
      const arr = resp.data || [];
      setItems(arr.map((obj) => ({ id: obj.id, name: obj.name, percent: Number(obj.percent), created_at: obj.created_at })));
    } catch (err: unknown) {
      console.error('Erro ao carregar margens:', err);
      const msg = (err && typeof err === 'object' && 'message' in err) ? (err as { message?: unknown }).message : String(err);
      const text = String(msg || 'desconhecido');
      setErrorMsg(text);
      toast.error('Erro ao carregar margens: ' + text);
    } finally { setLoading(false); }
  }, [profile?.company_id]);

  async function handleDelete(id: string) {
    if (!confirm('Confirma exclusão desta margem?')) return;
    try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delRes = await ((supabase as any).from('margins')).delete().eq('id', id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = delRes as { error?: any };
      if (error) throw error;
      toast.success('Margem excluída');
      fetchMargins();
    } catch (err) {
      console.error('Erro ao excluir margem:', err);
      toast.error('Erro ao excluir margem');
    }
  }

  useEffect(() => { 
    // chamamos a versão memoizada fetchMargins (inclusa no array de dependências via useCallback)
    void fetchMargins();
  }, [fetchMargins]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Cadastro de Margens</h2>
        <p className="text-sm text-muted-foreground">Cadastre regras de margem para aplicar em tabelas de preço.</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome da Margem</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Margem Padrão" />
          </div>
          <div>
            <Label>% Margem</Label>
            <Input value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="Ex: 10" />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave}>Salvar Margem</Button>
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="text-md font-medium">Margens Salvas</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-3 w-full overflow-x-auto">
            {items.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground">Nenhuma margem cadastrada.</p>
                {errorMsg ? (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-sm text-red-600">Erro: {errorMsg}</p>
                    <Button onClick={() => { setErrorMsg(null); void fetchMargins(); }}>Recarregar</Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-2">Nome</th>
                    <th className="pb-2">%</th>
                    <th className="pb-2">Criado em</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="py-2">{it.name}</td>
                      <td className="py-2">{it.percent}%</td>
                      <td className="py-2">{new Date(it.created_at).toLocaleString()}</td>
                      <td className="py-2">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(it.id)}>Excluir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
