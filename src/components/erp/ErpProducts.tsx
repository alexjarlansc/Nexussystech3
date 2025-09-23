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
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  options?: string | null;
}

const UNITS = ['UN','CX','KG','MT','LT','PC'];
const STATUS = ['ATIVO','INATIVO'];

export function ErpProducts(){
  const { profile } = useAuth();
  const [rows,setRows]=useState<(Product & { stock?: number, reserved?: number, available?: number })[]>([]);
  const [stockViewColumns, setStockViewColumns] = useState<string[]|null>(null);
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
  const [productGroups,setProductGroups]=useState<{ id:string; name:string; level:number; parent_id:string|null }[]>([]);
  const [loadingGroups,setLoadingGroups]=useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string|undefined>(undefined);
  const [selectedSectorId, setSelectedSectorId] = useState<string|undefined>(undefined);
  const [editing,setEditing]=useState<Product|null>(null);
  const makeEmpty = (): ProductForm => ({ name: '', unit: 'UN', status: 'ATIVO' });
  const [form,setForm]=useState<ProductForm>(makeEmpty());
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<null|Product>(null);
  const [optionalsOpen, setOptionalsOpen] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [optionGroups, setOptionGroups] = useState<{ id?: string; name: string; items: { id?: string; name: string; value?: string; showInPdf?: boolean }[] }[]>([]);
  const [extendedCols,setExtendedCols]=useState(true); // se false não enviar campos novos
  const [hasCodePrefix, setHasCodePrefix] = useState<boolean|null>(null);
  const [companyId,setCompanyId]=useState<string|undefined>(undefined);

  type ProductRow = Product & { created_at?: string };
  const load = useCallback(async (pageOverride?: number) => {
    const currentPage = pageOverride ?? page;
    // se ainda não sabemos se code_prefix existe, aguardar para evitar erro SQL
    if(hasCodePrefix === null) return;
    setLoading(true);
    try {
      // Capturar colunas da view product_stock apenas uma vez (primeiro load) para debug
      if(stockViewColumns === null){
        try {
          const { data: colsData } = await (supabase as any)
            .rpc('debug_stock_overview');
          if(colsData?.product_stock_columns){
            setStockViewColumns(colsData.product_stock_columns as string[]);
            if(import.meta.env.DEV){
              const cols = colsData.product_stock_columns as string[];
              if(!cols.includes('stock')) console.warn('[Estoque] View product_stock sem coluna stock');
              if(!cols.includes('reserved')) console.warn('[Estoque] View product_stock sem coluna reserved');
              if(!cols.includes('available')) console.warn('[Estoque] View product_stock sem coluna available');
            }
          }
        } catch(err){ if(import.meta.env.DEV) console.warn('Não conseguiu obter colunas product_stock', err); }
      }
      try { await (supabase as any).rpc('ensure_profile'); } catch(err) { if(import.meta.env.DEV) console.warn('ensure_profile rpc indisponível', err); }
      let q = (supabase as any)
        .from('products')
  .select(`id,code,name,unit,sale_price,price,cost_price,status,image_url,created_at,product_group_id,category,description${hasCodePrefix? ',code_prefix': ''}`)
        .order('created_at',{ascending:false});
      // Se usuário não é admin, filtrar por company_id para isolar dados por empresa
      if(profile && profile.role !== 'admin' && profile.company_id) {
        q = q.eq('company_id', profile.company_id);
      }
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
        // Buscar estoque pela lista de IDs (pode falhar se a view estiver usando códigos antigos ou outro identificador)
        let baseStocks: { product_id: string; stock: number; reserved?: number; available?: number }[] = [];
        try {
          const { data: s1, error: s1err } = await (supabase as any)
            .from('product_stock')
            .select('product_id,stock,reserved,available')
            .in('product_id', ids);
          if(s1err) throw s1err;
          baseStocks = (s1 as any[]) || [];
        } catch(e1){ if(import.meta.env.DEV) console.warn('[Estoque] Falha ao buscar por ids em product_stock', e1); }

        // Fallback: se não retornou nada, tentar por códigos (algumas migrações antigas usavam código como chave de estoque)
        if(!baseStocks.length){
          const codes = products.map(p=>p.code).filter(Boolean) as string[];
          if(codes.length){
            try {
              const uniqueCodes = Array.from(new Set(codes));
              const { data: s2, error: s2err } = await (supabase as any)
                .from('product_stock')
                .select('product_id,stock,reserved,available')
                .in('product_id', uniqueCodes.slice(0, 1000)); // limitar por segurança
              if(!s2err && s2 && s2.length){
                if(import.meta.env.DEV) console.warn('[Estoque] Usando fallback por código para product_stock');
                baseStocks = (s2 as any[]);
              }
            } catch(e2){ if(import.meta.env.DEV) console.warn('[Estoque] Fallback código falhou', e2); }
          }
        }
        // Tentar reserved (pode não existir)
        products = products.map(p=>{
          const base = baseStocks.find(s=>s.product_id===p.id);
          const stock = base?.stock ?? 0;
          const reserved = (base as any)?.reserved ?? 0;
          const available = (base as any)?.available ?? (stock - reserved);
          return { ...p, stock, reserved, available };
        });

        // Fallback recalculado se não obtivemos dados
        const needsFallback = !baseStocks.length || baseStocks.every(b => b.stock == null);
        if(needsFallback && import.meta.env.DEV){
          console.warn('[Estoque] Nenhum dado direto da view product_stock (ids e fallback por código). Iniciando recomputação local.');
        }
        if(needsFallback){
          if(import.meta.env.DEV) console.warn('[Fallback estoque ERP] Recalculando via inventory_movements + quotes');
          try {
            const { data: invMovs } = await (supabase as any)
              .from('inventory_movements')
              .select('product_id,type,quantity')
              .in('product_id', ids)
              .limit(20000);
            const agg: Record<string,{stock:number}> = {};
            (invMovs||[]).forEach((m:any)=>{
              if(!agg[m.product_id]) agg[m.product_id] = { stock:0 };
              const qNum = Number(m.quantity)||0;
              if(m.type==='ENTRADA') agg[m.product_id].stock += qNum;
              else if(m.type==='SAIDA') agg[m.product_id].stock -= qNum;
              else if(m.type==='AJUSTE') agg[m.product_id].stock += qNum;
            });
            const { data: pedQuotes } = await (supabase as any)
              .from('quotes')
              .select('items')
              .eq('type','PEDIDO')
              .eq('status','Rascunho')
              .limit(5000);
            const reservedAgg: Record<string,number> = {};
            (pedQuotes||[]).forEach((q:any)=>{
              const items: any[] = Array.isArray(q.items)? q.items: [];
              items.forEach(it=>{
                const pid = it.productId || it.product_id;
                if(pid && ids.includes(pid)){
                  reservedAgg[pid] = (reservedAgg[pid]||0) + Number(it.quantity||0);
                }
              });
            });
            products = products.map(p=>{
              const st = agg[p.id]?.stock ?? 0;
              const res = reservedAgg[p.id] ?? 0;
              return { ...p, stock: st, reserved: res, available: st - res };
            });
            if(import.meta.env.DEV){
              const missing = products.filter(pr=> (pr as any).stock===0 && !agg[(pr as any).id]);
              if(missing.length){
                console.warn('[DEBUG estoque ERP] Produtos sem movimentos agregados, exibindo 0:', missing.slice(0,20).map(m=>(m as any).id));
              }
            }
          } catch(fbErr){ if(import.meta.env.DEV) console.error('[Fallback estoque ERP] falhou', fbErr); }
        }
      }
      if(import.meta.env.DEV){
        const sampleDebug = products.slice(0,10).map(p=>({id:p.id, img: (p as any).image_url}));
        console.log('[DEBUG products images]', sampleDebug);
      }
      setRows(products);
    } catch(e:unknown){
      // Formatar objetos de erro complexos para mensagem legível
      let msg = '';
      try {
        if(e instanceof Error) msg = e.message;
        else if(typeof e === 'string') msg = e;
        else if(e && typeof e === 'object'){
          // priorizar propriedades comuns de erros retornados por supabase/pg
          const anyE = e as any;
          msg = anyE.message || anyE.error || anyE.details || anyE.statusText || anyE.status || '';
          if(!msg) msg = JSON.stringify(anyE);
        } else msg = String(e);
      } catch(_){ msg = String(e); }
      // encurtar mensagens muito longas
      if(msg.length > 300) msg = msg.slice(0,300) + '...';
      toast.error('Falha ao carregar produtos: '+msg);
    }
    finally { setLoading(false); }
  }, [page, debouncedSearch, profile, stockViewColumns, hasCodePrefix]);
  const loadSuppliers = useCallback(async ()=>{
    // carregar fornecedores visíveis para o usuário
    const { data, error }:{ data: Pick<Supplier,'id'|'name'>[]|null; error: unknown } = await (supabase as unknown as { from: any }).from('suppliers').select('id,name').eq('is_active', true).limit(200);
    if(!error) {
      // Filtrar entradas placeholder/importadas que contenham nome 'Fornecedor Padrão'
      const filtered = (data||[]).filter(s => {
        try {
          const name = String(s.name || '').trim();
          if(!name) return false;
          if(/^\s*fornecedor padrão\s*$/i.test(name)) return false;
          if(/^\s*selecione fornecedor\s*$/i.test(name)) return false;
          return true;
        } catch { return !!s.name; }
      });
      setSuppliers(filtered);
    }
  }, []);
  useEffect(()=>{ load(0); loadSuppliers(); setPage(0); },[load, loadSuppliers]);

  // carregar grupos de produto (hierarquia) para os selects em cascata
  async function loadProductGroups(){
    setLoadingGroups(true);
    try{
      const { data, error } = await (supabase as any).from('product_groups').select('id,name,level,parent_id').order('level').order('name');
      if(error) throw error;
      setProductGroups(data || []);
    }catch(e){ if(import.meta.env.DEV) console.warn('Falha ao carregar product_groups', e); setProductGroups([]); }
    finally{ setLoadingGroups(false); }
  }
  useEffect(()=>{ loadProductGroups(); },[]);
  // sincronizar selects quando productGroups ou form.product_group_id mudam (ex: abrir edição)
  useEffect(()=>{
    if(!productGroups.length) return;
    if(form.product_group_id){
      const sess = productGroups.find(pg=>pg.id===form.product_group_id);
      const sectorId = sess?.parent_id || undefined;
      const categoryId = sectorId ? productGroups.find(pg=>pg.id===sectorId)?.parent_id : undefined;
      setSelectedSectorId(sectorId);
      setSelectedCategoryId(categoryId);
    } else {
      // se não existe product_group_id, tentar manter texto category, mas limpar selects
      setSelectedSectorId(undefined);
      setSelectedCategoryId(undefined);
    }
  },[productGroups, form.product_group_id]);

  // DEBUG: logar resumo de rows quando mudam para diagnosticar imagens aplicadas indevidamente
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      console.debug('[ErpProducts] rows changed count=', rows.length, 'sampleImages=', rows.slice(0,8).map(r=>({id:r.id, image: (r as any).image_url })));
    } catch (e) { console.debug('[ErpProducts] rows changed (failed to stringify)'); }
  }, [rows]);
  // Debounce da busca para evitar muitas requisições
  useEffect(()=>{
    const t = setTimeout(()=>{ setDebouncedSearch(search.trim()); setPage(0); load(0); }, 400);
    return ()=> clearTimeout(t);
  },[search, load]);
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
  useEffect(()=>{
    if(profile?.company_id) setCompanyId(profile.company_id);
  },[profile?.company_id]);
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
      // testar se coluna code_prefix existe para evitar PGRST204
      try {
        const cp = await (supabase as unknown as { from:any }).from('products').select('code_prefix').limit(1);
        setHasCodePrefix(!cp.error);
      } catch(_){ setHasCodePrefix(false); }
    })();
  },[]);

  async function save(imageUrlOverride?: string){
  if(!form.name.trim()){ toast.error('Nome obrigatório'); return; }
    if(!form.code || !form.code.trim()){
      toast.error('Código obrigatório');
      return;
    }
    // Verificar unicidade do código (resiliente a falhas temporárias)
    let codeExists: any = null;
    try {
      // cast to any to avoid deep generic instantiation in TS when selecting minimal fields
      let codeQuery = (supabase as any)
        .from('products')
        .select('id')
        .eq('code', form.code.trim())
        .limit(1);
      if(editing?.id) codeQuery = codeQuery.neq('id', editing.id);
      const qRes = await codeQuery.single();
      codeExists = (qRes as any).data || null;
    } catch(err) {
      if(import.meta.env.DEV) console.debug('[ErpProducts] code uniqueness check failed, continuing', err);
      codeExists = null; // falha ao verificar unicidade não bloqueia o save
    }
    if(codeExists){
      toast.error('Já existe um produto com este código!');
      return;
    }
  const salePrice = Number(form.sale_price||form.price||0);
    // Evitar herdar imagem de edição anterior ao criar novo (se usuário abriu 'Novo' após editar)
    if(!editing && !imageFile && form.image_url){
      // limpar imagem herdada silenciosamente usando setForm para atualizar state corretamente
      setForm(f => ({ ...f, image_url: undefined }));
    }
    if(isNaN(salePrice)){ toast.error('Preço inválido'); return; }
  setSaving(true);
    try {
  // Validação obrigatória: Categoria, Setor e Sessão
  if(!selectedCategoryId){ toast.error('Categoria é obrigatória'); setSaving(false); return; }
  if(!selectedSectorId){ toast.error('Setor é obrigatório'); setSaving(false); return; }
  if(!form.product_group_id){ toast.error('Sessão é obrigatória'); setSaving(false); return; }
  // Fornecedor obrigatório
  if(!form.default_supplier_id){ toast.error('Fornecedor padrão é obrigatório'); setSaving(false); return; }
  const effectiveImageUrl = imageUrlOverride !== undefined ? imageUrlOverride : form.image_url;
  const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description||null,
  code: (form.code && form.code !== 'sample_code') ? form.code : null,
    // código do fabricante (opcional)
    ...(hasCodePrefix ? { code_prefix: form.code_prefix ?? null } : {}),
        category: form.category||null,
  product_group_id: form.product_group_id||null,
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
  options: form.options || null,
      };
      // Assegura que novos produtos sejam atribuídos à company do usuário quando aplicável
      if(profile && profile.role !== 'admin' && profile.company_id) {
        payload.company_id = profile.company_id;
      } else if(companyId) {
        payload.company_id = companyId;
      }
      if(!extendedCols){
        const allowed = ['name','description','price','sale_price','status'];
        if(hasCodePrefix) allowed.push('code_prefix');
        Object.keys(payload).forEach(k=>{ if(!allowed.includes(k)) delete payload[k]; });
        if(profile && profile.role !== 'admin' && profile.company_id) payload.company_id = profile.company_id; // garantir
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
  // Atualizar lista local imediatamente com o registro salvo para manter informações visíveis
  if(resp.data){
    const saved = resp.data as ProductRow;
    setRows(prev => {
      if(editing){
        return prev.map(r => r.id === saved.id ? { ...r, ...saved } : r);
      } else {
        // inserir novo produto no topo da lista
        return [saved, ...prev];
      }
    });
  }
  // resetar formulário e fechar modal
  setOpen(false); setEditing(null); setForm(makeEmpty());
  // ainda recarregamos em background para garantir consistência com DB
  load();
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
  setOptionGroups([]);
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
            // preserve arrays/objects for some known fields? default to empty string
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
  // garantir que description e code_prefix sejam preservados e tipados corretamente
  try {
    const anyNorm = norm as any;
    if('description' in anyNorm) scrubbed.description = anyNorm.description == null ? '' : String(anyNorm.description);
    if('code_prefix' in anyNorm) scrubbed.code_prefix = anyNorm.code_prefix == null ? undefined : String(anyNorm.code_prefix);
    if('code' in anyNorm) scrubbed.code = anyNorm.code == null ? '' : String(anyNorm.code);
  } catch(_){ /* ignore */ }
  setEditing({ ...p });
  setForm(scrubbed);
  // tentar obter versão mais fiel do backend (incluindo code_prefix quando existir)
  (async ()=>{
    try{
      // tentar sempre buscar code_prefix diretamente (pode não ter sido detectado ainda)
      const selectCols = `id,code,name,unit,sale_price,price,cost_price,status,image_url,created_at,product_group_id,category,description,code_prefix`;
      const { data: fresh, error: freshe } = await (supabase as any).from('products').select(selectCols).eq('id', p.id).single();
      if(freshe){
        try{
          const msg = (freshe as any)?.message || String(freshe);
          if(msg && msg.toLowerCase().includes('code_prefix')){
            // coluna realmente não existe no banco
            setHasCodePrefix(false);
            if(import.meta.env.DEV) console.warn('Coluna code_prefix ausente (fetch startEdit)', msg);
          } else {
            if(import.meta.env.DEV) console.warn('Erro ao buscar produto fresco', freshe);
          }
        }catch(_){ if(import.meta.env.DEV) console.warn('Erro desconhecido ao interpretar freshe', freshe); }
      } else if(fresh){
        const anyFresh = fresh as any;
        const updated: ProductForm = { ...scrubbed };
        if('description' in anyFresh) updated.description = anyFresh.description == null ? '' : String(anyFresh.description);
        if('code_prefix' in anyFresh) updated.code_prefix = anyFresh.code_prefix == null ? undefined : String(anyFresh.code_prefix);
        if('code' in anyFresh) updated.code = anyFresh.code == null ? '' : String(anyFresh.code);
        setHasCodePrefix(true);
        setEditing({ ...anyFresh } as Product);
        setForm(updated);
      }
    }catch(err){ if(import.meta.env.DEV) console.warn('Falha ao buscar produto fresco', err); }
  })();
    setOpen(true);
    // inicializar opcionais se existirem
    try {
      const raw = (p as any).options;
      if(raw && typeof raw === 'string' && raw.trim().startsWith('{')){
        const parsed = JSON.parse(raw);
        if(parsed && parsed.version === 1 && Array.isArray(parsed.groups)) setOptionGroups(parsed.groups);
        else setOptionGroups([]);
      } else {
        setOptionGroups([]);
      }
    } catch(e){ setOptionGroups([]); }
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

  // selected ids (kept in state) are synchronized with form.product_group_id via effect above

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
    {stockViewColumns && (
      <div className="text-xs flex flex-wrap gap-1 items-center">
        <span className="font-medium">product_stock:</span>
        {stockViewColumns.map(c => (
          <span key={c} className={`px-1 py-0.5 rounded border ${c==='available' ? 'bg-green-50 border-green-300 text-green-700':'bg-gray-50 border-gray-300 text-slate-600'}`}>{c}</span>
        ))}
      </div>
    )}
    <div className="border rounded max-h-[520px] overflow-auto">
      <table className="w-full text-xs">
  <thead className="bg-muted/50 sticky top-0"><tr>
    <th className="px-2 py-1">&nbsp;</th>
    <th className="px-2 py-1 text-left">Código</th>
    <th className="px-2 py-1 text-left">Nome</th>
    <th className="px-2 py-1">Un</th>
    <th className="px-2 py-1 text-right">Custo Médio</th>
    <th className="px-2 py-1 text-right">Preço Venda</th>
    <th className="px-2 py-1 text-right">Estoque</th>
    <th className="px-2 py-1 text-right">Reservado</th>
    <th className="px-2 py-1 text-right">Disp.</th>
    <th className="px-2 py-1">Status</th>
    <th className="px-2 py-1"/>
  </tr></thead>
        <tbody>
          {rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1"><div className="h-8 w-8 bg-gray-100 rounded overflow-hidden border"><img src={(r as any).image_url||''} alt="" className="h-8 w-8 object-cover" onError={(e:any)=>{ e.currentTarget.style.display='none'; }} /></div></td>
            <td className="px-2 py-1 font-mono truncate max-w-[120px]" title={r.code||''}>{r.code||'-'}</td>
            <td className="px-2 py-1 truncate max-w-[240px]" title={r.name}>{r.name}</td>
            <td className="px-2 py-1 text-center">{r.unit||'-'}</td>
            <td className="px-2 py-1 text-right">{r.cost_price != null ? r.cost_price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-'}</td>
            <td className="px-2 py-1 text-right">{(r.sale_price||r.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{r.stock ?? '-'}</td>
            <td className="px-2 py-1 text-right">{r.reserved ?? '-'}</td>
            <td className="px-2 py-1 text-right">{r.available ?? ((r.stock ?? 0) - (r.reserved ?? 0))}</td>
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
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            <div className="grid md:grid-cols-4 gap-2">
              <div>
                <select required className="h-9 border rounded px-2 w-full" value={selectedCategoryId||''} onChange={e=>{
                    const sel = e.target.value || '';
                    setSelectedCategoryId(sel || undefined);
                    // clear lower selections
                    setSelectedSectorId(undefined);
                    setForm(f=>({...f, product_group_id: undefined, category: productGroups.find(pg=>pg.id===sel)?.name || f.category }));
                  }}>
                  <option value="">Selecione Categoria *</option>
                  {productGroups.filter(pg=>pg.level===1).map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <select required disabled={!selectedCategoryId} className="h-9 border rounded px-2 w-full" value={selectedSectorId||''} onChange={e=>{
                    const sel = e.target.value || '';
                    setSelectedSectorId(sel || undefined);
                    // clear session selection
                    setForm(f=>({...f, product_group_id: undefined, category: productGroups.find(x=>x.id===sel)?.name || f.category }));
                    // ensure category selection matches parent of sector
                    const parent = productGroups.find(x=>x.id===sel)?.parent_id;
                    if(parent) setSelectedCategoryId(parent);
                  }}>
                  <option value="">Selecione Setor *</option>
                  {productGroups.filter(pg=>pg.level===2 && pg.parent_id===selectedCategoryId).map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <select required disabled={!selectedSectorId} className="h-9 border rounded px-2 w-full" value={form.product_group_id||''} onChange={e=>{
                    const sel = e.target.value || undefined;
                    const g = productGroups.find(pg=>pg.id===sel);
                    if(g && g.level===3){
                      // set product_group_id and also set textual fields for backward compatibility
                      const sector = productGroups.find(x=>x.id===g.parent_id);
                      const category = sector ? productGroups.find(x=>x.id===sector.parent_id) : undefined;
                      setSelectedSectorId(sector?.id);
                      setSelectedCategoryId(category?.id);
                      setForm(f=>({...f, product_group_id: g.id, category: category?.name || sector?.name || g.name }));
                    } else {
                      setForm(f=>({...f, product_group_id: undefined }));
                    }
                  }}>
                  <option value="">Selecione Sessão *</option>
                  {productGroups.filter(pg=>pg.level===3 && pg.parent_id===selectedSectorId).map(ss=> <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                </select>
              </div>
              <Input placeholder="Código do fabricante (opc)" value={(form as any).code_prefix||''} onChange={e=>setForm(f=>({...f, code_prefix:e.target.value||undefined}))} />
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
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="outline" onClick={()=>setOptionalsOpen(true)}>Opcionais do Produto</Button>
              <div className="text-xs text-muted-foreground">Gerenciar grupos e itens opcionais (nome, valor e visibilidade no PDF)</div>
            </div>
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
                readOnly disabled className="bg-gray-50/60"
              />
              <Input placeholder="Custo" value={formatBRL(form.cost_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, cost_price: parsed }));
                }}
                inputMode="decimal"
                readOnly disabled className="bg-gray-50/60"
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
                readOnly disabled className="bg-gray-50/60"
              />
              <Input placeholder="Preço Venda *" value={formatBRL(form.sale_price)}
                onChange={e=>{
                  const raw = e.target.value;
                  const parsed = parseBRL(raw);
                  setForm(f=>({...f, sale_price: parsed }));
                }}
                inputMode="decimal"
                readOnly disabled className="bg-gray-50/60"
              />
              <Input placeholder="Margem %" value={form.margin ?? ''}
                onChange={e=>{
                  const margin = Number(e.target.value.replace(/[\^\d.]/g, ''));
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
                readOnly disabled className="bg-gray-50/60"
              />
              <Input placeholder="Prazo Pagamento" value={form.payment_terms||''} onChange={e=>setForm(f=>({...f,payment_terms:e.target.value}))} readOnly disabled className="bg-gray-50/60" />
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
              <div />
            </div>
          </section>}

          {/* Fornecedor (seção separada) */}
          {extendedCols && <section className="space-y-2">
            <h3 className="font-semibold text-sm">Fornecedor</h3>
            <div className="grid md:grid-cols-2 gap-2 items-start">
              <div className="flex items-center gap-2 flex-wrap">
                <select className="h-9 border rounded px-2 min-w-[220px]" value={form.default_supplier_id||''} onChange={e=>setForm(f=>({...f,default_supplier_id:e.target.value||undefined}))}>
                  <option value="" disabled hidden>Selecione fornecedor</option>
                  {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={()=>setSupplierSearchOpen(true)}>Buscar fornecedor</Button>
                {/* Badge com nome do fornecedor selecionado e botão limpar */}
                {form.default_supplier_id && (()=>{
                  const sel = suppliers.find(s=>s.id===form.default_supplier_id);
                  return sel ? (
                    <div className="ml-2 mt-1 md:mt-0 px-2 py-1 rounded bg-green-50 border border-green-200 text-sm flex items-center gap-2">
                      <span className="max-w-[220px] truncate">{sel.name}</span>
                      <button className="text-red-500 font-bold leading-none" onClick={()=>setForm(f=>({...f, default_supplier_id: undefined}))} aria-label="Limpar fornecedor">×</button>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="text-xs text-muted-foreground mt-1 md:mt-0">Obrigatório — selecione o fornecedor padrão para este produto</div>
            </div>
          </section>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button onClick={async()=>{
            // upload imagem antes de salvar se houver
            let uploadedUrl: string | undefined;
            const editingId = editing?.id;
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
                    // sanitize filename to avoid spaces and special chars that can cause 400
                    const orig = fileToUpload.name || 'file';
                    const extMatch = orig.match(/\.([a-zA-Z0-9]+)$/);
                    const ext = extMatch ? extMatch[1] : '';
                    const base = orig.replace(/\.[^/.]+$/, '')
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]+/g, '-')
                      .replace(/-+/g, '-')
                      .slice(0, 60);
                    const safeName = ext ? `${base}.${ext}` : base;
                    const path = `produtos/${identifier}-${Date.now()}-${randomSuffix}-${safeName}`;
                // tenta bucket específico de imagens do produto
                const bucket = 'product-images';
                const upErr: any = null;
                try {
                  // Fast fallback: convert to data URL and save directly to image_url to avoid Storage issues
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
                    reader.readAsDataURL(fileToUpload!);
                  });
                  uploadedUrl = dataUrl;
                  if(import.meta.env.DEV) console.debug('[ErpProducts] using dataURL fallback for image', { editingId });
                  setForm(f=>({...f, image_url: uploadedUrl, imageDataUrl: uploadedUrl }));
                  setEditing(prev => {
                    const res = prev && (editingId ? prev.id === editingId : true) ? ({ ...prev, image_url: uploadedUrl, imageDataUrl: uploadedUrl } as Product) : prev;
                    if(import.meta.env.DEV) console.debug('[ErpProducts] setEditing result (dataURL fast)', { before: prev, after: res, editingId });
                    return res;
                  });
                } catch(e) {
                  if(import.meta.env.DEV) console.error('[ErpProducts] dataURL fallback failed', e);
                  throw e;
                }
              } catch(e:unknown){ toast.error('Upload falhou: '+ extractErr(e)); if(import.meta.env.DEV) console.error('upload error', e); }
            }
            // Se não houver novo upload mas já existe image_url no form, manter
            if(!uploadedUrl && form.image_url) uploadedUrl = form.image_url;
            if(uploadedUrl) {
              setForm(f=>({...f, image_url: uploadedUrl}));
            }
            // salvar e atualizar apenas a linha alterada em memória
             // incluir opcionais serializados
             const optionsPayload = optionGroups && optionGroups.length ? JSON.stringify({ version: 1, groups: optionGroups }) : null;
             setForm(f=>({...f, options: optionsPayload}));
             await save(uploadedUrl);
            // Observação: não aplicamos mais a URL localmente a `rows` aqui para evitar
            // efeitos colaterais — o método `save()` chama `load()` que recarrega a lista
            // do backend e garante consistência. Mantemos logs de upload para debug.
            if(import.meta.env.DEV) console.debug('[ErpProducts] upload finished, relying on load() to refresh rows', { editingId, uploadedUrl });
          }} disabled={saving}>{saving? 'Salvando...':'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal simples para gerenciar opcionais do produto */}
    <Dialog open={optionalsOpen} onOpenChange={setOptionalsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opcionais do Produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            {optionGroups.map((g, gi)=> (
              <div key={gi} className="border rounded p-2">
                <div className="flex gap-2 items-center">
                  <Input value={g.name} onChange={e=>{ const v=e.target.value; setOptionGroups(og=> og.map((x,i)=> i===gi? {...x, name:v}: x)); }} placeholder="Nome do grupo" />
                  <Button size="sm" variant="ghost" onClick={()=> setOptionGroups(og=>og.filter((_,i)=>i!==gi))}>Remover Grupo</Button>
                </div>
                <div className="mt-2 space-y-2">
                  {g.items.map((it, ii)=> (
                    <div key={ii} className="flex gap-2 items-center">
                      <Input value={it.name} onChange={e=>{ const v=e.target.value; setOptionGroups(og=> og.map((x,xi)=> xi===gi? {...x, items: x.items.map((it2,i2)=> i2===ii? {...it2, name:v}: it2)} : x)); }} placeholder="Nome do item" />
                      <Input value={it.value||''} onChange={e=>{ const v=e.target.value; setOptionGroups(og=> og.map((x,xi)=> xi===gi? {...x, items: x.items.map((it2,i2)=> i2===ii? {...it2, value:v}: it2)} : x)); }} placeholder="Valor (opcional)" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!it.showInPdf} onChange={e=>{ const v=e.target.checked; setOptionGroups(og=> og.map((x,xi)=> xi===gi? {...x, items: x.items.map((it2,i2)=> i2===ii? {...it2, showInPdf: v}: it2)} : x)); }} /> Exibir no PDF</label>
                      <Button size="sm" variant="ghost" onClick={()=> setOptionGroups(og=> og.map((x,xi)=> xi===gi? {...x, items: x.items.filter((_,i)=>i!==ii)}: x))}>Remover</Button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" onClick={()=> setOptionGroups(og=> og.map((x,xi)=> xi===gi? {...x, items: [...x.items, { name: '', value: '', showInPdf: true }]} : x))}>Adicionar Item</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={()=> setOptionGroups(og=>[...og, { name: '', items: [] }])}>Adicionar Grupo</Button>
            <Button size="sm" variant="outline" onClick={()=>{ setOptionGroups([]); }}>Limpar</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOptionalsOpen(false)}>Fechar</Button>
          <Button onClick={()=>{
            // salvar opcionais no form em formato serializado
            const payload = optionGroups && optionGroups.length ? JSON.stringify({ version: 1, groups: optionGroups }) : null;
            setForm(f=>({...f, options: payload}));
            setOptionalsOpen(false);
          }}>Salvar Opcionais</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Modal de busca completa de fornecedores */}
    <Dialog open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar Fornecedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Buscar por nome" value={supplierQuery} onChange={e=>setSupplierQuery(e.target.value)} />
          <div className="max-h-60 overflow-auto">
            {suppliers.filter(s => !supplierQuery || String(s.name||'').toLowerCase().includes(supplierQuery.toLowerCase())).map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 border-b">
                <div className="text-sm">{s.name}</div>
                <div>
                  <Button size="sm" onClick={()=>{ setForm(f=>({...f, default_supplier_id: s.id })); setSupplierSearchOpen(false); }}>Selecionar</Button>
                </div>
              </div>
            ))}
            {suppliers.filter(s => !supplierQuery || String(s.name||'').toLowerCase().includes(supplierQuery.toLowerCase())).length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">Nenhum fornecedor encontrado.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setSupplierSearchOpen(false)}>Fechar</Button>
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
