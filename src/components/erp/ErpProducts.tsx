  // Utilitário para formatar valores monetários (R$) apenas ao sair do campo
  function formatBRL(value: number|string|undefined): string {
    if(value === undefined || value === null || value === '') return '';
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^\d,]/g, '').replace(/(\d{2})$/, ',$1'));
    if(isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseBRL(value: string): number|undefined {
    if(!value) return undefined;
    let clean = value.replace(/[^\d,]/g, '');
    clean = clean.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  }

  // Calcula preço de venda a partir do custo e margem
  function calcSalePrice(cost: number|undefined, margin: number|undefined): number|undefined {
    if(cost === undefined || margin === undefined) return undefined;
    return +(cost * (1 + margin/100)).toFixed(2);
  }
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Product, Supplier } from '@/types';

interface ProductForm extends Partial<Product> {
  name: string;
  sale_price?: number;
  code_prefix?: string;
  stock_qty?: number;
  margin?: number;
}

const UNITS = ['UN','CX','KG','MT','LT','PC'];
const STATUS = ['ATIVO','INATIVO'];

export function ErpProducts(){
  const [rows,setRows]=useState<(Product & { stock?: number, reserved?: number })[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [page,setPage]=useState(0);
  const pageSize = 50; // menor lote para carregamento rápido
  const [hasMore,setHasMore]=useState(false);
  // Sugestões leves para autocomplete (não precisa do objeto Product completo)
  type ProdSuggestion = { id: string; name: string; code?: string };
  const [prodSearchSuggestions, setProdSearchSuggestions] = useState<ProdSuggestion[]>([]);
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [editing,setEditing]=useState<Product|null>(null);
  const makeEmpty = (): ProductForm => ({ name: '', unit: 'UN', status: 'ATIVO' });
  const [form,setForm]=useState<ProductForm>(makeEmpty());
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<null|Product>(null);
  const [extendedCols,setExtendedCols]=useState(true); // se false não enviar campos novos
  const [companyId,setCompanyId]=useState<string|undefined>(undefined);

  type ProductRow = Product & { created_at?: string };
  async function load(pageOverride?: number){
    const currentPage = pageOverride ?? page;
    setLoading(true);
    try {
      try { await (supabase as any).rpc('ensure_profile'); } catch(err) { if(import.meta.env.DEV) console.warn('ensure_profile rpc indisponível', err); }
      let q = (supabase as any)
        .from('products')
        .select('id,code,name,unit,sale_price,price,cost_price,status,created_at')
        .order('created_at',{ascending:false});
      if(debouncedSearch){
        q = q.or(`name.ilike.%${debouncedSearch}%,code.ilike.%${debouncedSearch}%`);
      }
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);
      const { data, error }:{ data: ProductRow[]|null; error: unknown } = await q;
      if(error) throw error;
      let products = (data as ProductRow[])||[];
      setHasMore(products.length === pageSize);
      const ids = products.map(p=>p.id);
      if(ids.length) {
        try {
          const { data: stocks } = await (supabase as any).from('product_stock').select('product_id,stock').in('product_id', ids);
          products = products.map(p=>{
            const found = stocks?.find((s:any)=>s.product_id===p.id);
            return { ...p, stock: found?.stock ?? 0 };
          });
        } catch(stockErr){ if(import.meta.env.DEV) console.warn('Falha ao buscar estoque', stockErr); }
      }
      if(import.meta.env.DEV){
        const sampleDebug = products.slice(0,10).map(p=>({id:p.id, img: (p as any).image_url}));
        console.log('[DEBUG products images]', sampleDebug);
      }
      setRows(products);
    } catch(e:unknown){ const msg = e instanceof Error? e.message: String(e); toast.error('Falha ao carregar produtos: '+msg); }
    finally { setLoading(false); }
  }
  async function loadSuppliers(){
    const { data, error }:{ data: Pick<Supplier,'id'|'name'>[]|null; error: unknown } = await (supabase as unknown as { from: any }).from('suppliers').select('id,name').eq('is_active', true).limit(200);
    if(!error) setSuppliers(data||[]);
  }
  useEffect(()=>{ load(0); loadSuppliers(); setPage(0); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Debounce da busca para evitar muitas requisições
  useEffect(()=>{
    const t = setTimeout(()=>{ setDebouncedSearch(search.trim()); setPage(0); load(0); }, 400);
    return ()=> clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[search]);
  // Autocomplete de produto na busca
  useEffect(() => {
    if (!search) { setProdSearchSuggestions([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,code')
        .or(`name.ilike.%${search}%,code.ilike.%${search}%`)
        .limit(10);
      if (!error && Array.isArray(data)) {
        // Garante que cada item tenha os campos mínimos
        setProdSearchSuggestions(data.map((p: any) => ({ id: String(p.id), name: String(p.name || ''), code: p.code ? String(p.code) : undefined })));
      } else setProdSearchSuggestions([]);
    })();
  }, [search]);
  // Carregar companyId do profile do usuário autenticado (evita pegar outro profile)
  useEffect(()=>{(async()=>{
    try {
      const { data: userRes } = await (supabase as any).auth.getUser();
      const user = userRes?.user;
      if(!user){ console.warn('Sem usuário autenticado para obter company_id'); return; }
      const { data, error } = await (supabase as any).from('profiles').select('company_id').eq('user_id', user.id).single();
      if(error){ console.warn('Erro ao buscar profile para company_id', error); return; }
      if(data?.company_id){ setCompanyId(data.company_id); }
      else console.warn('Profile sem company_id');
    } catch (err) { console.warn('Falha ao carregar company_id', err); }
  })();},[]);
  // Recarregar quando companyId definido (não obrigatório mas ajuda debug)
  // Quando companyId for obtido, recarrega. Ignoramos dependência de 'load' intencionalmente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(companyId) { load(); } },[companyId]);
  // Detecta se colunas estendidas existem (ex: brand). Se não, evita enviar para não gerar PGRST204
  useEffect(()=>{
    (async()=>{
      const test = await (supabase as unknown as { from:any }).from('products').select('brand').limit(1);
      if(test.error){
        setExtendedCols(false);
        if(import.meta.env.DEV) console.warn('Colunas estendidas ausentes, ocultando campos avançados. Aplique migration 20250831150000_extend_products_fields.sql');
      }
    })();
  },[]);

  async function save(imageUrlOverride?: string){
  if(!form.name.trim()){ toast.error('Nome obrigatório'); return; }
    if(!form.code || !form.code.trim()){
      toast.error('Código obrigatório');
      return;
    }
    // Verificar unicidade do código
  // cast to any to avoid deep generic instantiation in TS when selecting minimal fields
  // Verificar código existente sem gerar filtro inválido quando não estiver editando
  let codeQuery = (supabase as any)
      .from('products')
      .select('id')
      .eq('code', form.code.trim())
      .limit(1);
  if(editing?.id) codeQuery = codeQuery.neq('id', editing.id);
  const { data: codeExists } = await codeQuery.single();
    if(codeExists){
      toast.error('Já existe um produto com este código!');
      return;
    }
  const salePrice = Number(form.sale_price||form.price||0);
    // Evitar herdar imagem de edição anterior ao criar novo (se usuário abriu 'Novo' após editar)
    if(!editing && !imageFile && form.image_url){
      // limpar imagem herdada silenciosamente
      form.image_url = undefined;
    }
    if(isNaN(salePrice)){ toast.error('Preço inválido'); return; }
  setSaving(true);
    try {
  const effectiveImageUrl = imageUrlOverride !== undefined ? imageUrlOverride : form.image_url;
  const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description||null,
  code: (form.code && form.code !== 'sample_code') ? form.code : null,
        category: form.category||null,
        brand: form.brand||null,
        model: form.model||null,
        unit: form.unit||null,
        stock_min: form.stock_min? Number(form.stock_min):null,
        stock_max: form.stock_max? Number(form.stock_max):null,
        location: form.location||null,
        cost_price: form.cost_price? Number(form.cost_price):null,
        sale_price: salePrice,
        price: salePrice, // manter compatível
        status: form.status||'ATIVO',
        validity_date: form.validity_date||null,
        lot_number: form.lot_number||null,
        default_supplier_id: form.default_supplier_id||null,
        payment_terms: form.payment_terms||null,
        ncm: form.ncm||null,
        cfop: form.cfop||null,
        cest: form.cest||null,
        cst: form.cst||null,
        origin: form.origin||null,
        icms_rate: form.icms_rate? Number(form.icms_rate):null,
        pis_rate: form.pis_rate? Number(form.pis_rate):null,
        cofins_rate: form.cofins_rate? Number(form.cofins_rate):null,
  // garantir persistência da imagem (antes não era enviada no payload)
  image_url: effectiveImageUrl || null,
      };
      if(companyId) payload.company_id = companyId;
      if(!extendedCols){
        const allowed = ['name','description','price','sale_price','status'];
        Object.keys(payload).forEach(k=>{ if(!allowed.includes(k)) delete payload[k]; });
        if(companyId) payload.company_id = companyId; // garantir
      }
      let resp: { data: ProductRow|null; error: unknown };
      let oldStock = 0;
      if(editing) {
        // Buscar estoque atual para comparar
        const { data: stockData } = await (supabase as any).from('product_stock').select('stock').eq('product_id', editing.id).single();
        oldStock = stockData?.stock ?? 0;
        resp = await (supabase as unknown as { from: any }).from('products').update(payload).eq('id', editing.id).select('*').single();
        // Se quantidade de estoque mudou, registrar ajuste
        if(resp.data && typeof form.stock_qty === 'number' && form.stock_qty !== oldStock) {
          const diff = form.stock_qty - oldStock;
          if(diff !== 0) {
            try {
              await supabase.rpc('register_stock_movement', {
                p_product_id: resp.data.id,
                p_qty: Math.abs(diff),
                p_type: diff > 0 ? 'IN' : 'OUT',
                p_reason: 'Ajuste manual',
                p_location_from: null,
                p_location_to: null,
                p_related_sale_id: null,
                p_metadata: null
              });
            } catch(e) { if(import.meta.env.DEV) console.error('Erro ao ajustar estoque', e); }
          }
        }
      } else {
        resp = await (supabase as unknown as { from: any }).from('products').insert(payload).select('*').single();
        // Se estoque inicial informado, criar movimentação de entrada
        if(resp.data && form.stock_qty && form.stock_qty > 0) {
          try {
            await supabase.rpc('register_stock_movement', {
              p_product_id: resp.data.id,
              p_qty: form.stock_qty,
              p_type: 'IN',
              p_reason: 'Cadastro inicial',
              p_location_from: null,
              p_location_to: null,
              p_related_sale_id: null,
              p_metadata: null
            });
          } catch(e) { if(import.meta.env.DEV) console.error('Erro ao registrar estoque inicial', e); }
        }
      }
      if(resp.error) throw resp.error;
  toast.success(editing?'Produto atualizado':'Produto criado');
  // resetar somente após garantir que imagem persistiu
  setOpen(false); setEditing(null); setForm(makeEmpty()); load();
    } catch(e:unknown){ toast.error(extractErr(e)); if(import.meta.env.DEV) console.error('save product error', e); }
    setSaving(false);
  }

  // Utilitário unificado para gerar código evitando falso negativo de erro (agora com prefixo opcional)
  // Gera código aleatório local de 6 dígitos
  function generateLocalCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function startNew(){
    setEditing(null);
    setImageFile(null);
    setForm(makeEmpty());
    setOpen(true);
  }
  function normalizeNumber(v: unknown): number|undefined {
    if(v === null || v === undefined || v === '') return undefined;
    if(typeof v === 'number') return v;
    if(typeof v === 'string') { const n = Number(v.replace(',','.')); return isNaN(n)? undefined : n; }
    return undefined;
  }
  function startEdit(p:Product){
    // Normalizar campos possivelmente retornados como string (numeric) ou objetos
    const norm: ProductForm = {
      ...p,
      sale_price: normalizeNumber((p as any).sale_price ?? p.price),
      cost_price: normalizeNumber((p as any).cost_price),
      stock_min: normalizeNumber((p as any).stock_min),
      stock_max: normalizeNumber((p as any).stock_max),
      icms_rate: normalizeNumber((p as any).icms_rate),
      pis_rate: normalizeNumber((p as any).pis_rate),
      cofins_rate: normalizeNumber((p as any).cofins_rate)
    };
    // Sanitizar qualquer objeto inesperado (evitar [object Object] em inputs)
  const scrubbed: ProductForm = Object.fromEntries(
      Object.entries(norm).map(([k,v])=> {
        if(v && typeof v === 'object') {
          if (v instanceof Date) return [k, v.toISOString().slice(0,10)];
          return [k, ''];
        }
        return [k,v];
      })
    ) as ProductForm;
  // Se a linha passada contém stock (vinda da listagem), popular stock_qty para exibição
  const maybeStock = (p as any).stock;
  if(typeof maybeStock === 'number') scrubbed.stock_qty = maybeStock;
  // Se código legado placeholder, limpar para forçar geração nova
  if(scrubbed.code === 'sample_code') scrubbed.code = '';
  if(import.meta.env.DEV) console.log('Editar produto raw:', p);
  // clonar para evitar mutação por referência direta ao objeto listado em `rows`
  setEditing({ ...p });
    setForm(scrubbed);
    setOpen(true);
  }
  async function toggleStatus(p:Product){
    try {
      const newStatus = p.status==='INATIVO' ? 'ATIVO' : 'INATIVO';
      const { error } = await (supabase as unknown as { from: any }).from('products').update({ status:newStatus }).eq('id', p.id);
      if(error) throw error; toast.success('Status atualizado'); load();
    } catch(e:unknown){ toast.error(extractErr(e)); if(import.meta.env.DEV) console.error('toggle status error', e); }
  }
  async function doDelete(){
    if(!confirmDelete) return;
    try {
      const { error } = await (supabase as unknown as { from:any }).from('products').delete().eq('id', confirmDelete.id);
      if(error) throw error; toast.success('Produto removido'); setConfirmDelete(null); load();
    } catch(e:unknown){ toast.error(extractErr(e)); if(import.meta.env.DEV) console.error('delete product error', e); }
  }

  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Produtos</h2>
        <p className="text-sm text-muted-foreground">Cadastro completo de itens para estoque, vendas e fiscal.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap">
  <div className="relative">
    <Input
      placeholder="Buscar nome ou código"
      value={search}
      onChange={e=>setSearch(e.target.value)}
      className="w-48"
      autoComplete="off"
    />
    {prodSearchSuggestions.length > 0 && (
      <ul className="absolute z-10 bg-white border rounded w-48 mt-1 shadow-lg max-h-40 overflow-auto text-xs">
        {prodSearchSuggestions.map(p => (
          <li
            key={p.id}
            className="px-2 py-1 cursor-pointer hover:bg-muted/30"
            onClick={() => {
              setSearch(p.code ? `${p.code} - ${p.name}` : p.name);
              setProdSearchSuggestions([]);
            }}
          >
            {p.code ? <span className="font-mono text-slate-600">{p.code}</span> : null} {p.name}
          </li>
        ))}
      </ul>
    )}
  </div>
  <Button size="sm" onClick={()=>{ setPage(0); load(0); }} disabled={loading} className="relative">
    Filtrar
    {loading && <span className="ml-2 inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin align-middle" aria-label="Carregando" />}
  </Button>
  <Button size="sm" onClick={startNew}>Novo</Button>
      </div>
    </header>
    <div className="border rounded max-h-[520px] overflow-auto">
      <table className="w-full text-xs">
  <thead className="bg-muted/50 sticky top-0"><tr><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1">Un</th><th className="px-2 py-1 text-right">Custo Médio</th><th className="px-2 py-1 text-right">Preço Venda</th><th className="px-2 py-1 text-right">Estoque</th><th className="px-2 py-1 text-right">Reservado</th><th className="px-2 py-1">Status</th><th className="px-2 py-1"/></tr></thead>
        <tbody>
          {rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 font-mono truncate max-w-[120px]" title={r.code||''}>{r.code||'-'}</td>
            <td className="px-2 py-1 truncate max-w-[240px]" title={r.name}>{r.name}</td>
            <td className="px-2 py-1 text-center">{r.unit||'-'}</td>
            <td className="px-2 py-1 text-right">{r.cost_price != null ? r.cost_price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-'}</td>
            <td className="px-2 py-1 text-right">{(r.sale_price||r.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{r.stock ?? '-'}</td>
            <td className="px-2 py-1 text-right">{r.reserved ?? '-'}</td>
            <td className="px-2 py-1 text-center"><button onClick={()=>toggleStatus(r)} className={"underline-offset-2 hover:underline "+(r.status==='INATIVO'? 'text-red-500':'text-green-600')}>{r.status||'ATIVO'}</button></td>
            <td className="px-2 py-1 text-right flex gap-1 justify-end">
              <Button size="sm" variant="outline" onClick={()=>startEdit(r)}>Editar</Button>
              <button
                onClick={()=>setConfirmDelete(r)}
                aria-label="Excluir"
                title="Excluir"
                className="text-red-600 font-bold text-lg leading-none px-1 hover:text-red-700 focus:outline-none"
              >
                ×
              </button>
            </td>
          </tr>)}
          {rows.length===0 && !loading && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Sem produtos</td></tr>}
          {loading && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
      <div>Página {page+1} • {rows.length} itens {debouncedSearch? 'filtrados':''}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={loading || page===0} onClick={()=>{ const np = Math.max(0,page-1); setPage(np); load(np); }}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={loading || !hasMore} onClick={()=>{ const np = page+1; setPage(np); load(np); }}>Próxima</Button>
      </div>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editing? 'Editar Produto':'Novo Produto'}</DialogTitle>
        </DialogHeader>
        {/* descrição invisível para acessibilidade evitando warning */}
        <p id="product-dialog-desc" className="sr-only">Formulário de cadastro e edição de produto.</p>
        <div className="grid gap-6 text-xs" aria-describedby="product-dialog-desc">
          {/* Básico */}
          {extendedCols && <section className="space-y-2">
            <h3 className="font-semibold text-sm">Básico</h3>
            <div className="grid md:grid-cols-4 gap-2">
              <div className="flex gap-2">
                <Input placeholder="Código *" value={form.code||''} onChange={e=>setForm(f=>({...f,code:e.target.value}))} required />
                <Button type="button" variant="outline" size="sm" onClick={()=>{
                  const code = generateLocalCode();
                  setForm(f=>({...f, code }));
                }}>Gerar</Button>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Nome *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                {/* Botão de gerar código remoto removido pois generateRemoteCode não existe */}
              </div>
              <select className="h-9 border rounded px-2" value={form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                <option value="">Unidade</option>
                {UNITS.map(u=> <option key={u} value={u}>{u}</option>)}
              </select>
              <select className="h-9 border rounded px-2" value={form.status||'ATIVO'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid md:grid-cols-5 gap-2">
              <Input placeholder="Categoria" value={form.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))} />
              <Input placeholder="Marca" value={form.brand||''} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} />
              <Input placeholder="Modelo" value={form.model||''} onChange={e=>setForm(f=>({...f,model:e.target.value}))} />
              <Input placeholder="Localização" value={form.location||''} onChange={e=>setForm(f=>({...f,location:e.target.value}))} />
              <Input placeholder="Prefixo Código (opc)" value={(form as any).code_prefix||''} onChange={e=>setForm(f=>({...f, code_prefix:e.target.value||undefined}))} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0]||null)} className="text-xs" />
                <div className="text-[10px] text-muted-foreground">Imagem (opcional)</div>
              </div>
              {(editing?.image_url || imageFile) && (
                <div className="flex items-center gap-2">
                  {imageFile && <img src={URL.createObjectURL(imageFile)} alt="preview" className="h-16 w-16 object-cover rounded border" />}
                  {!imageFile && editing?.image_url && <img src={editing.image_url} alt="img" className="h-16 w-16 object-cover rounded border" />}
                  {(imageFile || editing?.image_url || editing?.imageDataUrl) && <Button size="sm" variant="outline" onClick={()=>{setImageFile(null); setForm(f=>({...f, image_url: undefined, imageDataUrl: undefined})); if(editing) setEditing({...editing, image_url: undefined, imageDataUrl: undefined} as Product);}}>Remover</Button>}
                </div>
              )}
            </div>
            <Textarea placeholder="Descrição / Observações" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} />
          </section>}
          {!extendedCols && <section className="space-y-2">
            <h3 className="font-semibold text-sm">Básico</h3>
            <div className="grid md:grid-cols-4 gap-2">
              <Input placeholder="Nome *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              <select className="h-9 border rounded px-2" value={form.status||'ATIVO'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
              <Input placeholder="Preço Venda *" value={formatBRL(form.sale_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, sale_price: parsed }));
                }}
                inputMode="decimal"
              />
              <Input placeholder="Custo" value={formatBRL(form.cost_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, cost_price: parsed }));
                }}
                inputMode="decimal"
              />
            </div>
            <Textarea placeholder="Descrição" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} />
            <div className="text-xs text-amber-600">Colunas avançadas ausentes. Aplique migration 20250831150000_extend_products_fields.sql para liberar campos completos.</div>
          </section>}
          {/* Estoque */}
            {extendedCols && <section className="space-y-2">
              <h3 className="font-semibold text-sm">Estoque</h3>
              <div className="grid md:grid-cols-4 gap-2">
                <Input placeholder="Quantidade em Estoque" value={form.stock_qty ?? ''} readOnly disabled className="bg-gray-50/60" />
                <div className="text-[11px] text-muted-foreground">Controlado por Movimentações de Estoque — para alterar, registre um movimento.</div>
                <Input placeholder="Estoque Mínimo" value={form.stock_min||''} onChange={e=>setForm(f=>({...f,stock_min:e.target.value? Number(e.target.value):undefined}))} />
                <Input placeholder="Estoque Máximo" value={form.stock_max||''} onChange={e=>setForm(f=>({...f,stock_max:e.target.value? Number(e.target.value):undefined}))} />
                <Input placeholder="Lote" value={form.lot_number||''} onChange={e=>setForm(f=>({...f,lot_number:e.target.value}))} />
                <Input type="date" placeholder="Validade" value={form.validity_date||''} onChange={e=>setForm(f=>({...f,validity_date:e.target.value}))} />
              </div>
            </section>}
          {/* Preços */}
          {extendedCols && <section className="space-y-2">
            <h3 className="font-semibold text-sm">Preços</h3>
            <div className="grid md:grid-cols-4 gap-2">
              <Input placeholder="Custo" value={formatBRL(form.cost_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, cost_price: parsed }));
                }}
                inputMode="decimal"
              />
              <Input placeholder="Preço Venda *" value={formatBRL(form.sale_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, sale_price: parsed }));
                }}
                inputMode="decimal"
              />
              <Input placeholder="Margem %" value={form.margin ?? ''}
                onChange={e=>{
                  const margin = Number(e.target.value.replace(/[^\d.]/g, ''));
                  if(!isNaN(margin)) {
                    setForm(f=>{
                      const cost = f.cost_price ?? 0;
                      return { ...f, margin, sale_price: calcSalePrice(cost, margin) };
                    });
                  } else {
                    setForm(f=>({...f, margin: undefined }));
                  }
                }}
                inputMode="decimal"
              />
              <Input placeholder="Prazo Pagamento" value={form.payment_terms||''} onChange={e=>setForm(f=>({...f,payment_terms:e.target.value}))} />
            </div>
          </section>}
          {/* Fiscal */}
          {extendedCols && <section className="space-y-2">
            <h3 className="font-semibold text-sm">Fiscal / Tributação</h3>
            <div className="grid md:grid-cols-6 gap-2">
              <Input placeholder="NCM" value={form.ncm||''} onChange={e=>setForm(f=>({...f,ncm:e.target.value}))} />
              <Input placeholder="CFOP" value={form.cfop||''} onChange={e=>setForm(f=>({...f,cfop:e.target.value}))} />
              <Input placeholder="CEST" value={form.cest||''} onChange={e=>setForm(f=>({...f,cest:e.target.value}))} />
              <Input placeholder="CST/CSOSN" value={form.cst||''} onChange={e=>setForm(f=>({...f,cst:e.target.value}))} />
              <Input placeholder="Origem (0..8)" value={form.origin||''} onChange={e=>setForm(f=>({...f,origin:e.target.value}))} />
              <Input placeholder="ICMS %" value={form.icms_rate??''} onChange={e=>setForm(f=>({...f,icms_rate:e.target.value? Number(e.target.value):undefined}))} />
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              <Input placeholder="PIS %" value={form.pis_rate??''} onChange={e=>setForm(f=>({...f,pis_rate:e.target.value? Number(e.target.value):undefined}))} />
              <Input placeholder="COFINS %" value={form.cofins_rate??''} onChange={e=>setForm(f=>({...f,cofins_rate:e.target.value? Number(e.target.value):undefined}))} />
              <select className="h-9 border rounded px-2" value={form.default_supplier_id||''} onChange={e=>setForm(f=>({...f,default_supplier_id:e.target.value||undefined}))}>
                <option value="">Fornecedor Padrão</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </section>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button onClick={async()=>{
            // upload imagem antes de salvar se houver
            let uploadedUrl: string | undefined;
            // Preparar arquivo para upload (pode vir de estado ou de uma dataURL existente)
            let fileToUpload: File | null = imageFile;
            if(!fileToUpload && typeof form.image_url === 'string' && form.image_url.startsWith('data:')){
              try {
                const m = form.image_url.match(/^data:(.+);base64,(.*)$/);
                if(m){
                  const mime = m[1];
                  const b64 = m[2];
                  const bin = atob(b64);
                  const arr = new Uint8Array(bin.length);
                  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
                  const ext = mime.includes('png')? 'png': mime.includes('jpeg')? 'jpg':'bin';
                  fileToUpload = new File([arr], `inline-${Date.now()}.${ext}`, { type: mime });
                }
              } catch(err){ if(import.meta.env.DEV) console.warn('Falha converter dataURL inline em arquivo', err); }
            }
            if(fileToUpload){
              try {
                const identifier = editing?.id ? String(editing.id) : String(Date.now());
                const randomSuffix = Math.random().toString(36).slice(2,8);
                const path = `produtos/${identifier}-${Date.now()}-${randomSuffix}-${fileToUpload.name}`;
                // tenta bucket específico de imagens do produto
                let bucket = 'product-images';
                let upErr: any = null;
                try {
                  const res = await supabase.storage.from(bucket).upload(path, fileToUpload, { upsert:false });
                  upErr = (res as any).error;
                  if(!upErr){
                    // Sempre tentar gerar signed URL (funciona para bucket privado e público)
                    let signedUrl: string | undefined;
                    try {
                      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60*60*24*30);
                      signedUrl = signed?.signedUrl;
                    } catch(_e){ /* ignore */ }
                    if(!signedUrl){
                      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path) as any;
                      signedUrl = pub?.publicUrl;
                    }
                    uploadedUrl = signedUrl;
                    // aplicar apenas ao form e ao produto em edição
                    setForm(f=>({...f, image_url: uploadedUrl }));
                    if(editing) setEditing({...editing, image_url: uploadedUrl, imageDataUrl: uploadedUrl} as Product);
                  }
                } catch(errInner) {
                  upErr = errInner;
                }
                // Se bucket não existe ou upload falhar com esse erro, tenta bucket 'logos' como fallback
                if(upErr) {
                  const msg = extractErr(upErr);
                  if(msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found')){
                    bucket = 'logos';
                    try {
                      const res2 = await supabase.storage.from(bucket).upload(path, fileToUpload, { upsert:false });
                      if((res2 as any).error) throw (res2 as any).error;
                      let signedUrl2: string | undefined;
                      try {
                        const { data: signed2 } = await supabase.storage.from(bucket).createSignedUrl(path, 60*60*24*30);
                        signedUrl2 = signed2?.signedUrl;
                      } catch(_e){ /* ignore */ }
                      if(!signedUrl2){
                        const { data: pub2 } = supabase.storage.from(bucket).getPublicUrl(path) as any;
                        signedUrl2 = pub2?.publicUrl;
                      }
                      uploadedUrl = signedUrl2;
                      setForm(f=>({...f, image_url: uploadedUrl }));
                      if(editing) setEditing({...editing, image_url: uploadedUrl, imageDataUrl: uploadedUrl} as Product);
                    } catch(err2) {
                      // Se o fallback também falhar por bucket não encontrado, converter para data URL e salvar direto no campo image_url
                      const errMsg = extractErr(err2 || upErr).toLowerCase();
                      if(errMsg.includes('bucket') || errMsg.includes('not found')){
                        // converter arquivo em data URL
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
                          reader.readAsDataURL(fileToUpload!);
                        });
                        uploadedUrl = dataUrl;
                        setForm(f=>({...f, image_url: uploadedUrl, imageDataUrl: uploadedUrl }));
                        if(editing) setEditing({...editing, image_url: uploadedUrl, imageDataUrl: uploadedUrl} as Product);
                      } else {
                        throw err2 || upErr;
                      }
                    }
                  } else {
                    throw upErr;
                  }
                }
              } catch(e:unknown){ toast.error('Upload falhou: '+ extractErr(e)); if(import.meta.env.DEV) console.error('upload error', e); }
            }
            // Se não houver novo upload mas já existe image_url no form, manter
            if(!uploadedUrl && form.image_url) uploadedUrl = form.image_url;
            if(uploadedUrl) {
              setForm(f=>({...f, image_url: uploadedUrl}));
            }
            // salvar e atualizar apenas a linha alterada em memória
             await save(uploadedUrl);
            // garantir que rows reflitam a alteração (caso backend não retorne a URL imediatamente)
            if(editing && (editing.id)){
              setRows(prev => prev.map(r => r.id === editing.id ? { ...r, image_url: form.image_url || uploadedUrl } : r));
            }
          }} disabled={saving}>{saving? 'Salvando...':'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!confirmDelete} onOpenChange={(o)=>!o && setConfirmDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover produto?</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="text-sm">Esta ação é permanente. Confirma excluir <b>{confirmDelete?.name}</b>?</div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={()=>setConfirmDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}

function calcMargin(f:ProductForm){
  if(!f.sale_price || !f.cost_price || f.cost_price===0) return '';
  const m = ((f.sale_price - f.cost_price)/f.sale_price)*100; return m.toFixed(1);
}

function extractErr(e:unknown): string {
  if(!e) return 'Erro desconhecido';
  if(typeof e === 'string') return e;
  if(e instanceof Error) return e.message;
  if(typeof e === 'object') {
    try { return JSON.stringify(e); } catch { return Object.prototype.toString.call(e); }
  }
  return String(e);
}
