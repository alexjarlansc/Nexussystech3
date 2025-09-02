import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Carrier } from '@/types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export function ErpCarriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [taxid, setTaxid] = useState('');
  const [rntrc, setRntrc] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState('');
  const [notes, setNotes] = useState('');

  const [companyId,setCompanyId] = useState<string|undefined>();
  async function resolveCompany(){
    try {
      const { data: userRes } = await (supabase as any).auth.getUser();
      const user = userRes?.user; if(!user) return;
      const { data, error } = await (supabase as any).from('profiles').select('company_id').eq('user_id', user.id).maybeSingle();
      if(!error && data?.company_id) setCompanyId(data.company_id);
    } catch(e){ /* ignore */ }
  }
  async function load() {
    let q = (supabase as any).from('carriers').select('*').order('name');
    if(companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) { toast.error('Erro ao carregar transportadoras'); return; }
    setCarriers((data||[]) as Carrier[]);
  }
  useEffect(()=>{ resolveCompany(); },[]);
  useEffect(()=>{ load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[companyId]);

  async function save() {
    if (!name) { toast.error('Nome obrigatório'); return; }
  const { error } = await (supabase as any).from('carriers').insert({ name, taxid: taxid||null, rntrc: rntrc||null, phone: phone||null, email: email||null, address: address||null, vehicle_types: vehicleTypes||null, notes: notes||null, company_id: companyId||null });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Transportadora cadastrada');
    setOpen(false); setName(''); setTaxid(''); setRntrc(''); setPhone(''); setEmail(''); setAddress(''); setVehicleTypes(''); setNotes('');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-56" />
        <Button size="sm" onClick={()=>setOpen(true)}>Nova Transportadora</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Nome</th>
              <th className="text-left px-2 py-1 font-medium">CNPJ/CPF</th>
              <th className="text-left px-2 py-1 font-medium">RNTRC</th>
              <th className="text-left px-2 py-1 font-medium">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {carriers.filter(s=> s.name.toLowerCase().includes(search.toLowerCase())).map(s=> (
              <tr key={s.id} className="border-t hover:bg-accent/30">
                <td className="px-2 py-1">{s.name}</td>
                <td className="px-2 py-1">{s.taxid||'-'}</td>
                <td className="px-2 py-1">{s.rntrc||'-'}</td>
                <td className="px-2 py-1">{s.phone||'-'}</td>
              </tr>
            ))}
            {carriers.length===0 && (
              <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-6">Nenhuma transportadora</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Transportadora</DialogTitle></DialogHeader>
          <div className="grid gap-2 text-sm">
            <Input placeholder="Nome *" value={name} onChange={e=>setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="CNPJ/CPF" value={taxid} onChange={e=>setTaxid(e.target.value)} />
              <Input placeholder="RNTRC" value={rntrc} onChange={e=>setRntrc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Telefone" value={phone} onChange={e=>setPhone(e.target.value)} />
              <Input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <Input placeholder="Endereço" value={address} onChange={e=>setAddress(e.target.value)} />
            <Input placeholder="Tipos de Veículos (texto)" value={vehicleTypes} onChange={e=>setVehicleTypes(e.target.value)} />
            <Textarea placeholder="Observações" value={notes} onChange={e=>setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
