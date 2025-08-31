import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import type { Tables } from '@/integrations/supabase/types';

interface ProductOption { id: string; name: string; }

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
  const [rows, setRows] = useState<Tables<'stock_movements'>[]>([]);
  const [page,setPage]=useState(1); const pageSize=50; const [total,setTotal]=useState(0);
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ product_id: '', qty: '', type: 'IN', reason: '', loc_from: '', loc_to: '' });
  const [companyId, setCompanyId] = useState<string|undefined>(undefined);
  // Carregar companyId do profile do usuário autenticado
  useEffect(()=>{(async()=>{
    try {
  const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if(!user){ console.warn('Sem usuário autenticado para obter company_id'); return; }
  const { data, error } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single();
      if(error){ console.warn('Erro ao buscar profile para company_id', error); return; }
      if(data?.company_id){ setCompanyId(data.company_id); }
      else console.warn('Profile sem company_id');
    } catch (err) { console.warn('Falha ao carregar company_id', err); }
  })();},[]);
  // Corrigir valor inicial para 'ENTRADA'
  const [products, setProducts] = useState<ProductOption[]>([]);

  async function loadProducts() {
    const { data, error } = await supabase.from('products').select('id,name').limit(500);
    if (!error && data) setProducts(data as ProductOption[]);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page-1)*pageSize; const to = from + pageSize - 1;
      let query = supabase.from('stock_movements').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from,to);
      if (companyId) query = query.eq('company_id', companyId);
      if (typeFilter) query = query.eq('type', typeFilter);
      if (search) query = query.ilike('reason', `%${search}%`);
      if (productSearch) {
        // Buscar produtos que batem com o termo
        const { data: prodData } = await supabase.from('products').select('id').or(`name.ilike.%${productSearch}%,code.ilike.%${productSearch}%`);
        const prodIds = prodData?.map((p:any)=>p.id) || [];
        if(prodIds.length) query = query.in('product_id', prodIds);
        else query = query.in('product_id', ['']); // força vazio se não encontrar
      }
      const { data, error, count } = await query;
      if (error) throw error;
      setRows(data || []);
      setTotal(count||0);
    } catch (e) {
      const msg = (e instanceof Error) ? e.message : 'Falha ao carregar movimentos';
      toast.error(msg);
    } finally { setLoading(false); }
  }, [typeFilter, search, page, companyId, productSearch]);

  useEffect(() => { load(); }, [typeFilter, search, page, companyId, productSearch]);
  useEffect(() => { loadProducts(); }, []);

  async function submit() {
    if (!form.product_id) { toast.error('Selecione produto'); return; }
    const qtyNum = parseFloat(form.qty.replace(',','.'));
    if (!qtyNum || qtyNum <= 0) { toast.error('Qtd inválida'); return; }
    setCreating(true);
    try {
      const payload = {
        p_product_id: form.product_id,
        p_qty: qtyNum,
        p_type: form.type, // agora já está no padrão correto
        p_reason: form.reason || null,
        p_location_from: form.loc_from || null,
        p_location_to: form.loc_to || null,
      };
      const { error } = await supabase.rpc('register_stock_movement', payload);
      if (error) {
        toast.error('Erro ao registrar: ' + (error.message || JSON.stringify(error)));
        if(import.meta.env.DEV) console.error('Erro detalhado:', error);
        return;
      }
      toast.success('Movimento registrado');
      setCreateOpen(false);
      setForm({ product_id: '', qty: '', type: 'IN', reason: '', loc_from: '', loc_to: '' });
      load();
    } catch(e){
      const msg = (e instanceof Error) ? e.message : 'Erro ao registrar';
      toast.error(msg);
      if(import.meta.env.DEV) console.error('Erro inesperado:', e);
    } finally { setCreating(false); }
  }

  function productName(id:string){
    const p = products.find(p=>p.id===id); return p? p.name : id.slice(0,8);
  }

  function exportCsv(){
    const header = ['data','produto','tipo','qtd','local','motivo','grupo'];
    const lines = rows.map(r=>[
      new Date(r.created_at).toISOString(),
      productName(r.product_id),
      r.type,
      r.signed_qty,
      r.location||'',
      (r.reason||'').replace(/\n/g,' '),
      r.movement_group||''
    ].join(';'));
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
          <Input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder='Nome ou código do produto...' className='h-9 w-52' />
  </div>
        <div className='flex flex-col'>
          <span className='text-[11px] uppercase text-slate-500'>Tipo</span>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className='h-9 border rounded px-2 text-sm'>
            <option value=''>Todos</option>
            {movementTypes.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Button onClick={()=>load()} variant='outline' size='sm'>Atualizar</Button>
        <Button onClick={()=>setCreateOpen(true)} size='sm'>Novo Movimento</Button>
        <Button onClick={exportCsv} variant='outline' size='sm'>Exportar CSV</Button>
      </div>
      <div className='overflow-auto border rounded'>
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
            {!loading && rows.map(r => (
              <tr key={r.id} className='border-t hover:bg-muted/30'>
                <td className='p-2'>{new Date(r.created_at).toLocaleString()}</td>
                <td className='p-2' title={r.product_id}>{productName(r.product_id)}</td>
                <td className='p-2'>{r.type}</td>
                <td className={'p-2 font-mono ' + (r.signed_qty < 0 ? 'text-red-600' : 'text-green-600')}>{r.signed_qty}</td>
                <td className='p-2'>{r.location || '-'}</td>
                <td className='p-2 max-w-[220px] truncate' title={r.reason || ''}>{r.reason || '-'}</td>
                <td className='p-2 text-[10px]'>{r.movement_group?.slice(0,8) || '-'}</td>
              </tr>
            ))}
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
        <DialogContent className='sm:max-w-md'>
          <DialogHeader><DialogTitle>Novo Movimento</DialogTitle></DialogHeader>
          <div className='space-y-3 text-sm'>
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Produto</label>
              <select value={form.product_id} onChange={e=>setForm(f=>({...f, product_id:e.target.value}))} className='mt-1 w-full border rounded h-9 px-2'>
                <option value=''>Selecione...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} title={p.name}>
                    {p.name.length > 40 ? p.name.slice(0, 40) + '...' : p.name}
                  </option>
                ))}
              </select>
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
