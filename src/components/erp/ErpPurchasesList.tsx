import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import type { Tables } from '@/integrations/supabase/types';

interface SupplierOption { id: string; name: string; }
interface ProductOption { id: string; name: string; price?: number; }

export const ErpPurchasesList = () => {
  const [rows,setRows]=useState<Tables<'purchases'>[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [type,setType]=useState('');
  const [page,setPage]=useState(1); const pageSize=20; const [total,setTotal]=useState(0);
  const [openNew,setOpenNew]=useState(false);
  const [saving,setSaving]=useState(false);
  const [suppliers,setSuppliers]=useState<SupplierOption[]>([]);
  const [closingId,setClosingId]=useState<string|null>(null);
  const [products,setProducts]=useState<ProductOption[]>([]);
  const [items,setItems]=useState<{product_id:string; qty:string; unit_cost:string;}[]>([]);
  const [supplierId,setSupplierId]=useState('');
  const [notes,setNotes]=useState('');
  const [freight,setFreight]=useState('');
  const [discount,setDiscount]=useState('');

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      let q = supabase.from('purchases').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*pageSize, page*pageSize-1);
      if (search) q = q.ilike('purchase_number','%'+search+'%');
      if (status) q = q.eq('status',status);
      if (type) q = q.eq('purchase_type',type);
      const { data, error, count } = await q;
      if (error) throw error;
      setRows(data||[]); setTotal(count||0);
    } catch(e){ const msg=e instanceof Error?e.message:'Falha'; setError(msg);} finally { setLoading(false); }
  },[search,status,type,page]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ (async()=>{
    async function loadSuppliers(){
      type RawSupplier = { id:string; name:string };
      const resp = await (supabase.from('suppliers') as unknown as { select:(c:string)=>{ limit:(n:number)=>Promise<{ data: RawSupplier[] | null }> } }).select('id,name').limit(500);
      const s = resp.data;
      if (s) setSuppliers(s.map(r=>({id:r.id,name:r.name})));
    }
    await loadSuppliers();
    const { data: p } = await supabase.from('products').select('id,name,price').limit(500);
    if (p) setProducts(p as ProductOption[]);
  })(); },[]);

  function addItem(){ setItems(it=>[...it,{product_id:'',qty:'',unit_cost:''}]); }
  function updateItem(idx:number, patch:Partial<{product_id:string; qty:string; unit_cost:string;}>){
    setItems(list => list.map((r,i)=> i===idx? {...r,...patch}: r));
  }
  function removeItem(idx:number){ setItems(list=>list.filter((_,i)=>i!==idx)); }

  async function save(){
    if(!items.length){ toast.error('Adicione itens'); return; }
    if(items.some(i=> !i.product_id || !parseFloat(i.qty))) { toast.error('Itens incompletos'); return; }
    setSaving(true);
    try {
      const numberResp = await supabase.rpc('next_purchase_number');
      if (numberResp.error) throw numberResp.error;
      const purchase_number = numberResp.data as string;
      const mappedItems = items.map(i=> ({ product_id: i.product_id, qty: parseFloat(i.qty), unit_cost: parseFloat(i.unit_cost||'0')||0, total: (parseFloat(i.qty)||0)*(parseFloat(i.unit_cost||'0')||0) }));
      const subtotal = mappedItems.reduce((s,it)=> s + it.total, 0);
      const freightV = parseFloat(freight||'0')||0; const discountV = parseFloat(discount||'0')||0;
      const totalV = subtotal + freightV - discountV;
      const supplier = suppliers.find(s=>s.id===supplierId) || null;
      const insertPayload = {
        purchase_number,
        purchase_type: 'NORMAL',
        supplier_id: supplierId||null,
        supplier_snapshot: supplier ? {id:supplier.id,name:supplier.name}: null,
        items: mappedItems,
        subtotal,
        freight: freightV,
        discount: discountV,
        total: totalV,
        status: 'ABERTA',
        notes: notes||null,
      };
      const { error } = await supabase.from('purchases').insert(insertPayload);
      if (error) throw error;
      toast.success('Compra lançada: '+purchase_number);
      setOpenNew(false); setItems([]); setSupplierId(''); setNotes(''); setFreight(''); setDiscount('');
      load();
    } catch(e){ const msg = e instanceof Error ? e.message : 'Falha'; toast.error(msg); } finally { setSaving(false); }
  }

  const totalPages = Math.max(1, Math.ceil(total/pageSize));

  return <Card className='p-6 space-y-4'>
    <header className='flex flex-wrap gap-3 items-end'>
      <div>
        <h2 className='text-xl font-semibold mb-1'>Compras</h2>
        <p className='text-sm text-muted-foreground'>Histórico de compras e retornos.</p>
      </div>
      <div className='flex gap-2 ml-auto flex-wrap text-xs'>
        <Input placeholder='Número' value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} className='w-32 h-8' />
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}} className='h-8 border rounded px-2'>
          <option value=''>Status</option>
          <option value='ABERTA'>Aberta</option>
          <option value='FECHADA'>Fechada</option>
          <option value='CANCELADA'>Cancelada</option>
        </select>
        <select value={type} onChange={e=>{setPage(1);setType(e.target.value);}} className='h-8 border rounded px-2'>
          <option value=''>Tipo</option>
          <option value='NORMAL'>Normal</option>
          <option value='RETURN'>Devolução</option>
          <option value='EXCHANGE'>Troca</option>
        </select>
        <Button size='sm' variant='outline' onClick={()=>{setSearch('');setStatus('');setType('');setPage(1);}}>Limpar</Button>
        <Button size='sm' onClick={()=>setOpenNew(true)}>Nova Compra</Button>
      </div>
    </header>
    {error && <div className='text-sm text-red-500'>{error}</div>}
    <div className='border rounded overflow-auto max-h-[500px]'>
      <table className='w-full text-xs'>
        <thead className='bg-muted/50'><tr><th className='px-2 py-1 text-left'>Data</th><th className='px-2 py-1 text-left'>Número</th><th className='px-2 py-1 text-left'>Tipo</th><th className='px-2 py-1 text-left'>Status</th><th className='px-2 py-1 text-right'>Total</th><th className='px-2 py-1 text-left'>Fornecedor</th><th className='px-2 py-1 text-right'>Ações</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} className='text-center py-6 text-muted-foreground'>Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={6} className='text-center py-6 text-muted-foreground'>Sem compras</td></tr>}
          {!loading && rows.map(r=> {
            let supName='-';
            if (r.supplier_snapshot && typeof r.supplier_snapshot==='object' && !Array.isArray(r.supplier_snapshot)){
              type Snap = { id?: string; name?: string };
              const s = r.supplier_snapshot as unknown as Snap; supName = s?.name || '-';
            }
            return <tr key={r.id} className='border-t hover:bg-muted/40'>
              <td className='px-2 py-1 whitespace-nowrap'>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
              <td className='px-2 py-1 font-medium'>{r.purchase_number}</td>
              <td className='px-2 py-1'>{r.purchase_type}</td>
              <td className='px-2 py-1'>{r.status}</td>
              <td className='px-2 py-1 text-right'>{Number(r.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
              <td className='px-2 py-1 truncate max-w-[160px]' title={supName}>{supName}</td>
              <td className='px-2 py-1 text-right'>
                {r.status==='ABERTA' && <Button size='sm' variant='outline' disabled={closingId===r.id} onClick={async()=>{
                  setClosingId(r.id);
                  interface FinalizeResp { ok?: boolean; error?: string }
                  const rpcCall = supabase.rpc('finalize_purchase' as unknown as 'next_purchase_number', { p_purchase_id: r.id } as unknown as never) as unknown as Promise<{ data: FinalizeResp | null; error: { message: string } | null }>;
                  const { data, error } = await rpcCall;
                  const result = data as unknown as { ok?: boolean; error?: string } | null;
                  if (error || !result?.ok) {
                    toast.error(error?.message || result?.error || 'Falha ao fechar');
                  } else {
                    toast.success('Compra fechada');
                    load();
                  }
                  setClosingId(null);
                }}>{closingId===r.id? '...':'Fechar'}</Button>}
              </td>
            </tr>})}
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

    <Dialog open={openNew} onOpenChange={o=>!saving && setOpenNew(o)}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader><DialogTitle>Nova Compra</DialogTitle></DialogHeader>
        <div className='space-y-4 text-sm'>
          <div className='grid md:grid-cols-3 gap-3'>
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Fornecedor</label>
              <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} className='mt-1 w-full h-9 border rounded px-2'>
                <option value=''>-- Selecionar --</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Frete</label>
              <Input value={freight} onChange={e=>setFreight(e.target.value)} placeholder='0.00' className='mt-1 h-9' />
            </div>
            <div>
              <label className='text-[11px] uppercase text-slate-500'>Desconto</label>
              <Input value={discount} onChange={e=>setDiscount(e.target.value)} placeholder='0.00' className='mt-1 h-9' />
            </div>
          </div>
          <div>
            <div className='flex items-center justify-between mb-2'>
              <h4 className='font-medium'>Itens</h4>
              <Button size='sm' variant='outline' onClick={addItem}>Adicionar Item</Button>
            </div>
            <div className='space-y-3'>
              {items.map((it,idx)=>{
                const prod = products.find(p=>p.id===it.product_id);
                return <div key={idx} className='grid md:grid-cols-5 gap-2 items-end'>
                  <div className='md:col-span-2'>
                    <label className='text-[11px] uppercase text-slate-500'>Produto</label>
                    <select value={it.product_id} onChange={e=>updateItem(idx,{product_id:e.target.value})} className='mt-1 w-full h-9 border rounded px-2'>
                      <option value=''>--</option>
                      {products.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className='text-[11px] uppercase text-slate-500'>Qtd</label>
                    <Input value={it.qty} onChange={e=>updateItem(idx,{qty:e.target.value})} className='mt-1 h-9' />
                  </div>
                  <div>
                    <label className='text-[11px] uppercase text-slate-500'>Custo</label>
                    <Input value={it.unit_cost} onChange={e=>updateItem(idx,{unit_cost:e.target.value})} className='mt-1 h-9' />
                  </div>
                  <div className='flex gap-1 items-center'>
                    <Button size='sm' variant='outline' onClick={()=>removeItem(idx)}>Remover</Button>
                  </div>
                  {prod && <div className='md:col-span-5 text-[10px] text-muted-foreground -mt-1'>Preço base conhecido: {prod.price ?? '-'} </div>}
                </div>})}
              {items.length===0 && <div className='text-xs text-muted-foreground'>Nenhum item adicionado.</div>}
            </div>
          </div>
          <div>
            <label className='text-[11px] uppercase text-slate-500'>Observações</label>
            <Textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} className='mt-1' />
          </div>
        </div>
        <DialogFooter className='flex gap-2'>
          <Button variant='outline' disabled={saving} onClick={()=>setOpenNew(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={save}>{saving? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
};

export default ErpPurchasesList;
