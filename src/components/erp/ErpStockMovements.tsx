/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import type { Tables } from '@/integrations/supabase/types';

// Minimal supabase client shape used here to avoid repetitive `as any` casts
// NOTE: keeping direct supabase calls (with occasional casts) because the
// project's Supabase types are extensive; prefer local runtime narrowing instead

interface ProductOption { id: string; name: string; code?: string }

const movementTypes = [
  { value: 'IN', label: 'Entrada' },
  { value: 'OUT', label: 'Saída' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'RETURN', label: 'Devolução' },
  { value: 'EXCHANGE', label: 'Troca' },
];

export const ErpStockMovements = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [page,setPage]=useState(1); const pageSize=50; const [total,setTotal]=useState(0);
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ product_id: '', qty: '', type: 'IN', reason: '', loc_from: '', loc_to: '' });
  const [productInput, setProductInput] = useState('');
  const [companyId, setCompanyId] = useState<string|undefined>(undefined);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id:string,name:string}>>([]);
  const auth = useAuth();
  const [productSuggestions, setProductSuggestions] = useState<ProductOption[]>([]);
  // Carregar companyId do profile do usuário autenticado
  useEffect(()=>{(async()=>{
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if(!user){ console.warn('Sem usuário autenticado para obter company_id'); return; }
      const { data, error } = await (supabase as any).from('profiles').select('company_id').eq('user_id', user.id).single();
      if(error){ console.warn('Erro ao buscar profile para company_id', error); return; }
      if(data && (data as Record<string, unknown>)['company_id']){ setCompanyId(String((data as Record<string, unknown>)['company_id'])); }
      else console.warn('Profile sem company_id');
    } catch (err: unknown) { console.warn('Falha ao carregar company_id', err); }
  })();},[]);

  // Se for admin, carregar lista de empresas disponíveis para seleção
  useEffect(() => {
    (async () => {
      try {
        if (auth.profile?.role === 'admin') {
          const { data, error } = await (supabase as any).from('companies').select('id,name').order('name');
          if (!error && Array.isArray(data)) {
            setAvailableCompanies((data as unknown as Array<Record<string, unknown>>).map(d => ({ id: String(d['id']), name: String(d['name']) })));
          }
        } else if (auth.profile?.company_id) {
          setAvailableCompanies([{ id: auth.profile.company_id, name: auth.company?.name || 'Minha empresa' }]);
        }
      } catch (e) { if (import.meta.env.DEV) console.warn('Erro ao carregar empresas', e); }
    })();
  }, [auth.profile, auth.company]);
  // Corrigir valor inicial para 'ENTRADA'
  const [products, setProducts] = useState<ProductOption[]>([]);

  async function loadProducts() {
  const { data, error } = await (supabase as any).from('products').select('id,name,code').limit(500);
  if (!error && Array.isArray(data)) {
  const safe = (data as unknown as Array<Record<string, unknown>>).map(d => ({ id: String(d['id']), name: String(d['name'] || ''), code: d['code'] ? String(d['code']) : undefined }));
    setProducts(safe);
  }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page-1)*pageSize; const to = from + pageSize - 1;
  // build query using client postgrest interface
  // Use a runtime-any for the chained Postgrest query - keep coercions local
  let query = (supabase as any).from('inventory_movements').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from,to);
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  // Removido filtro de companyId pois inventory_movements não possui esse campo
  // Filtros desativados para garantir exibição de todos os registros
  const { data, error, count } = await query as unknown as { data?: unknown; error?: unknown; count?: number };
      if (error) throw error;
  setRows((data as unknown as Record<string, unknown>[]) || []);
      setTotal(count||0);
    } catch (e) {
      const msg = (e instanceof Error) ? e.message : 'Falha ao carregar movimentos';
      toast.error(msg);
    } finally { setLoading(false); }
  }, [page, companyId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadProducts(); }, []);
  // Ouvir evento global para abrir modal de novo movimento com produto pré-selecionado
  useEffect(() => {
    function handler(e: Event) {
      try {
        const ev = e as CustomEvent<Record<string, unknown> | undefined>;
        const product = ev?.detail && (ev.detail as Record<string, unknown>)['product'] ? (ev.detail as Record<string, unknown>)['product'] as Record<string, unknown> : undefined;
        if(product && product['id']) {
          setForm(f=>({ ...f, product_id: String(product['id']) }));
          setProductInput(product['code'] ? `${String(product['code'])} - ${String(product['name'])}` : String(product['name']));
          setCreateOpen(true);
        }
      } catch (err) { if(import.meta.env.DEV) console.warn('open-stock-movement handler err', err); }
    }
    window.addEventListener('open-stock-movement', handler as EventListener);
    return () => window.removeEventListener('open-stock-movement', handler as EventListener);
  }, []);
  // Autocomplete para campo de produto no novo movimento
  useEffect(() => {
    if (!productInput) { setProductSuggestions([]); return; }
    (async () => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id,name,code')
        .or(`name.ilike.%${productInput}%,code.ilike.%${productInput}%`)
        .limit(10);
      if (!error && Array.isArray(data)) {
  const safe = (data as unknown as Array<Record<string, unknown>>).map(d => ({ id: String(d['id']), name: String(d['name'] || ''), code: d['code'] ? String(d['code']) : undefined }));
        setProductSuggestions(safe);
      } else setProductSuggestions([]);
    })();
  }, [productInput]);
  // Autocomplete de produto
  useEffect(() => {
    if (!productSearch) { setProductSuggestions([]); return; }
    (async () => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id,name,code')
        .or(`name.ilike.%${productSearch}%,code.ilike.%${productSearch}%`)
        .limit(10);
      if (!error && Array.isArray(data)) {
  const safe = (data as unknown as Array<Record<string, unknown>>).map(d => ({ id: String(d['id']), name: String(d['name'] || ''), code: d['code'] ? String(d['code']) : undefined }));
        setProductSuggestions(safe);
      } else setProductSuggestions([]);
    })();
  }, [productSearch]);

  async function submit() {
    if (!form.product_id) { toast.error('Selecione produto'); return; }
    const qtyNum = parseFloat(form.qty.replace(',','.'));
    if (!qtyNum || qtyNum <= 0) { toast.error('Qtd inválida'); return; }
    setCreating(true);

    // Obter usuário autenticado (usar user.id que é UUID para coluna created_by)
    let created_by: string | undefined = undefined;
    try {
  const { data: userRes } = await supabase.auth.getUser();
      created_by = userRes?.user?.id || undefined;
    } catch (_) { /* ignore */ }

    try {
      // Montar payload para inventory_movements
      let type = 'AJUSTE';
      if (form.type === 'IN') type = 'ENTRADA';
      else if (form.type === 'OUT') type = 'SAIDA';

      const payload: Record<string, unknown> = {
        product_id: form.product_id,
        quantity: Math.abs(qtyNum),
        type,
        created_at: new Date().toISOString(),
        ...(created_by ? { created_by } : {}),
        ...(companyId ? { company_id: companyId } : {}),
      };

  const { error } = await (supabase as any).from('inventory_movements').insert([payload]);
      if (error) {
        toast.error('Erro ao registrar: ' + (error.message || JSON.stringify(error)));
        if (import.meta.env.DEV) console.error('Erro detalhado:', error);
        return;
      }

      toast.success('Movimento registrado');
      setCreateOpen(false);
      setForm({ product_id: '', qty: '', type: 'IN', reason: '', loc_from: '', loc_to: '' });
      load();
    } catch (e) {
      const msg = (e instanceof Error) ? e.message : 'Erro ao registrar';
      toast.error(msg);
      if (import.meta.env.DEV) console.error('Erro inesperado:', e);
    } finally {
      setCreating(false);
    }
  }

  function productName(id:string){
    const p = products.find(p=>p.id===id); return p? p.name : (id ? id.slice(0,8) : '-');
  }

  function exportCsv(){
    const header = ['data','produto','tipo','qtd','local','motivo','grupo'];
    const safe = (obj: Record<string, unknown>, key: string) => {
      const v = obj[key];
      if (v === null || v === undefined) return '';
      return String(v);
    };
    const lines = rows.map(r => {
      const createdRaw = safe(r, 'created_at');
      const created = createdRaw ? new Date(createdRaw) : null;
      const productId = safe(r, 'product_id');
      const type = safe(r, 'type');
      const qty = safe(r, 'signed_qty') || safe(r, 'quantity');
      const location = safe(r, 'location');
      const reason = safe(r, 'reason').replace(/\n/g, ' ');
      const group = safe(r, 'movement_group');
      return [
        created ? created.toISOString() : '',
        productName(productId),
        type,
        qty,
        location || '',
        reason,
        group || ''
      ].join(';');
    });
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='movimentos_estoque.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total/pageSize));

  return (
    <div className='space-y-4'>
  <div className='flex gap-2 items-end flex-wrap'>
  <div className='flex flex-col'>
          <span className='text-[11px] uppercase text-slate-500'>Buscar Motivo</span>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Motivo...' className='h-9 w-52' />
        </div>
        <div className='flex flex-col'>
          <span className='text-[11px] uppercase text-slate-500'>Buscar Produto</span>
          <div className='relative'>
            <Input
              value={productSearch}
              onChange={e=>setProductSearch(e.target.value)}
              placeholder='Nome ou código do produto...'
              className='h-9 w-52'
              autoComplete='off'
            />
            {productSuggestions.length > 0 && (
              <ul className='absolute z-10 bg-white border rounded w-52 mt-1 shadow-lg max-h-40 overflow-auto text-xs'>
                {productSuggestions.map(p => (
                  <li
                    key={p.id}
                    className='px-2 py-1 cursor-pointer hover:bg-muted/30'
                    onClick={() => {
                      setProductSearch('');
                      setProductInput(p.code ? `${p.code} - ${p.name}` : p.name);
                      setForm(f => ({ ...f, product_id: p.id }));
                      setProductSuggestions([]);
                    }}
                  >
                    {p.code ? <span className='font-mono text-slate-600'>{p.code}</span> : null} {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className='ml-auto flex items-center gap-2'>
          {availableCompanies.length > 0 && (
            <div className='flex items-center gap-2'>
              <label className='text-xs text-muted-foreground'>Empresa</label>
              <select value={companyId||''} onChange={e=>setCompanyId(e.target.value||undefined)} className='h-9 border rounded px-2 text-sm'>
                <option value=''>Todas</option>
                {availableCompanies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}
          <Button size='sm' onClick={()=>setCreateOpen(true)}>Novo Movimento</Button>
          <Button size='sm' variant='outline' onClick={exportCsv}>Exportar</Button>
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='p-2 text-left'>Data</th>
              <th className='p-2 text-left'>Produto</th>
              <th className='p-2 text-left'>Tipo</th>
              <th className='p-2 text-left'>Qtd</th>
              <th className='p-2 text-left'>Local</th>
              <th className='p-2 text-left'>Motivo</th>
              <th className='p-2 text-left'>Grupo</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className='p-4 text-center text-slate-400'>Carregando...</td></tr>}
            {!loading && rows.length===0 && <tr><td colSpan={7} className='p-4 text-center text-slate-400'>Nenhum movimento</td></tr>}
            {!loading && rows.map((rRaw) => {
              const r = rRaw as Record<string, unknown>;
              const id = String(r['id'] ?? Math.random());
              const createdAt = r['created_at'] ? String(r['created_at']) : '';
              const productId = r['product_id'] ? String(r['product_id']) : '';
              const type = r['type'] ? String(r['type']) : '';
              const quantity = r['quantity'] ? String(r['quantity']) : (r['signed_qty'] ? String(r['signed_qty']) : '');
              const createdBy = r['created_by'] ? String(r['created_by']) : '-';
              return (
              <tr key={id} className='border-t hover:bg-muted/30'>
                <td className='p-2'>
                  {createdAt ? new Date(createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className='p-2' title={productId}>{productName(productId)}</td>
                <td className='p-2'>{type}</td>
                <td className={'p-2 font-mono ' + (type === 'SAIDA' ? 'text-red-600' : 'text-green-600')}>{quantity}</td>
                <td className='p-2 text-xs text-muted-foreground'>
                  {createdBy}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className='flex justify-between items-center text-xs text-muted-foreground'>
        <div>Página {page} de {totalPages} • {total} registros</div>
        <div className='flex gap-2'>
          <Button size='sm' variant='outline' disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
          <Button size='sm' variant='outline' disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={o=>!creating && setCreateOpen(o)}>
    <DialogContent className='sm:max-w-md max-h-[80vh] overflow-y-auto'>
          <DialogHeader><DialogTitle>Novo Movimento</DialogTitle></DialogHeader>
          <div className='space-y-3 text-sm'>
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Produto</label>
              <div className='relative'>
                <Input
                  value={productInput}
                  onChange={e => {
                    setProductInput(e.target.value);
                    setForm(f => ({ ...f, product_id: '' }));
                  }}
                  placeholder='Nome ou código do produto...'
                  className='mt-1 h-9 w-full'
                  autoComplete='off'
                />
                {productSuggestions.length > 0 && (
                  <ul className='absolute z-10 bg-white border rounded w-full mt-1 shadow-lg max-h-40 overflow-auto text-xs'>
                    {productSuggestions.map(p => (
                      <li
                        key={p.id}
                        className='px-2 py-1 cursor-pointer hover:bg-muted/30'
                        onClick={() => {
                          setProductInput(p.code ? `${p.code} - ${p.name}` : p.name);
                          setForm(f => ({ ...f, product_id: p.id }));
                          setProductSuggestions([]);
                        }}
                      >
                        {p.code ? <span className='font-mono text-slate-600'>{p.code}</span> : null} {p.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className='flex gap-3'>
              <div className='flex-1'>
                <label className='text-[11px] uppercase text-slate-500'>Quantidade</label>
                <Input value={form.qty} onChange={e=>setForm(f=>({...f, qty:e.target.value}))} placeholder='Ex: 10' className='mt-1 h-9' />
              </div>
              <div className='flex-1'>
                <label className='text-[11px] uppercase text-slate-500'>Tipo</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f, type:e.target.value}))} className='mt-1 h-9 w-full border rounded px-2'>
                  {movementTypes.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {form.type === 'TRANSFER' && (
              <div className='flex gap-3'>
                <div className='flex-1'>
                  <label className='text-[11px] uppercase text-slate-500'>De (Origem)</label>
                  <Input value={form.loc_from} onChange={e=>setForm(f=>({...f, loc_from:e.target.value}))} className='mt-1 h-9' />
                </div>
                <div className='flex-1'>
                  <label className='text-[11px] uppercase text-slate-500'>Para (Destino)</label>
                  <Input value={form.loc_to} onChange={e=>setForm(f=>({...f, loc_to:e.target.value}))} className='mt-1 h-9' />
                </div>
              </div>
            )}
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Motivo</label>
              <Textarea value={form.reason} onChange={e=>setForm(f=>({...f, reason:e.target.value}))} rows={3} className='mt-1' />
            </div>
          </div>
          <DialogFooter className='flex gap-2'>
            <Button variant='outline' disabled={creating} onClick={()=>setCreateOpen(false)}>Cancelar</Button>
            <Button disabled={creating} onClick={submit}>{creating? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErpStockMovements;
