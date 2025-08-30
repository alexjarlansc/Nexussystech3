import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from '@/types';
/* eslint-disable @typescript-eslint/no-explicit-any */

export function ErpSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // form
  const [name, setName] = useState('');
  const [taxid, setTaxid] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
  const { data, error } = await (supabase as any).from('suppliers').select('*').order('name');
    if (error) { toast.error('Erro ao carregar fornecedores'); return; }
    setSuppliers(data as Supplier[]);
  }
  useEffect(()=>{ load(); },[]);

  async function save() {
    if (!name) { toast.error('Nome obrigatório'); return; }
  const { error } = await (supabase as any).from('suppliers').insert({ name, taxid: taxid || null, phone: phone||null, email: email||null, address: address||null, notes: notes||null });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Fornecedor cadastrado');
    setOpen(false); setName(''); setTaxid(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-56" />
        <Button size="sm" onClick={()=>setOpen(true)}>Novo Fornecedor</Button>
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
            {suppliers.filter(s=> s.name.toLowerCase().includes(search.toLowerCase())).map(s=> (
              <tr key={s.id} className="border-t hover:bg-accent/30">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-2 text-sm">
            <Input placeholder="Nome *" value={name} onChange={e=>setName(e.target.value)} />
            <Input placeholder="CNPJ/CPF" value={taxid} onChange={e=>setTaxid(e.target.value)} />
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
    </div>
  );
}
