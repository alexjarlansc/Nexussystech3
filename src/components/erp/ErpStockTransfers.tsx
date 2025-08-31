import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';

export default function ErpStockTransfers(){
  const [productId,setProductId]=useState('');
  const [qty,setQty]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [reason,setReason]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(){
    const q = parseFloat(qty.replace(',','.'));
    if(!productId || !q || !from || !to){ toast.error('Preencha produto, quantidade, origem e destino'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('register_stock_movement', { p_product_id: productId, p_qty: q, p_type: 'TRANSFER', p_reason: reason||null, p_location_from: from, p_location_to: to });
      if (error) throw error;
      toast.success('Transferência registrada');
      setProductId(''); setQty(''); setFrom(''); setTo(''); setReason('');
    } catch(e){ const msg = e instanceof Error ? e.message : 'Falha'; toast.error(msg); } finally { setLoading(false); }
  }

  return <Card className='p-6 space-y-4'>
    <div>
      <h2 className='text-xl font-semibold mb-1'>Transferências de Estoque</h2>
      <p className='text-sm text-muted-foreground'>Registra saída de um local e entrada em outro como par de movimentos vinculados.</p>
    </div>
    <div className='grid gap-3 text-sm max-w-md'>
      <Input placeholder='ID Produto *' value={productId} onChange={e=>setProductId(e.target.value)} />
      <Input placeholder='Quantidade *' value={qty} onChange={e=>setQty(e.target.value)} />
      <div className='grid grid-cols-2 gap-2'>
        <Input placeholder='Origem *' value={from} onChange={e=>setFrom(e.target.value)} />
        <Input placeholder='Destino *' value={to} onChange={e=>setTo(e.target.value)} />
      </div>
      <Textarea placeholder='Motivo / Observação' value={reason} onChange={e=>setReason(e.target.value)} rows={3} />
      <div className='flex gap-2'>
        <Button disabled={loading} onClick={submit}>{loading?'Salvando...':'Registrar Transferência'}</Button>
      </div>
    </div>
  </Card>;
}
