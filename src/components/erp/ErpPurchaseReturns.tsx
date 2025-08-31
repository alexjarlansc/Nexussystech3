import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

interface PurchaseRef { id: string; purchase_number: string; total: number; }

export const ErpPurchaseReturns = () => {
  const [purchases,setPurchases]=useState<PurchaseRef[]>([]);
  const [loading,setLoading]=useState(false);
  const [basePurchase,setBasePurchase]=useState('');
  const [items,setItems]=useState<{description:string; qty:string; unit_cost:string;}[]>([]);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ (async()=>{
  const { data } = await supabase.from('purchases').select('id,purchase_number,total').order('created_at',{ascending:false}).limit(200) as { data: { id:string; purchase_number:string; total:number; }[] | null };
  if (data) setPurchases(data.map(d=> ({ id:d.id, purchase_number:d.purchase_number, total:d.total })));
  })(); },[]);

  function addItem(){ setItems(list=>[...list,{description:'',qty:'',unit_cost:''}]); }
  function updateItem(idx:number,patch:Partial<{description:string; qty:string; unit_cost:string;}>){ setItems(list=> list.map((r,i)=> i===idx? {...r,...patch}: r)); }
  function removeItem(idx:number){ setItems(list=> list.filter((_,i)=> i!==idx)); }

  async function saveReturn(type:'RETURN'|'EXCHANGE'){
    if(!basePurchase){ toast.error('Selecione a compra base'); return; }
    if(!items.length){ toast.error('Adicione itens'); return; }
    if(items.some(i=> !i.description || !parseFloat(i.qty))){ toast.error('Itens incompletos'); return; }
    setSaving(true);
    try {
      const numberResp = await supabase.rpc('next_purchase_number');
      if (numberResp.error) throw numberResp.error;
      const purchase_number = numberResp.data as string;
      const mapped = items.map(i=> ({ description: i.description, qty: parseFloat(i.qty), unit_cost: parseFloat(i.unit_cost||'0')||0, total: (parseFloat(i.qty)||0)*(parseFloat(i.unit_cost||'0')||0) }));
      const subtotal = mapped.reduce((s,it)=> s+it.total,0);
      const { error } = await supabase.from('purchases').insert({
        purchase_number,
        purchase_type: type,
        original_purchase_id: basePurchase,
        items: mapped,
        subtotal,
        freight: 0,
        discount: 0,
        total: subtotal,
        status: 'ABERTA',
        notes: type==='RETURN'? 'Devolução de compra' : 'Troca de compra'
      });
      if (error) throw error;
      toast.success((type==='RETURN'? 'Devolução':'Troca')+' criada: '+purchase_number);
      setBasePurchase(''); setItems([]);
    } catch(e){ toast.error(e instanceof Error? e.message: 'Falha'); } finally { setSaving(false); }
  }

  return <Card className='p-6 space-y-4'>
    <div>
      <h2 className='text-xl font-semibold'>Troca / Devolução de Compra</h2>
      <p className='text-sm text-muted-foreground'>Gere uma compra de tipo RETURN ou EXCHANGE vinculada a uma compra existente.</p>
    </div>
    <div className='grid md:grid-cols-3 gap-4 text-sm'>
      <div className='md:col-span-2'>
        <label className='text-[11px] uppercase text-slate-500'>Compra base</label>
        <select value={basePurchase} onChange={e=>setBasePurchase(e.target.value)} className='mt-1 w-full h-9 border rounded px-2'>
          <option value=''>-- Selecionar --</option>
          {purchases.map(p=> <option key={p.id} value={p.id}>{p.purchase_number} • {p.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</option>)}
        </select>
      </div>
      <div className='flex items-end'>
        <Button size='sm' variant='outline' onClick={addItem}>Adicionar Item</Button>
      </div>
    </div>
    <div className='space-y-3'>
      {items.map((it,idx)=> <div key={idx} className='grid md:grid-cols-5 gap-2 items-end text-sm'>
        <div className='md:col-span-2'>
          <label className='text-[11px] uppercase text-slate-500'>Descrição</label>
          <Input value={it.description} onChange={e=>updateItem(idx,{description:e.target.value})} className='mt-1 h-9' />
        </div>
        <div>
          <label className='text-[11px] uppercase text-slate-500'>Qtd</label>
          <Input value={it.qty} onChange={e=>updateItem(idx,{qty:e.target.value})} className='mt-1 h-9' />
        </div>
        <div>
          <label className='text-[11px] uppercase text-slate-500'>Custo</label>
          <Input value={it.unit_cost} onChange={e=>updateItem(idx,{unit_cost:e.target.value})} className='mt-1 h-9' />
        </div>
        <div className='flex gap-1'>
          <Button size='sm' variant='outline' onClick={()=>removeItem(idx)}>Remover</Button>
        </div>
      </div>)}
      {items.length===0 && <div className='text-xs text-muted-foreground'>Nenhum item adicionado.</div>}
    </div>
    <div className='flex gap-2'>
      <Button size='sm' disabled={saving} onClick={()=>saveReturn('RETURN')}>Gerar Devolução</Button>
      <Button size='sm' variant='outline' disabled={saving} onClick={()=>saveReturn('EXCHANGE')}>Gerar Troca</Button>
    </div>
  </Card>;
};

export default ErpPurchaseReturns;
