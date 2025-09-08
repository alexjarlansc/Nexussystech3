import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types';
import { validateTaxId, formatTaxId, validateCEP, formatCEP } from '@/lib/validators';
import { toast } from '@/components/ui/sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ErpClientsProps { modalOnly?: boolean }
export function ErpClients({ modalOnly }: ErpClientsProps) {
  const pageSize = 20;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [notes, setNotes] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const emptyNew: Partial<Client> = { name:'', taxid:'', phone_mobile:'', email:'', street:'', number:'', city:'', state:'', zip:'', preferred_payment_method:'', credit_limit:0 };
  const [novo,setNovo] = useState<Partial<Client>>(emptyNew);

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    // pesquisa simples client-side depois; para server use ilike
    let query: any = supabase.from('clients').select('*', { count: 'exact' }).order('name').range(from, to);
    if (search.trim()) {
      query = supabase.from('clients').select('*', { count: 'exact' }).ilike('name', `%${search.trim()}%`).order('name').range(from, to);
    }
    const { data, count, error } = await query;
    if (error) { toast.error('Erro ao carregar clientes'); setLoading(false); return; }
    setClients(data as Client[]);
    setTotal(count || 0);
    setLoading(false);
  }, [page, pageSize, search]);
  useEffect(()=>{ if(!modalOnly) load(); }, [load, modalOnly]);
  useEffect(()=>{ const t = setTimeout(()=>{ setPage(0); }, 400); return ()=>clearTimeout(t); }, [search]);

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
      const { data, error } = await (supabase as any).from('clients').select('*').order('name').limit(1000);
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
    const { id, name, taxid, phone, email, address, birth_date, sex, marital_status, street, number, complement, neighborhood, city, state, zip, phone_fixed, phone_mobile, whatsapp, preferred_payment_method, credit_limit, interests, purchase_frequency, preferred_channel, custom_notes } = edit as any;
    const fullPayload:any = { name, taxid, phone: phone||phone_mobile, email, address: address||[street, number, complement, neighborhood, city, state, zip].filter(Boolean).join(', '), birth_date, sex, marital_status, street, number, complement, neighborhood, city, state, zip, phone_fixed, phone_mobile, whatsapp, preferred_payment_method, credit_limit, interests, purchase_frequency, preferred_channel, custom_notes };
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
      sex: novo.sex || null,
      marital_status: novo.marital_status || null,
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
  try { window.dispatchEvent(new CustomEvent('erp:client-created', { detail: { client: ( (error? null : ( (await (supabase as any).from('clients').select('*').eq('name', payload.name).limit(1)).data?.[0]) ) ) } })); } catch(e){}
  setCreateOpen(false); setNovo(emptyNew); load();
  }

  return (
    <div className="space-y-4">
      {!modalOnly && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-60" />
            <Button size="sm" variant="outline" onClick={exportCsv}>Exportar CSV</Button>
            <Button size="sm" onClick={()=>setCreateOpen(true)}>Novo Cliente</Button>
            <div className="text-xs text-muted-foreground ml-auto">{loading ? 'Carregando...' : `${total} registros`}</div>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Nome</th>
                  <th className="text-left px-2 py-1 font-medium">Documento</th>
                  <th className="text-left px-2 py-1 font-medium">Telefone</th>
                  <th className="text-left px-2 py-1 font-medium">Email</th>
                  <th className="text-left px-2 py-1 font-medium">Endereço</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={()=> setEdit(c)}>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">{c.taxid||'-'}</td>
                    <td className="px-2 py-1">{c.phone||'-'}</td>
                    <td className="px-2 py-1">{c.email||'-'}</td>
                    <td className="px-2 py-1 truncate max-w-[220px]" title={c.address}>{c.address||'-'}</td>
                  </tr>
                ))}
                {clients.length===0 && !loading && (
                  <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhum cliente</td></tr>
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
                <Input value={edit.sex||''} onChange={e=> setEdit({...edit, sex:e.target.value})} placeholder="Sexo" />
                <Input value={edit.marital_status||''} onChange={e=> setEdit({...edit, marital_status:e.target.value})} placeholder="Estado civil" />
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
                <Input value={(edit as any).zip||''} onChange={e=> setEdit({...edit, zip:formatCEP(e.target.value)})} onBlur={e=> { if(!validateCEP(e.target.value)) toast.error('CEP inválido'); }} placeholder="CEP" />
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
    </div>
  );
}
