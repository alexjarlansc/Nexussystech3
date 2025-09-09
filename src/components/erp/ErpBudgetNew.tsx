import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ClientPicker } from '@/components/ClientPicker';
import { Product } from '@/types';

type Row = { id: string; product_id?: string | null; product_name: string; details?: string; quantity: number; price_type?: string; unit_price: number; discount_value?: number; discount_percent?: number; subtotal: number };

export default function ErpBudgetNew({ open, onOpenChange }:{ open:boolean; onOpenChange:(o:boolean)=>void }){
  const { profile } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([{ id: String(Date.now()), product_id: null, product_name: '', details: '', quantity: 1, price_type: 'LOJA', unit_price: 0, discount_value: 0, discount_percent: 0, subtotal: 0 }]);
  const [number, setNumber] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<any | null>(null);
  const [clientsCache, setClientsCache] = React.useState<any[]>([]);
  const [vendors, setVendors] = React.useState<Array<{id:string; name:string; role?:string}>>([]);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
  const [deliveryDate, setDeliveryDate] = React.useState<string | null>(null);
  const [freight, setFreight] = React.useState('0');
  const [subtotal, setSubtotal] = React.useState<number>(0);
  const [total, setTotal] = React.useState<number>(0);
  const [showTotalOnPrint, setShowTotalOnPrint] = React.useState(true);

  // payment
  const [genPayment, setGenPayment] = React.useState(false);
  const [isParcelado, setIsParcelado] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<string | null>(null);
  const [intervalDays, setIntervalDays] = React.useState<number | null>(null);
  const [parcelsQty, setParcelsQty] = React.useState<number | null>(null);
  const [firstParcelDate, setFirstParcelDate] = React.useState<string | null>(null);

  // product suggestions (debounced search handled per-row)
  const [prodSuggestions, setProdSuggestions] = React.useState<Array<{id:string; name:string; code?:string}>>([]);
  const [activeRowId, setActiveRowId] = React.useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState<number>(-1);

  const [costCenters, setCostCenters] = React.useState<Array<{id:string; name:string}>>([]);
  const [hasCostCenters, setHasCostCenters] = React.useState<boolean | null>(null);

  // busca clientes cache (pegar company clients)
  React.useEffect(()=>{
    (async()=>{
      try{
        const { data } = await (supabase as any).from('clients').select('*').limit(500);
        if(Array.isArray(data)) setClientsCache(data as any[]);
      }catch(e){ /* ignore */ }
    })();
  },[]);

  // try load cost centers if table exists
  React.useEffect(()=>{
    (async()=>{
      try{
        const res = await (supabase as any).from('cost_centers').select('id,name').limit(200);
        if(res && Array.isArray(res.data)) { setCostCenters(res.data.map((c:any)=>({ id:String(c.id), name:String(c.name||'') }))); setHasCostCenters(true); }
        else setHasCostCenters(false);
      }catch(e){ setHasCostCenters(false); }
    })();
  },[]);

  // carregar vendedores (users com profile role) para popular select
  React.useEffect(()=>{
    (async()=>{
      try{
        const q = (supabase as any).from('users').select('id,first_name,role').limit(200);
        const resp = await q;
        if(resp && Array.isArray(resp.data)) setVendors(resp.data.map((u:any)=>({ id: String(u.id), name: (u.first_name||'') , role: u.role })));
      }catch(e){ /* ignore */ }
    })();
  },[]);

  // Recalcula subtotais e total quando linhas ou frete mudam
  React.useEffect(()=>{
    let prodSum = 0;
    const newRows = rows.map(r=>{
      const q = Number(r.quantity) || 0;
      const p = Number(String(r.unit_price).replace(',','.')) || 0;
      const discVal = Number(r.discount_value || 0) || 0;
      const discPct = Number(r.discount_percent || 0) || 0;
      let sub = q * p;
      if(discVal) sub = Math.max(0, sub - discVal);
      else if(discPct) sub = Math.max(0, sub * (1 - discPct/100));
      sub = +sub.toFixed(2);
      prodSum += sub;
      return { ...r, subtotal: sub };
    });
    setRows(prev => {
      if (prev.length !== newRows.length) return newRows;
      for (let i=0;i<newRows.length;i++) if (newRows[i].subtotal !== prev[i].subtotal) return newRows;
      return prev;
    });
    const f = Number(String(freight).replace(',','.')) || 0;
    setSubtotal(+prodSum.toFixed(2));
    setTotal( Number((prodSum + f).toFixed(2)) );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rows.length, freight]);

  function updateRow(idx:number, patch:Partial<Row>){
    setRows(rs => rs.map((r,i)=> i===idx ? { ...r, ...patch } : r));
  }

  function addRow(){
    setRows(rs => [...rs, { id: String(Date.now()), product_id:null, product_name:'', details:'', quantity:1, price_type:'LOJA', unit_price:0, discount_value:0, discount_percent:0, subtotal:0 }]);
  }

  function removeRow(idx:number){
    setRows(rs => rs.filter((_,i)=> i!==idx));
  }

  async function fetchProductSuggestions(q:string){
    if(!q || !q.trim()) { setProdSuggestions([]); setActiveSuggestionIndex(-1); return; }
    try{
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id,name,code')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .limit(12);
      if(!error && Array.isArray(data)) setProdSuggestions(data.map((p:any)=>({ id:String(p.id), name:String(p.name||''), code: p.code?String(p.code):undefined })));
      else setProdSuggestions([]);
    }catch(e){ setProdSuggestions([]); }
  }

  function onProductKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: Row){
    if (!prodSuggestions || activeRowId !== row.id) return;
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      setActiveSuggestionIndex(i => Math.min((prodSuggestions?.length||0)-1, i+1));
    } else if (e.key === 'ArrowUp'){
      e.preventDefault();
      setActiveSuggestionIndex(i => Math.max(0, i-1));
    } else if (e.key === 'Enter'){
      if (activeSuggestionIndex >= 0 && prodSuggestions[activeSuggestionIndex]){
        const p = prodSuggestions[activeSuggestionIndex];
        updateRowById(row.id, { product_id: p.id, product_name: p.name });
        setProdSuggestions([]);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Escape'){
      setProdSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  }

  function updateRowById(id:string, patch:Partial<Row>){
    setRows(rs => rs.map(r=> r.id===id ? { ...r, ...patch } : r));
  }

  // (parcelas editáveis removidas por solicitação)

  async function handleSave(){
    if (saving) return;
    if(!selectedClient) { toast.error('Cliente obrigatório'); return; }
    setSaving(true);
    try{
      const items = rows.map(r=>({ product_id: r.product_id || null, product_name: r.product_name || null, details: r.details || null, quantity: Number(r.quantity)||0, unit_price: Number(String(r.unit_price).replace(',','.'))||0, discount_value: Number(r.discount_value||0)||0, discount_percent: Number(r.discount_percent||0)||0, subtotal: r.subtotal }));
      const payload = {
        type: 'ORCAMENTO',
        number: number || null,
        customer_id: selectedClient?.id || null,
        customer_name: selectedClient?.name || null,
        date: date || null,
        delivery_date: deliveryDate || null,
        subtotal,
        freight: Number(String(freight).replace(',','.'))||0,
        total,
        items,
        company_id: profile?.company_id || null,
        show_total_on_print: showTotalOnPrint ? true : false,
      };
      // salvar orçamento
      const { data: createdQuote, error } = await (supabase as any).from('quotes').insert(payload).select('*').single();
      if (error) throw error;

      // se gerar condições de pagamento, criar 1 receivable + installments
      if (genPayment) {
        const qty = parcelsQty && parcelsQty > 0 ? parcelsQty : 1;
        const interval = intervalDays && intervalDays > 0 ? intervalDays : 30;
        const base = firstParcelDate ? new Date(firstParcelDate) : new Date();
        const perAmount = +( (total || 0) / qty ).toFixed(2);
        // obter próximo número para a fatura (receivable)
        let mainNumber = null;
        try{ const rpc = await (supabase as any).rpc('next_receivable_number'); if(rpc && rpc.data) mainNumber = rpc.data; }catch(_){ mainNumber = ('RCV-'+Date.now()); }
        const receivablePayload = { receivable_number: mainNumber, client_id: selectedClient?.id || null, description: `Recebível do Orçamento ${createdQuote?.id || ''}`, issue_date: new Date().toISOString().slice(0,10), due_date: firstParcelDate || null, amount: total || 0, status: 'pendente', payment_method: paymentMethod || null, document_type: 'parcelado', company_id: profile?.company_id || null, origin_quote_id: createdQuote?.id || null };
        try{
          const res = await (supabase as any).from('receivables').insert([receivablePayload]).select('*').single();
          const created = res?.data;
          if(created && created.id){
            const toInsert: any[] = [];
            for(let i=0;i<qty;i++){
              const due = new Date(base.getTime());
              due.setDate(due.getDate() + (i * interval));
              toInsert.push({ receivable_id: created.id, installment_number: i+1, due_date: due.toISOString().slice(0,10), amount: perAmount });
            }
            if(toInsert.length>0) await (supabase as any).from('receivable_installments').insert(toInsert);
          }
        }catch(e){ console.error('Erro criando receivable + installments', e); }
      }

      toast.success('Orçamento salvo');
      onOpenChange(false);
    }catch(err:any){
      toast.error(err?.message || String(err) || 'Erro ao salvar');
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
        <div className="p-4 space-y-4">
          {/* Dados gerais */}
          <Card className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Número</label>
                <Input placeholder="Número" value={number} onChange={e=>setNumber((e.target as HTMLInputElement).value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Cliente</label>
                <ClientPicker clients={clientsCache} value={selectedClient?.id || null} onSelect={(c)=>setSelectedClient(c)} onClear={()=>setSelectedClient(null)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Vencimento / Data</label>
                <Input type="date" value={date} onChange={e=>setDate((e.target as HTMLInputElement).value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Prazo de entrega</label>
                <Input type="date" value={deliveryDate||''} onChange={e=>setDeliveryDate((e.target as HTMLInputElement).value||null)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Canal de venda</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Presencial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Centro de custo</label>
                {hasCostCenters ? (
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Centro de custo" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm text-muted-foreground mb-1 block">Introdução</label>
              <textarea className="w-full border rounded p-2" rows={3} />
            </div>
          </Card>

          {/* Produtos */}
          <Card className="p-3">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Detalhes</th>
                    <th className="w-24">Quant.</th>
                    <th className="w-32">Tipo</th>
                    <th className="w-32">Valor</th>
                    <th>Desconto</th>
                    <th className="w-32 text-right">Subtotal</th>
                    <th className="w-16">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,idx)=> (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-1">
                        <input className="w-full border rounded px-2 py-1" value={r.product_name} onChange={e=>{ updateRow(idx,{ product_name: e.target.value }); fetchProductSuggestions(e.target.value); setActiveRowId(r.id); setActiveSuggestionIndex(-1); }} placeholder="Buscar produto" onFocus={()=>{ setActiveRowId(r.id); }} onKeyDown={(e)=> onProductKeyDown(e, r)} />
                        {/* sugestões simples por linha */}
                        {prodSuggestions.length>0 && r.product_name && activeRowId===r.id && (
                          <div className="bg-white border rounded mt-1 max-h-28 overflow-auto z-10">
                            {prodSuggestions.map((p, si)=> (
                              <div key={p.id} className={`p-1 hover:bg-gray-100 cursor-pointer ${si===activeSuggestionIndex? 'bg-gray-100':''}`} onMouseDown={(e)=>{ e.preventDefault(); updateRowById(r.id,{ product_id: p.id, product_name: p.name }); setProdSuggestions([]); setActiveSuggestionIndex(-1); setActiveRowId(null); }}>
                                <div className="text-sm">{p.name}</div>
                                <div className="text-xs text-muted-foreground">{p.code}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1"><Input value={r.details||''} onChange={e=> updateRow(idx,{ details: (e.target as HTMLInputElement).value })} /></td>
                      <td className="px-2 py-1"><Input value={String(r.quantity)} onChange={e=> updateRow(idx,{ quantity: Number((e.target as HTMLInputElement).value)||0 })} /></td>
                      <td className="px-2 py-1">
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder={r.price_type || 'LOJA'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOJA">LOJA (80)</SelectItem>
                            <SelectItem value="JAN">JAN (120)</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1"><Input value={String(r.unit_price)} onChange={e=> updateRow(idx,{ unit_price: Number((e.target as HTMLInputElement).value)||0 })} /></td>
                      <td className="px-2 py-1"><Input value={String(r.discount_value||'')} onChange={e=> updateRow(idx,{ discount_value: Number((e.target as HTMLInputElement).value)||0 })} /></td>
                      <td className="px-2 py-1 text-right">{Number(r.subtotal||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                      <td className="px-2 py-1 text-center"><Button variant="destructive" onClick={()=>removeRow(idx)}>x</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2"><Button size="sm" onClick={addRow}>Adicionar linha</Button></div>
          </Card>

          {/* Total */}
          <Card className="p-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-2"><Checkbox checked={showTotalOnPrint} onCheckedChange={v=>setShowTotalOnPrint(Boolean(v))} /> <span className="ml-2">Exibir valor total na impressão</span></div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground block">Produtos</label>
                    <div className="p-2 bg-gray-50 rounded">{subtotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block">Serviços</label>
                    <div className="p-2 bg-gray-50 rounded">R$ 0,00</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block">Frete</label>
                    <Input value={freight} onChange={e=>setFreight((e.target as HTMLInputElement).value)} />
                  </div>
                </div>
              </div>
              <div className="w-48 text-right">
                <div className="text-sm text-muted-foreground">Valor total</div>
                <div className="text-lg font-semibold">{total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              </div>
            </div>
          </Card>

          {/* Pagamento */}
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={genPayment} onCheckedChange={v=>setGenPayment(Boolean(v))} /> <span>Gerar condições de pagamento</span>
            </div>
            {genPayment && (<>
              <div className="mt-3 grid grid-cols-6 gap-3 items-end">
                <div className="col-span-1">À vista</div>
                <div className="col-span-1">Parcelado</div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground block">Forma de pagamento</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block">Intervalo parcelas (dias)</label>
                  <Input value={intervalDays||''} onChange={e=> setIntervalDays(Number((e.target as HTMLInputElement).value)||null)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block">Qnt. parcelas</label>
                  <Input value={parcelsQty||''} onChange={e=> setParcelsQty(Number((e.target as HTMLInputElement).value)||null)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block">Data 1ª parcela</label>
                  <Input type="date" value={firstParcelDate||''} onChange={e=> setFirstParcelDate((e.target as HTMLInputElement).value||null)} />
                </div>
                
              </div>
              
            </>)}
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving? 'Salvando...':'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
