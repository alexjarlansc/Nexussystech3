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
  // Boletos
  interface Boleto { id:string; numero:string; nossoNumero:string; vencimento:string; valor:number; linhaDigitavel:string; status:'PENDENTE'|'EMITIDO'; jurosPercent:number; multaPercent:number; instructions:string; }
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [boletoJuros, setBoletoJuros] = useState('1.00'); // % ao mês
  const [boletoMulta, setBoletoMulta] = useState('2.00'); // % após vencimento
  const [boletoInstr, setBoletoInstr] = useState('Após vencimento cobrar multa e juros. Não receber após 30 dias.');
  const [openBoletoDialog, setOpenBoletoDialog] = useState(false);
  // NF-e
  // Tipos NF-e simplificados
  interface NFeItem { nItem:number; descricao:string; quantidade:number; vUnit:number; vDesc:number; vTotal:number; cfop:string; cst:string; ncm:string; unidade:string; aliqIcms:number; aliqIpi:number; aliqPis:number; aliqCofins:number; vIcms:number; vIpi:number; vPis:number; vCofins:number; }
  interface NFeParty { nome:string; cnpj?:string; doc?:string; }
  type RegimeTributario = 'NORMAL' | 'SIMPLES';
  interface NFeDraft { numero:string; naturezaOperacao:string; serie:string; modelo:string; dataEmissao:string; regime:RegimeTributario; emitente:NFeParty; destinatario:NFeParty & { endereco?:string; municipio?:string; uf?:string; cep?:string }; itens:NFeItem[]; totais:{ vProdutos:number; vFrete:number; vNF:number; vIcms:number; vIpi:number; vPis:number; vCofins:number }; }
  const [openNfeDialog, setOpenNfeDialog] = useState(false);
  const [nfeDraft, setNfeDraft] = useState<NFeDraft | null>(null);
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

  function gerarBoletos(){
    if(!linkedQuote){ toast.error('Carregue um Pedido primeiro'); return; }
    const baseDate = linkedQuote.createdAt ? new Date(linkedQuote.createdAt) : new Date();
    const list: Boleto[] = [];
    const schedule = parsedSchedule; // já calculado
    const totalBase = linkedQuote.total || referenceTotal;
    const pad = (n:number,len:number)=> n.toString().padStart(len,'0');
    const randDigits = (q:number)=> Array.from({length:q},()=> Math.floor(Math.random()*10)).join('');
    const jp = parseFloat(boletoJuros.replace(',','.'))||0;
    const mp = parseFloat(boletoMulta.replace(',','.'))||0;
    if(schedule.length>0){
      schedule.forEach((s,idx)=> {
        const due = new Date(baseDate.getTime());
        due.setDate(due.getDate() + (s.dueDays||0));
        const valor = +(s.amount.toFixed(2));
        const nossoNumero = pad(idx+1,8)+randDigits(4);
        const linha = '0019'+randDigits(41); // placeholder 47 digitos
        list.push({ id: crypto.randomUUID(), numero: `${linkedQuote.number}-${idx+1}`, nossoNumero, vencimento: due.toISOString().slice(0,10), valor, linhaDigitavel: linha.slice(0,47), status:'PENDENTE', jurosPercent: jp, multaPercent: mp, instructions: boletoInstr });
      });
    } else {
      const due = new Date(baseDate.getTime()); due.setDate(due.getDate()+5);
      const nossoNumero = '00000001'+randDigits(4);
      const linha = '0019'+randDigits(41);
      list.push({ id: crypto.randomUUID(), numero: `${linkedQuote.number}-1`, nossoNumero, vencimento: due.toISOString().slice(0,10), valor: +(totalBase.toFixed(2)), linhaDigitavel: linha.slice(0,47), status:'PENDENTE', jurosPercent: jp, multaPercent: mp, instructions: boletoInstr });
    }
    setBoletos(list);
    setOpenBoletoDialog(true);
  }

  function exportBoletos(){
    if(boletos.length===0){ toast.error('Nenhum boleto'); return; }
    const blob = new Blob([JSON.stringify({ pedido: linkedQuote?.number, boletos },null,2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${linkedQuote?.number||'PED'}-boletos.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  function marcarEmitido(id:string){
    setBoletos(prev=> prev.map(b=> b.id===id? {...b, status:'EMITIDO'}: b));
  }

  function aplicarConfigBoletos(){
    const jp = parseFloat(boletoJuros.replace(',','.'))||0;
    const mp = parseFloat(boletoMulta.replace(',','.'))||0;
    setBoletos(prev=> prev.map(b=> ({...b, jurosPercent: jp, multaPercent: mp, instructions: boletoInstr })));
  }

  function imprimirBoletos(){
    if(boletos.length===0){ toast.error('Nenhum boleto'); return; }
    const currency = (n:number)=> n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const today = new Date().toLocaleDateString('pt-BR');
    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Boletos ${linkedQuote?.number||''}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;margin:16px;} h1{font-size:18px;margin:0 0 12px;} .boleto{border:1px solid #000;padding:8px;margin-bottom:18px;}
      .linha{font-size:11px;word-break:break-all;} table{width:100%;border-collapse:collapse;font-size:12px;} td{padding:2px 4px;} .top td{font-size:11px;} .small{font-size:10px;color:#555;}
      .right{text-align:right;} .title{font-weight:600;font-size:12px;text-transform:uppercase;margin-top:8px;}
    </style></head><body><h1>Boletos (Rascunho) - ${linkedQuote?.number||''}</h1>
      ${boletos.map(b=>`<div class='boleto'>
        <table class='top'><tr><td><strong>Nosso Nº:</strong> ${b.nossoNumero}</td><td><strong>Parcela:</strong> ${b.numero.split('-').pop()}</td><td><strong>Vencimento:</strong> ${new Date(b.vencimento).toLocaleDateString('pt-BR')}</td><td class='right'><strong>Valor:</strong> ${currency(b.valor)}</td></tr></table>
        <div class='linha'><strong>Linha Digitável:</strong> ${b.linhaDigitavel}</div>
        <div class='title'>Sacado</div>
        <div class='small'>${linkedQuote?.clientSnapshot.name||''} • ${linkedQuote?.clientSnapshot.taxid||''}</div>
        <div class='title'>Instruções</div>
        <div class='small'>${b.instructions} | Juros: ${b.jurosPercent.toFixed(2)}% a.m. Multa: ${b.multaPercent.toFixed(2)}%</div>
        <div class='small'>Emitido em ${today} - Status: ${b.status}</div>
      </div>`).join('')}
      <script>window.onload=()=>setTimeout(()=>window.print(),150);</script>
    </body></html>`;
    const w = window.open('', '_blank','width=900');
    if(!w){ toast.error('Popup bloqueado'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function buildNfeDraft(){
    if(!linkedQuote){ toast.error('Carregue um Pedido primeiro'); return; }
    if(items.length===0){ toast.error('Sem itens para NF-e'); return; }
    const now = new Date();
    const num = 'NFe' + now.toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
    const emit: NFeParty = {
      nome: profile?.first_name || 'Emitente',
      // TODO: Recuperar CNPJ real da empresa (ex: tabela companies). Placeholder usado.
      cnpj: '00000000000000',
    };
    const dest = {
      nome: linkedQuote.clientSnapshot.name,
      doc: linkedQuote.clientSnapshot.taxid || 'ISENTO'
    };
    const itens: NFeItem[] = items.map((i,idx)=> {
      const vTotal = (i.unitPrice*i.quantity) - (i.discount||0);
      const aliqIcms = 18; const aliqIpi = 0; const aliqPis = 1.65; const aliqCofins = 7.6;
      const base = vTotal; // simplificação
      const vIcms = +(base * aliqIcms/100).toFixed(2);
      const vIpi = +(base * aliqIpi/100).toFixed(2);
      const vPis = +(base * aliqPis/100).toFixed(2);
      const vCofins = +(base * aliqCofins/100).toFixed(2);
      return {
        nItem: idx+1,
        descricao: i.name,
        quantidade: i.quantity,
        vUnit: i.unitPrice,
        vDesc: i.discount||0,
        vTotal,
        cfop: '5102',
        cst: '00',
        ncm: '00000000',
        unidade: 'UN',
        aliqIcms, aliqIpi, aliqPis, aliqCofins,
        vIcms, vIpi, vPis, vCofins
      };
    });
  const totalProdutos = itens.reduce((s,it)=> s + it.vTotal,0);
  const totIcms = itens.reduce((s,it)=> s + it.vIcms,0);
  const totIpi = itens.reduce((s,it)=> s + it.vIpi,0);
  const totPis = itens.reduce((s,it)=> s + it.vPis,0);
  const totCofins = itens.reduce((s,it)=> s + it.vCofins,0);
    const freightV = freight || 0;
    const draft: NFeDraft = {
      numero: num,
      naturezaOperacao: 'VENDA',
      serie: '1',
      modelo: '55',
      dataEmissao: now.toISOString(),
      regime: 'NORMAL',
      emitente: emit,
      destinatario: dest,
      itens,
      totais: {
        vProdutos: totalProdutos,
        vFrete: freightV,
        vNF: totalProdutos + freightV, // sem impostos destacados
        vIcms: totIcms,
        vIpi: totIpi,
        vPis: totPis,
        vCofins: totCofins
      }
    };
    setNfeDraft(draft);
    setOpenNfeDialog(true);
  }

  function updateNfeField(path: string, value: unknown){
    setNfeDraft(prev => {
      if(!prev) return prev;
      const clone: NFeDraft = { ...prev };
      const parts = path.split('.');
      type AnyRec = Record<string, unknown>;
      let ref: AnyRec = clone as unknown as AnyRec;
      for(let i=0;i<parts.length-1;i++){
        const p = parts[i];
        const current = ref[p];
        if(typeof current !== 'object' || current === null){
          ref[p] = {};
        }
        ref = ref[p] as AnyRec;
      }
      ref[parts[parts.length-1]] = value;
      return { ...clone };
    });
  }

  function recomputeTotals(d: NFeDraft){
    const vProdutos = d.itens.reduce((s,i)=> s + i.vTotal,0);
    const vIcms = d.itens.reduce((s,i)=> s + i.vIcms,0);
    const vIpi = d.itens.reduce((s,i)=> s + i.vIpi,0);
    const vPis = d.itens.reduce((s,i)=> s + i.vPis,0);
    const vCofins = d.itens.reduce((s,i)=> s + i.vCofins,0);
    d.totais.vProdutos = +vProdutos.toFixed(2);
    d.totais.vIcms = +vIcms.toFixed(2);
    d.totais.vIpi = +vIpi.toFixed(2);
    d.totais.vPis = +vPis.toFixed(2);
    d.totais.vCofins = +vCofins.toFixed(2);
    d.totais.vNF = +(d.totais.vProdutos + d.totais.vFrete).toFixed(2); // simplificação
  }

  function updateItemField(nItem:number, field:keyof NFeItem, value:string){
    setNfeDraft(prev => {
      if(!prev) return prev;
      const clone: NFeDraft = { ...prev, itens: prev.itens.map(i=> ({...i})) };
      const item = clone.itens.find(i=> i.nItem===nItem);
      if(item){
        if(field === 'aliqIcms') item.aliqIcms = parseFloat(value)||0;
        else if(field === 'aliqIpi') item.aliqIpi = parseFloat(value)||0;
        else if(field === 'aliqPis') item.aliqPis = parseFloat(value)||0;
        else if(field === 'aliqCofins') item.aliqCofins = parseFloat(value)||0;
        else if(field === 'quantidade') item.quantidade = parseFloat(value)||0;
        else if(field === 'vUnit') item.vUnit = parseFloat(value)||0;
        else if(field === 'vDesc') item.vDesc = parseFloat(value)||0;
        else if(field === 'ncm') item.ncm = value;
        else if(field === 'cfop') item.cfop = value;
        else if(field === 'cst') item.cst = value;
        else if(field === 'descricao') item.descricao = value;
        // campos calculados ou não editados ignorados
        // recalcula valores
        item.vTotal = +(item.quantidade * item.vUnit - item.vDesc).toFixed(2);
        const base = item.vTotal;
        item.vIcms = +(base * item.aliqIcms/100).toFixed(2);
        item.vIpi = +(base * item.aliqIpi/100).toFixed(2);
        item.vPis = +(base * item.aliqPis/100).toFixed(2);
        item.vCofins = +(base * item.aliqCofins/100).toFixed(2);
        recomputeTotals(clone);
      }
      return clone;
    });
  }

  function exportNfe(){
    if(!nfeDraft){ toast.error('Nada para exportar'); return; }
    const blob = new Blob([JSON.stringify(nfeDraft,null,2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nfeDraft.numero + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportNfeXml(){
    if(!nfeDraft){ toast.error('Nada para exportar'); return; }
    const esc = (v:string)=> (v||'').replace(/[<&>]/g,ch=> ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]!));
    const d = nfeDraft;
    const xmlParts: string[] = [];
    xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlParts.push('<NFe>');
    xmlParts.push(`<infNFe versao="4.00" Id="UNSIGNED">`);
    xmlParts.push(`<ide><natOp>${esc(d.naturezaOperacao)}</natOp><mod>${d.modelo}</mod><serie>${d.serie}</serie><nNF>${esc(d.numero)}</nNF><dhEmi>${d.dataEmissao}</dhEmi><tpNF>1</tpNF><tpAmb>2</tpAmb></ide>`);
    xmlParts.push(`<emit><xNome>${esc(d.emitente.nome)}</xNome><CNPJ>${d.emitente.cnpj||''}</CNPJ></emit>`);
    xmlParts.push(`<dest><xNome>${esc(d.destinatario.nome)}</xNome>${d.destinatario.doc?`<CPF>${esc(d.destinatario.doc)}</CPF>`:''}</dest>`);
    d.itens.forEach(it => {
      xmlParts.push(`<det nItem="${it.nItem}"><prod><cProd>${it.nItem}</cProd><xProd>${esc(it.descricao)}</xProd><NCM>${it.ncm}</NCM><CFOP>${it.cfop}</CFOP><uCom>${it.unidade}</uCom><qCom>${it.quantidade.toFixed(2)}</qCom><vUnCom>${it.vUnit.toFixed(2)}</vUnCom><vProd>${it.vTotal.toFixed(2)}</vProd></prod>`);
      if(d.regime==='SIMPLES'){
        xmlParts.push(`<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>${it.cst}</CSOSN></ICMSSN102></ICMS></imposto>`);
      } else {
        xmlParts.push(`<imposto><ICMS><ICMS00><orig>0</orig><CST>${it.cst}</CST><pICMS>${it.aliqIcms.toFixed(2)}</pICMS><vICMS>${it.vIcms.toFixed(2)}</vICMS></ICMS00></ICMS></imposto>`);
      }
      xmlParts.push('</det>');
    });
    xmlParts.push(`<total><ICMSTot><vProd>${d.totais.vProdutos.toFixed(2)}</vProd><vFrete>${d.totais.vFrete.toFixed(2)}</vFrete><vICMS>${d.totais.vIcms.toFixed(2)}</vICMS></ICMSTot></total>`);
    xmlParts.push('</infNFe></NFe>');
    const xml = xmlParts.join('');
    const blob = new Blob([xml], { type:'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = d.numero + '.xml';
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
    // Aceitar variações masculinas/femininas e diferentes sufixos
    const blockedStatuses = ['rascunho','digitacao','digitação','edicao','edição','aberto','em edição','em edicao'];
    const shouldBlock = (
      rawType !== 'PEDIDO' ||
      blockedStatuses.includes(rawStatus)
    );
    if (shouldBlock) {
      console.warn('PDV: Pedido bloqueado para carregamento', { number: full, status: data.status, type: data.type });
      let vendorName = '';
      try {
        const v = data.vendor as unknown as { name?: string } | null;
        vendorName = v?.name ? v.name.trim() : '';
      } catch { /* ignore */ }
      const baseMsg = 'Pedido ainda em digitação/edição.';
      if (vendorName) {
        toast.error(`${baseMsg} Consulte o vendedor: ${vendorName}.`);
      } else {
        toast.error(baseMsg);
      }
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
              <Button variant="outline" size="sm" onClick={gerarBoletos}>Gerar Boletos</Button>
              <Button variant="outline" size="sm" onClick={buildNfeDraft}>Gerar NFe</Button>
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

      {/* NF-e Draft Dialog */}
      <Dialog open={openNfeDialog} onOpenChange={setOpenNfeDialog}>
        <DialogContent className="sm:max-w-[1200px] w-full max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerar NF-e (Rascunho)</DialogTitle></DialogHeader>
          {!nfeDraft && <div className="text-sm text-muted-foreground">Sem dados.</div>}
          {nfeDraft && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium uppercase">Número</label>
                  <Input value={nfeDraft.numero} onChange={e=> updateNfeField('numero', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Natureza</label>
                  <Input value={nfeDraft.naturezaOperacao} onChange={e=> updateNfeField('naturezaOperacao', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Série</label>
                  <Input value={nfeDraft.serie} onChange={e=> updateNfeField('serie', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Modelo</label>
                  <Input value={nfeDraft.modelo} onChange={e=> updateNfeField('modelo', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Regime</label>
                  <select value={nfeDraft.regime} onChange={e=> {
                    const val = e.target.value as RegimeTributario;
                    updateNfeField('regime', val);
                    // ajustar códigos padrão
                    setNfeDraft(prev => {
                      if(!prev) return prev;
                      const clone: NFeDraft = { ...prev, itens: prev.itens.map(i=> ({...i, cst: val==='SIMPLES' ? (i.cst.length===2? '102': i.cst): (i.cst.length===3? '00': i.cst) })) };
                      return clone;
                    });
                  }} className="h-8 text-sm border rounded w-full bg-white px-2">
                    <option value="NORMAL">Normal</option>
                    <option value="SIMPLES">Simples</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium uppercase">Emitente</label>
                  <Input value={nfeDraft.emitente.nome} onChange={e=> updateNfeField('emitente.nome', e.target.value)} className="h-8 text-sm" />
                  <Input value={nfeDraft.emitente.cnpj} onChange={e=> updateNfeField('emitente.cnpj', e.target.value)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Destinatário</label>
                  <Input value={nfeDraft.destinatario.nome} onChange={e=> updateNfeField('destinatario.nome', e.target.value)} className="h-8 text-sm" />
                  <Input value={nfeDraft.destinatario.doc} onChange={e=> updateNfeField('destinatario.doc', e.target.value)} placeholder="CPF/CNPJ" className="h-8 text-sm mt-1" />
                  <Input value={nfeDraft.destinatario.endereco||''} onChange={e=> updateNfeField('destinatario.endereco', e.target.value)} placeholder="Endereço" className="h-8 text-sm mt-1" />
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    <Input value={nfeDraft.destinatario.municipio||''} onChange={e=> updateNfeField('destinatario.municipio', e.target.value)} placeholder="Município" className="h-8 text-xs" />
                    <Input value={nfeDraft.destinatario.uf||''} onChange={e=> updateNfeField('destinatario.uf', e.target.value)} placeholder="UF" className="h-8 text-xs" />
                    <Input value={nfeDraft.destinatario.cep||''} onChange={e=> updateNfeField('destinatario.cep', e.target.value)} placeholder="CEP" className="h-8 text-xs" />
                  </div>
                </div>
              </div>
              <div>
                <div className="font-medium text-[11px] uppercase mb-1">Itens (campos fiscais editáveis)</div>
                <table className="w-full text-[11px] border min-w-[900px] overflow-x-auto">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="p-1 text-left">#</th>
                      <th className="p-1 text-left">Descrição</th>
                      <th className="p-1 text-left">NCM</th>
                      <th className="p-1 text-left">CFOP</th>
                      <th className="p-1 text-left">CST</th>
                      <th className="p-1 text-right">Qtd</th>
                      <th className="p-1 text-right">V.Unit</th>
                      <th className="p-1 text-right">Desc</th>
                      <th className="p-1 text-right">Aliq ICMS</th>
                      <th className="p-1 text-right">ICMS</th>
                      <th className="p-1 text-right">PIS</th>
                      <th className="p-1 text-right">COFINS</th>
                      <th className="p-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfeDraft.itens.map((it)=> (
                      <tr key={it.nItem} className="odd:bg-white even:bg-slate-50 align-top">
                        <td className="p-1 align-middle text-center text-[11px] font-medium">{it.nItem}</td>
                        <td className="p-1 truncate max-w-[320px]" title={it.descricao}>{it.descricao}</td>
                        <td className="p-1 w-24"><Input value={it.ncm} onChange={e=> updateItemField(it.nItem,'ncm', e.target.value)} className="h-7 px-1 text-[11px] font-mono tracking-tight" /></td>
                        <td className="p-1 w-16"><Input value={it.cfop} onChange={e=> updateItemField(it.nItem,'cfop', e.target.value)} className="h-7 px-1 text-[11px] font-mono tracking-tight" /></td>
                        <td className="p-1 w-14"><Input value={it.cst} onChange={e=> updateItemField(it.nItem,'cst', e.target.value)} className="h-7 px-1 text-[11px] font-mono tracking-tight" /></td>
                        <td className="p-1 w-16"><Input value={it.quantidade.toString()} onChange={e=> updateItemField(it.nItem,'quantidade', e.target.value)} className="h-7 px-1 text-[11px] text-right font-mono tabular-nums" /></td>
                        <td className="p-1 w-24"><Input value={it.vUnit.toString()} onChange={e=> updateItemField(it.nItem,'vUnit', e.target.value)} className="h-7 px-1 text-[11px] text-right font-mono tabular-nums" /></td>
                        <td className="p-1 w-20"><Input value={it.vDesc.toString()} onChange={e=> updateItemField(it.nItem,'vDesc', e.target.value)} className="h-7 px-1 text-[11px] text-right font-mono tabular-nums" /></td>
                        <td className="p-1 w-24"><Input value={it.aliqIcms.toString()} onChange={e=> updateItemField(it.nItem,'aliqIcms', e.target.value)} className="h-7 px-1 text-[11px] text-right font-mono tabular-nums" /></td>
                        <td className="p-1 text-right whitespace-nowrap font-mono tabular-nums">{fmt(it.vIcms)}</td>
                        <td className="p-1 text-right whitespace-nowrap font-mono tabular-nums">{fmt(it.vPis)}</td>
                        <td className="p-1 text-right whitespace-nowrap font-mono tabular-nums">{fmt(it.vCofins)}</td>
                        <td className="p-1 text-right font-medium font-mono tabular-nums">{fmt(it.vTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <div>Produtos: {fmt(nfeDraft.totais.vProdutos)}</div>
                  <div>Frete: {fmt(nfeDraft.totais.vFrete)}</div>
                  <div>ICMS: {fmt(nfeDraft.totais.vIcms)}</div>
                  <div>PIS/COFINS: {fmt(nfeDraft.totais.vPis + nfeDraft.totais.vCofins)}</div>
                  <div className="font-semibold">Total NF (simpl.): {fmt(nfeDraft.totais.vNF)}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={()=> exportNfe()}>Exportar JSON</Button>
                  <Button variant="outline" onClick={()=> exportNfeXml()}>Exportar XML</Button>
                  <Button disabled title="Implementar envio SEFAZ futuramente">Transmitir</Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">
                Rascunho simplificado. Próximos: validação NCM/CFOP, CSOSN/CST corretos, ST, DIFAL, XML completo (protNFe, assinatura), contingência (EPEC/FS-DA) e transmissão SEFAZ. Alíquotas e bases meramente ilustrativas.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Boletos Dialog */}
      <Dialog open={openBoletoDialog} onOpenChange={setOpenBoletoDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Boletos do Pedido</DialogTitle></DialogHeader>
          {boletos.length===0 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Nenhum boleto gerado.</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="text-[11px] font-medium uppercase">Juros % mês</label>
                  <Input value={boletoJuros} onChange={e=> setBoletoJuros(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Multa %</label>
                  <Input value={boletoMulta} onChange={e=> setBoletoMulta(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="col-span-3">
                  <label className="text-[11px] font-medium uppercase">Instruções</label>
                  <Input value={boletoInstr} onChange={e=> setBoletoInstr(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </div>
          )}
          {boletos.length>0 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium uppercase">Juros % mês</label>
                  <Input value={boletoJuros} onChange={e=> setBoletoJuros(e.target.value)} onBlur={aplicarConfigBoletos} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase">Multa %</label>
                  <Input value={boletoMulta} onChange={e=> setBoletoMulta(e.target.value)} onBlur={aplicarConfigBoletos} className="h-8 text-sm" />
                </div>
                <div className="col-span-3">
                  <label className="text-[11px] font-medium uppercase">Instruções</label>
                  <Input value={boletoInstr} onChange={e=> setBoletoInstr(e.target.value)} onBlur={aplicarConfigBoletos} className="h-8 text-sm" />
                </div>
              </div>
              <div className="border rounded max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="p-1 text-left">#</th>
                      <th className="p-1 text-left">Nosso Nº</th>
                      <th className="p-1 text-left">Vencimento</th>
                      <th className="p-1 text-right">Valor</th>
                      <th className="p-1 text-left">Linha Digitável</th>
                      <th className="p-1 text-right">Juros%</th>
                      <th className="p-1 text-right">Multa%</th>
                      <th className="p-1 text-center">Status</th>
                      <th className="p-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {boletos.map((b,idx)=> (
                      <tr key={b.id} className="odd:bg-white even:bg-slate-50">
                        <td className="p-1">{idx+1}</td>
                        <td className="p-1 font-mono text-[11px]">{b.nossoNumero}</td>
                        <td className="p-1">{new Date(b.vencimento).toLocaleDateString('pt-BR')}</td>
                        <td className="p-1 text-right font-mono">{fmt(b.valor)}</td>
                        <td className="p-1 font-mono text-[10px] break-all">{b.linhaDigitavel}</td>
                        <td className="p-1 text-right font-mono text-[11px]">{b.jurosPercent.toFixed(2)}</td>
                        <td className="p-1 text-right font-mono text-[11px]">{b.multaPercent.toFixed(2)}</td>
                        <td className="p-1 text-center text-[10px]">
                          <span className={b.status==='EMITIDO' ? 'text-green-600 font-medium':'text-amber-600'}>{b.status}</span>
                        </td>
                        <td className="p-1 text-center">
                          {b.status==='PENDENTE' && <button onClick={()=> marcarEmitido(b.id)} className="text-xs text-blue-600 hover:underline">Marcar Emitido</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-[11px] text-muted-foreground">Total: {fmt(boletos.reduce((s,b)=> s + b.valor,0))}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportBoletos}>Exportar JSON</Button>
                  <Button variant="outline" size="sm" onClick={imprimirBoletos}>Imprimir</Button>
                  <Button variant="outline" size="sm" disabled title="Integração bancária futura">Registrar Banco</Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">Rascunho de boletos local (linha digitável fictícia). Próximos passos: integração com API bancária (ex: Gerencianet, Banco digital), validação de carteira, cálculo de multa/juros e geração de PDF.</div>
            </div>
          )}
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