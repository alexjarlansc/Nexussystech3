import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { Client, Receivable, ProductItem } from '@/types/receivables';

export default function FinanceReceivables(){
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Client[]>([]);
  const [payerType, setPayerType] = useState<'client'|'supplier'>('client');
  const [clientForm, setClientForm] = useState<Client>({ name:'', taxid:'', email:'', phone:'', address:'', payment_terms:'', credit_limit:0 });
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [receivableForm, setReceivableForm] = useState<Receivable>({ number:'', client_id:undefined, total_amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'', installments:[], document_type:'fatura' });
  const [description, setDescription] = useState('');

  useEffect(()=>{
    (async ()=>{
      try {
        const clientsResp = await supabase.from('clients').select('*').limit(200) as unknown as { data: Client[] | null };
        if (clientsResp?.data) setClients(clientsResp.data);
        const recvResp = await supabase.from('receivables').select('*').limit(200) as unknown as { data: Receivable[] | null };
        if (recvResp?.data) setReceivables(recvResp.data);
        // carregar fornecedores opcionais
        try {
          const s = await supabase.from('suppliers').select('*').limit(200) as unknown as { data: Client[] | null };
          if (s?.data) setSuppliers(s.data);
        } catch (_){/* optional */}
      } catch (e){ console.error('[FinanceReceivables] load error', e); }
    })();
  },[]);

  async function saveClient(){
    if (!clientForm.name) { toast.error('Nome é obrigatório'); return; }
    try {
  const res = await supabase.from('clients').insert([clientForm]);
  // success assumed; errors serão capturados no catch
      toast.success('Cliente salvo');
      const list = await supabase.from('clients').select('*').limit(200) as unknown as { data: Client[] | null };
      if (list?.data) setClients(list.data);
      setClientForm({ name:'', taxid:'', email:'', phone:'', address:'', payment_terms:'', credit_limit:0 });
    } catch(e){ console.error(e); toast.error('Falha ao salvar cliente'); }
  }

  type RpcStringResult = { data?: string | null; error?: unknown };
  type InsertSingle<T> = { data?: T | null; error?: unknown };

  async function saveReceivable(){
    // validar: aceitar tanto client_id quanto supplier_id
    if ((!receivableForm.client_id && !receivableForm.supplier_id) || !receivableForm.total_amount) { toast.error('Pagador e valor são obrigatórios'); return; }
    try {
      // obter próximo número sequencial via RPC
      let nextNumber = 'RCV' + String(Date.now());
      try {
        const rpcRes = await supabase.rpc('next_receivable_number') as unknown as RpcStringResult;
        if (rpcRes?.data) nextNumber = rpcRes.data;
      } catch(_){ /* fallback gerado */ }

      const payload = {
        receivable_number: nextNumber,
        client_id: receivableForm.client_id || null,
        supplier_id: receivableForm.supplier_id || null,
        description: description || 'Fatura',
        issue_date: receivableForm.issued_at || new Date().toISOString().slice(0,10),
        due_date: receivableForm.due_at || null,
        amount: receivableForm.total_amount,
        status: receivableForm.status || 'pendente',
      };

  const res = await supabase.from('receivables').insert([payload]).select('*').single() as unknown as InsertSingle<{ id?: string }>;
  const created = res?.data;
  if (!created?.id) throw new Error('Falha ao criar recebível');

      toast.success('Recebível lançado');
      const list = await supabase.from('receivables').select('*').limit(200) as unknown as { data: Receivable[] | null };
      if (list?.data) setReceivables(list.data);

      // registrar histórico de criação (opcional, não bloqueante)
      try{
        const sb = supabase as unknown as { from: (table: string) => { insert: (rows: unknown[]) => Promise<unknown> } };
        await sb.from('receivables_history').insert([{ receivable_id: created.id, action: 'created', details: payload, created_at: new Date().toISOString() }]);
      } catch(_){ /* ignore history failures */ }

      setReceivableForm({ number:'', client_id:undefined, supplier_id: undefined, total_amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'', installments:[], document_type:'fatura' });
    } catch(e){ console.error(e); toast.error('Falha ao lançar'); }
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Cadastro de Clientes</h3>
          <div className="grid gap-2">
            <Input placeholder="Nome / Razão Social" value={clientForm.name} onChange={e=>setClientForm(s=>({...s, name: e.target.value}))} />
            <Input placeholder="CNPJ / CPF" value={clientForm.taxid} onChange={e=>setClientForm(s=>({...s, taxid: e.target.value}))} />
            <Input placeholder="Telefone" value={clientForm.phone} onChange={e=>setClientForm(s=>({...s, phone: e.target.value}))} />
            <Input placeholder="Email" value={clientForm.email} onChange={e=>setClientForm(s=>({...s, email: e.target.value}))} />
            <Input placeholder="Endereço" value={clientForm.address} onChange={e=>setClientForm(s=>({...s, address: e.target.value}))} />
            <div className="flex gap-2">
              <Button onClick={saveClient}>Salvar</Button>
              <Button variant="outline" onClick={()=>setClientForm({ name:'', taxid:'', email:'', phone:'', address:'', payment_terms:'', credit_limit:0 })}>Limpar</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Lançar Recebível</h3>
          <div className="grid gap-2">
            <div className="flex gap-2 items-center">
              <label className="text-sm">Pagador:</label>
              <select value={payerType} onChange={e=>setPayerType(e.target.value === 'supplier' ? 'supplier' : 'client')} className="h-8 border rounded px-2">
                <option value="client">Cliente</option>
                <option value="supplier">Fornecedor</option>
              </select>
            </div>
            {payerType==='client' ? (
              <select value={receivableForm.client_id || ''} onChange={e=>setReceivableForm(s=>({...s, client_id: e.target.value || undefined, supplier_id: undefined}))} className="h-9 border rounded px-2">
                <option value="">Selecionar cliente</option>
                {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <select value={receivableForm.supplier_id || ''} onChange={e=>setReceivableForm(s=>({...s, supplier_id: e.target.value || undefined, client_id: undefined}))} className="h-9 border rounded px-2">
                <option value="">Selecionar fornecedor</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Input placeholder="Valor total" value={String(receivableForm.total_amount)} onChange={e=>setReceivableForm(s=>({...s, total_amount: Number(e.target.value) }))} />
            <Input placeholder="Data de emissão (YYYY-MM-DD)" value={receivableForm.issued_at} onChange={e=>setReceivableForm(s=>({...s, issued_at: e.target.value}))} />
            <Input placeholder="Data de vencimento (YYYY-MM-DD)" value={receivableForm.due_at} onChange={e=>setReceivableForm(s=>({...s, due_at: e.target.value}))} />
            <Input placeholder="Descrição" value={description} onChange={e=>setDescription(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={saveReceivable}>Lançar</Button>
              <Button variant="outline" onClick={()=>setReceivableForm({ number:'', client_id:undefined, total_amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'', installments:[], document_type:'fatura' })}>Limpar</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Recebíveis</h3>
        <div className="max-h-72 overflow-auto border rounded p-2">
          {receivables.length===0 && <div className="text-sm text-muted-foreground">Sem lançamentos</div>}
          {receivables.map(r=> (
            <div key={r.id} className="p-2 border-b last:border-b-0 flex justify-between items-center">
              <div>
                <div className="font-medium">#{r.number} • {r.status}</div>
                <div className="text-xs text-muted-foreground">Vence: {r.due_at} • {r.total_amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost">Ver</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
