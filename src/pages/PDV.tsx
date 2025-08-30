import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo, useEffect } from "react";
import { supabase } from '@/integrations/supabase/client';
import { nextSaleNumber } from '@/lib/sales';
import { Quote, Client } from '@/types';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { openCashSession, closeCashSession, registerMovement, getOpenSession } from '@/lib/cash';

interface PDVItem {
  id: string;
  name: string;
  reference?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // valor absoluto
}

type PaymentLine = { id: string; method: string; amount: number };

interface CashSession {
  id: string;
  opened_at: string;
  closed_at?: string | null;
  opening_amount: number;
  closing_amount?: number | null;
  operator_id: string;
  status: string; // ABERTO / FECHADO
}

export default function PDV() {
  const { profile, user } = useAuth();
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [linkedQuote, setLinkedQuote] = useState<Quote | null>(null);
  const [freight, setFreight] = useState<number>(0);
  const [products, setProducts] = useState<Array<{id:string; name:string; price:number}>>([]);
  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);
  const [clientDisplay, setClientDisplay] = useState<string>("1 - CONSUMIDOR FINAL");
  const [address, setAddress] = useState<string>("");
  const [vendor, setVendor] = useState<string>(profile?.first_name || "");
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<PDVItem[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [openCashDialog, setOpenCashDialog] = useState(false);
  const [cashOpeningValue, setCashOpeningValue] = useState('0');
  const [openCloseDialog, setOpenCloseDialog] = useState(false);
  const [cashClosingValue, setCashClosingValue] = useState('0');
  const [movementDialog, setMovementDialog] = useState<null | { type: 'SANGRIA' | 'SUPRIMENTO' }>(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const subtotal = useMemo(() => items.reduce((s,i)=> s + i.unitPrice * i.quantity,0), [items]);
  const totalDiscount = useMemo(()=> items.reduce((s,i)=> s + (i.discount||0),0), [items]);
  const grossTotal = subtotal;
  const netTotal = grossTotal - totalDiscount;
  const paid = payments.reduce((s,p)=> s + p.amount,0);
  const remaining = Math.max(0, netTotal - paid);
  const changeValue = paid > (netTotal + freight) ? (paid - (netTotal + freight)) : 0;
  const fmt = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  // Carrega produtos e sessão de caixa aberta
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('products').select('id,name,price').order('name');
        if (data) setProducts(data as Array<{id:string; name:string; price:number}>);
      } catch {/* ignore */}
      try {
        const sess = await getOpenSession(user?.id);
        if (sess) setCashSession(sess as CashSession);
      } catch {/* ignore */}
    })();
  }, [user]);

  // Status online/offline
  useEffect(() => {
    const handlerOnline = () => setIsOnline(true);
    const handlerOffline = () => setIsOnline(false);
    window.addEventListener('online', handlerOnline);
    window.addEventListener('offline', handlerOffline);
    return () => { window.removeEventListener('online', handlerOnline); window.removeEventListener('offline', handlerOffline); };
  }, []);

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
    const q = {
      id: data.id,
      number: data.number,
      createdAt: data.created_at,
      validityDays: data.validity_days,
      vendor: (data.vendor as unknown as { name:string; phone?:string; email?:string }) || { name:'', phone:'', email:'' },
      clientId: data.client_id,
      clientSnapshot: (data.client_snapshot as unknown as Client),
  items: data.items as Array<{ productId?:string; name:string; quantity:number; unitPrice:number }>,
      freight: data.freight || 0,
      paymentMethod: data.payment_method,
      paymentTerms: data.payment_terms,
      notes: data.notes || '',
      status: data.status || 'Rascunho',
      subtotal: data.subtotal || 0,
      total: data.total || 0,
      type: data.type,
    } as unknown as Quote;
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

  function onProductSearchChange(val: string) {
    setProductSearch(val);
    if (val.length >= 2) setShowSuggestions(true); else setShowSuggestions(false);
  }

  function handleBarcodeEnter(code: string) {
    const prod = products.find(p => p.id === code || p.id.endsWith(code));
    if (prod) {
      setCurrentProduct({ id: prod.id, name: prod.name });
      setUnitPrice(prod.price);
      setQuantity(1);
      addItem();
    } else {
      toast.error('Código não encontrado');
    }
  }

  async function finalizeSale() {
    if (items.length === 0) { toast.error('Sem itens'); return; }
    if (remaining > 0) { toast.error('Pagamento incompleto'); return; }
    if (!cashSession && payments.some(p => p.method === 'Dinheiro')) {
      toast.error('Abra o caixa para receber em dinheiro');
      return;
    }
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
      if (cashSession) {
        for (const p of payments) {
          if (p.method === 'Dinheiro') {
            await registerMovement(cashSession.id, 'VENDA', p.amount, `Venda ${saleNumber}`, undefined, user?.id);
          }
        }
      }
      toast.success('Venda finalizada');
      openSaleCupom({
        sale_number: payload.sale_number,
        items: payload.items.map(i=> ({ quantity: i.quantity, name: i.name, unitPrice: i.unitPrice, total: i.total })),
        subtotal: payload.subtotal,
        freight: payload.freight,
        discount: payload.discount,
        total: payload.total,
        payments: payload.payments.map(p=> ({ method: p.method, amount: p.amount }))
      });
      setItems([]); setPayments([]); setLinkedQuote(null); setOrderNumber('');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao finalizar venda');
    }
  }

  async function handleOpenCash() {
    try {
      const opening = parseFloat(cashOpeningValue.replace(',','.'))||0;
      const data = await openCashSession(profile?.company_id, user?.id, opening);
      setCashSession(data);
      toast.success('Caixa aberto');
      setOpenCashDialog(false);
    } catch { toast.error('Erro ao abrir caixa'); }
  }

  async function handleCloseCash() {
    if (!cashSession) return;
    try {
      const closing = parseFloat(cashClosingValue.replace(',','.'))||0;
      await closeCashSession(cashSession.id, closing);
      setCashSession(null);
      toast.success('Caixa fechado');
      setOpenCloseDialog(false);
    } catch { toast.error('Erro ao fechar caixa'); }
  }

  async function handleMovementSave() {
    if (!cashSession || !movementDialog) return;
    const value = parseFloat(movementAmount.replace(',','.'))||0;
    if (value <= 0) { toast.error('Valor inválido'); return; }
    try {
      await registerMovement(cashSession.id, movementDialog.type, movementDialog.type === 'SANGRIA' ? -Math.abs(value) : Math.abs(value), movementDesc || undefined, undefined, user?.id);
      toast.success('Movimento registrado');
      setMovementDialog(null); setMovementAmount(''); setMovementDesc('');
    } catch { toast.error('Erro ao registrar movimento'); }
  }

  interface SaleCupomItem { quantity:number; name:string; unitPrice:number; total:number }
  interface SaleCupomPayment { method:string; amount:number }
  interface SaleCupomData { sale_number:number|string; items:SaleCupomItem[]; subtotal:number; freight:number; discount:number; total:number; payments:SaleCupomPayment[] }
  function openSaleCupom(sale: SaleCupomData) {
    const companyName = 'Empresa';
    const issueDate = new Date().toLocaleDateString('pt-BR');
    const issueTime = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const discount = sale.discount || 0;
    const currency = (n:number)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>VENDA ${sale.sale_number}</title><style>
      @page { size:80mm auto; margin:4mm; }
      body { font-family:'Courier New',monospace; font-size:11px; }
      h1 { font-size:13px; text-align:center; margin:0 0 4px; }
      .center{text-align:center;} .line{border-top:1px dashed #000;margin:4px 0;} table{width:100%;border-collapse:collapse;} th,td{padding:2px 0;text-align:left;} th{font-size:10px;} .right{text-align:right;} .small{font-size:10px;} td.item{white-space:normal;word-break:break-word;max-width:30ch;}
    </style></head><body>
    <h1>${companyName}</h1>
  <div class='center small'>${profile?.company_id||''}</div>
    <div class='line'></div>
    <div class='small'><strong>VENDA:</strong> ${sale.sale_number}</div>
    <div class='small'>Data/Hora: ${issueDate} ${issueTime}</div>
    <div class='line'></div>
    <table><thead><tr><th style='width:4ch'>Qtd</th><th>Item</th><th class='right' style='width:7ch'>Vl Uni</th><th class='right' style='width:8ch'>Total</th></tr></thead><tbody>
  ${sale.items.map(it=>`<tr><td>${it.quantity}</td><td class='item'>${(it.name||'').toUpperCase()}</td><td class='right'>${currency(it.unitPrice)}</td><td class='right'>${currency(it.total)}</td></tr>`).join('')}
    </tbody></table>
    <div class='line'></div>
    <table>
      <tr><td>Subtotal</td><td class='right'>${currency(sale.subtotal)}</td></tr>
      <tr><td>Frete</td><td class='right'>${currency(sale.freight)}</td></tr>
      ${discount?`<tr><td>Desc.</td><td class='right'>-${currency(discount)}</td></tr>`:''}
      <tr><td><strong>Total</strong></td><td class='right'><strong>${currency(sale.total)}</strong></td></tr>
    </table>
    <div class='line'></div>
    <div class='small'><strong>Pagamentos:</strong></div>
  ${sale.payments.map(p=>`<div class='small'>${p.method}: ${currency(p.amount)}</div>`).join('')}
    <div class='line'></div>
    <div class='center small'>Obrigado pela preferência!</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),80);</script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=480');
    if (!w) { toast.error('Popup bloqueado'); return; }
    w.document.open(); w.document.write(html); w.document.close();
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
            <div className="flex items-center gap-1 relative">
              <Input value={productSearch} onChange={e=> onProductSearchChange(e.target.value)} onKeyDown={e=> { if(e.key==='Enter'){ const code = productSearch.trim(); if(/^[0-9]{5,}$/.test(code)) { handleBarcodeEnter(code); } else { addItem(); } }}} className="h-7" />
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={()=> addItem() }>➕</Button>
              {showSuggestions && (
                <div className="absolute top-full left-0 z-20 w-72 max-h-56 overflow-auto bg-white border shadow text-xs">
                  {products.filter(p=> p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.id.includes(productSearch)).slice(0,25).map(p=> (
                    <button key={p.id} type="button" className="w-full text-left px-2 py-1 hover:bg-slate-100 flex justify-between" onClick={()=> { setCurrentProduct({id:p.id,name:p.name}); setUnitPrice(p.price); setProductSearch(p.name); setShowSuggestions(false); }}>
                      <span className="truncate pr-2">{p.name}</span><span className="text-muted-foreground">{fmt(p.price)}</span>
                    </button>
                  ))}
                  {products.length===0 && <div className="px-2 py-1 text-muted-foreground">Sem produtos</div>}
                </div>
              )}
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
                      <td className="p-1 text-right">{fmt(it.unitPrice)}</td>
                      <td className="p-1 text-right">{fmt(it.discount||0)}</td>
                      <td className="p-1 text-right">{fmt(lineSubtotal - (it.discount||0))}</td>
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
                <div className="text-xl font-bold">{fmt(totalDiscount)}</div>
              </div>
              <div className="col-span-1">
                <div className="font-medium text-[11px] uppercase tracking-wide">Total Líquido</div>
                <div className="text-xl font-bold">{fmt(netTotal + freight)}</div>
              </div>
              <div className="col-span-3 flex justify-between items-center mt-4">
                <div className="flex flex-col items-start gap-0.5 text-[10px] text-muted-foreground">
                  <span>Operador: {profile?.first_name}</span>
                  <span>Caixa: {cashSession? 'Aberto':'Fechado'}</span>
                  <span>Conexão: {isOnline? 'Online':'Offline'}</span>
                </div>
                <div className="flex gap-2">
                  {!cashSession && <Button variant="outline" size="sm" onClick={()=> setOpenCashDialog(true)}>Abrir Caixa</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> setOpenCloseDialog(true)}>Fechar Caixa</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> setMovementDialog({type:'SANGRIA'})}>Sangria</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> setMovementDialog({type:'SUPRIMENTO'})}>Suprimento</Button>}
                  <Button size="lg" disabled={netTotal===0 || remaining>0} onClick={finalizeSale} className="bg-slate-800 hover:bg-slate-700">(F3) Finalizar Venda</Button>
                </div>
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
                    <td className="p-1 text-right">{fmt(p.amount)}</td>
                    <td className="p-1 text-center"><button onClick={()=> setPayments(prev=> prev.filter(x=> x.id!==p.id))} className="text-red-600 text-[10px]">rem</button></td>
                  </tr>)}
                  {payments.length===0 && <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Nenhum pagamento</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span>Total</span><span>{fmt(netTotal + freight)}</span></div>
              <div className="flex justify-between"><span>Pago</span><span>{fmt(paid)}</span></div>
              <div className="flex justify-between"><span>Restante</span><span>{fmt(remaining)}</span></div>
              <div className="flex justify-between col-span-2 font-semibold"><span>Troco</span><span>{fmt(changeValue)}</span></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Abrir Caixa */}
      <Dialog open={openCashDialog} onOpenChange={setOpenCashDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Valor Inicial</label>
              <Input value={cashOpeningValue} onChange={e=> setCashOpeningValue(e.target.value)} />
            </div>
            <Button onClick={handleOpenCash}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fechar Caixa */}
      <Dialog open={openCloseDialog} onOpenChange={setOpenCloseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Valor de Fechamento</label>
              <Input value={cashClosingValue} onChange={e=> setCashClosingValue(e.target.value)} />
            </div>
            <Button onClick={handleCloseCash}>Confirmar Fechamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movimento Caixa */}
      <Dialog open={!!movementDialog} onOpenChange={()=> setMovementDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{movementDialog?.type === 'SANGRIA' ? 'Sangria' : 'Suprimento'}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Valor</label>
              <Input value={movementAmount} onChange={e=> setMovementAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Input value={movementDesc} onChange={e=> setMovementDesc(e.target.value)} />
            </div>
            <Button onClick={handleMovementSave}>Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}