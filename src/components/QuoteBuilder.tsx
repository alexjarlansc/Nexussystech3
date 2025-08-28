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
import { StorageKeys, getJSON, setJSON, getString } from '@/utils/storage';
import { hashSHA256 } from '@/utils/crypto';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

function currencyBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function nextNumber(type: QuoteType, used: Set<string>): string {
  const key = type === 'ORCAMENTO' ? StorageKeys.orcCounter : StorageKeys.pedCounter;
  let idx = parseInt(getString(key, '0') || '0', 10);
  let number = '';
  do {
    idx += 1;
    number = `${type === 'ORCAMENTO' ? 'ORC' : 'PED'}-${String(idx).padStart(6, '0')}`;
  } while (used.has(number));
  localStorage.setItem(key, String(idx));
  return number;
}

export default function QuoteBuilder() {
  const { profile, user } = useAuth();
  const [type, setType] = useState<QuoteType>('ORCAMENTO');
  const [validityDays, setValidityDays] = useState(7);
  const [vendor, setVendor] = useState<Vendor>({
    name: '',
    phone: '',
    email: ''
  });
  const [clients, setClients] = useState<Client[]>(() => getJSON<Client[]>(StorageKeys.clients, []));
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>(() => getJSON<Quote[]>(StorageKeys.quotes, []));

  const [clientId, setClientId] = useState<string>('');
  const [items, setItems] = useState<QuoteItemSnapshot[]>([]);
  const [freight, setFreight] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [paymentTerms, setPaymentTerms] = useState('');
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
  const [discountAmount, setDiscountAmount] = useState(0);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.subtotal, 0), [items]);
  const discountValue = useMemo(() => {
    if (discountType === 'percentage') {
      return subtotal * (discountAmount / 100);
    }
    return discountAmount;
  }, [subtotal, discountType, discountAmount]);
  const subtotalWithDiscount = useMemo(() => subtotal - discountValue, [subtotal, discountValue]);
  const total = useMemo(() => subtotalWithDiscount + freight, [subtotalWithDiscount, freight]);

  useEffect(() => {
    setJSON(StorageKeys.clients, clients);
  }, [clients]);
  useEffect(() => {
    setJSON(StorageKeys.quotes, quotes);
  }, [quotes]);

  // Carregar produtos do banco de dados
  useEffect(() => {
    if (profile?.company_id) {
      loadProducts();
    }
  }, [profile?.company_id]);

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

  function handleSaveQuote() {
    const used = new Set(quotes.map((q) => q.number));
    const number = nextNumber(type, used);
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

    const quote: Quote = {
      id: crypto.randomUUID(),
      number,
      type,
      createdAt: new Date().toISOString(),
      validityDays,
      vendor,
      clientId,
      clientSnapshot: client,
      items,
      freight,
      paymentMethod,
      paymentTerms,
      notes,
      status,
      subtotal,
      total,
    };
    setQuotes((qs) => [quote, ...qs]);
    setItems([]);
    toast.success(`${type === 'ORCAMENTO' ? 'Orçamento' : 'Pedido'} ${number} salvo`);
  }

  async function handleDeleteQuote(id: string) {
    const pwd = prompt('Digite a senha para excluir (reikar2025)');
    if (pwd === null) return;
    if (pwd !== 'reikar2025') {
      toast.error('Senha incorreta');
      return;
    }
    setQuotes((qs) => qs.filter((q) => q.id !== id));
    toast.success('Registro excluído');
  }

  // Client modal state
  const [cName, setCName] = useState('');
  const [cTax, setCTax] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddr, setCAddr] = useState('');

  async function addClient() {
    if (!cName) { toast.error('Nome do cliente é obrigatório'); return; }
    const client: Client = {
      id: crypto.randomUUID(),
      name: cName,
      taxId: cTax,
      phone: cPhone,
      email: cEmail,
      address: cAddr,
    };
    setClients((arr) => [client, ...arr]);
    setClientId(client.id);
    setOpenClient(false);
    setCName(''); setCTax(''); setCPhone(''); setCEmail(''); setCAddr('');
    // Salvar no Supabase
    const { error } = await supabase
      .from('clients')
      .insert({
        name: client.name,
        taxid: client.taxId || null,
        phone: client.phone || null,
        email: client.email || null,
        address: client.address || null,
        company_id: profile?.company_id || null,
        created_by: user?.id || null
      });
    if (error) {
      toast.error('Erro ao salvar cliente no banco: ' + error.message);
    } else {
      toast.success('Cliente cadastrado no banco!');
    }
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
      const { error } = await supabase
        .from('products')
        .insert({
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
      
      // Recarregar produtos
      loadProducts();
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
      toast.error('Erro ao cadastrar produto');
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

  return (
    <main className="container mx-auto">
      <section aria-labelledby="editor" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-elevated p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border overflow-hidden">
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

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Dados do Vendedor</h3>
                <Input placeholder="Nome" value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
                <Input placeholder="Telefone" value={vendor.phone} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
                <Input placeholder="Email" type="email" value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Cliente</h3>
                  <Button size="sm" variant="secondary" onClick={() => setOpenClient(true)}>Cadastrar Cliente</Button>
                </div>
                <ClientSearch
                  clients={clients}
                  onSelect={c => setClientId(c.id)}
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Itens</h3>
                <div className="flex gap-2">
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
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
                  <div className="col-span-6 md:col-span-6">Produto</div>
                  <div className="col-span-2 text-right">Qtd</div>
                  <div className="col-span-2 text-right">Unitário</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
                    <div className="col-span-6 flex items-center gap-3">
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
                    <div className="col-span-2 text-right">{currencyBRL(it.unitPrice)}</div>
                    <div className="col-span-2 text-right font-medium">{currencyBRL(it.subtotal)}</div>
                    <div className="col-span-12 text-right">
                      <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frete">Frete</Label>
                <Input id="frete" type="number" step="0.01" value={freight}
                  onChange={(e) => setFreight(Number(e.target.value))}
                />
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
                <Input placeholder="Ex: 30/60 dias, entrada + parcelas..." value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
              <div className="space-y-2">
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
            <div className="mt-6 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-4">
                <Label>Desconto:</Label>
              </div>
              <div className="col-span-8 flex gap-2">
                <Select value={discountType} onValueChange={(v: 'percentage' | 'value') => setDiscountType(v)}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="value">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-right ml-auto">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div className="text-lg font-semibold">{currencyBRL(subtotal)}</div>
                {discountValue > 0 && (
                  <>
                    <div className="text-sm text-red-600">Desconto</div>
                    <div className="text-lg font-semibold text-red-600">-{currencyBRL(discountValue)}</div>
                  </>
                )}
                <div className="text-sm text-muted-foreground">Frete</div>
                <div className="text-lg font-semibold">{currencyBRL(freight)}</div>
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
                      <div className="font-semibold">{q.number}</div>
                      <div className="text-xs text-muted-foreground">{q.type==='ORCAMENTO' ? 'Orçamento' : 'Pedido'} · {new Date(q.createdAt).toLocaleDateString('pt-BR')} · Validade {q.validityDays}d</div>
                      <div className="text-xs">Cliente: {q.clientSnapshot.name}</div>
                      <div className="text-xs">Total: {currencyBRL(q.total)}</div>
                      <div className="text-xs">Status: {q.status}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => setOpenReceipt(q.id)}>Recibo</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteQuote(q.id)}>Excluir</Button>
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
      <Dialog open={openSearchProduct} onOpenChange={setOpenSearchProduct}>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Recibo</DialogTitle></DialogHeader>
          {openReceipt && (
            <ReceiptView quote={quotes.find((q) => q.id === openReceipt)!} />
            )}
          <DialogFooter>
            <Button className="no-print" onClick={() => window.print()}>Exportar PDF</Button>
          </DialogFooter>
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
  const company = getJSON<CompanyInfo>(StorageKeys.company, {
    name: 'Nexus Systech',
    address: '',
    taxId: '',
    phone: '',
    email: '',
    logoDataUrl: undefined,
  });

  return (
    <article className="text-sm print-area">
      <header className="flex items-start justify-between avoid-break">
        <div>
          <div className="text-2xl font-bold">{company.name || 'Nexus Systech'}</div>
          {company.address && <div className="text-muted-foreground">{company.address}</div>}
          <div className="text-muted-foreground">
            {[company.taxId ? `CNPJ/CPF: ${company.taxId}` : null, company.phone, company.email]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {company.logoDataUrl && (
          <img src={company.logoDataUrl} alt={`Logo ${company.name || 'da empresa'}`} className="h-16 w-16 object-contain" />
        )}
      </header>

      <section className="mt-4 avoid-break">
        <div className="text-xl font-bold">{quote.type === 'ORCAMENTO' ? 'Orçamento' : 'Pedido'} {quote.number}</div>
        <div className="text-muted-foreground">
          Emissão: {new Date(quote.createdAt).toLocaleDateString('pt-BR')} · Validade: {quote.validityDays} dias
        </div>
        <div className="mt-2">Vendedor: {quote.vendor.name} · {quote.vendor.phone} · {quote.vendor.email}</div>
        <div className="mt-1">
          Cliente: {quote.clientSnapshot.name}
          {quote.clientSnapshot.taxId ? ` · ${quote.clientSnapshot.taxId}` : ''}
          {quote.clientSnapshot.phone ? ` · ${quote.clientSnapshot.phone}` : ''}
          {quote.clientSnapshot.email ? ` · ${quote.clientSnapshot.email}` : ''}
          {quote.clientSnapshot.address ? ` · ${quote.clientSnapshot.address}` : ''}
        </div>
      </section>

      <section className="mt-4 border rounded-md overflow-hidden avoid-break">
        <div className="grid grid-cols-12 gap-2 p-2 bg-accent/60 font-medium">
          <div className="col-span-7">Produto</div>
          <div className="col-span-1 text-right">Qtd</div>
          <div className="col-span-2 text-right">Unitário</div>
          <div className="col-span-2 text-right">Subtotal</div>
        </div>
        {quote.items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 p-2 border-t product-row avoid-break">
            <div className="col-span-7">
              <div className="font-semibold">{it.name}</div>
              {(it.description || it.options) && (
                <div className="text-xs text-muted-foreground">{it.description} {it.options ? `· ${it.options}` : ''}</div>
              )}
            </div>
            <div className="col-span-1 text-right">{it.quantity}</div>
            <div className="col-span-2 text-right">{currencyBRL(it.unitPrice)}</div>
            <div className="col-span-2 text-right">{currencyBRL(it.subtotal)}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 ml-auto max-w-xs space-y-1 avoid-break">
        <div className="flex justify-between"><span>Subtotal</span><span>{currencyBRL(quote.subtotal)}</span></div>
        <div className="flex justify-between"><span>Frete</span><span>{currencyBRL(quote.freight)}</span></div>
        <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>{currencyBRL(quote.total)}</span></div>
      </section>

      <section className="mt-4 avoid-break">
        <div>Método de pagamento: {quote.paymentMethod}</div>
        {quote.paymentTerms && <div>Condições: {quote.paymentTerms}</div>}
        {quote.notes && (
          <div className="mt-2">
            <div className="font-medium">Observações</div>
            <div className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</div>
          </div>
        )}
      </section>
    </article>
  );
}