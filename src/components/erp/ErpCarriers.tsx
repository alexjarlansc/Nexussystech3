import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import invokeFunction from '@/lib/functions';
import { Carrier } from '@/types';
import { useAuth } from '@/hooks/useAuth';
/* eslint-disable @typescript-eslint/no-explicit-any */

export function ErpCarriers() {
  const { profile } = useAuth();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Carrier|null>(null);
  const [loading,setLoading] = useState(false);
  const [page,setPage] = useState(0);
  const pageSize = 25;
  const [hasMore,setHasMore] = useState(false);
  const [debouncedSearch,setDebouncedSearch] = useState('');
  const [totalCount,setTotalCount] = useState<number>(0);
  const [errorMessage,setErrorMessage] = useState('');

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
  async function load(pageOverride?: number) {
    const currentPage = pageOverride ?? page;
    setLoading(true);
    setErrorMessage('');
    try {
      // Evita consulta antes de termos o companyId (RLS pode bloquear e gerar erro genérico)
      if(!companyId){
        setCarriers([]);
        setHasMore(false);
        setTotalCount(0);
        return;
      }
      let q = (supabase as any).from('carriers').select('*', { count: 'exact' }).order('name');
      if(companyId) q = q.eq('company_id', companyId);
      if(debouncedSearch){
        const like = debouncedSearch.replace(/%/g,'');
        q = q.or(`name.ilike.%${like}%,taxid.ilike.%${like}%,rntrc.ilike.%${like}%`);
      }
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from,to);
      const { data, error, count } = await q;
      if (error) {
        console.error('Erro carriers load', { error, companyId, debouncedSearch, page: currentPage });
        const raw = error.message || 'Erro desconhecido';
        let friendly = raw;
        if(/carriers/i.test(raw) && /tabela|table/i.test(raw)) {
          friendly += '\n\nA tabela public.carriers não existe no banco atual. Aplique as migrações:'+
          '\n1. supabase db push (local) ou executar migration 20250830120000_create_erp_tables.sql no painel.'+
          '\n2. Verifique project_id em supabase/config.toml corresponde ao projeto correto.';
        }
        setErrorMessage(friendly);
        toast.error('Erro ao carregar transportadoras');
        return; }
      const rows = (data||[]) as Carrier[];
      if(typeof count === 'number') setTotalCount(count);
      setHasMore(typeof count === 'number' ? (from + rows.length) < count : rows.length === pageSize);
      setCarriers(rows);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ resolveCompany(); },[]);
  useEffect(()=>{ load(0); setPage(0); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[companyId,debouncedSearch]);

  useEffect(()=>{ const t = setTimeout(()=> setDebouncedSearch(search.trim()), 400); return ()=> clearTimeout(t); },[search]);

  async function save() {
    if (!name) { toast.error('Nome obrigatório'); return; }
    if (!companyId) {
      toast.error('Conta sem empresa vinculada. Peça ao administrador para associar seu usuário a uma empresa para cadastrar transportadoras.');
      return;
    }
    try {
      // util: extrai coluna ausente da mensagem do PostgREST/Postgres
      const parseMissingColumn = (msg:string): string | null => {
        const m1 = msg.match(/'([^']+)'\s+column\s+of\s+'carriers'/i); if (m1?.[1]) return m1[1];
        const m2 = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i); if (m2?.[1]) return m2[1];
        return null;
      };
      const sanitize = (obj:any) => {
        const allowed = new Set(['name','taxid','rntrc','phone','email','address','vehicle_types','notes','company_id']);
        const out:any = {}; Object.keys(obj||{}).forEach(k=>{ if(allowed.has(k)) out[k] = (obj as any)[k]; }); return out;
      };

      if(editing) {
        // Tenta via função Edge (service-role) primeiro
        try {
          const fx = await invokeFunction<{ ok?: boolean }>('admin-upsert-carrier', { body: { mode: 'update', id: editing.id, name, taxid: taxid||null, rntrc: rntrc||null, phone: phone||null, email: email||null, address: address||null, vehicle_types: vehicleTypes||null, notes: notes||null } });
          if (!fx.ok) throw new Error((fx as any).error || 'Falha via função');
          toast.success('Transportadora atualizada');
          setOpen(false); resetForm(); load(); return;
        } catch { /* fallback abaixo */ }
        const payload:any = sanitize({ name, taxid: taxid||null, rntrc: rntrc||null, phone: phone||null, email: email||null, address: address||null, vehicle_types: vehicleTypes||null, notes: notes||null });
        let { error } = await (supabase as any).from('carriers').update(payload).eq('id', editing.id);
        if (error) {
          const missing = parseMissingColumn(String(error.message||''));
          if (missing && missing in payload) {
            delete payload[missing];
            const r2 = await (supabase as any).from('carriers').update(payload).eq('id', editing.id);
            error = r2.error;
            if (!error) toast.warning(`Campo "${missing}" ausente. Atualizado sem esse campo. aplique as migrations.`);
          }
        }
        if(error) throw error;
        toast.success('Transportadora atualizada');
      } else {
        // Tenta via função Edge (service-role) primeiro
        try {
          const fx = await invokeFunction<{ ok?: boolean }>('admin-upsert-carrier', { body: { mode: 'insert', company_id: companyId, name, taxid: taxid||null, rntrc: rntrc||null, phone: phone||null, email: email||null, address: address||null, vehicle_types: vehicleTypes||null, notes: notes||null } });
          if (!fx.ok) throw new Error((fx as any).error || 'Falha via função');
          toast.success('Transportadora cadastrada');
          setOpen(false); resetForm(); load(); return;
        } catch { /* fallback abaixo */ }
        // insert mínimo para evitar erro de schema desatualizado
        const base:any = sanitize({ name, company_id: companyId });
        const ins = await (supabase as any).from('carriers').insert(base).select('id').single();
        if (ins.error) throw ins.error;
        // tenta aplicar campos opcionais posteriormente
  const optional:any = sanitize({ taxid: taxid||null, rntrc: rntrc||null, phone: phone||null, email: email||null, address: address||null, vehicle_types: vehicleTypes||null, notes: notes||null });
        Object.keys(optional).forEach(k=> { if (optional[k]==null || optional[k]==='') delete optional[k]; });
        if (Object.keys(optional).length>0) {
          let { error } = await (supabase as any).from('carriers').update(optional).eq('id', ins.data.id);
          if (error) {
            const missing = parseMissingColumn(String(error.message||''));
            if (missing && missing in optional) {
              delete optional[missing];
              if (Object.keys(optional).length>0) {
                const r2 = await (supabase as any).from('carriers').update(optional).eq('id', ins.data.id);
                error = r2.error;
                if (!error) toast.warning(`Campo "${missing}" ausente. Registro salvo sem esse campo. aplique as migrations.`);
              }
            }
          }
          if (error) throw error;
        }
        toast.success('Transportadora cadastrada');
      }
  setOpen(false); resetForm(); load();
    } catch(e:unknown){
      let msg = 'Falha ao salvar';
      const any = e as any;
      if (any && typeof any === 'object') {
        msg = any.message || any.error || JSON.stringify(any);
      } else { msg = String(e); }
      const low = (msg||'').toLowerCase();
      if (low.includes('row-level security') || low.includes('rls')) {
        msg = 'Permissão negada (RLS). Aplique as migrations de RLS para carriers ou realize a operação com um usuário Admin/Mestre vinculado à mesma empresa.';
      }
      toast.error('Erro ao salvar: '+msg);
    }
  }

  function resetForm(){
    setEditing(null); setName(''); setTaxid(''); setRntrc(''); setPhone(''); setEmail(''); setAddress(''); setVehicleTypes(''); setNotes('');
  }

  function startNew(){ resetForm(); setOpen(true); }
  function startEdit(c:Carrier){
    setEditing(c);
    setName(c.name); setTaxid(c.taxid||''); setRntrc(c.rntrc||''); setPhone(c.phone||''); setEmail(c.email||''); setAddress(c.address||''); setVehicleTypes(c.vehicle_types||''); setNotes(c.notes||'');
    setOpen(true);
  }
  async function doDelete(){
    if(!confirmDelete) return;
    try {
      const { error } = await (supabase as any).from('carriers').delete().eq('id', confirmDelete.id);
      if(error) throw error;
  toast.success('Transportadora removida');
  setConfirmDelete(null); load();
    } catch(e:unknown){ toast.error('Erro ao excluir'); }
  }

  function exportCsv(){
    if(!carriers.length){ toast.info('Nada para exportar'); return; }
    const headers = ['Nome','TaxID','RNTRC','Telefone','Email','Endereço'];
    const lines = carriers.map(c=>[
      c.name,
      c.taxid||'',
      c.rntrc||'',
      c.phone||'',
      c.email||'',
      (c.address||'').replace(/\n/g,' ')
    ].map(v=> '"'+String(v).replace(/"/g,'""')+'"').join(','));
    const csv = [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transportadoras.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar nome, CNPJ/CPF, RNTRC..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-72" />
        <Button size="sm" onClick={()=>{ setPage(0); load(0); }} disabled={loading} className="relative">Filtrar {loading && <span className="ml-1 h-3 w-3 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />}</Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={loading || carriers.length===0}>Exportar CSV</Button>
        <Button size="sm" onClick={startNew}>Nova Transportadora</Button>
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
            {carriers.map(s=> (
              <tr key={s.id} className="border-t hover:bg-accent/30">
                <td className="px-2 py-1">{s.name}</td>
                <td className="px-2 py-1">{s.taxid||'-'}</td>
                <td className="px-2 py-1">{s.rntrc||'-'}</td>
                <td className="px-2 py-1 flex items-center gap-2">
                  <span className="flex-1">{s.phone||'-'}</span>
                  {profile?.role==='admin' && (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>startEdit(s)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={()=>setConfirmDelete(s)}>Excluir</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {(!loading && carriers.length===0 && !errorMessage) && (
              <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-6">Nenhuma transportadora</td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-6">Carregando...</td></tr>
            )}
            {!loading && errorMessage && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center">
                  <div className="text-xs text-red-600 mb-2">Erro ao carregar transportadoras</div>
                  <div className="text-[10px] font-mono break-all max-h-20 overflow-auto bg-red-50 border border-red-200 rounded p-2 text-red-700">{errorMessage}</div>
                  <div className="mt-2 flex justify-center">
                    <Button size="sm" variant="outline" onClick={()=>load(page)} disabled={loading}>Tentar novamente</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="flex flex-wrap gap-2 items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Página {page+1}{totalCount>0 && ` de ${Math.max(1, Math.ceil(totalCount / pageSize))}`}</span>
          {totalCount>0 && (
            <span className="opacity-70">
              {(() => {
                const start = carriers.length ? page*pageSize + 1 : 0;
                const end = page*pageSize + carriers.length;
                return `Mostrando ${start}-${end} de ${totalCount}`;
              })()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading || page===0} onClick={()=>{ const np = Math.max(0,page-1); setPage(np); load(np); }}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={loading || !hasMore} onClick={()=>{ const np = page+1; setPage(np); load(np); }}>Próxima</Button>
        </div>
      </div>

    <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{editing? 'Editar Transportadora':'Nova Transportadora'}</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={()=>{ setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDelete} onOpenChange={(o)=>{ if(!o) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm">Remover transportadora <b>{confirmDelete?.name}</b>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
