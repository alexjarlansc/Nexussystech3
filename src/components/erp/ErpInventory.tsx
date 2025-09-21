import React, { useMemo, useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

type Row = {
  id: number;
  code: string;
  description: string;
  unit: 'KG'|'UND'|'METROS';
  cost: number | '';
  qty_system: number | '';
  qty_physical: number | '';
};

function toNumber(v: number | '' | string) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v).replace(/\./g,'').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function ErpInventory({ initialRows }: { initialRows?: Row[] }){
  // inicializa 25 linhas vazias por padrão
  const initial: Row[] = Array.from({length:25}).map((_,i)=>({ id:i+1, code:'', description:'', unit:'UND', cost:'', qty_system:'', qty_physical:'' } as Row));
  const [rows, setRows] = useState<Row[]>(initialRows && initialRows.length ? initialRows : initial);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  type ProductResult = { name?: string; cost_price?: number };

  function updateRow(index:number, patch: Partial<Row>){
    setRows(r=>{
      const copy = r.slice();
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  // cálculos por linha
  const calc = (row: Row) => {
    const sys = toNumber(row.qty_system);
    const phy = toNumber(row.qty_physical);
    let faltas = 0;
    let sobras = 0;
    // Faltas: quando sistema - físico > 0 => falta (sistema maior que físico)
    // Aqui representamos faltas como NEGATIVAS (valor com sinal '-') conforme solicitado
    if (sys - phy > 0) {
      // se sistema maior que físico, faltas = -(sys - phy)
      faltas = -(sys - phy);
    } else if (sys < 0) {
      // se sistema < 0, somar sistema + físico (conforme descrição original)
      // manter o sinal resultante (pode ser negativo)
      faltas = sys + phy;
    } else {
      faltas = 0;
    }
    // Sobras: quando físico - sistema > 0
    if (phy - sys > 0) {
      if (sys < 0) {
        const val = phy + sys; // soma físico + sistema
        sobras = val < 0 ? 0 : val;
      } else {
        sobras = phy - sys;
      }
    } else {
      sobras = 0;
    }

    const cost = toNumber(row.cost);
  // R$ Falta: calcular quando há faltas (agora representadas como valores negativos)
  const faltaValue = faltas < 0 ? faltas * cost : null;
  // R$ Sobra: calcular quando há sobras positivas (físico > sistema)
  const sobraValue = sobras > 0 ? sobras * cost : null;

    return { sys, phy, faltas, sobras, cost, faltaValue, sobraValue };
  };

  const totals = useMemo(()=>{
    let totalFaltaR = 0;
    let totalSobraR = 0;
    rows.forEach(r=>{
      const c = calc(r);
      if (typeof c.faltaValue === 'number' && !isNaN(c.faltaValue)) totalFaltaR += c.faltaValue;
      if (typeof c.sobraValue === 'number' && !isNaN(c.sobraValue)) totalSobraR += c.sobraValue;
    });
    return { totalFaltaR, totalSobraR, grandTotal: totalFaltaR + totalSobraR };
  },[rows]);

  function clearAll(){ setRows(initial); }

  // Listen for inventory finalize events (forwarded by SystemDialogProvider)
  useEffect(()=>{
    async function handler(e: Event){
      try{
        const ce = e as any;
        const payload = ce.detail;
        if(!payload) return;
        const record = {
          items: JSON.stringify(payload.rows || []),
          description: payload.description || null,
          created_at: new Date().toISOString(),
          user_id: payload.user_id || null,
          user_name: payload.user_name || null,
        };
        const { data, error } = await (supabase as any).from('inventories').insert(record).select().maybeSingle();
        if(error){
          console.error('Error saving inventory', error);
          toast.error('Erro ao salvar inventário: ' + (error.message || ''));
        } else {
          toast.success('Inventário salvo com sucesso');
          try{ window.dispatchEvent(new CustomEvent('inventory:finalized', { detail: data })); }catch(_){/*noop*/}
        }
      }catch(err){ console.error('inventory finalize handler failed', err); toast.error('Erro interno ao finalizar'); }
    }
    window.addEventListener('inventory:finalize', handler as EventListener);
    return ()=> window.removeEventListener('inventory:finalize', handler as EventListener);
  }, []);

  // If another part of the app requests a finalize (e.g. header button), trigger system confirm using current rows
  useEffect(()=>{
    function reqHandler(e: Event){
      try{
        // dispatch system confirm forwarding to inventory:finalize with current rows
        window.dispatchEvent(new CustomEvent('system:confirm', { detail: {
          id: 'finalize-inventory',
          title: 'Finalizar inventário',
          message: 'Deseja concluir o inventário? Esta ação salvará o resultado e não poderá ser desfeita.',
          forwardEvent: 'inventory:finalize',
          forwardPayload: { rows }
        }}));
      }catch(e){ console.debug('request finalize dispatch failed', e); }
    }
    window.addEventListener('request:inventory:confirm', reqHandler as EventListener);
    return ()=> window.removeEventListener('request:inventory:confirm', reqHandler as EventListener);
  }, [rows]);

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3 mb-2">
        <div>
          <h2 className="text-lg font-semibold">Inventário</h2>
          <div className="text-xs text-muted-foreground">Preencha a contagem física — subtotais atualizam automaticamente.</div>
        </div>
        <div className="ml-auto">
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearAll}>Limpar</Button>
            <Button size="sm" variant="destructive" onClick={()=>{
              // dispatch system confirm event which will forward inventory:finalize when OK
              try{
                window.dispatchEvent(new CustomEvent('system:confirm', { detail: {
                  id: 'finalize-inventory',
                  title: 'Finalizar inventário',
                  message: 'Deseja concluir o inventário? Esta ação salvará o resultado e não poderá ser desfeita.',
                  forwardEvent: 'inventory:finalize',
                  forwardPayload: { rows }
                }}));
              }catch(e){ console.debug('dispatch confirm failed', e); }
            }}>Finalizar inventário</Button>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40 text-left text-xs">
              <th className="px-2 py-1 w-8">#</th>
              <th className="px-2 py-1 w-28">Código</th>
              <th className="px-2 py-1 min-w-[220px]">Descrição</th>
              <th className="px-2 py-1 w-24">Tipo</th>
              <th className="px-2 py-1 w-28 text-right">Preço</th>
              <th className="px-2 py-1 w-28 text-right">Sistema</th>
              <th className="px-2 py-1 w-28 text-right">Físico</th>
              <th className="px-2 py-1 w-20 text-right">Faltas</th>
              <th className="px-2 py-1 w-20 text-right">Sobras</th>
              <th className="px-2 py-1 w-28 text-right">R$ Falta</th>
              <th className="px-2 py-1 w-28 text-right">R$ Sobra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx)=>{
              const c = calc(row);
              return (
                <tr key={row.id} className="border-t odd:bg-white even:bg-slate-50">
                  <td className="px-2 py-1 text-xs align-middle">{row.id}</td>
                  <td className="px-2 py-1 align-middle"><Input className="h-8 text-xs w-full min-w-0" value={row.code} onChange={e=>{
                    const v = e.target.value;
                    updateRow(idx,{ code: v });
                    // debounce fetch product by code
                    if(timers.current[idx]) clearTimeout(timers.current[idx] as ReturnType<typeof setTimeout>);
                    timers.current[idx] = setTimeout(async ()=>{
                      try{
                        if(!v || v.trim()==='') return;
                        // @ts-expect-error - supabase client returns complex generics; simplificamos a verificação aqui
                        const res: unknown = await supabase.from('products').select('name,cost_price').eq('code', v).maybeSingle();
                        const obj = res as { data?: ProductResult } | ProductResult | undefined;
                        const data = (obj && ('data' in obj ? obj.data : obj)) as ProductResult | undefined;
                        if(data){ updateRow(idx, { description: String(data.name || ''), cost: data.cost_price ?? '' }); }
                      }catch(_e){ /* ignore */ }
                    }, 600);
                  }} /></td>
                  <td className="px-2 py-1 align-middle"><Input className="h-8 text-xs w-full min-w-0" value={row.description} onChange={e=>updateRow(idx,{ description: e.target.value })} /></td>
                  <td className="px-2 py-1 align-middle">
                    <select className="text-sm h-8 w-full px-2 rounded border" value={row.unit} onChange={e=>updateRow(idx,{ unit: e.target.value as Row['unit'] })}>
                      <option value="KG">KG</option>
                      <option value="UND">UND</option>
                      <option value="METROS">METROS</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 align-middle"><Input className="h-8 text-xs text-right w-full min-w-0" value={row.cost === '' ? '' : (typeof row.cost === 'number' ? row.cost.toLocaleString('pt-BR',{ style: 'currency', currency: 'BRL' }) : String(row.cost))} onChange={e=>{
                    const raw = e.target.value;
                    const v = raw.replace(/[^0-9,.-]/g,'');
                    const num = v === '' ? '' : Number(v.replace(',', '.'));
                    updateRow(idx,{ cost: (num === '' ? '' : num) as number | '' });
                  }} /></td>
                  <td className="px-2 py-1 align-middle"><Input className="h-8 text-xs text-right" value={row.qty_system === '' ? '' : String(row.qty_system)} onChange={e=>{
                const v = e.target.value.replace(/[^0-9,.-]/g,'');
                    const num = v === '' ? '' : Number(v.replace(',', '.'));
                    updateRow(idx,{ qty_system: (num === '' ? '' : num) as number | '' });
                  }} /></td>
                  <td className="px-2 py-1 align-middle"><Input className="h-8 text-xs text-right" value={row.qty_physical === '' ? '' : String(row.qty_physical)} onChange={e=>{
                const v = e.target.value.replace(/[^0-9,.-]/g,'');
                    const num = v === '' ? '' : Number(v.replace(',', '.'));
                    updateRow(idx,{ qty_physical: (num === '' ? '' : num) as number | '' });
                  }} /></td>
                  <td className={`px-2 py-1 text-right align-middle ${c.faltas < 0 ? 'text-red-600' : c.faltas > 0 ? 'text-blue-600' : ''}`}>{c.faltas === 0 ? '' : c.faltas.toLocaleString('pt-BR', { maximumFractionDigits:3 })}</td>
                  <td className={`px-2 py-1 text-right align-middle ${c.sobras < 0 ? 'text-red-600' : c.sobras > 0 ? 'text-blue-600' : ''}`}>{c.sobras === 0 ? '' : c.sobras.toLocaleString('pt-BR', { maximumFractionDigits:3 })}</td>
                  <td className={`px-2 py-1 text-right align-middle ${typeof c.faltaValue === 'number' && c.faltaValue < 0 ? 'text-red-600' : typeof c.faltaValue === 'number' && c.faltaValue > 0 ? 'text-blue-600' : ''}`}>{typeof c.faltaValue === 'number' ? c.faltaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                  <td className={`px-2 py-1 text-right align-middle ${typeof c.sobraValue === 'number' && c.sobraValue < 0 ? 'text-red-600' : typeof c.sobraValue === 'number' && c.sobraValue > 0 ? 'text-blue-600' : ''}`}>{typeof c.sobraValue === 'number' ? c.sobraValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/10">
              <td colSpan={10} className="px-2 py-2 text-right font-semibold">Subtotal R$ faltas</td>
              <td className={`px-2 py-2 text-right font-semibold ${totals.totalFaltaR < 0 ? 'text-red-600' : totals.totalFaltaR > 0 ? 'text-blue-600' : ''}`}>{totals.totalFaltaR !== 0 ? totals.totalFaltaR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
            </tr>
            <tr className="bg-muted/10">
              <td colSpan={10} className="px-2 py-2 text-right font-semibold">Subtotal R$ sobras</td>
              <td className={`px-2 py-2 text-right font-semibold ${totals.totalSobraR < 0 ? 'text-red-600' : totals.totalSobraR > 0 ? 'text-blue-600' : ''}`}>{totals.totalSobraR !== 0 ? totals.totalSobraR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
            </tr>
            <tr className="bg-muted/20">
              <td colSpan={10} className="px-2 py-2 text-right font-semibold">Sub Total geral</td>
              <td className={`px-2 py-2 text-right font-semibold ${totals.grandTotal < 0 ? 'text-red-600' : totals.grandTotal > 0 ? 'text-blue-600' : ''}`}>{totals.grandTotal !== 0 ? totals.grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// listener moved into component; no exported helpers here
