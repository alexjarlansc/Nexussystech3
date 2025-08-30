import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClientSearch } from '@/components/ClientSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Client, Product, Quote, QuoteItemSnapshot, QuoteStatus, QuoteType, PaymentMethod, Vendor, CompanyInfo } from '@/types';
import { StorageKeys, getString } from '@/utils/storage'; // StorageKeys mantido para compat mas não usado na numeração
import { hashSHA256 } from '@/utils/crypto';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

function currencyBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

// Geração de número global (consulta banco) evitando duplicidade entre usuários.
async function generateNextNumber(type: QuoteType): Promise<string> {
  const { data, error } = await supabase.rpc('next_quote_number', { p_type: type });
  if (error || !data) {
  // Fallback sem a palavra FALLBACK: usa timestamp compacto (YYMMDDHHMM) para evitar colisão
  const prefix = type === 'PEDIDO' ? 'PED' : 'ORC';
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2,12); // YYMMDDHHMM
  return `${prefix}-${stamp}`;
  }
  return data as string;
}

export default function QuoteBuilder() {
  // Token gerado pelo admin (deve ser o primeiro hook do componente)
  const [generatedToken, setGeneratedToken] = useState('');

  // Controle de token usado e validade
  function isTokenValid(token: string) {
    if (!token.startsWith('DESC')) return false;
    const used = localStorage.getItem(`used_token_${token}`);
    if (used) return false; // já usado
    const gen = localStorage.getItem(`gen_token_${token}`);
    if (!gen) return false;
    const genTime = parseInt(gen, 10);
    if (isNaN(genTime)) return false;
    // 15 minutos = 900000 ms
    if (Date.now() - genTime > 900000) return false;
    return true;
  }

  function markTokenUsed(token: string) {
    localStorage.setItem(`used_token_${token}`, '1');
  }

  // Quando admin gera token, salva timestamp
  useEffect(() => {
    if (generatedToken) {
      localStorage.setItem(`gen_token_${generatedToken}`, String(Date.now()));
    }
  }, [generatedToken]);
  const { profile, user, company } = useAuth();
  const [type, setType] = useState<QuoteType>('ORCAMENTO');
  const [validityDays, setValidityDays] = useState(7);
  // Estados para controle de desconto com token
  const [discountToken, setDiscountToken] = useState('');
  const [maxDiscount, setMaxDiscount] = useState(5);
  useEffect(() => {
    // Se admin, libera qualquer desconto
    if (profile?.role === 'admin') {
      setMaxDiscount(100);
      return;
    }
    // Se token válido, libera até o valor do token
    if (discountToken.startsWith('DESC')) {
      const perc = parseInt(discountToken.replace('DESC', ''));
      if (!isNaN(perc) && perc > 5) {
        setMaxDiscount(perc);
        return;
      }
    }
    setMaxDiscount(5);
  }, [profile, discountToken]);
  const [vendor, setVendor] = useState<Vendor>({
    name: '',
    phone: '',
    email: ''
  });
  const [clients, setClients] = useState<Client[]>([]);
  // Buscar clientes do banco de dados Supabase ao carregar
  // Função para buscar clientes do banco
  async function fetchClients() {
    // Buscar clientes da tabela correta
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (error) {
      toast.error('Erro ao buscar clientes do banco');
      return;
    }
    setClients(data || []);
  }

  useEffect(() => {
    fetchClients();
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const [clientId, setClientId] = useState<string>('');
  const [items, setItems] = useState<QuoteItemSnapshot[]>([]);
  // Campo de entrada do frete (pode ser valor fixo ou percentual ex: "5%")
  const [freight, setFreight] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [paymentTerms, setPaymentTerms] = useState('');
  // Estrutura avançada de condições (parcelas)
  interface PaymentScheduleItem {
    id: string;
    kind: 'entrada' | 'parcela' | 'saldo';
    valueType: 'percent' | 'fixed';
    value: number; // percentual ou valor fixo
    dueDays: number; // dias após emissão
  }
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([]);

  // Converter schedule em resumo string + persistir em paymentTerms (JSON)
  useEffect(() => {
    if (paymentSchedule.length === 0) return;
    const json = JSON.stringify({ version: 1, items: paymentSchedule });
    setPaymentTerms(json);
  }, [paymentSchedule]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<QuoteStatus>('Rascunho');

  const [openClient, setOpenClient] = useState(false);
  const [openProduct, setOpenProduct] = useState(false);
  const [openManageProducts, setOpenManageProducts] = useState(false);
  const [openSearchProduct, setOpenSearchProduct] = useState(false);
  const [openEditProduct, setOpenEditProduct] = useState<Product | null>(null);
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);

  // Discount state
  const [discountType, setDiscountType] = useState<'percentage' | 'value'>('percentage');
  const [discountAmount, setDiscountAmount] = useState('');

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.subtotal, 0), [items]);
  const discountValue = useMemo(() => {
    const value = parseFloat(discountAmount || '0');
    if (discountType === 'percentage') {
      return subtotal * (value / 100);
    }
    return value;
  }, [subtotal, discountType, discountAmount]);
  const subtotalWithDiscount = useMemo(() => subtotal - discountValue, [subtotal, discountValue]);
  // Detecta se frete é percentual
  const freightIsPercent = useMemo(() => freight.trim().endsWith('%'), [freight]);
  const freightValue = useMemo(() => {
    if (!freight) return 0;
    const raw = freight.trim();
    if (raw.endsWith('%')) {
      const num = parseFloat(raw.slice(0, -1).replace(',', '.'));
      if (isNaN(num) || num <= 0) return 0;
      return subtotalWithDiscount * (num / 100);
    }
    const num = parseFloat(raw.replace(/\./g,'').replace(',', '.'));
    if (isNaN(num) || num < 0) return 0;
    return num;
  }, [freight, subtotalWithDiscount]);
  const total = useMemo(() => subtotalWithDiscount + freightValue, [subtotalWithDiscount, freightValue]);


  // Removido: não persiste mais clientes localmente

  // Buscar orçamentos do Supabase conforme permissão
  async function fetchQuotes() {
    if (!user) return;
  let query = supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (profile?.role !== 'admin') {
      query = query.eq('created_by', user.id);
    }
    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao buscar orçamentos');
      return;
    }
    // Converter snake_case para camelCase para uso no frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (data || []).map((q: any) => ({
      ...q,
      clientId: q.client_id,
      createdAt: q.created_at,
      validityDays: q.validity_days,
      paymentMethod: q.payment_method,
      paymentTerms: q.payment_terms,
      clientSnapshot: q.client_snapshot,
      companyId: q.company_id,
      createdBy: q.created_by,
    }));
    setQuotes(mapped);
  }

  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  // Carregar produtos do banco de dados
  useEffect(() => {
    loadProducts();
  }, []);

  // Atualizar dados do vendedor quando o perfil mudar
  useEffect(() => {
    if (profile) {
      setVendor({
        name: profile.first_name || '',
        phone: profile.phone || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      const formattedProducts: Product[] = data.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        options: p.options || '',
        imageDataUrl: p.image_url || '',
        price: Number(p.price)
      }));
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    }
  };

  function addItemFromProduct(prod: Product, quantity = 1) {
    const snapshot: QuoteItemSnapshot = {
      productId: prod.id,
      name: prod.name,
      description: prod.description,
      options: prod.options,
      imageDataUrl: prod.imageDataUrl,
      unitPrice: prod.price,
      quantity,
      subtotal: prod.price * quantity,
    };
    setItems((it) => [...it, snapshot]);
  }

  function updateItemQty(index: number, qty: number) {
    setItems((arr) => {
      const copy = [...arr];
      const it = copy[index];
      copy[index] = { ...it, quantity: qty, subtotal: it.unitPrice * qty };
      return copy;
    });
  }

  function removeItem(index: number) {
    setItems((arr) => arr.filter((_, i) => i !== index));
  }

  async function handleSaveQuote() {
    // Se usuário comum e desconto > 5%, precisa de token válido
    if (parseFloat(discountAmount || '0') > 5 && profile?.role !== 'admin') {
      if (!isTokenValid(discountToken)) {
        toast.error('Token inválido, expirado ou já utilizado. Solicite um novo ao administrador.');
        return;
      }
      markTokenUsed(discountToken); // marca como usado, expira para outros orçamentos
      setMaxDiscount(5); // volta o limite para 5% após uso
      setDiscountToken(''); // limpa o campo
    }
    // Gerar número global consultando banco
    let number = '';
    let attempts = 0;
    while (attempts < 5) {
      attempts += 1;
      number = await generateNextNumber(type);
      // Verificação leve local: evitar reutilizar em memória
      if (quotes.some(q => q.number === number)) {
        continue; // gera novamente
      }
      break;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      toast.error('Selecione um cliente');
      return;
    }
    if (!vendor.name) {
      toast.error('Informe os dados do vendedor');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione ao menos um produto/serviço');
      return;
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quote: any = {
      number,
      type,
      created_at: new Date().toISOString(),
      validity_days: validityDays,
      vendor,
      client_id: client.id,
      client_snapshot: client,
      items,
  freight: freightValue,
      payment_method: paymentMethod,
      payment_terms: paymentTerms,
      notes,
      status,
      subtotal,
      total,
      created_by: user?.id,
      company_id: profile?.company_id,
    };
    // Inserção com retry em caso de conflito unique (se constraint existir)
  type QuoteRow = { id: string; number: string };
  let saveError: { message?: string; code?: string } | null = null;
  let saved: QuoteRow | null = null;
    for (let i = 0; i < 5; i++) {
  const { data, error } = await supabase.from('quotes').insert(quote).select().single();
      if (!error) { saved = data; saveError = null; break; }
      // Se conflito (unique violation) tenta novo número
  if (error && typeof error === 'object' && 'code' in error && (error as {code?: string}).code === '23505') {
        quote.number = await generateNextNumber(type); // novo número
        continue;
      }
      saveError = error; break;
    }
    if (saveError) {
      toast.error('Erro ao salvar orçamento: ' + (saveError.message || 'desconhecido'));
      return;
    }
    if (!saved) {
      toast.error('Não foi possível salvar orçamento (tentativas excedidas)');
      return;
    }
    setItems([]);
    toast.success(`${type === 'ORCAMENTO' ? 'Orçamento' : 'Pedido'} ${number} salvo`);
    fetchQuotes();
  }

  async function handleDeleteQuote(id: string) {
    if (profile?.role !== 'admin') {
      toast.error('Apenas administradores podem excluir orçamentos.');
      return;
    }
    const pwd = prompt('Digite a senha para excluir (reikar2025)');
    if (pwd === null) return;
    if (pwd !== 'reikar2025') {
      toast.error('Senha incorreta');
      return;
    }
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir orçamento: ' + error.message);
      return;
    }
    toast.success('Registro excluído');
    fetchQuotes();
  }

  // Client modal state
  const [cName, setCName] = useState('');
  const [cTax, setCTax] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddr, setCAddr] = useState('');

  async function addClient() {
    if (!cName) { toast.error('Nome do cliente é obrigatório'); return; }
    // Salvar no Supabase
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: cName,
        taxid: cTax || null,
        phone: cPhone || null,
        email: cEmail || null,
        address: cAddr || null,
        company_id: profile?.company_id || null,
        created_by: user?.id || null
      })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao salvar cliente no banco: ' + error.message);
      return;
    }
    if (data) {
      setClientId(data.id);
      toast.success('Cliente cadastrado no banco!');
      fetchClients(); // Atualiza lista após cadastro
    }
    setOpenClient(false);
    setCName(''); setCTax(''); setCPhone(''); setCEmail(''); setCAddr('');
  }

  // Product modal state
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pOpt, setPOpt] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pImg, setPImg] = useState<string | undefined>(undefined);

  function onPickImage(file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPImg(reader.result as string);
    reader.readAsDataURL(file);
  }

  const addProduct = async () => {
    // Verificar se é administrador
    if (profile?.role !== 'admin') {
      toast.error('Apenas administradores podem cadastrar produtos');
      return;
    }
    
    // Corrigir formatação do preço
    const cleanPrice = pPrice.replace(/[R$\s.]/g, '').replace(',', '.');
    const price = Number(cleanPrice);
    
    if (!pName || isNaN(price) || price <= 0) { 
      toast.error('Nome e preço válidos são obrigatórios'); 
      return; 
    }
    
    try {
  // Gerar código numérico único para o produto (apenas números)
  let code = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  code = code.replace(/[^0-9]/g, ''); // Garante só números
      const { error } = await supabase
        .from('products')
        .insert({
          id: code, // apenas números
          name: pName,
          description: pDesc || null,
          options: pOpt || null,
          image_url: pImg || null,
          price,
          company_id: profile.company_id,
          created_by: user?.id
        });

      if (error) throw error;
      setOpenProduct(false);
      setPName(''); setPDesc(''); setPOpt(''); setPPrice(''); setPImg(undefined);
      toast.success('Produto cadastrado com sucesso!');
      loadProducts();
  } catch (error: unknown) {
      console.error('Erro ao cadastrar produto:', error);
      const msg = (error && typeof error === 'object' && 'message' in error) ? (error as {message:string}).message : JSON.stringify(error);
      toast.error('Erro ao cadastrar produto: ' + msg);
    }
  };

  const deleteProduct = async (id: string) => {
    if (profile?.role !== 'admin') {
      toast.error('Apenas administradores podem excluir produtos');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Produto excluído com sucesso!');
      loadProducts(); // Recarregar produtos
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const editProduct = async (updated: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: updated.name,
          description: updated.description || null,
          options: updated.options || null,
          image_url: updated.imageDataUrl || null,
          price: updated.price
        })
        .eq('id', updated.id);

      if (error) throw error;
      
      toast.success('Produto atualizado');
      setOpenEditProduct(null);
      loadProducts(); // Recarregar produtos
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto');
    }
  };

  // Impressão independente: abre nova janela somente com o orçamento
  function openQuotePdf(quote: Quote) {
    const issueDate = new Date(quote.createdAt).toLocaleDateString('pt-BR');
    const validade = new Date(new Date(quote.createdAt).getTime() + quote.validityDays * 86400000).toLocaleDateString('pt-BR');
    const companyStored = localStorage.getItem(StorageKeys.company);
    let companyName = 'Empresa';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let companyObj: any = {};
    try {
      if (companyStored) { companyObj = JSON.parse(companyStored); companyName = companyObj.name || companyName; }
    } catch {
      // ignore parse
    }
    // Preferir dados atuais do hook (company) sobre storage
  if (company) {
      companyObj = {
        ...companyObj,
        name: company.name || companyObj.name,
        address: company.address || companyObj.address,
        taxid: company.cnpj_cpf || companyObj.taxid || companyObj.cnpj_cpf,
        phone: company.phone || companyObj.phone,
        email: company.email || companyObj.email,
        logoDataUrl: companyObj.logoDataUrl // preserva logo armazenada localmente se houver
      };
      companyName = companyObj.name || companyName;
    }
    // Caso tenhamos logo_url vindo do backend e ainda não haja DataUrl salva
    // Tentar usar logo_url vinda do backend (campo não mapeado em CompanyInfo local)
    if (!companyObj.logoDataUrl && company) {
      const backendLogo = (company as unknown as { logo_url?: string }).logo_url;
      if (backendLogo) companyObj.logoDataUrl = backendLogo;
    }
    // Fallback: se não houver taxid mas houver cnpj_cpf
    if (!companyObj.taxid && companyObj.cnpj_cpf) companyObj.taxid = companyObj.cnpj_cpf;
    // Garantir vendor preenchido (caso state ainda não atualizado) usando profile
    const repName = quote.vendor?.name || profile?.first_name || '—';
    const repPhone = quote.vendor?.phone || profile?.phone || '';
    const repEmail = quote.vendor?.email || profile?.email || '';

    const escape = (s: string) => (s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
    const currency = (n:number)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
  // paymentEntries calculado abaixo
    interface PaymentEntry { label:string; detail:string; amount:number }
    let paymentEntries: PaymentEntry[] = [];
    if (quote.paymentTerms) {
      try {
        const parsed = JSON.parse(quote.paymentTerms);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) {
          paymentEntries = parsed.items.map((it: {kind:string; valueType:string; value:number; dueDays:number}, idx:number) => {
            const label = it.kind === 'entrada' ? 'Entrada' : it.kind === 'saldo' ? 'Saldo' : `Parcela ${idx+1}`;
            const amount = it.valueType === 'percent' ? (quote.total * (it.value/100)) : Number(it.value);
            const valTxt = it.valueType === 'percent' ? `${it.value}%` : currencyBRL(Number(it.value));
            const detail = `${valTxt} em ${it.dueDays} dia(s)`;
            return { label, detail, amount };
          });
        } else {
          paymentEntries = quote.paymentTerms.split(/\n|;/).map(l=>l.trim()).filter(Boolean).map((t,i)=>({label:`Parcela ${i+1}`, detail:t, amount:0}));
        }
      } catch {
        paymentEntries = quote.paymentTerms.split(/\n|;/).map(l=>l.trim()).filter(Boolean).map((t,i)=>({label:`Parcela ${i+1}`, detail:t, amount:0}));
      }
    }

    const discountCalc = (quote.subtotal + quote.freight) - quote.total; // desconto implícito
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>${escape(quote.type==='ORCAMENTO'?'Orçamento':'Pedido')} ${escape(quote.number)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
      <style>
        @page { size:A4; margin:14mm 14mm 16mm; }
        :root { --brand:#195e63; --brand-alt:#3e838c; --border:#d4d8dd; --bg-alt:#f6f9fa; }
        * { box-sizing:border-box; }
        body { font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:11.3px; line-height:1.45; color:#111; -webkit-print-color-adjust:exact; }
        h1,h2,h3 { font-family:'Poppins','Inter',sans-serif; font-weight:600; margin:0; line-height:1.2; }
        h1 { font-size:20px; letter-spacing:.5px; }
        h2 { font-size:14px; text-transform:uppercase; letter-spacing:.5px; color:var(--brand); margin-top:22px; margin-bottom:6px; }
        h3 { font-size:12px; text-transform:uppercase; letter-spacing:.4px; color:var(--brand); margin:18px 0 4px; }
        .muted { color:#555; }
        .small { font-size:10px; }
  .header { display:flex; justify-content:space-between; gap:24px; padding-bottom:12px; border-bottom:1px solid var(--border); }
  .company-block { display:flex; flex-direction:column; gap:6px; font-size:12px; }
  .company-block h1 { font-size:22px; }
  .logo { max-height:80px; max-width:190px; object-fit:contain; }
        .meta { margin-top:10px; display:flex; flex-wrap:wrap; gap:22px; padding:6px 0 8px; border-bottom:1px solid var(--border); font-weight:600; font-size:11px; }
        .info-grid { margin-top:10px; display:grid; gap:8px; }
        .info-box { padding-bottom:6px; border-bottom:1px solid var(--border); }
        .label { font-weight:600; }
        table { border-collapse:collapse; width:100%; table-layout:fixed; }
        th,td { border:1px solid var(--border); padding:6px 6px 5px; text-align:left; vertical-align:top; }
        th { background:var(--bg-alt); font-weight:600; font-size:10.5px; letter-spacing:.3px; }
        td { font-size:10.8px; }
        .col-img { width:78px; }
        .product-name { font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; }
        .desc { white-space:pre-wrap; font-size:10px; margin-top:3px; line-height:1.35; }
        .totals { margin-top:18px; max-width:320px; border:1px solid var(--border); border-radius:4px; overflow:hidden; }
        .totals-row { display:flex; justify-content:space-between; padding:6px 10px; font-size:11px; border-bottom:1px solid var(--border); background:#fff; }
        .totals-row.highlight { background:linear-gradient(135deg,var(--brand),var(--brand-alt)); color:#fff; font-weight:600; font-size:13px; letter-spacing:.4px; }
        .totals-row:last-child { border-bottom:none; }
        .signatures { margin-top:60px; display:grid; grid-template-columns:1fr 1fr; gap:60px; }
        .sig { text-align:center; }
        .sig-line { width:230px; border-top:1px dashed #666; height:0; margin:0 auto 6px; }
        .notes { margin-top:18px; white-space:pre-wrap; font-size:10.6px; line-height:1.4; border:1px solid var(--border); background:#fff; padding:10px 12px; border-radius:4px; }
        .payments-table { margin-top:14px; }
        .avoid-break { page-break-inside:avoid; }
        img { page-break-inside:avoid; }
      </style></head><body>
      <div class="header">
        <div class="company-block">
          <h1>${escape(companyObj.name || companyName)}</h1>
          ${companyObj.address ? `<div class="small">${escape(companyObj.address)}</div>`:''}
          <div class="muted small">${[companyObj.taxid && 'CNPJ/CPF: '+escape(companyObj.taxid), companyObj.phone, companyObj.email].filter(Boolean).map(escape).join(' · ')}</div>
        </div>
        ${companyObj.logoDataUrl ? `<img class="logo" src="${companyObj.logoDataUrl}" />`:''}
      </div>
      <div class="meta">
        <span>${escape(quote.type==='ORCAMENTO'?'Orçamento':'Pedido')} Nº ${escape(quote.number)}</span>
        <span>Emissão: ${escape(issueDate)}</span>
        <span>Validade: ${escape(new Date(new Date(quote.createdAt).getTime()+quote.validityDays*86400000).toLocaleDateString('pt-BR'))}</span>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div><span class="label">Representante:</span> ${escape(repName)}</div>
          ${repPhone?`<div class="small muted">Telefone: ${escape(repPhone)}</div>`:''}
          ${repEmail?`<div class="small muted">Email: ${escape(repEmail)}</div>`:''}
        </div>
        <div class="info-box">
          <div><span class="label">Cliente:</span> ${escape(quote.clientSnapshot.name)}</div>
          ${quote.clientSnapshot.taxid?`<div class="small muted">CNPJ/CPF: ${escape(quote.clientSnapshot.taxid)}</div>`:''}
          ${quote.clientSnapshot.phone?`<div class="small muted">Telefone: ${escape(quote.clientSnapshot.phone)}</div>`:''}
          ${quote.clientSnapshot.email?`<div class="small muted">Email: ${escape(quote.clientSnapshot.email)}</div>`:''}
          ${quote.clientSnapshot.address?`<div class="small muted">Endereço: ${escape(quote.clientSnapshot.address)}</div>`:''}
        </div>
      </div>
      <h2>Produtos / Serviços</h2>
      <table class="avoid-break">
        <thead><tr>
          <th class="col-img">Imagem</th>
          <th style="width:42%">Descrição</th>
            <th style="width:10%">Qtd</th>
            <th style="width:16%">Unitário</th>
            <th style="width:16%">Subtotal</th>
        </tr></thead>
        <tbody>
          ${quote.items.map(it=>`<tr class="avoid-break">
            <td class="col-img" style="text-align:center; vertical-align:middle;">${it.imageDataUrl?`<img src="${it.imageDataUrl}" alt="${escape(it.name)}" style="width:64px;height:64px;object-fit:cover;border:1px solid var(--border);border-radius:4px;" />`:'—'}</td>
            <td><div class="product-name">${escape(it.name)}</div>${(it.description||it.options)?`<div class="desc">${escape((it.description||'')+(it.options?"\n"+it.options:''))}</div>`:''}</td>
            <td>${it.quantity}</td>
            <td>${currency(it.unitPrice)}</td>
            <td>${currency(it.subtotal)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${currency(quote.subtotal)}</span></div>
        <div class="totals-row"><span>Frete</span><span>${currency(quote.freight)}</span></div>
        ${discountCalc>0.009?`<div class="totals-row"><span>Desconto</span><span>- ${currency(discountCalc)}</span></div>`:''}
        <div class="totals-row highlight"><span>Total</span><span>${currency(quote.total)}</span></div>
      </div>
      ${paymentEntries.length?`<h3 style="margin-top:22px;">Condições de Pagamento</h3>
      <table class="payments-table">
        <thead><tr><th style="width:20%">Parcela</th><th>Detalhes</th><th style="width:18%">Valor (R$)</th></tr></thead>
        <tbody>${paymentEntries.map(p=>`<tr><td style="font-weight:600;">${escape(p.label)}</td><td>${escape(p.detail)}</td><td>${currency(p.amount)}</td></tr>`).join('')}</tbody>
      </table>`:''}
      ${quote.notes?`<h3 style="margin-top:22px;">Observações</h3><div class="notes">${escape(quote.notes)}</div>`:''}
      <div class="signatures">
        <div class="sig"><div class="sig-line"></div><div class="small muted">Assinatura do Vendedor</div><div class="small" style="margin-top:4px;">${escape(quote.vendor?.name||'')}</div></div>
        <div class="sig"><div class="sig-line"></div><div class="small muted">Assinatura do Cliente</div><div class="small" style="margin-top:4px;">${escape(quote.clientSnapshot?.name||'')}</div></div>
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),120);};</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast.error('Popup bloqueado. Libere popups para gerar o PDF.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <main className="container mx-auto px-1 sm:px-2 md:px-4">
      <section aria-labelledby="editor" className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-2 md:space-y-4">
          <Card className="card-elevated p-2 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex flex-col sm:flex-row rounded-md border overflow-hidden w-full sm:w-auto mb-2 sm:mb-0">
                <button
                  className={`px-4 py-2 text-sm ${type==='ORCAMENTO' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  onClick={() => setType('ORCAMENTO')}
                  aria-pressed={type==='ORCAMENTO'}
                >Orçamento</button>
                <button
                  className={`px-4 py-2 text-sm ${type==='PEDIDO' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  onClick={() => setType('PEDIDO')}
                  aria-pressed={type==='PEDIDO'}
                >Pedido</button>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="valid">Validade</Label>
                <Select value={String(validityDays)} onValueChange={(v) => setValidityDays(Number(v))}>
                  <SelectTrigger id="valid" className="w-28"><SelectValue placeholder="Dias" /></SelectTrigger>
                  <SelectContent>
                    {[3,7,10,15,30,60,90].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Dados da Empresa - preenchidos automaticamente */}
            <div className="mt-2 w-full rounded-md border bg-accent/40 p-2 text-xs grid gap-1 md:text-sm" aria-label="Dados da Empresa">
              <div className="font-semibold text-primary leading-tight">{company?.name || 'Empresa não cadastrada'}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {company?.cnpj_cpf && <span><span className="font-medium">CNPJ/CPF:</span> {company.cnpj_cpf}</span>}
                {company?.phone && <span><span className="font-medium">Tel.:</span> {company.phone}</span>}
                {company?.email && <span className="truncate max-w-[160px] md:max-w-none"><span className="font-medium">Email:</span> {company.email}</span>}
              </div>
              {company?.address && (
                <div className="text-muted-foreground truncate" title={company.address}>
                  {company.address}
                </div>
              )}
              {!company && (
                <div className="text-muted-foreground">Complete os dados da empresa nas configurações.</div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
              <div className="space-y-1 md:space-y-2">
                <h3 className="font-semibold">Dados do Vendedor</h3>
                <Input placeholder="Nome" value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
                <Input placeholder="Telefone" value={vendor.phone} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
                <Input placeholder="Email" type="email" value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} />
              </div>
              <div className="space-y-1 md:space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Cliente</h3>
                  <Button size="sm" variant="secondary" onClick={() => setOpenClient(true)}>Cadastrar Cliente</Button>
                </div>
                <ClientSearch
                  clients={clients}
                  onSelect={c => {
                    if (!c || !c.id) {
                      toast.error('Selecione um cliente válido do banco de dados!');
                      return;
                    }
                    setClientId(c.id);
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-2 gap-2">
                <h3 className="font-semibold">Itens</h3>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button size="sm" variant="secondary" onClick={() => setOpenSearchProduct(true)}>Buscar Produto</Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => {
                      if (profile?.role !== 'admin') {
                        toast.error('Apenas administradores podem cadastrar produtos');
                        return;
                      }
                      setOpenProduct(true);
                    }}
                  >
                    Cadastrar Produto
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpenManageProducts(true)}>Gerenciar Produtos</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:gap-3">
                <div className="grid grid-cols-12 gap-1 md:gap-2 text-[11px] md:text-xs text-muted-foreground font-medium">
                  <div className="col-span-5 md:col-span-6">Produto</div>
                  <div className="col-span-2 text-right">Qtd</div>
                  <div className="col-span-2 text-right">Unitário</div>
                  <div className="col-span-3 md:col-span-2 text-right">Subtotal</div>
                </div>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 md:gap-2 items-center border rounded-md p-1 md:p-2">
                    <div className="col-span-5 md:col-span-6 flex items-center gap-3">
                      {it.imageDataUrl ? (
                        <img src={it.imageDataUrl} alt={it.name} className="h-12 w-12 rounded object-cover border" loading="lazy" />
                      ) : (
                        <div className="h-12 w-12 rounded border bg-accent/60 grid place-items-center text-[10px]">IMG</div>
                      )}
                      <div>
                        <div className="font-semibold">{it.name}</div>
                        {(it.description || it.options) && (
                          <div className="text-xs text-muted-foreground">
                            {it.description} {it.options ? `· ${it.options}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItemQty(idx, Math.max(1, Number(e.target.value)))}
                      />
                    </div>
                    <div className="col-span-2 text-right whitespace-nowrap text-[11px] md:text-sm pr-1">{currencyBRL(it.unitPrice)}</div>
                    <div className="col-span-3 md:col-span-2 text-right font-medium whitespace-nowrap text-[11px] md:text-sm pl-1 border-l border-muted/30">{currencyBRL(it.subtotal)}</div>
                    <div className="col-span-12 text-right">
                      <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="frete">Frete</Label>
                <Input id="frete" value={freight}
                  placeholder="Ex: 150 ou 5%"
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    // Permite dígitos, ponto, vírgula e %
                    const cleaned = v.replace(/[^0-9.,%]/g, '');
                    // Apenas um % no final se existir
                    const norm = cleaned.replace(/%+/g,'%');
                    // Se tiver % no meio remove
                    const finalVal = norm.includes('%') ? norm.replace('%','') + '%' : norm;
                    setFreight(finalVal);
                  }}
                />
                {freight && (
                  <div className="text-[10px] text-muted-foreground">
                    {freightIsPercent ? `Frete = ${freightValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} (${freight.trim()})` : 'Valor fixo de frete'}
                  </div>
                )}
                <Label>Método de pagamento</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                  <SelectContent>
                    {(['Pix','Cartão Débito','Cartão de Crédito','Boleto'] as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Condições de pagamento</Label>
                <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                  {/* Form inline responsivo */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="w-[110px] flex-1 min-w-[120px] sm:min-w-[100px]">
                      <Label className="text-[10px] uppercase">Tipo</Label>
                      <select id="pg-kind" className="w-full border rounded px-2 py-1 text-xs">
                        <option value="entrada">Entrada</option>
                        <option value="parcela">Parcela</option>
                        <option value="saldo">Saldo</option>
                      </select>
                    </div>
                    <div className="w-[120px] flex-1 min-w-[120px] sm:min-w-[100px]">
                      <Label className="text-[10px] uppercase">Valor</Label>
                      <input id="pg-value" className="w-full border rounded px-2 py-1 text-xs" placeholder="30% ou 500" />
                    </div>
                    <div className="w-[90px] flex-1 min-w-[80px] sm:min-w-[80px]">
                      <Label className="text-[10px] uppercase">Dias</Label>
                      <input id="pg-days" type="number" className="w-full border rounded px-2 py-1 text-xs" defaultValue={30} />
                    </div>
                    <div className="flex gap-1 ml-auto">
                      <Button type="button" size="sm" className="px-4" onClick={() => {
                        const kindSel = (document.getElementById('pg-kind') as HTMLSelectElement).value as PaymentScheduleItem['kind'];
                        const valueRaw = (document.getElementById('pg-value') as HTMLInputElement).value.trim();
                        const daysVal = parseInt((document.getElementById('pg-days') as HTMLInputElement).value, 10);
                        if (!valueRaw) { toast.error('Informe valor'); return; }
                        const valueType: PaymentScheduleItem['valueType'] = valueRaw.endsWith('%') ? 'percent' : 'fixed';
                        const num = parseFloat(valueRaw.replace('%','').replace(',','.'));
                        if (isNaN(num) || num <= 0) { toast.error('Valor inválido'); return; }
                        if (isNaN(daysVal) || daysVal < 0) { toast.error('Dias inválido'); return; }
                        setPaymentSchedule(arr => [...arr, { id: crypto.randomUUID(), kind: kindSel, valueType, value: num, dueDays: daysVal }]);
                        (document.getElementById('pg-value') as HTMLInputElement).value='';
                      }}>Add</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setPaymentSchedule([]); }}>Limpar</Button>
                    </div>
                  </div>
                  {paymentSchedule.length > 0 && (
                    <div className="space-y-2">
                      {paymentSchedule.map((p, idx) => {
                        const labelKind = p.kind === 'entrada' ? 'Entrada' : p.kind === 'saldo' ? 'Saldo' : `Parcela ${idx+1}`;
                        const valTxt = p.valueType === 'percent' ? `${p.value}%` : currencyBRL(p.value);
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded border px-2 py-1 text-xs">
                            <div>
                              <span className="font-medium">{labelKind}</span>{' '}
                              <span className="text-muted-foreground">{valTxt} • {p.dueDays} dia(s)</span>
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPaymentSchedule(arr => arr.filter(it => it.id !== p.id))}>✕</Button>
                            </div>
                          </div>
                        );
                      })}
                      {/* Validação soma percentuais */}
                      {(() => {
                        const percTotal = paymentSchedule.filter(p => p.valueType==='percent').reduce((s,p)=>s+p.value,0);
                        if (percTotal > 100.0001) return <div className="text-[10px] text-red-600">Percentuais somam {percTotal.toFixed(2)}% &gt; 100%</div>;
                        return <div className="text-[10px] text-muted-foreground">Percentuais somam {percTotal.toFixed(2)}%</div>;
                      })()}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">Configure parcelas estruturadas. Valores % aplicam sobre o total.</div>
                </div>
              </div>
              <div className="space-y-1 md:space-y-2">
                <Label>Observações</Label>
                <Textarea rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {(['Rascunho','Enviado','Aprovado','Cancelado','Pago'] as QuoteStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Discount Section */}
            <div className="mt-4 grid grid-cols-12 gap-2 md:gap-4 items-center">
              <div className="col-span-12 md:col-span-4">
                <Label>Desconto (%):</Label>
                {profile?.role === 'admin' ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={6}
                        max={100}
                        step="1"
                        placeholder="% para liberar"
                        style={{ width: 120 }}
                        id="admin-discount-token-value"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById('admin-discount-token-value') as HTMLInputElement)?.value;
                          const perc = parseInt(val || '');
                          if (!perc || perc <= 5 || perc > 100) {
                            toast.error('Informe um percentual acima de 5 e até 100');
                            return;
                          }
                          setGeneratedToken(`DESC${perc}`);
                        }}
                      >Gerar Token</Button>
                    </div>
                    {generatedToken && (
                      <div className="flex items-center gap-2">
                        <Input readOnly value={generatedToken} style={{ width: 100 }} />
                        <Button type="button" onClick={() => {navigator.clipboard.writeText(generatedToken); toast.success('Token copiado!')}}>Copiar</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <Input
                        type="text"
                        value={discountToken}
                        onChange={e => setDiscountToken(e.target.value.toUpperCase())}
                        placeholder="Token do administrador"
                        style={{ width: 120 }}
                        id="user-discount-token-value"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (!discountToken) {
                            toast.error('Digite o token para aplicar');
                            return;
                          }
                          if (!isTokenValid(discountToken)) {
                            toast.error('Token inválido, expirado ou já utilizado. Solicite um novo ao administrador.');
                            return;
                          }
                          setMaxDiscount(parseInt(discountToken.replace('DESC', '')));
                          toast.success('Token aplicado! Agora você pode usar o desconto liberado.');
                        }}
                      >Aplicar Token</Button>
                    </div>
                    {discountToken && !isTokenValid(discountToken) && (
                      <span className="text-xs text-red-600">Token inválido, expirado ou já utilizado. Solicite um novo ao administrador.</span>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-12 md:col-span-8 flex flex-col gap-2">
                <Input
                  type="number"
                  value={discountAmount}
                  placeholder="0"
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.,-]/g, '');
                    if (parseFloat(val || '0') > maxDiscount) {
                      toast.error(`Desconto máximo permitido: ${maxDiscount}%`);
                      return;
                    }
                    setDiscountAmount(val);
                  }}
                  className="flex-1"
                  min="0"
                  max={maxDiscount}
                  step="any"
                />
                {parseFloat(discountAmount || '0') > 5 && profile?.role !== 'admin' && (
                  <div className="flex flex-col gap-1 mt-2">
                    <Input
                      type="text"
                      value={discountToken}
                      onChange={e => setDiscountToken(e.target.value.toUpperCase())}
                      placeholder="Token do administrador"
                      className="flex-1 border-red-500"
                    />
                    {discountToken && !isTokenValid(discountToken) && (
                      <span className="text-xs text-red-600">Token inválido, expirado ou já utilizado. Solicite um novo ao administrador.</span>
                    )}
                    {!discountToken && (
                      <span className="text-xs text-red-600">Token obrigatório para desconto acima de 5%</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col md:flex-row flex-wrap items-center justify-between gap-2 md:gap-4">
              <div className="text-right ml-auto w-full md:w-auto">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div className="text-lg font-semibold">{currencyBRL(subtotal)}</div>
                {discountValue > 0 && (
                  <>
                    <div className="text-sm text-red-600">Desconto</div>
                    <div className="text-lg font-semibold text-red-600">-{currencyBRL(discountValue)}</div>
                  </>
                )}
                <div className="text-sm text-muted-foreground">Frete</div>
                <div className="text-lg font-semibold">{currencyBRL(freightValue)}</div>
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-2xl font-bold">{currencyBRL(total)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSaveQuote}>Salvar {type==='ORCAMENTO' ? 'Orçamento' : 'Pedido'}</Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="card-elevated p-4">
            <h3 className="font-semibold mb-3">Registros</h3>
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {quotes.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum registro salvo ainda.</div>
              )}
              {quotes.map((q) => (
                <div key={q.id} className="border rounded-md p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={q.type === 'PEDIDO' ? 'font-semibold text-green-600' : 'font-semibold'}>
                        {q.type === 'PEDIDO' ? 'Pedido' : q.number}
                      </div>
                      <div className="text-xs text-muted-foreground">{q.type==='ORCAMENTO' ? 'Orçamento' : 'Pedido'} · {new Date(q.createdAt).toLocaleDateString('pt-BR')} · Validade {q.validityDays}d</div>
                      <div className="text-xs">Cliente: {q.clientSnapshot.name}</div>
                      <div className="text-xs">Total: {currencyBRL(q.total)}</div>
                      <div className="text-xs">Status: {q.status}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => setOpenReceipt(q.id)}>Recibo</Button>
                      {/* Botão para gerar pedido de venda se for orçamento */}
                      {q.type === 'ORCAMENTO' && (
                        <Button size="sm" variant="default" onClick={async () => {
                          // Atualiza o tipo para PEDIDO
                          const { error } = await supabase.from('quotes').update({ type: 'PEDIDO' }).eq('id', q.id);
                          if (!error) {
                            toast.success('Pedido de venda gerado!');
                            fetchQuotes();
                          } else {
                            toast.error('Erro ao gerar pedido');
                          }
                        }}>Gerar Pedido de Venda</Button>
                      )}
                      {/* Botão para retornar para orçamento, só admin */}
                      {q.type === 'PEDIDO' && profile?.role === 'admin' && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const { error } = await supabase.from('quotes').update({ type: 'ORCAMENTO' }).eq('id', q.id);
                          if (!error) {
                            toast.success('Retornado para orçamento!');
                            fetchQuotes();
                          } else {
                            toast.error('Erro ao retornar para orçamento');
                          }
                        }}>Retornar para Orçamento</Button>
                      )}
                      {profile?.role === 'admin' ? (
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteQuote(q.id)}>Excluir</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center">Somente administradores podem excluir orçamentos</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </section>

      {/* Client Modal */}
      <Dialog open={openClient} onOpenChange={setOpenClient}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar Cliente</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Nome" value={cName} onChange={(e) => setCName(e.target.value)} />
            <Input placeholder="CNPJ/CPF" value={cTax} onChange={(e) => setCTax(e.target.value)} />
            <Input placeholder="Telefone" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
            <Input placeholder="Email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            <Input placeholder="Endereço" value={cAddr} onChange={(e) => setCAddr(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={addClient}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Modal */}
      <Dialog open={openProduct} onOpenChange={setOpenProduct}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Cadastrar Produto Completo</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="product-name">Nome do Produto *</Label>
              <Input 
                id="product-name"
                placeholder="Ex: Smartphone Samsung Galaxy S24" 
                value={pName} 
                onChange={(e) => setPName(e.target.value)} 
                required
              />
            </div>
            
            <div>
              <Label htmlFor="product-desc">Descrição Detalhada</Label>
              <Textarea 
                id="product-desc"
                placeholder="Descrição completa do produto, características, especificações..." 
                value={pDesc} 
                onChange={(e) => setPDesc(e.target.value)}
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="product-options">Opcionais/Variações</Label>
              <Input 
                id="product-options"
                placeholder="Ex: Cores disponíveis, tamanhos, acessórios inclusos..." 
                value={pOpt} 
                onChange={(e) => setPOpt(e.target.value)} 
              />
            </div>
            
            <div className="grid gap-1">
              <Label htmlFor="product-price">Preço (R$) *</Label>
              <Input 
                id="product-price"
                placeholder="2000,00" 
                value={pPrice} 
                onChange={(e) => {
                  // Permitir apenas números, vírgula e ponto
                  const value = e.target.value.replace(/[^0-9,]/g, '');
                  setPPrice(value);
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value.replace(',', '.')) || 0;
                  setPPrice(value.toFixed(2).replace('.', ','));
                }}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="product-image">Imagem do Produto</Label>
              <input 
                id="product-image"
                type="file" 
                accept="image/*" 
                onChange={(e) => onPickImage(e.target.files?.[0])}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
              {pImg && (
                <div className="mt-2">
                  <img 
                    src={pImg} 
                    alt="Pré-visualização" 
                    className="h-32 w-32 rounded border object-cover mx-auto" 
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Pré-visualização da imagem</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenProduct(false)}>Cancelar</Button>
            <Button onClick={addProduct}>Salvar Produto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Products Modal */}
      <Dialog open={openManageProducts} onOpenChange={setOpenManageProducts}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Gerenciar Produtos Cadastrados</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-auto space-y-2">
            {profile?.role === 'admin' && (
              <div className="mb-4 p-3 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Administrador:</strong> Você pode editar, criar novos produtos e excluir produtos existentes.
                </p>
              </div>
            )}
            
            {products.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum produto cadastrado ainda.
                {profile?.role === 'admin' && (
                  <div className="mt-2">
                    <Button size="sm" onClick={() => setOpenProduct(true)}>
                      Cadastrar Primeiro Produto
                    </Button>
                  </div>
                )}
              </div>
            )}
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
                <div className="flex items-center gap-3">
                  {p.imageDataUrl ? (
                    <img src={p.imageDataUrl} alt={p.name} className="h-12 w-12 rounded object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded border bg-accent/60 grid place-items-center text-xs">IMG</div>
                  )}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{currencyBRL(p.price)}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground max-w-xs truncate">{p.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpenEditProduct(p)}>Editar</Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      if (profile?.role !== 'admin') {
                        toast.error('Apenas administradores podem cadastrar produtos');
                        return;
                      }
                      setOpenProduct(true);
                    }}
                  >
                    Novo
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => {
                      if (profile?.role !== 'admin') {
                        toast.error('Apenas administradores podem excluir produtos');
                        return;
                      }
                      deleteProduct(p.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Product Modal */}
      <Dialog open={openSearchProduct} onOpenChange={async (open) => {
        setOpenSearchProduct(open);
        if (open) await loadProducts(); // Sempre recarrega produtos ao abrir
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Buscar Produto</DialogTitle></DialogHeader>
          <SearchProductModal 
            products={products} 
            onSelectProduct={(product) => {
              addItemFromProduct(product);
              setOpenSearchProduct(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      {openEditProduct && (
        <Dialog open={!!openEditProduct} onOpenChange={() => setOpenEditProduct(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Editar Produto</DialogTitle></DialogHeader>
            <EditProductModal 
              product={openEditProduct} 
              onSave={editProduct}
              onCancel={() => setOpenEditProduct(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Receipt Modal */}
      <Dialog open={!!openReceipt} onOpenChange={() => setOpenReceipt(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {(() => {
            const currentQuote = quotes.find(q => q.id === openReceipt!);
            if (!currentQuote) return <div className="text-red-600 text-sm">Orçamento não encontrado.</div>;
            return <>
              {currentQuote.type !== 'PEDIDO' && (
                <DialogHeader><DialogTitle>Recibo</DialogTitle></DialogHeader>
              )}
              <div className="mt-2 space-y-2 overflow-y-auto max-h-[65vh] pr-2">
                <ReceiptView quote={currentQuote} />
              </div>
              <DialogFooter>
                <Button className="no-print" onClick={() => openQuotePdf(currentQuote)}>Gerar PDF</Button>
              </DialogFooter>
            </>;
          })()}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SearchProductModal({ 
  products, 
  onSelectProduct 
}: { 
  products: Product[]; 
  onSelectProduct: (product: Product) => void; 
}) {
  const [search, setSearch] = useState('');
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome ou código..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-[50vh] overflow-auto space-y-2">
        {filteredProducts.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum produto encontrado.</div>
        )}
        {filteredProducts.map((p) => (
          <div 
            key={p.id} 
            className="flex items-center justify-between border rounded-md p-3 hover:bg-accent/50 cursor-pointer"
            onClick={() => onSelectProduct(p)}
          >
            <div className="flex items-center gap-3">
              {p.imageDataUrl ? (
                <img src={p.imageDataUrl} alt={p.name} className="h-10 w-10 rounded object-cover border" />
              ) : (
                <div className="h-10 w-10 rounded border bg-accent/60 grid place-items-center text-xs">IMG</div>
              )}
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">Código: {p.id.slice(-8)}</div>
                <div className="text-xs text-muted-foreground">{currencyBRL(p.price)}</div>
              </div>
            </div>
            <Button size="sm" variant="secondary">Adicionar</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditProductModal({ 
  product, 
  onSave, 
  onCancel 
}: { 
  product: Product; 
  onSave: (product: Product) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [options, setOptions] = useState(product.options || '');
  const [price, setPrice] = useState(product.price.toString());
  const [imageDataUrl, setImageDataUrl] = useState(product.imageDataUrl);

  const handleSave = () => {
    // Corrigir formatação do preço
    const cleanPrice = price.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsedPrice = parseFloat(cleanPrice);
    
    if (!name || isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Nome e preço válidos são obrigatórios');
      return;
    }

    onSave({
      ...product,
      name,
      description,
      options,
      price: parsedPrice,
      imageDataUrl,
    });
  };

  const handleImageChange = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <Input 
        placeholder="Nome do produto" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
      />
      <Textarea 
        placeholder="Descrição" 
        value={description} 
        onChange={(e) => setDescription(e.target.value)} 
      />
      <Input 
        placeholder="Opcionais (texto livre)" 
        value={options} 
        onChange={(e) => setOptions(e.target.value)} 
      />
      <div>
        <Label>Preço (R$)</Label>
        <Input 
          placeholder="2000,00" 
          value={price} 
          onChange={(e) => {
            // Permitir apenas números, vírgula e ponto
            const value = e.target.value.replace(/[^0-9,]/g, '');
            setPrice(value);
          }}
          onBlur={(e) => {
            const value = parseFloat(e.target.value.replace(',', '.')) || 0;
            setPrice(value.toFixed(2).replace('.', ','));
          }}
        />
      </div>
      <div>
        <Label>Imagem</Label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => handleImageChange(e.target.files?.[0])} 
        />
        {imageDataUrl && (
          <img 
            src={imageDataUrl} 
            alt="Pré-visualização" 
            className="h-20 w-20 rounded border object-cover mt-2" 
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}


function ReceiptView({ quote }: { quote: Quote }) {
  // Preferir dados da empresa via hook
  const { company: authCompany } = useAuth();
  let company: CompanyInfo = {
    name: authCompany?.name || 'Empresa',
    address: authCompany?.address || '',
    taxid: authCompany?.cnpj_cpf || '',
    phone: authCompany?.phone || '',
    email: authCompany?.email || '',
    logoDataUrl: undefined,
  };
  // Completar com storage se tiver logo custom salva
  try {
    const raw = localStorage.getItem(StorageKeys.company);
    if (raw) {
      const parsed = JSON.parse(raw);
      company = { ...company, ...parsed };
    }
  } catch {/* ignore */}

  const issueDate = new Date(quote.createdAt).toLocaleDateString('pt-BR');
  const validade = new Date(new Date(quote.createdAt).getTime() + quote.validityDays * 86400000).toLocaleDateString('pt-BR');

  interface PaymentEntry { label:string; detail:string; amount:number }
  let paymentEntries: PaymentEntry[] = [];
  if (quote.paymentTerms) {
    try {
      const parsed = JSON.parse(quote.paymentTerms);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) {
        paymentEntries = parsed.items.map((it: {kind:string; valueType:string; value:number; dueDays:number}, idx:number) => {
          const label = it.kind === 'entrada' ? 'Entrada' : it.kind === 'saldo' ? 'Saldo' : `Parcela ${idx+1}`;
          const amount = it.valueType === 'percent' ? (quote.total * (it.value/100)) : Number(it.value);
          const valTxt = it.valueType === 'percent' ? `${it.value}%` : currencyBRL(Number(it.value));
          const detail = `${valTxt} em ${it.dueDays} dia(s)`;
          return { label, detail, amount };
        });
      } else {
        paymentEntries = quote.paymentTerms.split(/\n|;/).map(l=>l.trim()).filter(Boolean).map((t,i)=>({label:`Parcela ${i+1}`, detail:t, amount:0}));
      }
    } catch {
      paymentEntries = quote.paymentTerms.split(/\n|;/).map(l=>l.trim()).filter(Boolean).map((t,i)=>({label:`Parcela ${i+1}`, detail:t, amount:0}));
    }
  }

  return (
    <article className="print-area text-[12px] leading-relaxed text-foreground">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-gray-300">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg">{company.name}</h1>
          {company.address && <div>{company.address}</div>}
          <div className="text-muted-foreground">
            {[company.taxid && `CNPJ/CPF: ${company.taxid}`, company.phone, company.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        {company.logoDataUrl && (
          <img src={company.logoDataUrl} alt="Logo" className="h-16 w-32 object-contain ml-auto" />
        )}
      </div>

      {/* Linha título orçamento */}
      <div className="mt-3 font-semibold text-sm border-b border-gray-300 pb-1 flex flex-wrap gap-x-8 gap-y-1">
        <span>{quote.type === 'ORCAMENTO' ? 'Orçamento' : 'Pedido'} Nº {quote.number}</span>
        <span>Criado em {issueDate}</span>
        <span>Válido até {validade}</span>
      </div>

      {/* Dados Comerciais */}
      <div className="mt-3 grid gap-2">
        <div>
          <div><span className="font-semibold">Representante:</span> {quote.vendor?.name || '-'}</div>
          {quote.vendor?.phone && <div className="text-xs text-muted-foreground">Telefone: {quote.vendor.phone}</div>}
          {quote.vendor?.email && <div className="text-xs text-muted-foreground">Email: {quote.vendor.email}</div>}
        </div>
        <div>
          <div><span className="font-semibold">Cliente:</span> {quote.clientSnapshot.name}</div>
          {quote.clientSnapshot.taxid && <div className="text-xs text-muted-foreground">CNPJ/CPF: {quote.clientSnapshot.taxid}</div>}
          {quote.clientSnapshot.phone && <div className="text-xs text-muted-foreground">Telefone: {quote.clientSnapshot.phone}</div>}
          {quote.clientSnapshot.email && <div className="text-xs text-muted-foreground">Email: {quote.clientSnapshot.email}</div>}
          {quote.clientSnapshot.address && <div className="text-xs text-muted-foreground">Endereço: {quote.clientSnapshot.address}</div>}
        </div>
      </div>

      {/* Produtos */}
      <div className="mt-4">
        <h2 className="font-semibold mb-2">Produtos:</h2>
        <div className="space-y-4">
          {quote.items.map((it, i) => (
            <div key={i} className="flex gap-4 items-start border-b pb-4 last:border-b-0">
              {it.imageDataUrl && (
                <img src={it.imageDataUrl} alt={it.name} className="w-28 h-28 object-cover rounded border" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold uppercase text-sm">{it.name}</div>
                <div className="text-muted-foreground mb-2">Preço unitário: {currencyBRL(it.unitPrice)}  •  Quantidade: {it.quantity}</div>
                {(it.description || it.options) && (
                  <div className="whitespace-pre-wrap text-[11px] leading-snug">
                    {it.description}
                    {it.options && (it.description ? '\n' : '')}{it.options}
                  </div>
                )}
                <div className="mt-2 font-medium">Subtotal: {currencyBRL(it.subtotal)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="mt-4 space-y-1 max-w-sm">
        <div><span className="font-semibold">Subtotal:</span> {currencyBRL(quote.subtotal)}</div>
        <div><span className="font-semibold">Frete:</span> {currencyBRL(quote.freight)}</div>
        <div><span className="font-semibold">Método de pagamento:</span> {quote.paymentMethod}</div>
      </div>

      {/* Condições de pagamento */}
      {(paymentEntries.length > 0) && (
        <div className="mt-4">
          <h3 className="font-semibold mb-1">Condições de pagamento:</h3>
          <table className="w-full text-xs border border-gray-300">
            <thead className="bg-muted/60">
              <tr className="border-b border-gray-300">
                <th className="text-left p-1 font-medium">Parcela</th>
                <th className="text-left p-1 font-medium">Detalhes</th>
                <th className="text-left p-1 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {paymentEntries.map((p, idx) => (
                <tr key={idx} className="border-t border-gray-200">
                  <td className="p-1 align-top">{p.label}</td>
                  <td className="p-1 whitespace-pre-wrap">{p.detail}</td>
                  <td className="p-1 whitespace-pre-wrap">{p.amount ? currencyBRL(p.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observações / Notas */}
  {(quote.notes || paymentEntries.length === 0) && (
        <div className="mt-4">
          <h3 className="font-semibold mb-1">Observações:</h3>
          <div className="text-xs whitespace-pre-wrap leading-snug">
            {quote.notes || '—'}
          </div>
        </div>
      )}

      {/* Total Destaque */}
      <div className="mt-6 text-lg font-bold">Total: {currencyBRL(quote.total)}</div>

      {/* Assinaturas */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10 print:mt-16">
        <div className="flex flex-col items-center">
          <div className="w-56 border-t border-dashed border-gray-500 h-0" />
          <span className="mt-1 text-[11px] text-muted-foreground">Assinatura do Vendedor</span>
          <span className="text-xs font-medium mt-1">{quote.vendor?.name || '_________________'}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-56 border-t border-dashed border-gray-500 h-0" />
          <span className="mt-1 text-[11px] text-muted-foreground">Assinatura do Cliente</span>
          <span className="text-xs font-medium mt-1">{quote.clientSnapshot?.name || '_________________'}</span>
        </div>
      </div>
    </article>
  );
}