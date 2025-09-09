/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { formatCurrencyInput, parseCurrencyInput, isValidCnpjCpf, formatTaxId, formatPhoneBR, validateCPF, validateCNPJ } from './financeUtils';

type Supplier = { id?: string; name: string; taxid?: string; phone?: string; email?: string; bank?: string; account?: string; conditions?: string };

type Expense = { id?: string; type: 'fixa' | 'variavel'; category: string; amount: number; due_date: string; frequency: 'unica' | 'mensal' | 'anual'; notes?: string };

type Invoice = { id?: string; number: string; supplier_id?: string; amount: number; issued_at?: string; due_at?: string; status?: string; payment_method?: string };

export default function FinancePayables(){
  const [tab, setTab] = useState<'suppliers'|'expenses'|'invoices'|'approvals'|'payments'|'reconciliation'|'reports'>('suppliers');

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState<Supplier>({ name: '', taxid: '', phone:'', email:'', bank:'', account:'', conditions:'' });
  const [loading, setLoading] = useState(false);

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseForm, setExpenseForm] = useState<Expense>({ type:'fixa', category:'', amount:0, due_date:'', frequency:'unica', notes:'' });

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceForm, setInvoiceForm] = useState<Invoice>({ number:'', supplier_id:undefined, amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'' });
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<{key: keyof Invoice|'amount'|'due_at'|'number', dir: 'asc'|'desc'}>({ key: 'due_at', dir: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});

  useEffect(()=>{
    // carregar dados básicos (placeholders) - não bloqueante
    (async ()=>{
      try {
        const { data: s } = await (supabase as any).from('suppliers').select('*').limit(50);
        if (s) setSuppliers(s as Supplier[]);
      } catch(_){/* ignore */}
    })();
  },[]);

  async function saveSupplier(){
    if (!supplierForm.name) { toast.error('Nome obrigatório'); return; }
    setLoading(true);
    try {
      const { error } = await (supabase as any).from('suppliers').insert([supplierForm]);
      if (error) throw error;
      toast.success('Fornecedor salvo');
      setSupplierForm({ name:'', taxid:'', phone:'', email:'', bank:'', account:'', conditions:'' });
  const { data: s } = await (supabase as any).from('suppliers').select('*').limit(50);
      if (s) setSuppliers(s as Supplier[]);
  } catch(e:any){ toast.error('Falha: '+(e.message||String(e))); }
    setLoading(false);
  }

  // --- utilitários locais ---
  // utilitários importados de financeUtils

  function toggleSelectInvoice(id?:string){
    if (!id) return;
    setSelectedInvoices(s=> s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  }

  async function bulkUpdateInvoices(status:string){
    if (selectedInvoices.length===0) return toast.error('Nenhuma fatura selecionada');
    setLoading(true);
    try{
      const { error } = await (supabase as any).from('payables').update({ status }).in('id', selectedInvoices);
      if (error) throw error;
      // history
  try { await (supabase as any).from('payables_history').insert(selectedInvoices.map(id=>({ payable_id: id, action: status, created_at: new Date().toISOString() }))); } catch(_){ /* optional */ }
      toast.success('Ação em massa executada');
      setSelectedInvoices([]);
      await loadApprovals();
    } catch(e:any){ toast.error('Falha em ação em massa'); }
    setLoading(false);
  }

  async function saveExpense(){
    if (!expenseForm.category || !expenseForm.amount) { toast.error('Categoria e valor obrigatórios'); return; }
    setLoading(true);
    try {
      const { error } = await (supabase as any).from('expenses').insert([expenseForm]);
      if (error) throw error;
      toast.success('Despesa cadastrada');
      setExpenseForm({ type:'fixa', category:'', amount:0, due_date:'', frequency:'unica', notes:'' });
      const { data } = await (supabase as any).from('expenses').select('*').limit(100);
      if (data) setExpenses(data as Expense[]);
    } catch(e:any){ toast.error('Falha: '+(e.message||String(e))); }
    setLoading(false);
  }

  async function saveInvoice(){
    if (!invoiceForm.number || !invoiceForm.amount) { toast.error('Número e valor obrigatórios'); return; }
    setLoading(true);
    try {
      const { error } = await (supabase as any).from('payables').insert([invoiceForm]);
      if (error) throw error;
      toast.success('Fatura lançada');
      setInvoiceForm({ number:'', supplier_id:undefined, amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'' });
      const { data } = await (supabase as any).from('payables').select('*').limit(200);
      if (data) setInvoices(data as Invoice[]);
    } catch(e:any){ toast.error('Falha: '+(e.message||String(e))); }
    setLoading(false);
  }

  // Approvals: carregar faturas pendentes
  async function loadApprovals(){
    try {
      const { data } = await (supabase as any).from('payables').select('*').eq('status','pendente').order('due_date',{ascending:true}).limit(200);
      if (data) setInvoices(data as Invoice[]);
    } catch(e:any){ /* ignore */ }
  }

  function sortedPagedInvoices(){
    const list = invoices.filter(i=>i.status==='pendente');
    const sorted = [...list].sort((a,b)=>{
      const key = sortBy.key as keyof Invoice;
      const va: any = (a as any)[key] ?? '';
      const vb: any = (b as any)[key] ?? '';
      if (typeof va === 'number' || typeof vb === 'number') return (va - vb) * (sortBy.dir==='asc'?1:-1);
      return String(va).localeCompare(String(vb)) * (sortBy.dir==='asc'?1:-1);
    });
    const start = (page-1)*pageSize; return sorted.slice(start, start+pageSize);
  }

  function toggleSort(key: any){
    setPage(1);
    setSortBy(s=> s.key===key ? { ...s, dir: s.dir==='asc'?'desc':'asc' } : { key, dir: 'asc' });
  }

  async function updateInvoiceStatus(id:string|undefined, status:string){
    if(!id) return;
    setLoading(true);
    try{
      const { error } = await (supabase as any).from('payables').update({ status }).eq('id', id);
      if (error) throw error;
      // registrar histórico simples se tabela existir
  try { await (supabase as any).from('payables_history').insert([{ payable_id: id, action: status, created_at: new Date().toISOString() }]); } catch(_){ /* history optional */ }
      toast.success('Status atualizado');
      await loadApprovals();
    } catch(e:any){ toast.error('Falha ao atualizar'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Contas a Pagar</h2>
        <nav className="ml-auto flex gap-2">
          {[
            {key: 'suppliers', label: 'Fornecedores'},
            {key: 'expenses', label: 'Despesas'},
            {key: 'invoices', label: 'Faturas'},
            {key: 'approvals', label: 'Aprovações'},
            {key: 'payments', label: 'Pagamentos'},
            {key: 'reconciliation', label: 'Conciliação'},
            {key: 'reports', label: 'Relatórios'},
          ].map(t=> (
            <Button key={(t as any).key} variant={tab=== (t as any).key? 'default':'ghost'} size="sm" onClick={()=>setTab((t as any).key)}>{(t as any).label}</Button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Resumo</h3>
          <div className="text-sm text-muted-foreground">Total faturas: {invoices.length}</div>
          <div className="text-sm text-muted-foreground">Fornecedores: {suppliers.length}</div>
        </Card>
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold mb-2">Filtro rápido</h3>
            <div className="flex gap-2">
              <Input placeholder="Pesquisar número/fornecedor" onChange={e=>{/* filtro futuro */}} className="h-8" />
              <Button size="sm" onClick={()=>loadApprovals()}>Atualizar</Button>
            </div>
          </div>
        </Card>
      </div>

      {tab==='suppliers' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Cadastro de Fornecedores</h3>
            <div className="grid gap-2">
              <Input placeholder="Nome / Razão Social" value={supplierForm.name} onChange={e=>setSupplierForm(s=>({...s, name: e.target.value}))} />
              <Input placeholder="CNPJ / CPF" value={supplierForm.taxid} onChange={e=>setSupplierForm(s=>({...s, taxid: formatTaxId(e.target.value)}))} />
              <Input placeholder="Telefone" value={supplierForm.phone} onChange={e=>setSupplierForm(s=>({...s, phone: formatPhoneBR(e.target.value)}))} />
              
              <Input placeholder="Email" value={supplierForm.email} onChange={e=>setSupplierForm(s=>({...s, email: e.target.value}))} />
              <Input placeholder="Dados bancários" value={supplierForm.bank} onChange={e=>setSupplierForm(s=>({...s, bank: e.target.value}))} />
              <Input placeholder="Condições de pagamento" value={supplierForm.conditions} onChange={e=>setSupplierForm(s=>({...s, conditions: e.target.value}))} />
              <div className="flex gap-2">
                <Button onClick={()=>{ if(!supplierForm.name){ toast.error('Nome obrigatório'); return; } if(supplierForm.taxid && !isValidCnpjCpf(supplierForm.taxid)){ toast.error('CNPJ/CPF inválido'); return; } saveSupplier(); }} disabled={loading}>Salvar</Button>
                <Button variant="outline" onClick={()=>setSupplierForm({ name:'', taxid:'', phone:'', email:'', bank:'', account:'', conditions:'' })}>Limpar</Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Fornecedores Cadastrados</h3>
            <div className="max-h-72 overflow-auto border rounded p-2">
              {suppliers.length===0 && <div className="text-sm text-muted-foreground">Sem fornecedores</div>}
              {suppliers.map(s=> (
                <div key={s.id} className="p-2 border-b last:border-b-0 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.taxid} • {s.phone}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={()=>{ setSupplierForm(s); }}>Editar</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='expenses' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Cadastro de Despesas</h3>
            <div className="grid gap-2">
              <Select value={expenseForm.type} onValueChange={(v:any)=>setExpenseForm(e=>({...e, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Categoria (aluguel, energia, serviços...)" value={expenseForm.category} onChange={e=>setExpenseForm(s=>({...s, category: e.target.value}))} />
              <Input placeholder="Valor" value={formatCurrencyInput(expenseForm.amount)} onChange={e=>setExpenseForm(s=>({...s, amount: parseCurrencyInput(e.target.value)}))} />
              <Input placeholder="Data de Vencimento (YYYY-MM-DD)" value={expenseForm.due_date} onChange={e=>setExpenseForm(s=>({...s, due_date: e.target.value}))} />
              <Select value={expenseForm.frequency} onValueChange={(v:any)=>setExpenseForm(e=>({...e, frequency: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unica">Única</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button onClick={()=>{ if(!expenseForm.category || !expenseForm.amount){ toast.error('Categoria e valor obrigatórios'); return; } saveExpense(); }} disabled={loading}>Salvar</Button>
                <Button variant="outline" onClick={()=>setExpenseForm({ type:'fixa', category:'', amount:0, due_date:'', frequency:'unica', notes:'' })}>Limpar</Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Despesas Cadastradas</h3>
            <div className="max-h-72 overflow-auto border rounded p-2">
              {expenses.length===0 && <div className="text-sm text-muted-foreground">Sem despesas</div>}
              {expenses.map(e=> (
                <div key={e.id} className="p-2 border-b last:border-b-0">
                  <div className="font-medium">{e.category} • {e.frequency}</div>
                  <div className="text-xs text-muted-foreground">Vence: {e.due_date} • {e.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='invoices' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Lançamento de Faturas / Boletos</h3>
            <div className="grid gap-2">
              <Input placeholder="Número da fatura" value={invoiceForm.number} onChange={e=>setInvoiceForm(s=>({...s, number: e.target.value}))} />
              <select value={invoiceForm.supplier_id || ''} onChange={e=>setInvoiceForm(s=>({...s, supplier_id: e.target.value || undefined}))} className="h-9 border rounded px-2">
                <option value="">Fornecedor</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input placeholder="Valor total" value={formatCurrencyInput(invoiceForm.amount)} onChange={e=>setInvoiceForm(s=>({...s, amount: parseCurrencyInput(e.target.value)}))} />
              <Input placeholder="Data de emissão (YYYY-MM-DD)" value={invoiceForm.issued_at} onChange={e=>setInvoiceForm(s=>({...s, issued_at: e.target.value}))} />
              <Input placeholder="Data de vencimento (YYYY-MM-DD)" value={invoiceForm.due_at} onChange={e=>setInvoiceForm(s=>({...s, due_at: e.target.value}))} />
              <select value={invoiceForm.status} onChange={e=>setInvoiceForm(s=>({...s, status: e.target.value}))} className="h-9 border rounded px-2">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <select value={invoiceForm.payment_method} onChange={e=>setInvoiceForm(s=>({...s, payment_method: e.target.value}))} className="h-9 border rounded px-2">
                <option value="">Forma de pagamento</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
              </select>
              <div className="flex gap-2">
                <Button onClick={()=>{ if(!invoiceForm.number || !invoiceForm.amount){ toast.error('Número e valor obrigatórios'); return; } saveInvoice(); }} disabled={loading}>Lançar</Button>
                <Button variant="outline" onClick={()=>setInvoiceForm({ number:'', supplier_id:undefined, amount:0, issued_at:'', due_at:'', status:'pendente', payment_method:'' })}>Limpar</Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Faturas Lançadas</h3>
            <div className="max-h-72 overflow-auto border rounded p-2">
              {invoices.length===0 && <div className="text-sm text-muted-foreground">Sem faturas</div>}
              {invoices.map(i=> (
                <div key={i.id} className="p-2 border-b last:border-b-0 flex justify-between items-center">
                  <div>
                    <div className="font-medium">#{i.number} • {i.status}</div>
                    <div className="text-xs text-muted-foreground">Vence: {i.due_at} • {i.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">Ver</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='approvals' && (
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Aprovações</h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={loadApprovals}>Atualizar</Button>
              <Button size="sm" onClick={()=>bulkUpdateInvoices('aprovado')} disabled={selectedInvoices.length===0}>Aprovar selecionadas ({selectedInvoices.length})</Button>
              <Button size="sm" variant="destructive" onClick={()=>bulkUpdateInvoices('rejeitado')} disabled={selectedInvoices.length===0}>Rejeitar selecionadas ({selectedInvoices.length})</Button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded p-2">
            {invoices.filter(i=>i.status==='pendente').length===0 && <div className="text-sm text-muted-foreground">Nenhuma fatura pendente</div>}
            <table className="min-w-full table-auto">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-2"><input type="checkbox" onChange={(e)=>{ const all = sortedPagedInvoices().map(l=>l.id||''); setSelectedInvoices(e.target.checked? all: []); }} /></th>
                  <th className="px-2 py-2 cursor-pointer" onClick={()=>toggleSort('number')}>Nº {sortBy.key==='number' ? (sortBy.dir==='asc'?'▲':'▼'): ''}</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={()=>toggleSort('supplier_id')}>Fornecedor {sortBy.key==='supplier_id' ? (sortBy.dir==='asc'?'▲':'▼'): ''}</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={()=>toggleSort('due_at')}>Vencimento {sortBy.key==='due_at' ? (sortBy.dir==='asc'?'▲':'▼'): ''}</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={()=>toggleSort('amount')}>Valor {sortBy.key==='amount' ? (sortBy.dir==='asc'?'▲':'▼'): ''}</th>
                  <th className="px-2 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedPagedInvoices().map(inv=> (
                  <React.Fragment key={inv.id || inv.number}>
                    <tr className="border-t">
                      <td className="px-2 py-3"><input type="checkbox" checked={selectedInvoices.includes(inv.id || '')} onChange={(e)=> toggleSelectInvoice(inv.id)} /></td>
                      <td className="px-2 py-3">{inv.number}</td>
                      <td className="px-2 py-3">{inv.supplier_id || '—'}</td>
                      <td className="px-2 py-3">{inv.due_at}</td>
                      <td className="px-2 py-3">{(inv.amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <Button className="h-8" size="sm" onClick={()=> setExpanded(prev=>({ ...prev, [inv.id||'']: !prev[inv.id||''] }))}>{expanded[inv.id||'']? 'Fechar':'Detalhes'}</Button>
                          <Button className="h-8" size="sm" onClick={()=>updateInvoiceStatus(inv.id,'aprovado')}>Aprovar</Button>
                        </div>
                      </td>
                    </tr>
                    {expanded[inv.id||''] && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div><strong>Nº:</strong> {inv.number}</div>
                            <div><strong>Fornecedor:</strong> {inv.supplier_id || '—'}</div>
                            <div><strong>Vencimento:</strong> {inv.due_at}</div>
                            <div><strong>Valor:</strong> {(inv.amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-600">Mostrando {Math.min((page-1)*pageSize+1, invoices.filter(i=>i.status==='pendente').length)}-{Math.min(page*pageSize, invoices.filter(i=>i.status==='pendente').length)} de {invoices.filter(i=>i.status==='pendente').length}</div>
            <div className="flex items-center gap-2">
              <Button className="h-8" size="sm" disabled={page===1} onClick={()=> setPage(p=>Math.max(1,p-1))}>Anterior</Button>
              <div>Pg {page}</div>
              <Button className="h-8" size="sm" disabled={page*pageSize >= invoices.filter(i=>i.status==='pendente').length} onClick={()=> setPage(p=>p+1)}>Próxima</Button>
            </div>
          </div>
        </div>
      )}

      {tab==='payments' && (
        <div className="p-2">
          <h3 className="font-semibold mb-2">Execução de Pagamentos</h3>
          <div className="text-sm text-muted-foreground">Execução / registro de pagamentos - placeholder.</div>
        </div>
      )}

      {tab==='reconciliation' && (
        <div className="p-2">
          <h3 className="font-semibold mb-2">Conciliação Bancária</h3>
          <div className="text-sm text-muted-foreground">Ferramentas de conciliação e importação de extratos - placeholder.</div>
        </div>
      )}

      {tab==='reports' && (
        <div className="p-2">
          <h3 className="font-semibold mb-2">Relatórios</h3>
          <div className="text-sm text-muted-foreground">Relatórios de fluxo e vencimentos - placeholder.</div>
        </div>
      )}

  </div>
  );
}
