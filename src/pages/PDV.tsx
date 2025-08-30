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

type PaymentLine = { id: string; method: string; amount: number; description?: string; dueDays?: number; planned?: boolean };

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
  // clientDisplay agora armazena somente o nome; detalhes formatados renderizados abaixo
  const [clientDisplay, setClientDisplay] = useState<string>("CONSUMIDOR FINAL");
  const [clientTaxId, setClientTaxId] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [vendor, setVendor] = useState<string>(profile?.first_name || "");
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendors, setVendors] = useState<Array<{id:string; name:string; role:string}>>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<PDVItem[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  // Desconto extra (global) aplicado no orçamento que não está distribuído por item
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
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
  // Modo simplificado: não há mais verificação manual nem adição de parcelas

  const subtotal = useMemo(() => items.reduce((s,i)=> s + i.unitPrice * i.quantity,0), [items]);
  const totalDiscount = useMemo(()=> items.reduce((s,i)=> s + (i.discount||0),0) + extraDiscount, [items, extraDiscount]);
  const grossTotal = subtotal;
  const netTotal = grossTotal - totalDiscount;
  // Apenas pagamentos efetivos (não planejados) contam como pagos
  const paid = payments.filter(p=> !p.planned).reduce((s,p)=> s + p.amount,0);
  const referenceTotal = linkedQuote ? (linkedQuote.total || (netTotal + freight)) : (netTotal + freight);
  const remaining = Math.max(0, referenceTotal - paid);
  const changeValue = paid > referenceTotal ? (paid - referenceTotal) : 0;
  const fmt = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  // Parse das condições/parcelas (paymentPlan JSON vindo do Pedido)
  interface ParsedScheduleLine { id:string; label:string; amount:number; dueDays:number; }
  const parsedSchedule = useMemo<ParsedScheduleLine[]>(() => {
    if (!paymentPlan) return [];
    try {
      const obj = JSON.parse(paymentPlan);
      if (!obj || !Array.isArray(obj.items)) return [];
      const totalBase = linkedQuote?.total || (netTotal + freight);
      const lines: ParsedScheduleLine[] = [];
      let allocated = 0;
      for (const it of obj.items) {
        if (!it || !it.id) continue;
        if (it.kind === 'saldo') {
          const saldo = Math.max(0, totalBase - allocated);
          lines.push({ id: it.id, label: 'Saldo', amount: saldo, dueDays: it.dueDays || 0 });
          allocated += saldo;
          continue;
        }
        let amount = 0;
        if (it.valueType === 'percent') amount = totalBase * (it.value/100);
        else amount = it.value;
        amount = Math.max(0, amount);
        allocated += amount;
        const label = it.kind === 'entrada' ? 'Entrada' : `Parcela`;
        lines.push({ id: it.id, label, amount, dueDays: it.dueDays || 0 });
      }
      return lines;
    } catch { return []; }
  }, [paymentPlan, linkedQuote, netTotal, freight]);

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
  // Bloqueado conforme solicitação: itens somente via Pedido (orcamento convertido)
  toast.error('Inclusão manual de itens bloqueada. Carregue pelo número do Pedido.');
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i=> i.id!==id));
  }

  function applyDiscount(id: string, value: number) {
    setItems(prev => prev.map(i=> i.id===id ? { ...i, discount: value } : i));
  }

  function addPayment() { /* desativado */ toast.error('Ajuste de pagamento desativado. Use condições do Pedido.'); }

  function normalizeOrder(num: string){
    if(!num) return '';
    const cleaned = num.toUpperCase().replace(/^PED-/, '');
    return `PED-${cleaned}`;
  }

  async function loadQuoteByNumber(num: string) {
    if (!num) return;
    const full = normalizeOrder(num);
    const { data, error } = await supabase.from('quotes').select('*').eq('number', full).maybeSingle();
    if (error || !data) { toast.error('Pedido não encontrado'); return; }
    // Regras de elegibilidade: apenas TYPE=PEDIDO e status em lista branca
    const rawStatus = (data.status || '').toString().trim().toLowerCase();
    const rawType = (data.type || '').toString().trim().toUpperCase();
    const allowStatuses = ['aprovado','liberado','fechado','confirmado','pedido','finalizado'];
    const blockedStatuses = ['rascunho','digitacao','digitação','edicao','edição','aberto','em edição','em edicao'];
    if (rawType !== 'PEDIDO' || blockedStatuses.includes(rawStatus) || (!allowStatuses.includes(rawStatus) && rawStatus !== '')) {
      console.warn('PDV: Pedido bloqueado para carregamento', { number: full, status: data.status, type: data.type });
      toast.error('Pedido ainda em digitação/edição. Conclua e aprove antes de usar no PDV.');
      return;
    }
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
  // Preenche todos os campos de cliente conforme solicitado
  setClientDisplay(q.clientSnapshot.name || '');
  setClientTaxId(q.clientSnapshot.taxid || '');
  setClientPhone(q.clientSnapshot.phone || '');
  setClientEmail(q.clientSnapshot.email || '');
  setAddress(q.clientSnapshot.address || '');
    setVendor(q.vendor?.name || vendor);
    setFreight(q.freight || 0);
  const mappedItems = q.items.map(it => {
      const expectedSubtotal = it.unitPrice * it.quantity;
      const realSubtotal = (it as { subtotal?: number }).subtotal ?? expectedSubtotal; // QuoteItemSnapshot tem campo subtotal
      const discountValue = Math.max(0, expectedSubtotal - realSubtotal);
      return {
        id: it.productId || crypto.randomUUID(),
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: discountValue > 0.009 ? discountValue : 0,
      } as PDVItem;
  });
  setItems(mappedItems);
  // Desconto global do orçamento (diferença entre subtotal + frete e total final)
  const globalDiscount = (q.subtotal + q.freight) - q.total;
  setExtraDiscount(globalDiscount > 0.009 ? globalDiscount : 0);
    setPaymentPlan(q.paymentTerms || null);
    // Limpa pagamentos existentes e define método igual ao do Pedido
    const mapMethod = (m?: string): string => {
      if (!m) return 'Dinheiro';
      const t = m.toLowerCase();
      if (t.includes('crédit')) return 'Cartão Crédito';
      if (t.includes('débit')) return 'Cartão Débito';
      if (t.includes('pix')) return 'Pix';
      if (t.includes('boleto')) return 'Boleto';
      if (t.includes('voucher')) return 'Voucher';
      if (t.includes('din')) return 'Dinheiro';
      return 'Dinheiro';
    };
    const mapped = mapMethod(data.payment_method as string | undefined);
    setPaymentMethod(mapped);
  const schedulePayments: PaymentLine[] = [];
    try {
      if (q.paymentTerms) {
        type SItem = { id:string; kind:'entrada'|'parcela'|'saldo'; valueType:'percent'|'fixed'; value:number; dueDays?:number };
        const obj = JSON.parse(q.paymentTerms);
        const arr: SItem[] = obj?.items || [];
        if (Array.isArray(arr) && arr.length>0) {
          const totalBase = q.total || 0;
          let allocated = 0;
          let seq = 1;
          for (const it of arr) {
            let amount = 0;
            if (it.kind === 'saldo') amount = Math.max(0, totalBase - allocated);
            else if (it.valueType === 'percent') amount = totalBase * (it.value/100);
            else amount = it.value;
            amount = Math.max(0, amount);
            allocated += amount;
            let label: string;
            if (it.kind === 'entrada') label = 'Entrada';
            else if (it.kind === 'saldo') label = 'Saldo';
            else { label = `Parcela ${seq}`; seq++; }
            schedulePayments.push({ id: crypto.randomUUID(), method: mapped, amount, description: label, dueDays: it.dueDays || 0, planned: true });
          }
        }
      }
    } catch {/* ignore */}
    if (schedulePayments.length === 0) {
      const totalPedido = (q.total || 0);
      if (totalPedido > 0) schedulePayments.push({ id: crypto.randomUUID(), method: mapped, amount: totalPedido, description: 'Único', planned: true });
    }
  setPayments(schedulePayments);
  toast.success('Pedido carregado');
  }

  function onProductSearchChange(val: string) {
    setProductSearch(val);
    if (val.length >= 2) setShowSuggestions(true); else setShowSuggestions(false);
  }

  function handleBarcodeEnter(code: string) {
  // Bloqueado: não permitir adicionar via código de barras
  toast.error('Leitura de código bloqueada. Use o número do Pedido.');
  }

  async function openVendorPicker() {
    setShowVendorDialog(true);
    if (vendors.length === 0) {
      setLoadingVendors(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, role, company_id')
          .eq('company_id', profile?.company_id || '');
        if (!error && data) {
          setVendors(data.map(p => ({ id: p.id, name: p.first_name || 'Sem nome', role: p.role })));
        }
      } catch {/* ignore */} finally { setLoadingVendors(false); }
    }
  }

  const filteredVendors = vendors.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()) || v.role.toLowerCase().includes(vendorSearch.toLowerCase()));

  async function finalizeSale() {
    if (items.length === 0) { toast.error('Sem itens'); return; }
    // Agora permite finalizar sem receber entrada; status será calculado
    if (!cashSession && payments.some(p => p.method === 'Dinheiro' && !p.planned)) {
      toast.error('Abra o caixa para receber em dinheiro');
      return;
    }
    try {
      const saleNumber = await nextSaleNumber();
      const payload = {
        sale_number: saleNumber,
        quote_id: linkedQuote?.id || null,
        client_snapshot: linkedQuote?.clientSnapshot || { name: clientDisplay, id: 'consumidor-final', taxid: clientTaxId, phone: clientPhone, email: clientEmail, address },
        vendor: linkedQuote?.vendor || { name: vendor, phone: '', email: '' },
        operator_id: user?.id,
        items: items.map(i => ({ ...i, total: i.quantity * i.unitPrice - (i.discount || 0) })),
        payments: payments,
        payment_plan: paymentPlan,
        subtotal: subtotal,
        discount: totalDiscount,
        freight: freight,
  total: referenceTotal,
  status: 'FINALIZADA',
  payment_status: remaining <= 0.009 ? 'PAGO' : 'PARCIAL',
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
  setItems([]); setPayments([]); setLinkedQuote(null); setOrderNumber(''); setExtraDiscount(0);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao finalizar venda');
    }
  }

  // Fluxo de verificação removido

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
              <div className="flex h-7 w-full">
                <span className="inline-flex items-center px-2 border border-r-0 rounded-l text-[11px] bg-slate-100 font-semibold">PED-</span>
                <Input value={orderNumber} placeholder="" onChange={e=> setOrderNumber(e.target.value.replace(/[^0-9]/g,''))} onKeyDown={e=> { if(e.key==='Enter'){ loadQuoteByNumber(orderNumber); }}} className="h-7 text-right rounded-l-none" />
              </div>
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={()=> loadQuoteByNumber(orderNumber)}>🔍</Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Cliente:</label>
            <div className="flex items-center gap-1">
              <Input value={clientDisplay} disabled className="h-7 font-semibold" />
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs" disabled>🔍</Button>
            </div>
            {/* Bloco informativo com todos os dados do cliente */}
            <div className="mt-1 text-[11px] leading-tight border rounded p-2 bg-slate-50">
              <div><span className="font-semibold">Cliente:</span> {clientDisplay || '-'} </div>
              {clientTaxId && <div>CNPJ/CPF: {clientTaxId}</div>}
              {clientPhone && <div>Telefone: {clientPhone}</div>}
              {clientEmail && <div>Email: {clientEmail}</div>}
              {address && <div className="truncate" title={address}>Endereço: {address}</div>}
              {(!clientTaxId && !clientPhone && !clientEmail && !address) && <div className="text-muted-foreground">Dados adicionais não informados</div>}
            </div>
          </div>
          {/* Removido bloco de endereço duplicado; informações já mostradas no painel de cliente */}
          <div>
            <label className="text-xs font-medium">Vendedor:</label>
            <div className="flex items-center gap-1">
              <Input value={vendor} disabled={!!linkedQuote} onChange={e=> setVendor(e.target.value)} className="h-7" title={linkedQuote? 'Vendedor definido pelo Pedido' : 'Editar vendedor'} />
              <Button type="button" onClick={openVendorPicker} variant="outline" size="icon" className="h-7 w-7 text-xs" disabled={!!linkedQuote} title={linkedQuote? 'Vendedor não pode ser alterado' : 'Pesquisar vendedores'}>🔍</Button>
            </div>
          </div>
          <div className="p-2 border rounded bg-slate-50 text-[11px] leading-snug">
            <div className="font-semibold text-slate-700">Itens somente via Pedido</div>
            <div className="text-slate-600">Informe o número do Pedido acima e pressione a lupa ou ENTER. A inclusão manual de produtos está desativada.</div>
          </div>
        </div>{/* fim coluna esquerda */}
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
                {extraDiscount>0 && <div className="text-[10px] text-red-700 mt-0.5">Global: {fmt(extraDiscount)}</div>}
              </div>
              <div className="col-span-1">
                <div className="font-medium text-[11px] uppercase tracking-wide">Total Líquido</div>
                <div className="text-xl font-bold">{fmt(referenceTotal)}</div>
              </div>
              <div className="col-span-3 flex justify-between items-center mt-4">
                <div className="flex flex-col items-start gap-0.5 text-[10px] text-muted-foreground">
                  <span>Operador: {profile?.first_name}</span>
                  <span>Caixa: {cashSession? 'Aberto':'Fechado'}</span>
                  <span>Conexão: {isOnline? 'Online':'Offline'}</span>
                </div>
                <div className="flex gap-2">
                  {!cashSession && <Button variant="outline" size="sm" onClick={()=> { setOpenCashDialog(true); }}>Abrir Caixa</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> { setOpenCloseDialog(true); }}>Fechar Caixa</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> { setMovementDialog({type:'SANGRIA'}); }}>Sangria</Button>}
                  {cashSession && <Button variant="outline" size="sm" onClick={()=> { setMovementDialog({type:'SUPRIMENTO'}); }}>Suprimento</Button>}
                  <Button size="lg" disabled={referenceTotal===0 || items.length===0} onClick={finalizeSale} className="bg-slate-800 hover:bg-slate-700">(F3) Finalizar Venda</Button>
                </div>
              </div>
              {parsedSchedule.length>0 && (
                <div className="col-span-3 mt-2">
                  <div className="font-medium text-[11px] uppercase tracking-wide">Condições</div>
                  <div className="mt-1 max-h-28 overflow-auto pr-1 space-y-0.5 text-[11px] leading-tight">
                    {parsedSchedule.map((l,idx)=> (
                      <div key={l.id} className="flex justify-between gap-2">
                        <span className="truncate">{idx+1}. {l.label}{l.dueDays?` D+${l.dueDays}`:''}</span>
                        <span className="font-medium">{fmt(l.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-0.5 border-t border-slate-300/40 font-semibold">
                      <span>Total Cond.</span>
                      <span>{fmt(parsedSchedule.reduce((s,l)=> s + l.amount,0))}</span>
                    </div>
                  </div>
                </div>
              )}
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
            {/* As parcelas planejadas aparecem como linhas "planejadas" abaixo */}
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
                  {payments.map(p=> <tr key={p.id} className={p.planned? 'opacity-90':''}>
                    <td className="p-1 align-top">
                      <div className="flex flex-col">
                        <span>{p.method}</span>
                        {p.description && <span className="text-[10px] text-muted-foreground">{p.description}{p.dueDays?` (${p.dueDays}d)`:''}{p.planned? ' • planejado':''}</span>}
                      </div>
                    </td>
                    <td className="p-1 text-right align-top">{fmt(p.amount)}</td>
                    <td className="p-1 text-center align-top">
                      {!p.planned && (
                        <button
                          onClick={()=> setPayments(prev=> prev.filter(x=> x.id!==p.id))}
                          className="text-red-600 text-xs font-bold hover:scale-110 transition"
                          aria-label="Remover"
                          title="Remover"
                        >✕</button>
                      )}
                    </td>
                  </tr>)}
                  {payments.length===0 && <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Nenhum pagamento</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 text-xs border-t pt-2">
              <div className="flex justify-between"><span>Total</span><span>{fmt(referenceTotal)}</span></div>
              <div className="flex justify-between"><span>Pago</span><span>{fmt(paid)}</span></div>
              <div className="flex justify-between"><span>Restante</span><span>{fmt(remaining)}</span></div>
              <div className="flex justify-between font-semibold"><span>Troco</span><span>{fmt(changeValue)}</span></div>
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

      {/* Selecionar Vendedor */}
      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Selecionar Vendedor</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <Input placeholder="Pesquisar..." value={vendorSearch} onChange={e=> setVendorSearch(e.target.value)} />
            <div className="border rounded max-h-72 overflow-auto divide-y">
              {loadingVendors && <div className="p-3 text-xs text-muted-foreground">Carregando...</div>}
              {!loadingVendors && filteredVendors.map(v => (
                <button key={v.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-100 flex justify-between items-center" onClick={()=> { setVendor(v.name); setShowVendorDialog(false); }}>
                  <span className="truncate font-medium">{v.name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{v.role}</span>
                </button>
              ))}
              {!loadingVendors && filteredVendors.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Nenhum vendedor</div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={()=> setShowVendorDialog(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}