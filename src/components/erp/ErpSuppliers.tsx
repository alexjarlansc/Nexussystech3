import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from '@/types';
import { validateTaxId, formatTaxId } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
/* eslint-disable @typescript-eslint/no-explicit-any */

export function ErpSuppliers() {
  const { user, profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  // form fields
  const [name, setName] = useState('');
  const [taxid, setTaxid] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let query:any = (supabase as any).from('suppliers').select('*').order('name');
    if (profile?.company_id) {
      const orFilter = `company_id.eq.${profile.company_id},company_id.is.null`;
      query = (supabase as any).from('suppliers').select('*').or(orFilter).order('name');
    }
    const { data, error } = await query;
    if (error) {
      toast.error('Erro fornecedores: '+error.message);
      setLoading(false);
      return;
    }
    setSuppliers(data as Supplier[]);
    if (!debugEnabled) setDebugInfo(null);
    setLoading(false);
  }, [profile?.company_id, debugEnabled]);

  useEffect(()=> { load(); }, [load]);

  async function save() {
    if (!name) { toast.error('Nome obrigatório'); return; }
    const payload:any = {
      name,
      taxid: taxid || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      notes: notes || null,
    };
    // If user has a company_id and is not admin, ensure supplier is linked to that company.
    if (profile?.company_id && profile.role !== 'admin') {
      payload.company_id = profile.company_id;
    }
    console.log('[Suppliers][InsertAttempt]', payload);
    const { data, error } = await (supabase as any).from('suppliers').insert(payload).select('*').single();
    if (error) {
      if (error.message.toLowerCase().includes('rls')) toast.error('Permissão negada (RLS)');
      else toast.error('Erro ao salvar: '+error.message);
      console.error('[Suppliers][InsertError]', error);
      return;
    }
    setSuppliers(prev=> [...prev, data as Supplier].sort((a,b)=> a.name.localeCompare(b.name)));
    if (debugEnabled) setDebugInfo({ inserted: data });
    toast.success('Fornecedor cadastrado');
    setOpen(false); setName(''); setTaxid(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-56" />
  <Button size="sm" onClick={()=>setOpen(true)}>Novo Fornecedor</Button>
  <Button size="sm" variant="outline" onClick={()=>load()}>Recarregar</Button>
  {import.meta.env.DEV && (
    <Button size="sm" variant={debugEnabled ? 'secondary':'outline'} onClick={()=> { setDebugEnabled(v=>!v); if(!debugEnabled) { /* ativando */ } else { setDebugInfo(null);} }}>
      {debugEnabled ? 'Debug ON':'Debug'}
    </Button>
  )}
  <div className="text-xs text-muted-foreground ml-auto">{loading ? 'Carregando...' : suppliers.length + ' registros'}</div>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Nome</th>
              <th className="text-left px-2 py-1 font-medium">CNPJ/CPF</th>
              <th className="text-left px-2 py-1 font-medium">Telefone</th>
              <th className="text-left px-2 py-1 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.filter(s=> (s.is_active ?? true) && s.name.toLowerCase().includes(search.toLowerCase())).map(s=> (
              <tr
                key={s.id}
                className="border-t hover:bg-accent/30 cursor-pointer"
                onClick={()=> { setSelected(s); setDetailOpen(true); }}
              >
                <td className="px-2 py-1">{s.name}</td>
                <td className="px-2 py-1">{s.taxid||'-'}</td>
                <td className="px-2 py-1">{s.phone||'-'}</td>
                <td className="px-2 py-1">{s.email||'-'}</td>
              </tr>
            ))}
            {suppliers.length===0 && (
              <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-6">Nenhum fornecedor</td></tr>
            )}
          </tbody>
        </table>
      </Card>
  {import.meta.env.DEV && debugEnabled && debugInfo && (
        <div className="text-[10px] font-mono bg-muted/30 p-2 rounded border max-w-full overflow-auto">
          <div className="font-semibold mb-1 flex items-center justify-between">
            <span>DEBUG Fornecedores</span>
            <button className="text-xs underline" onClick={()=> setDebugInfo(null)}>fechar</button>
          </div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify({count: suppliers.length, debugInfo}, null, 2)}</pre>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-2 text-sm">
            <Input placeholder="Nome *" value={name} onChange={e=>setName(e.target.value)} />
            <Input
              placeholder="CNPJ/CPF"
              value={taxid}
              onChange={e=> setTaxid(formatTaxId(e.target.value))}
              onBlur={e=> { const v=formatTaxId(e.target.value); setTaxid(v); const r=validateTaxId(v); if(!r.ok && v) toast.error(r.message!); }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Telefone" value={phone} onChange={e=>setPhone(e.target.value)} />
              <Input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <Input placeholder="Endereço" value={address} onChange={e=>setAddress(e.target.value)} />
            <Textarea placeholder="Observações" value={notes} onChange={e=>setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <Dialog open={detailOpen} onOpenChange={o=> { if(!o) { setDetailOpen(false); setSelected(null); setEditMode(false);} else setDetailOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Fornecedor</DialogTitle></DialogHeader>
      {selected && !editMode && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Nome:</span> {selected.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">CNPJ/CPF:</span> {selected.taxid || '-'}</div>
                <div><span className="font-medium">Telefone:</span> {selected.phone || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">Email:</span> {selected.email || '-'}</div>
                <div><span className="font-medium">Contato:</span> {selected.contact_name || '-'}</div>
              </div>
              <div><span className="font-medium">Endereço:</span> {selected.address || '-'}</div>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="font-medium">Cidade:</span> {selected.city || '-'}</div>
                <div><span className="font-medium">UF:</span> {selected.state || '-'}</div>
                <div><span className="font-medium">CEP:</span> {selected.zip || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">IE:</span> {selected.state_registration || '-'}</div>
                <div><span className="font-medium">IM:</span> {selected.municipal_registration || '-'}</div>
              </div>
              <div>
                <span className="font-medium">Observações:</span>
                <div className="mt-1 whitespace-pre-wrap break-words border rounded p-2 bg-muted/30 min-h-[40px]">
                  {selected.notes || '—'}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Criado em: {selected.created_at ? new Date(selected.created_at).toLocaleString() : '-'}</span>
                <span>Status: {(selected.is_active ?? true) ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          )}
          {selected && editMode && (
            <div className="grid gap-2 text-sm">
              <Input placeholder="Nome *" value={selected.name} onChange={e=> setSelected({...selected, name: e.target.value})} />
              <Input placeholder="CNPJ/CPF" value={selected.taxid||''} onChange={e=> setSelected({...selected, taxid: formatTaxId(e.target.value)})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Telefone" value={selected.phone||''} onChange={e=> setSelected({...selected, phone: e.target.value})} />
                <Input placeholder="Email" value={selected.email||''} onChange={e=> setSelected({...selected, email: e.target.value})} />
              </div>
              <Input placeholder="Contato" value={selected.contact_name||''} onChange={e=> setSelected({...selected, contact_name: e.target.value})} />
              <Input placeholder="Endereço" value={selected.address||''} onChange={e=> setSelected({...selected, address: e.target.value})} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Cidade" value={selected.city||''} onChange={e=> setSelected({...selected, city: e.target.value})} />
                <Input placeholder="UF" value={selected.state||''} onChange={e=> setSelected({...selected, state: e.target.value})} />
                <Input placeholder="CEP" value={selected.zip||''} onChange={e=> setSelected({...selected, zip: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="IE" value={selected.state_registration||''} onChange={e=> setSelected({...selected, state_registration: e.target.value})} />
                <Input placeholder="IM" value={selected.municipal_registration||''} onChange={e=> setSelected({...selected, municipal_registration: e.target.value})} />
              </div>
              <Textarea placeholder="Observações" value={selected.notes||''} onChange={e=> setSelected({...selected, notes: e.target.value})} rows={3} />
            </div>
          )}
          <DialogFooter>
            {!editMode && (
              <>
                <Button variant="outline" onClick={()=> { setDetailOpen(false); setSelected(null); }}>Fechar</Button>
                <Button variant="outline" onClick={()=> setEditMode(true)}>Editar</Button>
                <Button variant="outline" onClick={async ()=> {
                  if (!selected) return;
                  const updating = ! (selected.is_active ?? true);
                  const { error } = await (supabase as any).from('suppliers').update({ is_active: updating }).eq('id', selected.id);
                  if (error) { toast.error('Erro ao alterar status: '+error.message); return; }
                  toast.success(updating ? 'Reativado' : 'Inativado');
                  setSelected({...selected, is_active: updating});
                  setSuppliers(prev=> prev.map(s=> s.id===selected.id ? { ...s, is_active: updating } : s));
                }}>{(selected?.is_active ?? true) ? 'Inativar' : 'Reativar'}</Button>
                <Button variant="destructive" onClick={()=> setConfirmDelete(true)}>Excluir</Button>
              </>
            )}
            {editMode && (
              <>
                <Button variant="outline" onClick={()=> setEditMode(false)}>Cancelar</Button>
                <Button onClick={async ()=> {
                  if (!selected) return;
                  if (!selected.name) { toast.error('Nome obrigatório'); return; }
                  const updatePayload = { ...selected } as any;
                  delete updatePayload.id; delete updatePayload.created_at;
                  const { error } = await (supabase as any).from('suppliers').update(updatePayload).eq('id', selected.id).select('*').single();
                  if (error) { toast.error('Erro ao salvar: '+error.message); return; }
                  toast.success('Atualizado');
                  setSuppliers(prev=> prev.map(s=> s.id===selected.id ? { ...s, ...updatePayload } : s));
                  setEditMode(false);
                }}>Salvar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e irá remover o fornecedor definitivamente. Confirme para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async ()=> {
                if (!selected) return;
                const { error } = await (supabase as any).from('suppliers').delete().eq('id', selected.id);
                if (error) { toast.error('Erro ao excluir: '+error.message); return; }
                toast.success('Excluído');
                setSuppliers(prev=> prev.filter(s=> s.id!==selected.id));
                setConfirmDelete(false); setDetailOpen(false); setSelected(null);
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
