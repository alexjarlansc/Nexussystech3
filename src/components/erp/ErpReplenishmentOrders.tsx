import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface ReplItem { product_id:string; code?:string; name?:string; stock?:number; stock_min?:number; stock_max?:number; order_suggested_qty?:number; }
interface ReplOrder { id:string; created_at:string; updated_at?:string; status:string; items:ReplItem[]; notes?:string; closed_at?:string|null; }
interface ReplLog { id:number; event:string; data:unknown; created_at:string; }

export default function ErpReplenishmentOrders(){
  const [rows,setRows]=useState<ReplOrder[]>([]); const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<ReplOrder|null>(null);
  const [logs,setLogs]=useState<ReplLog[]>([]); const [saving,setSaving]=useState(false);
  const [filter,setFilter]=useState('');
  const [missing,setMissing]=useState(false);

  const load = useCallback(async ()=>{
    setLoading(true);
    try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as unknown as { from: any }).from('replenishment_orders').select('*').order('created_at',{ascending:false}).limit(200);
      if(filter) q = q.eq('status', filter);
      const { data, error } = await q; if(error) throw error; setRows(data||[]);
    } catch(e){
      const msg = extractErr(e);
      if(msg.includes('PGRST205') || msg.toLowerCase().includes('replenishment_orders')){
        setMissing(true);
      }
      toast.error('Falha ao carregar pedidos: '+msg);
    }
    setLoading(false);
  },[filter]);
  async function openOrder(o:ReplOrder){
    setEditing(o); setOpen(true); loadLogs(o.id);
  }
  async function loadLogs(id:string){
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { const { data, error } = await (supabase as unknown as { from:any }).from('replenishment_order_logs').select('*').eq('order_id', id).order('created_at',{ascending:true}); if(error) throw error; setLogs(data||[]); } catch(_e){ /* ignore */ }
  }
  useEffect(()=>{ load(); },[load]);

  function changeStatus(next:string){
    if(!editing) return; updateOrder({ status: next });
  }
  async function updateOrder(patch: Partial<ReplOrder>){
    if(!editing) return;
    setSaving(true);
    try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as { from:any }).from('replenishment_orders').update(patch).eq('id', editing.id).select('*').single();
      if(error) throw error; setEditing(data); toast.success('Atualizado'); load();
      // log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { await (supabase as unknown as { from:any }).from('replenishment_order_logs').insert({ order_id: editing.id, event: 'UPDATE', data: patch }); } catch { /* ignore */ }
    } catch(e){ toast.error('Falha: '+extractErr(e)); }
    setSaving(false);
  }
  function exportOrderCSV(o:ReplOrder){
    const headers=['Codigo','Nome','Estoque','Min','Max','Sugerido'];
  const lines=o.items.map(it=>[it.code||'', it.name?.replace(/;/g,','), it.stock??'', it.stock_min??'', it.stock_max??'', it.order_suggested_qty??''].join(';'));
    const csv=[headers.join(';'),...lines].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`pedido-reposicao-${o.id}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function editItemQty(idx:number, qty:number){
    if(!editing) return; const items=[...editing.items]; items[idx]={...items[idx], order_suggested_qty: qty}; setEditing({...editing, items}); }
  async function persistItems(){ updateOrder({ items: editing?.items }); }

  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pedidos de Reposição</h2>
        <p className="text-sm text-muted-foreground">Gerencie pedidos gerados a partir dos limites de estoque.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap text-xs">
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="h-8 border rounded px-2">
          <option value="">Todos</option>
          <option value="ABERTO">Abertos</option>
          <option value="EM_PROCESSO">Em Processo</option>
          <option value="FECHADO">Fechados</option>
        </select>
        <Button size="sm" variant="outline" onClick={()=>load()} disabled={loading}>{loading?'...':'Atualizar'}</Button>
      </div>
    </header>
    {missing && <div className="text-xs border rounded p-4 bg-amber-50 dark:bg-amber-950/20 space-y-2">
      <div className="font-semibold text-amber-700 dark:text-amber-300">Tabela não encontrada</div>
      <p>As migrations de pedidos de reposição ainda não foram aplicadas. Aplique no Supabase:</p>
      <ol className="list-decimal ml-4 space-y-1">
        <li>Instale CLI (se não): <code className="bg-black/5 px-1 rounded">npm i -g supabase</code></li>
        <li>Link: <code className="bg-black/5 px-1 rounded">supabase link --project-ref &lt;REF&gt;</code></li>
        <li>Push: <code className="bg-black/5 px-1 rounded">supabase db push</code></li>
      </ol>
      <p>Ou rode manualmente no SQL editor o conteúdo dos arquivos:</p>
      <ul className="list-disc ml-4">
        <li><code>20250901131000_create_replenishment_orders.sql</code></li>
        <li><code>20250901132000_alter_replenishment_orders_add_logs.sql</code></li>
      </ul>
      <p className="text-muted-foreground">Após aplicar, clique em "Verificar novamente".</p>
      <div>
        <button onClick={()=>{ setMissing(false); load(); }} className="mt-2 inline-flex items-center px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium">Verificar novamente</button>
      </div>
    </div>}
    <div className="border rounded max-h-[500px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 sticky top-0"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-right">Itens</th><th className="px-2 py-1 text-right"/></tr></thead>
        <tbody>
          {rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/30">
            <td className="px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
            <td className="px-2 py-1">{r.status}</td>
            <td className="px-2 py-1 text-right">{r.items?.length||0}</td>
            <td className="px-2 py-1 text-right"><Button size="sm" variant="outline" onClick={()=>openOrder(r)}>Abrir</Button></td>
          </tr>)}
          {rows.length===0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum pedido</td></tr>}
        </tbody>
      </table>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Pedido #{editing?.id.slice(0,8)}</DialogTitle>
        </DialogHeader>
        {editing && <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="font-semibold">Status:</div>
            <div className="flex gap-2">
              {['ABERTO','EM_PROCESSO','FECHADO'].map(s=> <Button key={s} size="sm" variant={editing.status===s? 'default':'outline'} onClick={()=>changeStatus(s)} disabled={saving || editing.status===s}>{s}</Button>)}
            </div>
            <Button size="sm" variant="outline" onClick={()=>exportOrderCSV(editing!)}>Exportar CSV</Button>
            <Button size="sm" variant="outline" onClick={persistItems} disabled={saving}>Salvar Itens</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Itens</h3>
              <div className="border rounded h-72 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/30 sticky top-0"><tr><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Produto</th><th className="px-2 py-1 text-right">Estoque</th><th className="px-2 py-1 text-right">Min</th><th className="px-2 py-1 text-right">Max</th><th className="px-2 py-1 text-right">Sug.</th></tr></thead>
                  <tbody>
                    {editing.items.map((it,i)=> <tr key={i} className={it.stock!==undefined && it.stock_min!==undefined && it.stock < it.stock_min? 'bg-red-50/70':''}>
                      <td className="px-2 py-1 font-mono truncate max-w-[80px]" title={it.code}>{it.code||'-'}</td>
                      <td className="px-2 py-1 truncate max-w-[160px]" title={it.name}>{it.name}</td>
                      <td className="px-2 py-1 text-right">{it.stock??'-'}</td>
                      <td className="px-2 py-1 text-right">{it.stock_min??'-'}</td>
                      <td className="px-2 py-1 text-right">{it.stock_max??'-'}</td>
                      <td className="px-2 py-1 text-right"><input type="number" className="w-20 h-6 border rounded px-1" value={it.order_suggested_qty??''} onChange={e=>editItemQty(i, Number(e.target.value))} /></td>
                    </tr>)}
                    {editing.items.length===0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Sem itens</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Log</h3>
              <div className="border rounded h-40 overflow-auto p-2 space-y-1 bg-muted/20">
                {logs.map(l=> <div key={l.id} className="text-[10px] leading-tight"><b>{l.event}</b> {new Date(l.created_at).toLocaleString()} <code className="bg-black/5 px-1 rounded">{JSON.stringify(l.data)}</code></div>)}
                {logs.length===0 && <div className="text-[10px] text-muted-foreground">Sem eventos.</div>}
              </div>
              <h3 className="font-semibold mt-4">Observações</h3>
              <Textarea rows={6} value={editing.notes||''} onChange={e=>setEditing(o=>o? {...o, notes:e.target.value}:o)} placeholder="Notas internas, fornecedores preferenciais, prazos..." />
              <Button size="sm" variant="outline" onClick={()=>updateOrder({ notes: editing.notes })} disabled={saving}>Salvar Notas</Button>
            </div>
          </div>
        </div>}
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

function extractErr(e:unknown): string { if(!e) return 'Erro'; if(typeof e==='string') return e; if(e instanceof Error) return e.message; try { return JSON.stringify(e); } catch { return 'Erro'; }}
