import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';

export default function ErpStockAdjustments(){
  const [productId,setProductId]=useState('');
  const [qty,setQty]=useState('');
  const [loc,setLoc]=useState('');
  const [reason,setReason]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(){
    const q = parseFloat(qty.replace(',','.'));
    if(!productId || !q){ toast.error('Produto e quantidade'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('register_stock_movement', { p_product_id: productId, p_qty: q, p_type: 'ADJUSTMENT', p_reason: reason||null, p_location_from: loc||null });
      if (error) throw error;
      toast.success('Ajuste registrado');
      setProductId(''); setQty(''); setLoc(''); setReason('');
  } catch(e){ const msg = e instanceof Error ? e.message : 'Falha'; toast.error(msg); } finally { setLoading(false); }
  }

  return <Card className='p-6 space-y-4'>
    <div>
      <h2 className='text-xl font-semibold mb-1'>Ajustes de Estoque</h2>
      <p className='text-sm text-muted-foreground'>Use quantidades positivas (acréscimo) ou negativas (baixa) para corrigir saldo real vs sistema.</p>
    </div>
    <div className='grid gap-3 text-sm max-w-md'>
      <Input placeholder='ID Produto *' value={productId} onChange={e=>setProductId(e.target.value)} />
      <Input placeholder='Quantidade (ex: -3 ou 5) *' value={qty} onChange={e=>setQty(e.target.value)} />
      <Input placeholder='Local (opcional)' value={loc} onChange={e=>setLoc(e.target.value)} />
      <Textarea placeholder='Motivo / Observação' value={reason} onChange={e=>setReason(e.target.value)} rows={3} />
      <div className='flex gap-2'>
        <Button disabled={loading} onClick={submit}>{loading?'Salvando...':'Registrar Ajuste'}</Button>
      </div>
    </div>
  </Card>;
}
