import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo } from "react";
import { supabase } from '@/integrations/supabase/client';
import { nextSaleNumber } from '@/lib/sales';
import { Quote, Client } from '@/types';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

interface PDVItem {
  id: string;
  name: string;
  reference?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // valor absoluto
}

type PaymentLine = {
  id: string;
  method: string;
  amount: number;
};

export default function PDV() {
  const { profile, user } = useAuth();
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [linkedQuote, setLinkedQuote] = useState<Quote | null>(null);
  const [freight, setFreight] = useState<number>(0);
  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);
  const [clientDisplay, setClientDisplay] = useState<string>("1 - CONSUMIDOR FINAL");
  const [address, setAddress] = useState<string>("");
  const [vendor, setVendor] = useState<string>(profile?.first_name || "");
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [currentProduct, setCurrentProduct] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<PDVItem[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [paymentAmount, setPaymentAmount] = useState('');

  const subtotal = useMemo(() => items.reduce((s,i)=> s + i.unitPrice * i.quantity,0), [items]);
  const totalDiscount = useMemo(()=> items.reduce((s,i)=> s + (i.discount||0),0), [items]);
  const grossTotal = subtotal;
  const netTotal = grossTotal - totalDiscount;
  const paid = payments.reduce((s,p)=> s + p.amount,0);
  const remaining = Math.max(0, netTotal - paid);

  function addItem() {
    if (!currentProduct && !productSearch.trim()) {
      toast.error('Informe o produto');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantidade inválida');
      return;
    }
    setItems(prev => [...prev, {
      id: currentProduct?.id || crypto.randomUUID(),
      name: currentProduct?.name || productSearch.trim(),
      quantity,
      unitPrice,
    }]);
    setProductSearch('');
    setCurrentProduct(null);
    setQuantity(1);
    setUnitPrice(0);
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i=> i.id!==id));
  }

  function applyDiscount(id: string, value: number) {
    setItems(prev => prev.map(i=> i.id===id ? { ...i, discount: value } : i));
  }

  function addPayment() {
    const value = parseFloat(paymentAmount.replace(',','.'));
    if (isNaN(value) || value <= 0) { toast.error('Valor inválido'); return; }
    setPayments(prev=> [...prev, { id: crypto.randomUUID(), method: paymentMethod, amount: value }]);
    setPaymentAmount('');
    if (value >= remaining) setPaymentDialog(false);
  }

  async function loadQuoteByNumber(num: string) {
    if (!num) return;
    const { data, error } = await supabase.from('quotes').select('*').eq('number', num).maybeSingle();
    if (error || !data) { toast.error('Pedido não encontrado'); return; }
    // map fields
    const q: Quote = {
      id: data.id,
      number: data.number,
      type: data.type,
      createdAt: data.created_at,
      validityDays: data.validity_days,
      vendor: data.vendor,
      clientId: data.client_id,
      clientSnapshot: data.client_snapshot as Client,
      items: data.items,
      freight: data.freight || 0,
      paymentMethod: data.payment_method,
      paymentTerms: data.payment_terms,
      notes: data.notes || '',
      status: data.status || 'Rascunho',
      subtotal: data.subtotal || 0,
      total: data.total || 0,
      type: data.type,
    } as unknown as Quote; // alguns campos já coerentes
    setLinkedQuote(q);
    setClientDisplay(q.clientSnapshot.name);
    setAddress(q.clientSnapshot.address || '');
    setVendor(q.vendor?.name || vendor);
    setFreight(q.freight || 0);
    setItems(q.items.map(it => ({
      id: it.productId || crypto.randomUUID(),
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: 0,
    })));
    setPaymentPlan(q.paymentTerms || null);
    toast.success('Pedido carregado');
  }

  async function finalizeSale() {
    if (items.length === 0) { toast.error('Sem itens'); return; }
    if (remaining > 0) { toast.error('Pagamento incompleto'); return; }
    try {
      const saleNumber = await nextSaleNumber();
      const payload = {
        sale_number: saleNumber,
        quote_id: linkedQuote?.id || null,
        client_snapshot: linkedQuote?.clientSnapshot || { name: clientDisplay, id: 'consumidor-final', taxid: '' },
        vendor: linkedQuote?.vendor || { name: vendor, phone: '', email: '' },
  operator_id: user?.id,
        items: items.map(i => ({ ...i, total: i.quantity * i.unitPrice - (i.discount || 0) })),
        payments: payments,
        payment_plan: paymentPlan,
        subtotal: subtotal,
        discount: totalDiscount,
        freight: freight,
        total: netTotal + freight,
        status: 'FINALIZADA',
        payment_status: remaining === 0 ? 'PAGO' : 'PARCIAL',
        company_id: profile?.company_id,
  created_by: user?.id,
      };
      // @ts-expect-error tabela nova ainda não nos types
      const { error } = await supabase.from('sales').insert(payload);
      if (error) throw error;
      toast.success('Venda finalizada');
      // reset
      setItems([]); setPayments([]); setLinkedQuote(null); setOrderNumber('');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao finalizar venda');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d4d70]">
      <NexusProtectedHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Coluna esquerda */}
        <div className="w-80 bg-white/95 p-3 flex flex-col gap-2 border-r overflow-auto">
          <div>
            <label className="text-xs font-medium">Pedido:</label>
            <div className="flex items-center gap-1">
              <Input value={orderNumber} placeholder="Número" onChange={e=> setOrderNumber(e.target.value.toUpperCase())} onKeyDown={e=> { if(e.key==='Enter'){ loadQuoteByNumber(orderNumber); }}} className="h-7 text-right" />
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={()=> loadQuoteByNumber(orderNumber)}>🔍</Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Cliente:</label>
            <div className="flex items-center gap-1">
              <Input value={clientDisplay} onChange={e=> setClientDisplay(e.target.value)} className="h-7" />
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs">🔍</Button>
            </div>
          </div>
            <div>
              <label className="text-xs font-medium">Endereço:</label>
              <textarea value={address} onChange={e=> setAddress(e.target.value)} className="w-full h-16 text-xs border rounded p-1 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium">Vendedor:</label>
              <div className="flex items-center gap-1">
                <Input value={vendor} onChange={e=> setVendor(e.target.value)} className="h-7" />
                <Button variant="outline" size="icon" className="h-7 w-7 text-xs">🔍</Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Produto / Serviço:</label>
              <div className="flex items-center gap-1">
                <Input value={productSearch} onChange={e=> setProductSearch(e.target.value)} className="h-7" />
                <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={()=>{/* abrir busca */}}>🔍</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">(F2) Quantidade:</label>
                <Input type="number" value={quantity} onChange={e=> setQuantity(parseFloat(e.target.value)||1)} className="h-7" />
              </div>
              <div>
                <label className="text-xs font-medium">Valor Unitário:</label>
                <Input type="number" value={unitPrice} onChange={e=> setUnitPrice(parseFloat(e.target.value)||0)} className="h-7" />
              </div>
            </div>
            <div className="pt-1">
              <Button className="w-full h-8" onClick={addItem}>Lançar</Button>
            </div>
        </div>
        {/* Centro - Tabela */}
        <div className="flex-1 bg-white p-3 flex flex-col">
          <div className="flex-1 overflow-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-sky-900 text-white">
                <tr>
                  <th className="p-1 text-left w-10">#</th>
                  <th className="p-1 text-left">Descrição</th>
                  <th className="p-1 text-right w-16">Qtde</th>
                  <th className="p-1 text-right w-24">Vl. Unitário</th>
                  <th className="p-1 text-right w-20">Desc.</th>
                  <th className="p-1 text-right w-24">Vl. Total</th>
                  <th className="p-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it,idx)=> {
                  const lineSubtotal = it.unitPrice * it.quantity;
                  return (
                    <tr key={it.id} className="odd:bg-white even:bg-slate-50">
                      <td className="p-1">{idx+1}</td>
                      <td className="p-1 truncate max-w-[240px]" title={it.name}>{it.name}</td>
                      <td className="p-1 text-right">{it.quantity}</td>
                      <td className="p-1 text-right">{it.unitPrice.toFixed(2)}</td>
                      <td className="p-1 text-right">{(it.discount||0).toFixed(2)}</td>
                      <td className="p-1 text-right">{(lineSubtotal - (it.discount||0)).toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button onClick={()=> removeItem(it.id)} className="text-red-600 hover:underline">X</button>
                      </td>
                    </tr>
                  );
                })}
                {items.length===0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum item</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-2">
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={()=> setPaymentDialog(true)}>Pagamento</Button>
              <Button variant="outline" size="sm" disabled>Alterar</Button>
              <Button variant="outline" size="sm" disabled>Excluir</Button>
              <Button variant="outline" size="sm" disabled>Copiar</Button>
              <Button variant="outline" size="sm" disabled>Desc.</Button>
              <Button variant="outline" size="sm" disabled>Produto</Button>
              <Button variant="outline" size="sm" disabled>Sugestão</Button>
              <Button variant="outline" size="sm" disabled>Similar</Button>
              <Button variant="outline" size="sm" disabled>Lote</Button>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4 bg-slate-100 rounded p-3 text-sm">
              <div className="col-span-1">
                <div className="font-medium text-[11px] uppercase tracking-wide">Itens</div>
                <div className="text-xl font-bold">{items.length.toString().padStart(3,'0')}</div>
              </div>
              <div className="col-span-1">
                <div className="font-medium text-[11px] uppercase tracking-wide">Descontos</div>
                <div className="text-xl font-bold">{totalDiscount.toFixed(2)}</div>
              </div>
              <div className="col-span-1">
                <div className="font-medium text-[11px] uppercase tracking-wide">Total Líquido</div>
                <div className="text-xl font-bold">{(netTotal + freight).toFixed(2)}</div>
              </div>
              <div className="col-span-3 flex justify-between items-center mt-4">
                <div className="text-xs text-muted-foreground">Operador: {profile?.first_name}</div>
                <Button size="lg" disabled={netTotal===0 || remaining>0} onClick={finalizeSale} className="bg-slate-800 hover:bg-slate-700">(F3) Finalizar Venda</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Dinheiro','Cartão Crédito','Cartão Débito','Pix','Boleto','Voucher'].map(m=> <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Valor" value={paymentAmount} onChange={e=> setPaymentAmount(e.target.value)} className="h-8" />
              <Button onClick={addPayment} className="h-8">Adicionar</Button>
            </div>
            <div className="border rounded max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr><th className="p-1 text-left">Forma</th><th className="p-1 text-right">Valor</th><th></th></tr>
                </thead>
                <tbody>
                  {payments.map(p=> <tr key={p.id}>
                    <td className="p-1">{p.method}</td>
                    <td className="p-1 text-right">{p.amount.toFixed(2)}</td>
                    <td className="p-1 text-center"><button onClick={()=> setPayments(prev=> prev.filter(x=> x.id!==p.id))} className="text-red-600 text-[10px]">rem</button></td>
                  </tr>)}
                  {payments.length===0 && <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Nenhum pagamento</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span>Total</span><span>{netTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Pago</span><span>{paid.toFixed(2)}</span></div>
              <div className="flex justify-between col-span-2 font-semibold"><span>Restante</span><span>{remaining.toFixed(2)}</span></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}