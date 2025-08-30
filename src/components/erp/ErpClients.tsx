import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types';
import { toast } from '@/components/ui/sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ErpClients() {
  const pageSize = 20;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    // pesquisa simples client-side depois; para server use ilike
    let query: any = supabase.from('clients').select('*', { count: 'exact' }).order('name').range(from, to);
    if (search.trim()) {
      query = supabase.from('clients').select('*', { count: 'exact' }).ilike('name', `%${search.trim()}%`).order('name').range(from, to);
    }
    const { data, count, error } = await query;
    if (error) { toast.error('Erro ao carregar clientes'); setLoading(false); return; }
    setClients(data as Client[]);
    setTotal(count || 0);
    setLoading(false);
  }, [page, pageSize, search]);
  useEffect(()=>{ load(); }, [load]);
  useEffect(()=>{ const t = setTimeout(()=>{ setPage(0); }, 400); return ()=>clearTimeout(t); }, [search]);

  function exportCsv() {
    // exporta até 1000 rapidamente
    (async () => {
      const { data, error } = await (supabase as any).from('clients').select('*').order('name').limit(1000);
      if (error) { toast.error('Falha ao exportar'); return; }
      const rows = data as Client[];
      const header = ['id','name','taxid','phone','email','address'];
      const csv = [header.join(';'), ...rows.map(r=> header.map(h=> (r as any)[h] ? String((r as any)[h]).replace(/;/g, ',') : '').join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'clientes.csv'; a.click();
      URL.revokeObjectURL(url);
    })();
  }

  async function saveEdit() {
    if (!edit) return;
    const { id, name, taxid, phone, email, address } = edit;
    const { error } = await (supabase as any).from('clients').update({ name, taxid, phone, email, address }).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Cliente atualizado');
    setEdit(null); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-60" />
        <Button size="sm" variant="outline" onClick={exportCsv}>Exportar CSV</Button>
        <div className="text-xs text-muted-foreground ml-auto">{loading ? 'Carregando...' : `${total} registros`}</div>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Nome</th>
              <th className="text-left px-2 py-1 font-medium">Documento</th>
              <th className="text-left px-2 py-1 font-medium">Telefone</th>
              <th className="text-left px-2 py-1 font-medium">Email</th>
              <th className="text-left px-2 py-1 font-medium">Endereço</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={()=> setEdit(c)}>
                <td className="px-2 py-1">{c.name}</td>
                <td className="px-2 py-1">{c.taxid||'-'}</td>
                <td className="px-2 py-1">{c.phone||'-'}</td>
                <td className="px-2 py-1">{c.email||'-'}</td>
                <td className="px-2 py-1 truncate max-w-[220px]" title={c.address}>{c.address||'-'}</td>
              </tr>
            ))}
            {clients.length===0 && !loading && (
              <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhum cliente</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center gap-2 text-xs">
        <Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button>
        <div>Página {page+1} / {Math.max(1, Math.ceil(total / pageSize))}</div>
        <Button size="sm" variant="outline" disabled={(page+1)*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Próxima</Button>
      </div>

      <Dialog open={!!edit} onOpenChange={(o)=>{ if(!o) setEdit(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-2 text-sm">
              <Input value={edit.name} onChange={e=> setEdit({...edit, name:e.target.value})} placeholder="Nome" />
              <Input value={edit.taxid||''} onChange={e=> setEdit({...edit, taxid:e.target.value})} placeholder="CNPJ/CPF" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={edit.phone||''} onChange={e=> setEdit({...edit, phone:e.target.value})} placeholder="Telefone" />
                <Input value={edit.email||''} onChange={e=> setEdit({...edit, email:e.target.value})} placeholder="Email" type="email" />
              </div>
              <Textarea value={edit.address||''} onChange={e=> setEdit({...edit, address:e.target.value})} placeholder="Endereço" rows={2} />
              <Textarea value={notes} onChange={e=> setNotes(e.target.value)} placeholder="Notas internas (não salvo ainda)" rows={2} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setEdit(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
