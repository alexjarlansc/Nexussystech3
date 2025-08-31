import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';

export default function ErpStockReturns(){
  const [productId,setProductId]=useState('');
  const [qty,setQty]=useState('');
  const [reason,setReason]=useState('');
  const [saleId,setSaleId]=useState('');
  const [location,setLocation]=useState('');
  const [type,setType]=useState<'RETURN'|'EXCHANGE'>('RETURN');
  const [loading,setLoading]=useState(false);

  async function submit(){
    const q = parseFloat(qty.replace(',','.'));
    if(!productId || !q){ toast.error('Produto e quantidade'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('register_stock_movement', { p_product_id: productId, p_qty: q, p_type: type, p_reason: reason||null, p_location_from: location||null, p_related_sale_id: saleId||null });
      if (error) throw error;
      toast.success(type==='RETURN'?'Devolução registrada':'Troca registrada');
      setProductId(''); setQty(''); setReason(''); setSaleId(''); setLocation('');
    } catch(e){ const msg = e instanceof Error ? e.message : 'Falha'; toast.error(msg); } finally { setLoading(false); }
  }

  return <Card className='p-6 space-y-4'>
    <div>
      <h2 className='text-xl font-semibold mb-1'>Trocas / Devoluções</h2>
      <p className='text-sm text-muted-foreground'>Registre devoluções ou trocas vinculando opcionalmente ao pedido original.</p>
    </div>
    <div className='grid gap-3 text-sm max-w-lg'>
      <div className='grid grid-cols-2 gap-2'>
  <select value={type} onChange={e=>setType(e.target.value as 'RETURN'|'EXCHANGE')} className='border rounded h-9 px-2 text-sm'>
          <option value='RETURN'>Devolução</option>
          <option value='EXCHANGE'>Troca</option>
        </select>
        <Input placeholder='ID Pedido (opcional)' value={saleId} onChange={e=>setSaleId(e.target.value)} />
      </div>
      <Input placeholder='ID Produto *' value={productId} onChange={e=>setProductId(e.target.value)} />
      <Input placeholder='Quantidade *' value={qty} onChange={e=>setQty(e.target.value)} />
      <Input placeholder='Local (opcional)' value={location} onChange={e=>setLocation(e.target.value)} />
      <Textarea placeholder='Motivo / Observação' value={reason} onChange={e=>setReason(e.target.value)} rows={3} />
      <div className='flex gap-2'>
        <Button disabled={loading} onClick={submit}>{loading?'Salvando...':'Registrar'}</Button>
      </div>
    </div>
  </Card>;
}
