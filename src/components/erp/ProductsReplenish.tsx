import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Dialog is provided globally by SystemDialogProvider; don't import local Dialog here
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { Product } from '@/types';

type Row = Product & { stock?: number; reserved?: number; available?: number; };
type StockRow = { product_id: string; stock: number; reserved?: number; available?: number };
type Inv = { product_id: string; type: 'ENTRADA'|'SAIDA'|'AJUSTE'|string; quantity: number|string };

export default function ProductsReplenish(){
  const [showReport, setShowReport] = useState(false);
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(false);
  const [filter,setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string){
    setSelectedIds(s=>{ const n = new Set(Array.from(s)); if(n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function toggleSelectAll(){
    if(selectedIds.size === rows.length){ setSelectedIds(new Set()); return; }
    const all = new Set(rows.map(r=>r.id)); setSelectedIds(all);
  }

  function formatBRL(value: number|string|undefined): string {
    if(value === undefined || value === null || value === '') return '';
    const num = typeof value === 'number' ? value : Number(String(value).replace(/[^\\d,]/g, '').replace(/(\\d{2})$/, ',$1'));
    if(isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function printReport(){
    const html = `
      <html>
      <head><title>Relatório de Reposição</title><meta charset="utf-8" /></head>
      <body>
        <h2>Relatório de Reposição</h2>
        <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
          <thead><tr><th style="text-align:left">Produto</th><th style="text-align:right">Custo Médio</th><th style="text-align:right">Qtd Fixo</th><th style="text-align:right">Estoque</th><th style="text-align:right">Falta</th></tr></thead>
          <tbody>
      ${rows.map(r=>`<tr><td>${String(r.name||'')}</td><td style="text-align:right">${formatBRL((r as unknown as { price?: number }).price)}</td><td style="text-align:right">${r.stock_max??0}</td><td style="text-align:right">${(r as unknown as { missing?: number }).missing ?? 0}</td><td style="text-align:right">${r.available??0}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const w = window.open('', '_blank', 'noopener');
    if(!w) { toast.error('Falha ao abrir janela de impressão'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(()=>{ w.print(); w.close(); }, 300);
  }

  async function exportXlsx(rowsToExport: unknown[], filename = 'relatorio_reposicao.xlsx'){
    if(!rowsToExport || rowsToExport.length===0){ toast.message?.('Sem dados para exportar'); return; }
    try{
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(rowsToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const wbout = XLSX.write(wb, { type:'array', bookType:'xlsx'});
      const blob = new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2500);
      toast.success('XLSX gerado');
  }catch(e: unknown){ const msg = e instanceof Error ? e.message : String(e); toast.error(msg); }
  }

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

  return (<>
    <Card className="p-6">
      <header className="flex items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Repor Estoque - Grades / Variações</h2>
          <p className="text-sm text-muted-foreground">Gera lista de quantidades necessárias para alcançar estoque máximo por produto/variação.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Filtrar por nome..." value={filter} onChange={e=>setFilter(e.target.value)} className="w-56" />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading? 'Carregando...':'Atualizar'}</Button>
          <Button size="sm" variant="default" onClick={()=>setShowReport(true)}>Gerar Relatório</Button>
        </div>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-xs border-separate" style={{ borderSpacing: '0 6px' }}>
          <thead><tr className="text-left"><th>Código</th><th>Produto</th><th className="text-right">Estoque</th><th className="text-right">Qtd Fixo</th><th className="text-right">Falta</th></tr></thead>
          <tbody>
            {rows.map((r)=> (
              <tr key={r.id} className="bg-white/60 border rounded mb-2">
                <td className="px-3 py-2 font-mono">{r.code}</td>
                <td className="px-3 py-2 truncate">{r.name}</td>
                <td className="px-3 py-2 text-right font-semibold">{(r as unknown as { missing?: number }).missing}</td>
                <td className="px-3 py-2 text-right">{r.stock_max ?? 0}</td>
                <td className="px-3 py-2 text-right">{r.available ?? 0}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum item precisa reposição</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
    {showReport && (
      <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.2)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'#fff',padding:32,borderRadius:8,minWidth:400,maxWidth:'90vw'}}>
          <h2 style={{fontWeight:'bold',fontSize:20,marginBottom:16}}>Relatório de Reposição</h2>
          <table style={{width:'100%',fontSize:14,borderCollapse:'separate'}}>
            <thead>
                <tr>
                  <th style={{padding:'8px'}}><input type="checkbox" aria-label="Selecionar todos" checked={rows.length>0 && selectedIds.size===rows.length} onChange={toggleSelectAll} /></th>
                  <th style={{textAlign:'left',padding:'8px 12px',whiteSpace:'nowrap'}}>Produto</th>
                  <th style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap'}}>Custo Médio</th>
                  <th style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap'}}>Qtd Fixo</th>
                  <th style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap'}}>Estoque</th>
                  <th style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap'}}>Falta</th>
                </tr>
              </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td style={{padding:'6px 12px'}}><input aria-label={`Selecionar ${r.name}`} type="checkbox" checked={selectedIds.has(r.id)} onChange={()=>toggleSelect(r.id)} /></td>
                  <td style={{padding:'6px 12px'}}>{r.name}</td>
                  <td style={{textAlign:'right',padding:'6px 12px'}}>{formatBRL((r as unknown as { price?: number }).price)}</td>
                  <td style={{textAlign:'right',padding:'6px 12px'}}>{Number(r.stock_max ?? 0).toLocaleString('pt-BR')}</td>
                  <td style={{textAlign:'right',padding:'6px 12px'}}>{Number((r as unknown as { missing?: number }).missing ?? 0).toLocaleString('pt-BR')}</td>
                  <td style={{textAlign:'right',padding:'6px 12px'}}>{Number(r.available ?? 0).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,gap:12}}>
            <div className="text-sm text-muted-foreground">Selecionados: {selectedIds.size}</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Button size="sm" variant="outline" onClick={printReport}>Imprimir</Button>
              <Button size="sm" variant="outline" onClick={()=>exportXlsx(rows.map(r=>({produto:r.name, custo_medio:r.price, qtd_fixo:r.stock_max, estoque:(r as unknown as { missing?: number }).missing, falta:r.available})))}>Gerar Excel</Button>
              <Button size="sm" variant="outline" onClick={()=>{
                try {
                  const ids = Array.from(selectedIds.values());
                  if(!ids.length){ toast.error('Nenhum produto selecionado para gerar grade'); return; }
                  const confirmMsg = `Deseja criar Solicitações de Compras com ${ids.length} produto(s) selecionado(s)?`;
                  // ask system dialog and wait for reply
                  const reqId = Math.random().toString(36).slice(2);
                  console.debug('[ProductsReplenish] dispatching system:confirm (no forward)', { reqId, msg: confirmMsg });
                  // ask the global system dialog (do NOT request forwarding/navigation)
                  window.dispatchEvent(new CustomEvent('system:confirm', { detail: { id: reqId, title: 'Confirmação', message: confirmMsg } }));

                  // Wait for reply; if OK, persist draft locally and show 'Concluído' message. Do NOT change screen.
                  function replyHandler(ev: Event){
                    const d = (ev as CustomEvent)?.detail as { id?: string; ok?: boolean } | undefined;
                    if(d?.id !== reqId) return;
                    window.removeEventListener('system:confirm:reply', replyHandler as EventListener);
                    if(d.ok){
                      try{ localStorage.setItem('erp:purchase_requests_initial', JSON.stringify(ids)); }catch(_){/* noop */}
                      window.dispatchEvent(new CustomEvent('system:message', { detail: { title: 'Concluído', message: 'Solicitações de compras criadas com sucesso.', durationMs: 3000 } }));
                    }
                  }
                  window.addEventListener('system:confirm:reply', replyHandler as EventListener);
                } catch(e){ toast.error('Erro ao tentar gerar grade'); }
              }}>Gerar Grade</Button>
              <Button size="sm" variant="outline" onClick={()=>setShowReport(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* system dialog is provided globally via SystemDialogProvider */}
  </>
  );
}
