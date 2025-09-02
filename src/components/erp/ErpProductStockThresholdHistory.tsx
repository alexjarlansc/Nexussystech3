/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/use-toast';

interface LogRow {
  id: number;
  product_id: string;
  company_id: string;
  changed_by?: string | null;
  old_stock_min?: number | null;
  new_stock_min?: number | null;
  old_stock_max?: number | null;
  new_stock_max?: number | null;
  reason?: string | null;
  created_at: string;
  product_name?: string;
  product_code?: string;
}

export function ErpProductStockThresholdHistory(){
  const { toast } = useToast();
  const [rows,setRows]=useState<LogRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [productFilter,setProductFilter]=useState('');

  const load = useCallback(async ()=>{
    setLoading(true);
    try {
      // Faz join manual via rpc (fallback) - simples: duas queries
  let query: any = (supabase as any).from('product_stock_threshold_logs').select('*').order('id',{ascending:false}).limit(500);
      if(productFilter){
        // Busca ids de produtos com like
  const { data: prodIds, error: prodErr } = await (supabase as any).from('products').select('id, name, code').ilike('name', `%${productFilter}%`).limit(100);
        if(prodErr){ throw prodErr; }
        const ids = prodIds?.map(p=>p.id) || [];
        if(ids.length===0){ setRows([]); return; }
        query = query.in('product_id', ids);
      }
  const { data, error } = await query;
      if(error) throw error;
  let enriched: LogRow[] = (data as any) || [];
      // Enriquecer nomes
      const prodIds = Array.from(new Set(enriched.map(r=>r.product_id)));
      if(prodIds.length){
  const { data: prods, error: prodErr } = await (supabase as any).from('products').select('id,name,code').in('id', prodIds);
        if(!prodErr && prods){
          const map = new Map(prods.map((p:any)=>[p.id,p]));
            enriched = enriched.map(r=> {
              const prod: any = map.get(r.product_id);
              return ({...r, product_name: prod?.name, product_code: prod?.code });
            });
        }
      }
      setRows(enriched);
    } catch(err){
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      toast({ title:'Erro carregando histórico', description: message, variant:'destructive'});
    } finally { setLoading(false); }
  },[productFilter, toast]);

  useEffect(()=>{ load(); },[load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Filtrar produto" value={productFilter} onChange={e=>setProductFilter(e.target.value)} />
        <Button onClick={load} disabled={loading}>{loading? '...' : 'Recarregar'}</Button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1 text-left">Data</th>
              <th className="px-2 py-1 text-left">Produto</th>
              <th className="px-2 py-1 text-right">Min (old → new)</th>
              <th className="px-2 py-1 text-right">Max (old → new)</th>
              <th className="px-2 py-1 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> {
              const changedMin = r.old_stock_min !== r.new_stock_min;
              const changedMax = r.old_stock_max !== r.new_stock_max;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{r.product_code? `[${r.product_code}] `: ''}{r.product_name||r.product_id}</td>
                  <td className={"px-2 py-1 text-right " + (changedMin? 'text-amber-700 font-medium':'text-slate-600')}>{r.old_stock_min ?? '-'} → {r.new_stock_min ?? '-'}</td>
                  <td className={"px-2 py-1 text-right " + (changedMax? 'text-amber-700 font-medium':'text-slate-600')}>{r.old_stock_max ?? '-'} → {r.new_stock_max ?? '-'}</td>
                  <td className="px-2 py-1 max-w-xs truncate" title={r.reason||''}>{r.reason||'-'}</td>
                </tr>
              );
            })}
            {!rows.length && !loading && (
              <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Nenhum registro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ErpProductStockThresholdHistory;
