import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const ErpPurchaseXmlImport = () => {
  const [xml,setXml]=useState('');
  const [parsing,setParsing]=useState(false);
  interface ParsedItem { code: string; name: string; qty: number; unit_cost: number; }
  const [items,setItems]=useState<ParsedItem[]>([]);
  const [summary,setSummary]=useState<string>('');

  async function fakeParse(){
    if(!xml.trim()){ toast.error('Cole o XML da NFe'); return; }
    setParsing(true);
    try {
      // Placeholder: in production parse XML NFe 4.0 structure
      // Extract chave, fornecedor, itens (cProd, xProd, qCom, vProd)
      await new Promise(r=>setTimeout(r,800));
      const demoItems = [
        { code: '001', name: 'ITEM DEMO 1', qty: 2, unit_cost: 10 },
        { code: '002', name: 'ITEM DEMO 2', qty: 1, unit_cost: 35 },
      ];
      setItems(demoItems);
      setSummary('Itens extraídos: '+demoItems.length+' (placeholder — implementar parser real).');
    } catch(e){ toast.error(e instanceof Error? e.message : 'Falha'); } finally { setParsing(false); }
  }

  async function convertToPurchase(){
    if(items.length===0){ toast.error('Nenhum item para converter'); return; }
    try {
      const numberResp = await supabase.rpc('next_purchase_number');
      if (numberResp.error) throw numberResp.error;
      const purchase_number = numberResp.data as string;
      const mapped = items.map(i=> ({ external_code: i.code, description: i.name, qty: i.qty, unit_cost: i.unit_cost, total: i.qty * i.unit_cost }));
      const subtotal = mapped.reduce((s,it)=> s+it.total,0);
      const { error } = await supabase.from('purchases').insert({
        purchase_number,
        purchase_type: 'NORMAL',
        items: mapped,
        subtotal,
        freight: 0,
        discount: 0,
        total: subtotal,
        status: 'ABERTA',
        xml_access_key: 'CHAVE-DEMO',
        notes: 'Importado via XML placeholder',
      });
      if (error) throw error;
      toast.success('Compra criada '+purchase_number);
      setXml(''); setItems([]); setSummary('Criada compra '+purchase_number);
    } catch(e){ toast.error(e instanceof Error? e.message : 'Falha'); }
  }

  return <Card className='p-6 space-y-4'>
    <div>
      <h2 className='text-xl font-semibold'>Gerar compra via XML</h2>
      <p className='text-sm text-muted-foreground'>Cole o XML da NF-e (versão 4.0). Parser real ainda não implementado.</p>
    </div>
    <div className='space-y-2'>
      <Textarea rows={10} placeholder='Cole aqui o XML completo...' value={xml} onChange={e=>setXml(e.target.value)} />
      <div className='flex gap-2'>
        <Button size='sm' disabled={parsing} onClick={fakeParse}>{parsing?'Processando...':'Processar XML (placeholder)'}</Button>
        <Button size='sm' variant='outline' disabled={!items.length} onClick={convertToPurchase}>Gerar Compra</Button>
      </div>
      {summary && <div className='text-xs text-muted-foreground'>{summary}</div>}
    </div>
    {items.length>0 && <div className='border rounded max-h-64 overflow-auto'>
      <table className='w-full text-xs'>
        <thead className='bg-muted/50'><tr><th className='px-2 py-1 text-left'>Código</th><th className='px-2 py-1 text-left'>Descrição</th><th className='px-2 py-1 text-right'>Qtd</th><th className='px-2 py-1 text-right'>Unit</th><th className='px-2 py-1 text-right'>Total</th></tr></thead>
        <tbody>
          {items.map((it,i)=> <tr key={i} className='border-t'>
            <td className='px-2 py-1'>{it.code}</td>
            <td className='px-2 py-1'>{it.name}</td>
            <td className='px-2 py-1 text-right'>{it.qty}</td>
            <td className='px-2 py-1 text-right'>{Number(it.unit_cost).toFixed(2)}</td>
            <td className='px-2 py-1 text-right'>{(it.qty*it.unit_cost).toFixed(2)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </Card>;
};

export default ErpPurchaseXmlImport;
