import { useEffect, useState, useCallback, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types';
import { validateTaxId, formatTaxId, validateCEP, formatCEP } from '@/lib/validators';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ErpClientsProps { modalOnly?: boolean }
export function ErpClients({ modalOnly }: ErpClientsProps) {
  const { profile } = useAuth();
  const pageSize = 20;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [notes, setNotes] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name?: string } | null>(null);
  const emptyNew: Partial<Client> = { name:'', taxid:'', phone_mobile:'', email:'', street:'', number:'', city:'', state:'', zip:'', preferred_payment_method:'', credit_limit:0 };
  const [novo,setNovo] = useState<Partial<Client>>(emptyNew);

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    try {
      // pesquisa: busca por nome, documento (taxid), telefone e e-mail no servidor usando ilike
      let query: any = supabase.from('clients').select('*', { count: 'exact' }).order('name').range(from, to);
      // escopo por empresa (multi-tenant)
      if (profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }
      const q = search.trim();
      let orExpr = '';
      // prepare esc e like fora do bloco para permitir retry sem referência ausente
      const esc = q ? q.replace(/'/g, "\\'") : '';
      const like = q ? `%${esc}%` : '';
      if (q) {
        // monta expressão OR para ilike em múltiplas colunas
        // supabase JS não aceita objetos complexos para OR com ilike diretamente, usamos .or()
        orExpr = `name.ilike.${like},taxid.ilike.${like},phone.ilike.${like},phone_mobile.ilike.${like},email.ilike.${like}`;
        query = supabase
          .from('clients')
          .select('*', { count: 'exact' })
          .or(orExpr)
          .order('name')
          .range(from, to);
        if (profile?.company_id) {
          query = query.eq('company_id', profile.company_id);
        }
      }
      // executa a query; se falhar por coluna inexistente (ex: phone_mobile), tenta novamente sem essa coluna
      const exec = await query;
      let data = exec.data as any[] | null;
      let count = exec.count as number | null;
      const error = exec.error as any;
      if (error && /phone_mobile/i.test(String(error.message || ''))) {
        // retry sem phone_mobile
        try {
          const orExpr2 = `name.ilike.${like},taxid.ilike.${like},phone.ilike.${like},email.ilike.${like}`;
          let retry = (supabase as any)
            .from('clients')
            .select('*', { count: 'exact' })
            .or(orExpr2)
            .order('name')
            .range(from, to);
          if (profile?.company_id) retry = retry.eq('company_id', profile.company_id);
          const retryRes = await retry;
          if (retryRes.error) {
            console.error('Erro ao carregar clientes (retry):', retryRes.error, { search, orExpr2 });
            toast.error('Erro ao carregar clientes: ' + (retryRes.error.message || 'Erro desconhecido'));
            setLoading(false);
            return;
          }
          data = retryRes.data as any[];
          count = retryRes.count as number | null;
        } catch (e2) {
          console.error('Exceção no retry sem phone_mobile', e2, { search });
          toast.error('Erro ao carregar clientes: ' + (e2 instanceof Error ? e2.message : String(e2)));
          setLoading(false);
          return;
        }
      } else if (error) {
        console.error('Erro ao carregar clientes:', error, { search, orExpr });
        toast.error('Erro ao carregar clientes: ' + (error.message || 'Erro desconhecido'));
        setLoading(false);
        return;
      }
      setClients((data || []) as Client[]);
      setTotal(count || 0);
    } catch (err) {
      console.error('Exceção ao carregar clients', err, { search });
      toast.error('Erro ao carregar clientes: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, profile?.company_id]);
  useEffect(()=>{ if(!modalOnly) load(); }, [load, modalOnly]);
  useEffect(()=>{ const t = setTimeout(()=>{ setPage(0); }, 400); return ()=>clearTimeout(t); }, [search]);

  // Debounce para pesquisa (evita chamar load a cada tecla)
  const debouncedSetSearch = useMemo(() => debounce((v: string) => { setSearch(v); }, 300), [setSearch]);
  useEffect(() => {
    return () => { debouncedSetSearch.cancel(); };
  }, [debouncedSetSearch]);

  // Escuta evento global para abrir modal de novo cliente a partir de outros componentes
  useEffect(()=>{
    const handler = (ev: Event) => {
      try {
        const ce = ev as CustomEvent;
        const detail = ce?.detail as any;
        if (detail && detail.prefill) {
          setNovo(prev => ({ ...prev, ...(detail.prefill || {}) }));
        }
      } catch (err) {
        // ignore
      }
      setCreateOpen(true);
    };
    window.addEventListener('erp:create-client', handler as EventListener);
    return () => window.removeEventListener('erp:create-client', handler as EventListener);
  }, []);

  function exportCsv() {
    // exporta até 1000 rapidamente
    (async () => {
      let q: any = (supabase as any).from('clients').select('*').order('name').limit(1000);
      if (profile?.company_id) q = q.eq('company_id', profile.company_id);
      const { data, error } = await q;
      if (error) { toast.error('Falha ao exportar'); return; }
      const rows = data as Client[];
      const header = ['id','name','taxid','phone','email','address'];
      const csv = [header.join(';'), ...rows.map(r=> header.map(h=> (r as any)[h] ? String((r as any)[h]).replace(/;/g, ',') : '').join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'clientes.csv'; a.click();
      URL.revokeObjectURL(url);
    })();
  }

  async function saveEdit() {
    if (!edit) return;
    const { id, name, taxid, phone, email, address, birth_date, state_registration, street, number, complement, neighborhood, city, state, zip, phone_fixed, phone_mobile, whatsapp, preferred_payment_method, credit_limit, interests, purchase_frequency, preferred_channel, custom_notes } = edit as any;
    const fullPayload:any = { name, taxid, phone: phone||phone_mobile, email, address: address||[street, number, complement, neighborhood, city, state, zip].filter(Boolean).join(', '), birth_date, state_registration, street, number, complement, neighborhood, city, state, zip, phone_fixed, phone_mobile, whatsapp, preferred_payment_method, credit_limit, interests, purchase_frequency, preferred_channel, custom_notes };
  const { error } = await (supabase as any).from('clients').update(fullPayload).eq('id', id);
    if (error) {
      const msg = (error.message||'').toLowerCase();
      if (msg.includes('schema cache') || msg.includes('column')) {
        // tenta novamente somente com colunas básicas existentes no esquema antigo
        const basic = { name, taxid, phone: phone||phone_mobile, email, address: fullPayload.address };
        const retry = await (supabase as any).from('clients').update(basic).eq('id', id);
        if (retry.error) { toast.error('Erro ao salvar (fallback): '+retry.error.message); return; }
        toast.message('Salvo com campos básicos (execute migrations para usar campos avançados)');
      } else {
        toast.error('Erro ao salvar: '+error.message); return;
      }
    }
    toast.success('Cliente atualizado');
    setEdit(null); load();
  }

  async function createClient(){
    if(!novo.name){ toast.error('Nome é obrigatório'); return; }
    // Monta somente colunas existentes na tabela (evita camelCase divergente)
    const addressFull = [novo.street, novo.number, novo.complement, novo.neighborhood, novo.city, novo.state, novo.zip].filter(Boolean).join(', ');
    const payload:any = {
      name: novo.name,
      taxid: novo.taxid || null,
      phone: novo.phone || novo.phone_mobile || null,
      email: novo.email || null,
      address: addressFull || null,
      birth_date: novo.birth_date || null,
      state_registration: novo.state_registration || null,
      street: novo.street || null,
      number: novo.number || null,
      complement: novo.complement || null,
      neighborhood: novo.neighborhood || null,
      city: novo.city || null,
      state: novo.state || null,
      zip: novo.zip || null,
      phone_fixed: novo.phone_fixed || null,
      phone_mobile: novo.phone_mobile || null,
      whatsapp: novo.whatsapp || null,
      preferred_payment_method: novo.preferred_payment_method || null,
      credit_limit: (novo.credit_limit ?? null),
      interests: novo.interests || null,
      purchase_frequency: novo.purchase_frequency || null,
      preferred_channel: novo.preferred_channel || null,
      custom_notes: novo.custom_notes || null,
      company_id: profile?.company_id || null,
    };
  const { error } = await (supabase as any).from('clients').insert(payload).single();
    if (error) {
      const msg = (error.message||'').toLowerCase();
      if (msg.includes('schema cache') || msg.includes('column')) {
        // reenvia apenas colunas básicas do schema original
        const basic = { name: payload.name, taxid: payload.taxid, phone: payload.phone, email: payload.email, address: payload.address };
        const retry = await (supabase as any).from('clients').insert(basic).single();
        if (retry.error) { toast.error('Erro ao criar (fallback): '+retry.error.message); return; }
        toast.message('Criado com campos básicos (rode migrations para campos avançados)');
      } else {
        toast.error('Erro ao criar: '+error.message); return; }
    }
  toast.success('Cliente criado');
  // Dispara evento global para notificar criadores de lista (ex: QuoteBuilder)
  try { window.dispatchEvent(new CustomEvent('erp:client-created', { detail: { client: ( (error? null : ( (await (supabase as any).from('clients').select('*').eq('name', payload.name).limit(1)).data?.[0]) ) ) } })); } catch(e){
    // ignore dispatch errors (e.g., window not available in some environments)
    if (import.meta?.env?.DEV) {
      console.debug('[ErpClients] erp:client-created dispatch failed', e);
    }
  }
  setCreateOpen(false); setNovo(emptyNew); load();
  }

  // Função para deletar cliente
  async function deleteClient(id: string) {
    try {
      const { error } = await (supabase as any).from('clients').delete().eq('id', id);
      if (error) { toast.error('Erro ao excluir: '+error.message); return; }
      toast.success('Cliente excluído');
      load();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  }

  return (
    <div className="space-y-4">
      {!modalOnly && (
        <div>
          <Card className="overflow-hidden">
            <div className="p-2 border-b bg-muted/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 w-full">
                <Input className="flex-1" placeholder="Pesquisar por nome, documento, telefone ou email" value={searchInput} onChange={e=>{ setSearchInput(e.target.value); debouncedSetSearch(e.target.value); }} />
                <Button size="sm" variant="outline" onClick={()=>{ setCreateOpen(true); }}>Novo</Button>
                <Button size="sm" variant="outline" onClick={exportCsv}>Exportar</Button>
              </div>
              <div className="text-xs text-muted-foreground">Total: {total}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Nome</th>
                  <th className="text-left px-2 py-1 font-medium">Documento</th>
                  <th className="text-left px-2 py-1 font-medium">Celular</th>
                  <th className="text-left px-2 py-1 font-medium">WhatsApp</th>
                  <th className="text-left px-2 py-1 font-medium">Email</th>
                  <th className="text-left px-2 py-1 font-medium">Bairro</th>
                  <th className="text-left px-2 py-1 font-medium">Cidade</th>
                  <th className="text-left px-2 py-1 font-medium">UF</th>
                  <th className="text-left px-2 py-1 font-medium">Endereço</th>
                  <th className="text-center px-2 py-1 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t hover:bg-accent/30 group">
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{c.name}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{c.taxid||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{c.phone_mobile||c.phone||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{c.whatsapp||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{c.email||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{(c as any).neighborhood||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{(c as any).city||'-'}</td>
                    <td className="px-2 py-1 cursor-pointer" onClick={()=> setEdit(c)}>{(c as any).state||'-'}</td>
                    <td className="px-2 py-1 truncate max-w-[180px] cursor-pointer" title={c.address} onClick={()=> setEdit(c)}>{c.address||'-'}</td>
                    <td className="px-2 py-1 text-center min-w-[60px]">
                      <button title="Editar" className="text-blue-600 hover:text-blue-900 mr-2" onClick={e=>{e.stopPropagation(); setEdit(c);}}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                      </button>
                      <button title="Excluir" className="text-red-600 hover:text-red-900" onClick={e=>{e.stopPropagation(); setPendingDelete({ id: c.id, name: c.name });}}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {clients.length===0 && !loading && (
                  <tr><td colSpan={10} className="text-center text-xs text-muted-foreground py-6">Nenhum cliente</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          <div className="flex items-center gap-2 text-xs">
            <Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button>
            <div>Página {page+1} / {Math.max(1, Math.ceil(total / pageSize))}</div>
            <Button size="sm" variant="outline" disabled={(page+1)*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Próxima</Button>
          </div>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o)=>{ if(!o) setEdit(null); }}>
  <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2"><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-2 text-sm px-4 pb-4 overflow-y-auto flex-1 min-h-0">
              <div className="font-semibold text-xs text-muted-foreground uppercase">Informações Básicas</div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={edit.name} onChange={e=> setEdit({...edit, name:e.target.value})} placeholder="Nome completo" />
                <Input value={edit.taxid||''} onChange={e=> setEdit({...edit, taxid:e.target.value})} onBlur={e=>{ const v=e.target.value; const v2=formatTaxId(v); const res=validateTaxId(v2); setEdit({...edit, taxid:v2}); if(!res.ok) toast.error(res.message!); }} placeholder="CPF ou CNPJ" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="date" value={edit.birth_date||''} onChange={e=> setEdit({...edit, birth_date:e.target.value})} placeholder="Data nascimento/fundação" />
                <Input value={(edit as any).state_registration||''} onChange={e=> setEdit({...edit, state_registration:e.target.value})} placeholder="Inscrição estadual" />
                <div />
              </div>
              <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Endereço</div>
              <div className="grid grid-cols-3 gap-2">
                <Input value={(edit as any).street||''} onChange={e=> setEdit({...edit, street:e.target.value})} placeholder="Rua" />
                <Input value={(edit as any).number||''} onChange={e=> setEdit({...edit, number:e.target.value})} placeholder="Número" />
                <Input value={(edit as any).complement||''} onChange={e=> setEdit({...edit, complement:e.target.value})} placeholder="Compl." />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input value={(edit as any).neighborhood||''} onChange={e=> setEdit({...edit, neighborhood:e.target.value})} placeholder="Bairro" />
                <Input value={(edit as any).city||''} onChange={e=> setEdit({...edit, city:e.target.value})} placeholder="Cidade" />
                <Input value={(edit as any).state||''} onChange={e=> setEdit({...edit, state:e.target.value})} placeholder="UF" />
                <Input
                  value={(edit as any).zip||''}
                  onChange={async e => {
                    const zip = formatCEP(e.target.value);
                    setEdit(prev => ({ ...(prev as any), zip }));
                    if (zip.length === 9 && validateCEP(zip)) {
                      try {
                        const res = await fetch(`https://viacep.com.br/ws/${zip.replace(/\D/g, '')}/json/`);
                        const data = await res.json();
                        if (!data.erro) {
                          setEdit(prev => ({
                            ...(prev as any),
                            street: data.logradouro || (prev as any).street || '',
                            neighborhood: data.bairro || (prev as any).neighborhood || '',
                            city: data.localidade || (prev as any).city || '',
                            state: data.uf || (prev as any).state || '',
                            zip
                          }));
                        }
                      } catch {
                        toast.error('Erro ao buscar endereço do CEP');
                      }
                    }
                  }}
                  onBlur={e=> { if(!validateCEP(e.target.value)) toast.error('CEP inválido'); }}
                  placeholder="CEP"
                />
              </div>
              <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Contato</div>
              <div className="grid grid-cols-3 gap-2">
                <Input value={(edit as any).phone_fixed||''} onChange={e=> setEdit({...edit, phone_fixed:e.target.value})} placeholder="Telefone fixo" />
                <Input value={(edit as any).phone_mobile|| edit.phone ||''} onChange={e=> setEdit({...edit, phone_mobile:e.target.value})} placeholder="Celular" />
                <Input value={(edit as any).whatsapp||''} onChange={e=> setEdit({...edit, whatsapp:e.target.value})} placeholder="WhatsApp" />
              </div>
              <Input value={edit.email||''} onChange={e=> setEdit({...edit, email:e.target.value})} placeholder="Email" type="email" />
              <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Financeiro</div>
              <div className="grid grid-cols-3 gap-2">
                <Input value={(edit as any).preferred_payment_method||''} onChange={e=> setEdit({...edit, preferred_payment_method:e.target.value})} placeholder="Forma preferida" />
                <Input value={String((edit as any).credit_limit||'')} onChange={e=> setEdit({...edit, credit_limit:Number(e.target.value)||0})} placeholder="Limite crédito" />
                <Input value={(edit as any).purchase_frequency||''} onChange={e=> setEdit({...edit, purchase_frequency:e.target.value})} placeholder="Freq. compra" />
              </div>
              <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Perfil</div>
              <Input value={(edit as any).interests||''} onChange={e=> setEdit({...edit, interests:e.target.value})} placeholder="Interesses" />
              <Input value={(edit as any).preferred_channel||''} onChange={e=> setEdit({...edit, preferred_channel:e.target.value})} placeholder="Canal preferido" />
              <Textarea value={(edit as any).custom_notes||''} onChange={e=> setEdit({...edit, custom_notes:e.target.value})} placeholder="Observações" rows={2} />
              <Textarea value={notes} onChange={e=> setNotes(e.target.value)} placeholder="Notas internas (não salvo)" rows={2} />
            </div>
          )}
          <DialogFooter className="p-4 pt-2 border-t bg-background sticky bottom-0">
            <Button variant="outline" onClick={()=>setEdit(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Cliente */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
  <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2"><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="grid gap-2 text-sm px-4 pb-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="font-semibold text-xs text-muted-foreground uppercase">Informações Básicas</div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={novo.name||''} onChange={e=> setNovo({...novo, name:e.target.value})} placeholder="Nome completo" />
              <Input value={novo.taxid||''} onChange={e=> setNovo({...novo, taxid:e.target.value})} onBlur={e=>{ const v2=formatTaxId(e.target.value); const r=validateTaxId(v2); setNovo({...novo, taxid:v2}); if(!r.ok) toast.error(r.message!); }} placeholder="CPF/CNPJ" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={novo.birth_date||''} onChange={e=> setNovo({...novo, birth_date:e.target.value})} />
              <Input value={novo.state_registration||''} onChange={e=> setNovo({...novo, state_registration:e.target.value})} placeholder="Inscrição estadual" />
              <div />
            </div>
            <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Endereço</div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={novo.street||''} onChange={e=> setNovo({...novo, street:e.target.value})} placeholder="Rua" />
              <Input value={novo.number||''} onChange={e=> setNovo({...novo, number:e.target.value})} placeholder="Número" />
              <Input value={novo.complement||''} onChange={e=> setNovo({...novo, complement:e.target.value})} placeholder="Compl." />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Input value={novo.neighborhood||''} onChange={e=> setNovo({...novo, neighborhood:e.target.value})} placeholder="Bairro" />
              <Input value={novo.city||''} onChange={e=> setNovo({...novo, city:e.target.value})} placeholder="Cidade" />
              <Input value={novo.state||''} onChange={e=> setNovo({...novo, state:e.target.value})} placeholder="UF" />
              <Input
                value={novo.zip||''}
                onChange={async e => {
                  const zip = formatCEP(e.target.value);
                  setNovo({ ...novo, zip });
                  if (zip.length === 9 && validateCEP(zip)) {
                    try {
                      const res = await fetch(`https://viacep.com.br/ws/${zip.replace(/\D/g, '')}/json/`);
                      const data = await res.json();
                      if (!data.erro) {
                        setNovo(n => ({
                          ...n,
                          street: data.logradouro || n.street || '',
                          neighborhood: data.bairro || n.neighborhood || '',
                          city: data.localidade || n.city || '',
                          state: data.uf || n.state || '',
                          zip
                        }));
                      }
                    } catch {
                      toast.error('Erro ao buscar endereço do CEP');
                    }
                  }
                }}
                onBlur={e=> { if(!validateCEP(e.target.value)) toast.error('CEP inválido'); }}
                placeholder="CEP"
              />
            </div>
            <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Contato</div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={novo.phone_fixed||''} onChange={e=> setNovo({...novo, phone_fixed:e.target.value})} placeholder="Telefone fixo" />
              <Input value={novo.phone_mobile||''} onChange={e=> setNovo({...novo, phone_mobile:e.target.value})} placeholder="Celular" />
              <Input value={novo.whatsapp||''} onChange={e=> setNovo({...novo, whatsapp:e.target.value})} placeholder="WhatsApp" />
            </div>
            <Input value={novo.email||''} onChange={e=> setNovo({...novo, email:e.target.value})} placeholder="Email" type="email" />
            <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Financeiro</div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={novo.preferred_payment_method||''} onChange={e=> setNovo({...novo, preferred_payment_method:e.target.value})} placeholder="Forma preferida" />
              <Input value={String(novo.credit_limit||'')} onChange={e=> setNovo({...novo, credit_limit:Number(e.target.value)||0})} placeholder="Limite crédito" />
              <Input value={novo.purchase_frequency||''} onChange={e=> setNovo({...novo, purchase_frequency:e.target.value})} placeholder="Freq. compra" />
            </div>
            <div className="font-semibold text-xs text-muted-foreground uppercase mt-2">Perfil</div>
            <Input value={novo.interests||''} onChange={e=> setNovo({...novo, interests:e.target.value})} placeholder="Interesses" />
            <Input value={novo.preferred_channel||''} onChange={e=> setNovo({...novo, preferred_channel:e.target.value})} placeholder="Canal preferido" />
            <Textarea value={novo.custom_notes||''} onChange={e=> setNovo({...novo, custom_notes:e.target.value})} placeholder="Observações" rows={2} />
          </div>
          <DialogFooter className="p-4 pt-2 border-t bg-background sticky bottom-0">
            <Button variant="outline" onClick={()=>{setCreateOpen(false); setNovo(emptyNew);}}>Cancelar</Button>
            <Button onClick={createClient}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Diálogo de confirmação de exclusão (substitui window.confirm) */}
      <Dialog open={!!pendingDelete} onOpenChange={(o)=>{ if(!o) setPendingDelete(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 text-sm">Excluir cliente{pendingDelete?.name ? `: ${pendingDelete.name}` : '?'} </div>
          <DialogFooter className="p-4 pt-2 border-t bg-background sticky bottom-0">
            <Button variant="outline" onClick={()=>setPendingDelete(null)}>Cancelar</Button>
            <Button onClick={async ()=>{ if(pendingDelete){ await deleteClient(pendingDelete.id); setPendingDelete(null); } }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
