import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';

type Movement = {
  id: string;
  product_id: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUST';
  qty: number;
  created_at: string;
  document?: string | null;
  user?: string | null;
  notes?: string | null;
};

export default function ErpKardex(){
  // estilos locais para reduzir poluição visual (aplicados apenas dentro do componente)
  const localStyle = `
    .kardex-scope select:focus, .kardex-scope input:focus { outline: none !important; box-shadow: none !important; }
    .kardex-scope input[type=date]::-webkit-calendar-picker-indicator { opacity: 0; pointer-events: none; }
    .kardex-scope input[type=date] { padding-right: .5rem; }
  `;
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'consulta'|'relatorios'>('consulta');

  useEffect(()=>{ loadProducts(); loadMovements(); }, []);

  async function loadProducts(){
    try{
      const { data, error } = await (supabase as any).from('products').select('id,code,name,unit,stock_min,stock_max');
      if(error) throw error;
      setProducts(data || []);
    }catch(e){ if(import.meta.env.DEV) console.warn('ErpKardex loadProducts', e); }
  }

  async function loadMovements(){
    setLoading(true);
    try{
      let q = (supabase as any).from('inventory_movements').select('*').order('created_at', { ascending: true });
      if(productFilter) q = q.eq('product_id', productFilter);
      if(typeFilter) q = q.eq('type', typeFilter);
      if(fromDate) q = q.gte('created_at', fromDate);
      if(toDate) q = q.lte('created_at', toDate);
      const { data, error } = await q;
      if(error) throw error;
      setMovements(data || []);
    }catch(e){ if(import.meta.env.DEV) console.error('ErpKardex loadMovements', e); toast.error('Falha ao carregar movimentos'); }
    finally{ setLoading(false); }
  }

  const rowsWithBalance = useMemo(()=>{
    // calcula saldo cumulativo por produto
    const map: Record<string, { balance: number; rows: Movement[] }> = {};
    const filtered = movements;
    for(const m of filtered){
      if(!map[m.product_id]) map[m.product_id] = { balance: 0, rows: [] };
      const sign = (m.type === 'IN') ? 1 : (m.type === 'OUT') ? -1 : (m.type === 'TRANSFER') ? 0 : (m.type === 'ADJUST') ? 0 : 0;
      // transfers/adjusts may carry qty semantics depending on subtype; we keep qty sign as provided
      const qty = m.qty * (sign === 0 ? (m.qty>=0?1: -1) : sign);
      map[m.product_id].balance += qty;
      map[m.product_id].rows.push({ ...m });
    }
    // flatten for display (simple approach: group by product)
    const out: Array<{ product:any; balance:number; rows:Movement[] }> = [];
    for(const pid of Object.keys(map)){
      const product = products.find(p=>p.id===pid) || { id: pid, name: pid };
      out.push({ product, balance: map[pid].balance, rows: map[pid].rows });
    }
    return out;
  }, [movements, products]);

  function exportCsv(){
    const lines = ['produto,data,tipo,quantidade,saldo,documento,observacoes'];
    for(const g of rowsWithBalance){
      let running = 0;
      for(const r of g.rows){
        running += r.qty;
        lines.push(`${JSON.stringify(g.product.name)},${r.created_at},${r.type},${r.qty},${running},${JSON.stringify(r.document||'')},${JSON.stringify(r.notes||'')}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'kardex.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // Relatórios
  const saldoAtualPorProduto = useMemo(()=>{
    const m: Record<string, number> = {};
    for(const mv of movements){ m[mv.product_id] = (m[mv.product_id]||0) + mv.qty; }
    return products.map(p=> ({ product: p, balance: m[p.id]||0 }));
  }, [movements, products]);

  const abaixoDoMinimo = useMemo(()=>{
    return saldoAtualPorProduto.filter(s=> typeof s.product.stock_min === 'number' && s.balance < (s.product.stock_min||0));
  }, [saldoAtualPorProduto]);

  const altaRotatividade = useMemo(()=>{
    // considerar saídas dos últimos 90 dias
    const since = new Date(); since.setDate(since.getDate()-90);
    const outMap: Record<string, number> = {};
    for(const mv of movements){
      const d = new Date(mv.created_at);
      if(d >= since && mv.type === 'OUT') outMap[mv.product_id] = (outMap[mv.product_id]||0) + Math.abs(mv.qty);
    }
    const arr = Object.keys(outMap).map(pid=> ({ product: products.find(p=>p.id===pid) || { id: pid, name: pid }, qty: outMap[pid] }));
    return arr.sort((a,b)=> b.qty - a.qty).slice(0,20);
  }, [movements, products]);

  return (
    <div className="space-y-4 kardex-scope">
      <style>{localStyle}</style>
  <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Kardex do Produto</h2>
          <p className="text-sm text-muted-foreground">Rastreie movimentações de estoque por produto e gere relatórios.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded bg-muted/10 p-1">
            <button className={`px-3 py-1 rounded ${activeTab==='consulta'?'bg-white shadow':''}`} onClick={()=>setActiveTab('consulta')}>Consulta</button>
            <button className={`px-3 py-1 rounded ${activeTab==='relatorios'?'bg-white shadow':''}`} onClick={()=>setActiveTab('relatorios')}>Relatórios</button>
          </div>
          <Button onClick={exportCsv} disabled={loading}>Exportar CSV</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Produto</label>
            <select className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-200 focus:border-slate-300" value={productFilter||''} onChange={e=>setProductFilter(e.target.value||null)}>
              <option value="">Todos</option>
              {products.map(p=> <option key={p.id} value={p.id}>{p.code? `${p.code} — ${p.name}`: p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-200 focus:border-slate-300" value={typeFilter||''} onChange={e=>setTypeFilter(e.target.value||null)}>
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
              <option value="TRANSFER">Transferência</option>
              <option value="ADJUST">Ajuste</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" className="w-36 focus:outline-none focus:ring-1 focus:ring-slate-200" value={fromDate||''} onChange={e=>setFromDate(e.target.value||null)} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input type="date" className="w-36 focus:outline-none focus:ring-1 focus:ring-slate-200" value={toDate||''} onChange={e=>setToDate(e.target.value||null)} />
              </div>
            </div>
            <div>
              <Button onClick={loadMovements} className="h-10">Filtrar</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Movimentações</div>
          <div className="text-xl font-semibold">{movements.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Produtos abaixo do mínimo</div>
          <div className="text-xl font-semibold">{abaixoDoMinimo.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Produtos (ativos)</div>
          <div className="text-xl font-semibold">{products.length}</div>
        </Card>
      </div>

      <div>
        {activeTab === 'consulta' && (
          <div>
            {rowsWithBalance.map(group=> (
              <Card className="p-4 mb-3" key={group.product.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{group.product.name}</div>
                    <div className="text-xs text-muted-foreground">Saldo: {group.balance}</div>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-left">Documento</th><th className="p-2 text-left">Observações</th></tr></thead>
                    <tbody>
                      {group.rows.map((r, i)=>{
                        const running = group.rows.slice(0, i+1).reduce((s, x)=>s + x.qty, 0);
                        return (<tr key={r.id}><td className="p-2">{new Date(r.created_at).toLocaleString()}</td><td className="p-2">{r.type}</td><td className="p-2 text-right">{r.qty}</td><td className="p-2 text-right">{running}</td><td className="p-2">{r.document}</td><td className="p-2">{r.notes}</td></tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'relatorios' && (
          <div className="space-y-3">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Histórico completo de movimentações</h3>
                <div className="overflow-auto">
                  {movements.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Nenhuma movimentação encontrada para os filtros aplicados.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30"><tr><th className="p-2">Data</th><th className="p-2">Produto</th><th className="p-2">Tipo</th><th className="p-2 text-right">Quantidade</th><th className="p-2">Documento</th><th className="p-2">Observações</th></tr></thead>
                      <tbody>
                        {movements.map(m=> (<tr key={m.id}><td className="p-2">{new Date(m.created_at).toLocaleString()}</td><td className="p-2">{(products.find(p=>p.id===m.product_id)||{name:m.product_id}).name}</td><td className="p-2">{m.type}</td><td className="p-2 text-right">{m.qty}</td><td className="p-2">{m.document}</td><td className="p-2">{m.notes}</td></tr>))}
                      </tbody>
                    </table>
                  )}
                </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Saldo atual por produto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {saldoAtualPorProduto.length===0 && <div className="text-sm text-muted-foreground">Nenhum produto encontrado.</div>}
                {saldoAtualPorProduto.map(s=> (<div key={s.product.id} className={`p-2 border rounded ${typeof s.product.stock_min==='number' && s.balance < s.product.stock_min ? 'bg-rose-50 border-rose-200' : ''}`}>
                  <div className="font-medium">{s.product.name}</div>
                  <div className="text-xs text-muted-foreground">Saldo: {s.balance}{typeof s.product.stock_min==='number' ? ` • Mín: ${s.product.stock_min}` : ''}</div>
                  {typeof s.product.stock_min==='number' && s.balance < s.product.stock_min && (<div className="text-xs text-rose-600 mt-1">Abaixo do mínimo</div>)}
                </div>))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Produtos abaixo do estoque mínimo</h3>
              <div>
                {abaixoDoMinimo.length===0 ? <div className="text-sm text-muted-foreground">Nenhum produto abaixo do mínimo.</div> : (
                  <table className="w-full text-sm"><thead className="bg-muted/30"><tr><th className="p-2">Produto</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Mínimo</th><th className="p-2">Ação</th></tr></thead><tbody>
                    {abaixoDoMinimo.map(s=> (<tr key={s.product.id}><td className="p-2">{s.product.name}</td><td className="p-2 text-right">{s.balance}</td><td className="p-2 text-right">{s.product.stock_min}</td><td className="p-2"><Button variant="outline" size="sm">Ajustar</Button></td></tr>))}
                  </tbody></table>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Produtos com alta rotatividade (últimos 90 dias)</h3>
              <div>
                {altaRotatividade.length===0 ? <div className="text-sm text-muted-foreground">Nenhuma saída registrada nos últimos 90 dias.</div> : (
                  <table className="w-full text-sm"><thead className="bg-muted/30"><tr><th className="p-2">Produto</th><th className="p-2 text-right">Quantidade Saída</th></tr></thead><tbody>
                    {altaRotatividade.map(a=> (<tr key={a.product.id}><td className="p-2">{a.product.name}</td><td className="p-2 text-right">{a.qty}</td></tr>))}
                  </tbody></table>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
