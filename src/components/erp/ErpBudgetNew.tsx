import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function ErpBudgetNew({ open, onOpenChange }:{ open:boolean; onOpenChange:(o:boolean)=>void }){
  const { profile } = useAuth();
  const [saving,setSaving]=useState(false);
  const [freight,setFreight]=useState<string>('0,00');
  const [carrierSearch,setCarrierSearch]=useState('');
  const [showTotalOnPrint,setShowTotalOnPrint]=useState(true);
  const [productsTotal,setProductsTotal]=useState<number>(0);
  const [servicesTotal,setServicesTotal]=useState<number>(0);
  const [discountValue,setDiscountValue]=useState<string>('0,00');
  const [discountPercent,setDiscountPercent]=useState<string>('0');
  const [totalValue,setTotalValue]=useState<number>(0);
  const [genPayment,setGenPayment]=useState(true);
  const [isParcelado,setIsParcelado]=useState(true);
  const [paymentMethod,setPaymentMethod]=useState('');
  const [intervalDays,setIntervalDays]=useState<string>('30');
  const [parcelsQty,setParcelsQty]=useState<string>('1');
  const [firstParcelDate,setFirstParcelDate]=useState<string>(new Date().toISOString().slice(0,10));

  useEffect(()=>{
    // recalcular total simples
    const p = Number(String(productsTotal))||0;
    const s = Number(String(servicesTotal))||0;
    const disc = parseFloat(String(discountValue).replace(',','.'))||0;
    const discPct = parseFloat(String(discountPercent).replace(',','.'))||0;
    const subtotal = p + s;
    const subtotalAfterPct = subtotal * (1 - (discPct/100));
    const total = Math.max(0, subtotalAfterPct - disc + (parseFloat(String(freight).replace(',','.'))||0));
    setTotalValue(+total.toFixed(2));
  },[productsTotal,servicesTotal,discountValue,discountPercent,freight]);

  async function handleSave(){
    if(saving) return; setSaving(true);
    try{
      const payload:any = {
        type: 'ORCAMENTO',
        number: null,
        client_id: null,
        total: totalValue,
        subtotal: productsTotal + servicesTotal,
        freight: parseFloat(String(freight).replace(',','.'))||0,
        discount: parseFloat(String(discountValue).replace(',','.'))||0,
        discount_percent: parseFloat(String(discountPercent).replace(',','.'))||0,
        items: [],
        origin_orc_number: null,
        company_id: profile?.company_id || null,
      };
      const { data, error } = await (supabase as any).from('quotes').insert(payload).select().single();
      if(error) throw error;
      toast.success('Orçamento criado');
      onOpenChange(false);
    }catch(e:any){ toast.error(e?.message || String(e)||'Erro ao criar orçamento'); }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo Orçamento (ERP)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-2 text-sm">
          <Card className="p-3">
            <h4 className="font-semibold mb-2">Transporte</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input value={freight} onChange={e=>setFreight(e.target.value)} placeholder="Valor do frete" />
              <Input value={carrierSearch} onChange={e=>setCarrierSearch(e.target.value)} placeholder="Transportadora (digite para buscar)" />
            </div>
          </Card>

          <Card className="p-3">
            <h4 className="font-semibold mb-2">Total</h4>
            <div className="mb-2"><Checkbox checked={showTotalOnPrint} onCheckedChange={(v:any)=>setShowTotalOnPrint(Boolean(v))} /> <span className="ml-2">Exibir valor total na impressão</span></div>
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-2"><label className="block text-xs">Produtos</label><Input value={String(productsTotal)} onChange={e=>setProductsTotal(Number(e.target.value)||0)} /></div>
              <div className="col-span-2"><label className="block text-xs">Serviços</label><Input value={String(servicesTotal)} onChange={e=>setServicesTotal(Number(e.target.value)||0)} /></div>
              <div className="col-span-1"><label className="block text-xs">Desconto (R$)</label><Input value={discountValue} onChange={e=>setDiscountValue(e.target.value)} /></div>
              <div className="col-span-1"><label className="block text-xs">Desconto (%)</label><Input value={discountPercent} onChange={e=>setDiscountPercent(e.target.value)} /></div>
              <div className="col-span-6"><label className="block text-xs">Valor total</label><Input value={String(totalValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))} readOnly /></div>
            </div>
          </Card>

          <Card className="p-3">
            <h4 className="font-semibold mb-2">Pagamento</h4>
            <div className="mb-2"><Checkbox checked={genPayment} onCheckedChange={(v:any)=>setGenPayment(Boolean(v))} /> <span className="ml-2">Gerar condições de pagamento</span></div>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center"><input type="radio" name="paytype" checked={!isParcelado} onChange={()=>setIsParcelado(false)} /> <span className="ml-2">À vista</span></label>
              <label className="flex items-center"><input type="radio" name="paytype" checked={isParcelado} onChange={()=>setIsParcelado(true)} /> <span className="ml-2">Parcelado</span></label>
            </div>
            <div className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2"><label className="block text-xs">Forma de pagamento</label><select className="h-9 border rounded px-2 w-full" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="">Selecione</option><option value="boleto">Boleto</option><option value="pix">PIX</option><option value="cartao">Cartão</option></select></div>
              <div><label className="block text-xs">Intervalo parcelas (dias)</label><Input value={intervalDays} onChange={e=>setIntervalDays(e.target.value)} /></div>
              <div><label className="block text-xs">Qnt. parcelas</label><Input value={parcelsQty} onChange={e=>setParcelsQty(e.target.value)} /></div>
              <div><label className="block text-xs">Data 1ª parcela</label><Input type="date" value={firstParcelDate} onChange={e=>setFirstParcelDate(e.target.value)} /></div>
              <div><Button onClick={()=>{
                // gerar parcelas simples (apenas cálculo local)
                toast.success('Parcelas geradas (simulado)');
              }}>Gerar</Button></div>
            </div>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving? 'Salvando...':'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
