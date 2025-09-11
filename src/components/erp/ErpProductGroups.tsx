/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Pencil, X, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

type Group = { id: string; name: string; level: 1|2|3; parent_id: string|null; };

function IconAction({ onClick, title, children, variant }: { onClick:()=>void; title:string; children:React.ReactNode; variant?:'danger'|'default' }){
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`h-6 w-6 flex items-center justify-center rounded-sm transition-colors text-[13px]
        ${variant==='danger'
          ? 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
          : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/60'}
      `}
      type="button"
    >{children}</button>
  );
}

export function ErpProductGroups(){
  const [groups,setGroups]=useState<Group[]>([]);
  const [loading,setLoading]=useState(false);
  const [missingTable,setMissingTable]=useState(false);
  const [open,setOpen]=useState(false);
  const [parent,setParent]=useState<string|undefined>();
  const [name,setName]=useState('');
  const [editing,setEditing]=useState<Group|null>(null);
  const [companyId,setCompanyId]=useState<string|undefined>();
  const [toDelete,setToDelete]=useState<Group|null>(null);
  const [expandedCats,setExpandedCats]=useState<Set<string>>(new Set());
  const [expandedSectors,setExpandedSectors]=useState<Set<string>>(new Set());
  // produtos agrupados por session(product_group_id)
  const [productsByGroup, setProductsByGroup] = useState<Record<string, {id:string; name:string; code?:string}[]>>({});

  async function load(){
    setLoading(true);
    try {
  const q = (supabase as any).from('product_groups').select('id,name,level,parent_id').order('level').order('name');
      const { data, error } = await q;
      if(error) throw error;
      setGroups(data||[]);
      setMissingTable(false);
    } catch(e:any){
      const msg = String(e?.message||'');
      if(msg.includes('product_groups')){
        setMissingTable(true);
      }
      toast.error('Falha ao carregar: '+msg);
    } finally { setLoading(false); }
  }
  // Carregar produtos por sessão (product_group_id)
  async function loadProductsForGroups(gList: Group[]) {
    try {
      const sessionIds = gList.filter(g=>g.level===3).map(g=>g.id);
      if(!sessionIds.length){ setProductsByGroup({}); return; }
      const { data: prods, error } = await (supabase as any).from('products').select('id,name,code,product_group_id').in('product_group_id', sessionIds).limit(2000);
      if(error) throw error;
      const map: Record<string, {id:string;name:string;code?:string}[]> = {};
      (prods||[]).forEach((p:any) => {
        const gid = String(p.product_group_id || '');
        if(!map[gid]) map[gid]=[];
        map[gid].push({ id: String(p.id), name: String(p.name||''), code: p.code ? String(p.code) : undefined });
      });
      setProductsByGroup(map);
    } catch(err){
      if(import.meta.env.DEV) console.warn('Falha ao carregar produtos por grupo', err);
      setProductsByGroup({});
    }
  }
  useEffect(()=>{ load(); },[]);
  // Recarregar produtos quando os grupos mudarem
  useEffect(()=>{ if(groups.length) loadProductsForGroups(groups); else setProductsByGroup({}); },[groups]);
  useEffect(()=>{(async()=>{
    try { const { data: u } = await (supabase as any).auth.getUser(); const user=u?.user; if(!user) return;
      const { data, error } = await (supabase as any).from('profiles').select('company_id').eq('user_id', user.id).single();
      if(!error && data?.company_id) setCompanyId(data.company_id);
    } catch(err) {/* noop */}
  })();},[]);

  function openNew(level:1|2|3, parentId?: string){
    setEditing(null);
    setParent(parentId);
    setName('');
    setOpen(true);
    // level derivado do parent (validado no save)
  }
  function openEdit(g:Group){ setEditing(g); setName(g.name); setParent(g.parent_id||undefined); setOpen(true); }

  function toggleCat(id:string){
    setExpandedCats(prev=>{ const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSector(id:string){
    setExpandedSectors(prev=>{ const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save(){
    if(!name.trim()){ toast.error('Nome obrigatório'); return; }
    try {
      const level:1|2|3 = editing? editing.level : parent ? ((groups.find(g=>g.id===parent)?.level||0)+1 as 1|2|3) : 1;
      if(level<1 || level>3) { toast.error('Nível inválido'); return; }
      const payload:any = { name: name.trim(), level, parent_id: parent||null };
      if(companyId) payload.company_id = companyId;
      if(editing){
        const { error } = await (supabase as any).from('product_groups').update(payload).eq('id', editing.id);
        if(error) throw error; toast.success('Atualizado');
      } else {
        const { error } = await (supabase as any).from('product_groups').insert(payload);
        if(error) throw error; toast.success('Criado');
      }
      setOpen(false); load();
    } catch(e:any){ toast.error(e.message);}  
  }

  async function performDelete(){
    if(!toDelete) return;
    const g = toDelete;
    const { error } = await (supabase as any).from('product_groups').delete().eq('id', g.id);
    if(error) toast.error(error.message); else { toast.success('Removido'); }
    setToDelete(null); load();
  }

  // Construir árvore
  const root = groups.filter(g=>g.level===1);
  function children(of?:string){ return groups.filter(g=>g.parent_id===of); }

  return <Card className="p-6 space-y-4">
    <header className="flex items-center gap-3 flex-wrap">
      <h2 className="text-xl font-semibold">Grupos de Produtos</h2>
      <p className="text-sm text-muted-foreground">Categoria &gt; Setor &gt; Sessão</p>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" onClick={()=>openNew(1)} className="gap-1"><Plus className="h-4 w-4"/> <span className="hidden sm:inline">Categoria</span></Button>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} /> <span className="hidden sm:inline">{loading?'':'Atualizar'}</span></Button>
        <Button size="sm" variant="outline" onClick={()=>{ const allRoot = groups.filter(g=>g.level===1).map(g=>g.id); setExpandedCats(new Set(allRoot)); const allSectors = groups.filter(g=>g.level===2).map(g=>g.id); setExpandedSectors(new Set(allSectors)); }} className="gap-1">Expandir tudo</Button>
        <Button size="sm" variant="ghost" onClick={()=>{ setExpandedCats(new Set()); setExpandedSectors(new Set()); }} className="gap-1">Recolher tudo</Button>
        <Button size="sm" variant="outline" onClick={()=>loadProductsForGroups(groups)} className="gap-1">Recarregar produtos</Button>
      </div>
    </header>
    <div className="text-xs text-muted-foreground">
      <div className="mb-2">Debug: categorias {groups.filter(g=>g.level===1).length} • setores {groups.filter(g=>g.level===2).length} • sessões {groups.filter(g=>g.level===3).length} • sessões com produtos {Object.keys(productsByGroup).length} • produtos carregados {Object.values(productsByGroup).reduce((s,a)=>s + (a?.length||0),0)}</div>
    </div>
  {/* debug JSON removido */}
    {missingTable && <div className="text-xs border rounded p-3 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <div className="font-semibold mb-1">Tabela ausente</div>
      A tabela <code className="font-mono">product_groups</code> ainda não existe no banco.
      <ol className="list-decimal ml-4 mt-2 space-y-1">
        <li>Confirme que o arquivo de migration <strong>20250901120000_create_product_groups.sql</strong> está na pasta <code>supabase/migrations</code>.</li>
        <li>Execute: <code className="font-mono">supabase db push</code> (ou rode o SQL manualmente no editor do Supabase).</li>
        <li>Recarregue a página.</li>
      </ol>
      Alternativa rápida (SQL Editor):<pre className="mt-2 p-2 bg-black/5 rounded overflow-auto whitespace-pre-wrap text-[10px]">create table public.product_groups (id uuid primary key default gen_random_uuid(), company_id uuid not null, level smallint not null check (level in (1,2,3)), name text not null, parent_id uuid references public.product_groups(id) on delete cascade, created_at timestamptz default now(), updated_at timestamptz default now());</pre>
    </div>}
    <div className="grid md:grid-cols-3 gap-4 text-xs">
      <div>
        <h3 className="font-medium mb-2">Categorias</h3>
        <ul className="space-y-1">
          {root.map(c=> {
            const catOpen = expandedCats.has(c.id);
            const sectorList = children(c.id);
            return <li key={c.id} className="border rounded p-2 bg-muted/40">
              <div className="grid grid-cols-[auto,1fr,auto,auto,auto] items-center gap-1">
                <button aria-label={catOpen? 'Recolher Categoria':'Expandir Categoria'} onClick={()=>toggleCat(c.id)} className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-slate-200/60 dark:hover:bg-slate-700/60">
                  {catOpen? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span onClick={()=>toggleCat(c.id)} className="font-semibold truncate pr-1 cursor-pointer select-none" title={c.name}>{c.name}</span>
                <IconAction onClick={()=>openNew(2,c.id)} title="Novo Setor"><Plus className="h-3.5 w-3.5" /></IconAction>
                <IconAction onClick={()=>openEdit(c)} title="Editar Categoria"><Pencil className="h-3.5 w-3.5" /></IconAction>
                <IconAction onClick={()=>setToDelete(c)} title="Excluir Categoria" variant="danger"><X className="h-4 w-4" /></IconAction>
              </div>
              {catOpen && <ul className="mt-2 space-y-1">
                {sectorList.map(s=> {
                  const sectorOpen = expandedSectors.has(s.id);
                  const sessionList = children(s.id);
                  return <li key={s.id} className="border rounded p-2 bg-white/70 dark:bg-slate-900/30">
                    <div className="grid grid-cols-[auto,1fr,auto,auto,auto] items-center gap-1">
                      <button aria-label={sectorOpen? 'Recolher Setor':'Expandir Setor'} onClick={()=>toggleSector(s.id)} className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-slate-200/60 dark:hover:bg-slate-700/60">
                        {sectorOpen? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span onClick={()=>toggleSector(s.id)} className="font-medium truncate pr-1 cursor-pointer select-none" title={s.name}>{s.name}</span>
                      <IconAction onClick={()=>openNew(3,s.id)} title="Nova Sessão"><Plus className="h-3.5 w-3.5" /></IconAction>
                      <IconAction onClick={()=>openEdit(s)} title="Editar Setor"><Pencil className="h-3.5 w-3.5" /></IconAction>
                      <IconAction onClick={()=>setToDelete(s)} title="Excluir Setor" variant="danger"><X className="h-4 w-4" /></IconAction>
                    </div>
                    {sectorOpen && <ul className="mt-2 space-y-1">
                      {sessionList.map(ss=> {
                        return <li key={ss.id} className="border rounded p-2 bg-muted/20">
                          <div className="grid grid-cols-[auto,1fr,auto,auto] items-center gap-1">
                            <span className="h-6 w-6" />
                            <span className="truncate pr-1" title={ss.name}>{ss.name}</span>
                            <IconAction onClick={()=>openEdit(ss)} title="Editar Sessão"><Pencil className="h-3.5 w-3.5" /></IconAction>
                            <IconAction onClick={()=>setToDelete(ss)} title="Excluir Sessão" variant="danger"><X className="h-4 w-4" /></IconAction>
                          </div>
                        </li>;
                      })}
                      {sessionList.length===0 && <li className="text-muted-foreground text-[10px] pl-6">Sem sessões</li>}
                    </ul>}
                  </li>;
                })}
                {sectorList.length===0 && <li className="text-muted-foreground text-[10px] pl-6">Sem setores</li>}
              </ul>}
            </li>;
          })}
          {root.length===0 && !loading && <li className="text-muted-foreground text-[10px]">Sem categorias</li>}
        </ul>
      </div>
      <div className="md:col-span-2 space-y-3">
        <h3 className="font-medium">Resumo</h3>
        <div className="border rounded p-3 bg-muted/30 text-[11px]">
          <div>Total Categorias: {root.length}</div>
          <div>Total Setores: {groups.filter(g=>g.level===2).length}</div>
          <div>Total Sessões: {groups.filter(g=>g.level===3).length}</div>
          <div className="mt-2 text-muted-foreground">Associe produtos informando a categoria / setor / sessão manualmente por enquanto. Futuro: FK para sessão.</div>
        </div>
      </div>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing? 'Editar':'Novo'} {editing? levelLabel(editing.level): parent? levelLabel((groups.find(g=>g.id===parent)?.level||0)+1 as 1|2|3) : 'Categoria'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <Input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} />
          {editing && <div className="text-[10px] text-muted-foreground">Nível: {levelLabel(editing.level)}</div>}
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!toDelete} onOpenChange={(v)=>{ if(!v) setToDelete(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar Exclusão</DialogTitle>
        </DialogHeader>
        <div className="text-xs space-y-3">
          <p>Excluir <strong>{toDelete?.name}</strong> {toDelete && toDelete.level<3 ? 'e todos os itens descendentes' : ''}?</p>
          <p className="text-amber-600 dark:text-amber-400">Esta ação não pode ser desfeita.</p>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={()=>setToDelete(null)}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={performDelete}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

function levelLabel(l:1|2|3){ return l===1? 'Categoria': l===2? 'Setor':'Sessão'; }

export default ErpProductGroups;