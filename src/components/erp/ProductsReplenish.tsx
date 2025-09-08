import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { Product } from '@/types';

type Row = Product & { stock?: number; reserved?: number; available?: number; };
type StockRow = { product_id: string; stock: number; reserved?: number; available?: number };
type Inv = { product_id: string; type: 'ENTRADA'|'SAIDA'|'AJUSTE'|string; quantity: number|string };

export default function ProductsReplenish(){
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(false);
  const [filter,setFilter] = useState('');

  async function load(){
    setLoading(true);
    try{
      // buscar produtos com stock_max definido
  // supabase client typing: bypass lint for call sites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = (supabase as unknown as { from: any });
  let q = sb.from('products').select('id,code,name,stock_max,price').gt('stock_max', 0).order('name');
  if(filter) q = q.ilike('name', '%'+filter+'%').limit(500);
  const qRes = await q;
  const data = (qRes as unknown as { data?: unknown[] | null }).data as unknown[] | null;
  const error = (qRes as unknown as { error?: unknown }).error;
  if(error) throw error;
  const prods: Row[] = (data||[]).map((p) => (p as unknown as Row));
      if(prods.length===0){ setRows([]); setLoading(false); return; }
      const ids = prods.map(p=>p.id);
      // tentar obter product_stock view por ids
      let stocks: StockRow[] = [];
      try {
        const r = await sb.from('product_stock').select('product_id,stock,reserved,available').in('product_id', ids);
        const s = (r as unknown as { data?: unknown[] | null }).data as unknown[] | null;
        const se = (r as unknown as { error?: unknown }).error;
        if(!se && s) stocks = s as unknown as StockRow[];
      } catch(e){ /* ignore */ }
      // fallback: recomputar via inventory_movements
      if(!stocks.length){
        try {
          const r2 = await sb.from('inventory_movements').select('product_id,type,quantity').in('product_id', ids).limit(20000);
          const inv = (r2 as unknown as { data?: unknown[] | null }).data as unknown[] | null;
          const agg: Record<string, number> = {};
          (inv || []).forEach((m) => { const mm = m as unknown as Inv; if(!agg[mm.product_id]) agg[mm.product_id]=0; const qn = Number(mm.quantity)||0; if(mm.type==='ENTRADA') agg[mm.product_id]+=qn; else if(mm.type==='SAIDA') agg[mm.product_id]-=qn; else if(mm.type==='AJUSTE') agg[mm.product_id]+=qn; });
          stocks = ids.map(id=> ({ product_id: id, stock: agg[id]||0, reserved: 0, available: agg[id]||0 }));
        } catch(e){ /* ignore */ }
      }
      const byId = new Map(stocks.map(s=>[s.product_id, s]));
      const enriched = prods.map(p=>{
        const s = byId.get(p.id) || { stock: 0, reserved: 0, available: 0 };
        return { ...p, stock: s.stock, reserved: s.reserved, available: s.available } as Row;
      });
      // calcular faltante
  const need = enriched.map(r=> ({ ...r, missing: Math.max(0, (Number(r.stock_max)||0) - (Number(r.available)||0)) }));
  setRows(need.filter((r)=> (r as unknown as { missing?: number }).missing! > 0));
    }catch(e){
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error('Falha ao carregar: '+(String((e as any)?.message || e)));
    }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); /* eslint-disable-line react-hooks/exhaustive-deps */ },[]);

  return (
    <Card className="p-6">
      <header className="flex items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Repor Estoque - Grades / Variações</h2>
          <p className="text-sm text-muted-foreground">Gera lista de quantidades necessárias para alcançar estoque máximo por produto/variação.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Filtrar por nome..." value={filter} onChange={e=>setFilter(e.target.value)} className="w-56" />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading? 'Carregando...':'Atualizar'}</Button>
        </div>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-xs border-separate" style={{ borderSpacing: '0 6px' }}>
          <thead><tr className="text-left"><th>Código</th><th>Produto</th><th className="text-right">Estoque</th><th className="text-right">Máx</th><th className="text-right">Falta</th></tr></thead>
          <tbody>
            {rows.map((r)=> (
              <tr key={r.id} className="bg-white/60 border rounded mb-2">
                <td className="px-3 py-2 font-mono">{r.code}</td>
                <td className="px-3 py-2 truncate">{r.name}</td>
                <td className="px-3 py-2 text-right">{r.available ?? 0}</td>
                <td className="px-3 py-2 text-right">{r.stock_max ?? 0}</td>
                <td className="px-3 py-2 text-right font-semibold">{(r as unknown as { missing?: number }).missing}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum item precisa reposição</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
