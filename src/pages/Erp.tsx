import { NexusProtectedHeader } from '@/components/NexusProtectedHeader';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Users, Truck, Boxes, Settings2, Tags, Plus, RefreshCcw } from 'lucide-react';
import { ErpSuppliers } from '@/components/erp/ErpSuppliers';
import { ErpCarriers } from '@/components/erp/ErpCarriers';
import { ErpClients } from '@/components/erp/ErpClients';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';

type SectionKey = 'dashboard' | 'clients' | 'suppliers' | 'carriers' | 'products' | 'stock' | 'labels';

export default function Erp() {
  const [section, setSection] = useState<SectionKey>('dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <NexusProtectedHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-white/90 backdrop-blur-sm dark:bg-slate-800/80 flex flex-col">
          <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ERP</div>
          <nav className="flex-1 px-2 space-y-1 text-sm">
            <ErpNavItem icon={<Boxes className='h-4 w-4' />} label="Visão Geral" active={section==='dashboard'} onClick={()=>setSection('dashboard')} />
            <ErpNavItem icon={<Users className='h-4 w-4' />} label="Clientes" active={section==='clients'} onClick={()=>setSection('clients')} />
            <ErpNavItem icon={<Users className='h-4 w-4' />} label="Fornecedores" active={section==='suppliers'} onClick={()=>setSection('suppliers')} />
            <ErpNavItem icon={<Truck className='h-4 w-4' />} label="Transportadoras" active={section==='carriers'} onClick={()=>setSection('carriers')} />
            <ErpNavItem icon={<Package className='h-4 w-4' />} label="Produtos" active={section==='products'} onClick={()=>setSection('products')} />
            <ErpNavItem icon={<Settings2 className='h-4 w-4' />} label="Estoque" active={section==='stock'} onClick={()=>setSection('stock')} />
            <ErpNavItem icon={<Tags className='h-4 w-4' />} label="Etiquetas / Códigos" active={section==='labels'} onClick={()=>setSection('labels')} />
          </nav>
          <div className="p-3 border-t text-[10px] text-muted-foreground">
            MVP inicial do módulo ERP • Expandir funções posteriormente
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
              {section === 'dashboard' && <ErpDashboard />}
              {section === 'clients' && <ErpClients />}
              {section === 'suppliers' && <ErpSuppliers />}
              {section === 'carriers' && <ErpCarriers />}
              {section === 'products' && <SectionPlaceholder title="Produtos" description="(Futuro) gerenciamento avançado + tributação (tabela product_tax)." />}
              {section === 'stock' && <StockPlaceholder />}
              {section === 'labels' && <LabelsPlaceholder />}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

function ErpNavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/10 text-left transition-colors ${active ? 'bg-primary/15 text-primary font-medium' : 'text-slate-600 dark:text-slate-300'}`}
    >
      {icon}<span className="truncate">{label}</span>
    </button>
  );
}

function SectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="text-xs text-muted-foreground">Interface detalhada será implementada conforme requisitos (CRUD completo, filtros avançados, exportação, integrações fiscais).</div>
    </Card>
  );
}

function ErpDashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-4"><h3 className="font-semibold mb-1">Status Geral</h3><p className="text-xs text-muted-foreground">KPIs de estoque, vendas, compras.</p></Card>
      <Card className="p-4"><h3 className="font-semibold mb-1">Alertas de Estoque</h3><p className="text-xs text-muted-foreground">Itens abaixo do mínimo serão exibidos aqui.</p></Card>
      <Card className="p-4"><h3 className="font-semibold mb-1">Pendências Fiscais</h3><p className="text-xs text-muted-foreground">Notas a emitir / divergências tributárias.</p></Card>
    </div>
  );
}

// reutilizar Button como UIButton para diferenciar no escopo estoque
const UIButton = Button;

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MovementRow { id:string; product_id:string; type:string; quantity:number; unit_cost:number|null; reference:string|null; notes:string|null; created_at:string }
interface StockRow { product_id:string; stock:number }

function StockPlaceholder() {
  const [movs, setMovs] = useState<MovementRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id:'', type:'ENTRADA', quantity:'', unit_cost:'', reference:'', notes:'' });
  const [loading, setLoading] = useState(false);

  async function load() {
  const { data: m, error: e1 } = await (supabase as any).from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(50);
    if (e1) toast.error('Erro movimentos'); else setMovs(m as MovementRow[]);
  const { data: s, error: e2 } = await (supabase as any).from('product_stock').select('*');
    if (e2) toast.error('Erro estoque'); else setStock(s as StockRow[]);
  }
  useEffect(()=>{ load(); },[]);

  async function save() {
    const qty = Number(form.quantity);
    if (!form.product_id || !qty || qty<=0) { toast.error('Produto e quantidade'); return; }
    setLoading(true);
  const payload: any = { product_id: form.product_id, type: form.type, quantity: qty, reference: form.reference||null, notes: form.notes||null };
    if (form.type==='ENTRADA' && form.unit_cost) payload.unit_cost = Number(form.unit_cost)||null;
  const { error } = await (supabase as any).from('inventory_movements').insert(payload);
    if (error) { toast.error('Falha ao lançar'); setLoading(false); return; }
    toast.success('Movimentação registrada');
    setForm({ product_id:'', type:'ENTRADA', quantity:'', unit_cost:'', reference:'', notes:'' });
    setOpen(false); setLoading(false); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UIButton size="sm" onClick={()=>setOpen(true)}><Plus className="h-4 w-4 mr-1"/>Nova Movimentação</UIButton>
        <UIButton size="sm" variant="outline" onClick={load}><RefreshCcw className="h-4 w-4 mr-1"/>Atualizar</UIButton>
        <div className="text-xs text-muted-foreground ml-auto">{movs.length} movs exibidas | {stock.length} produtos estoque</div>
      </div>
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-2">Estoque (posição)</h2>
        <div className="max-h-56 overflow-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Produto</th><th className="px-2 py-1 text-left">Qtd</th></tr></thead>
            <tbody>
              {stock.map(s=> <tr key={s.product_id} className="border-t"><td className="px-2 py-1">{s.product_id}</td><td className="px-2 py-1">{s.stock}</td></tr>)}
              {stock.length===0 && <tr><td colSpan={2} className="text-center py-4 text-muted-foreground">Sem dados</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-2">Últimas Movimentações</h2>
        <div className="max-h-72 overflow-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Produto</th><th className="px-2 py-1">Tipo</th><th className="px-2 py-1 text-right">Qtd</th><th className="px-2 py-1 text-right">Custo</th><th className="px-2 py-1">Ref</th></tr></thead>
            <tbody>
              {movs.map(m=> <tr key={m.id} className="border-t"><td className="px-2 py-1">{new Date(m.created_at).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</td><td className="px-2 py-1">{m.product_id}</td><td className="px-2 py-1">{m.type}</td><td className="px-2 py-1 text-right">{m.quantity}</td><td className="px-2 py-1 text-right">{m.unit_cost??'-'}</td><td className="px-2 py-1 truncate max-w-[120px]" title={m.reference||''}>{m.reference||'-'}</td></tr>)}
              {movs.length===0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Sem movimentações</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-2 text-sm">
            <Input placeholder="Código do Produto *" value={form.product_id} onChange={e=>setForm(f=>({...f,product_id:e.target.value}))} />
            <select className="border rounded h-9 px-2 text-sm" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              <option value="ENTRADA">ENTRADA</option>
              <option value="SAIDA">SAIDA</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Quantidade *" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} />
              {form.type==='ENTRADA' && (<Input placeholder="Custo Unitário" value={form.unit_cost} onChange={e=>setForm(f=>({...f,unit_cost:e.target.value}))} />)}
            </div>
            <Input placeholder="Referência (pedido, nota)" value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} />
            <Textarea placeholder="Observações" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} />
          </div>
          <DialogFooter>
            <UIButton variant="outline" onClick={()=>setOpen(false)}>Cancelar</UIButton>
            <UIButton disabled={loading} onClick={save}>{loading?'Salvando...':'Salvar'}</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabelsPlaceholder() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">Etiquetas / Códigos</h2>
      <p className="text-sm text-muted-foreground mb-4">Gerar e armazenar códigos de barras (EAN13, Code128) e QR Codes para produtos em product_labels.</p>
  <div className="text-xs text-muted-foreground mb-2">Próximo passo: adicionar libs (jsbarcode / qrcode) e permitir geração em lote + impressão térmica.</div>
  <div className="border rounded p-3 bg-muted/30 text-xs text-muted-foreground">
    Exemplo futuro de API:
    <pre className="whitespace-pre-wrap mt-2">{`generateLabel({
  productId: '123',
  type: 'EAN13',
  code: '7891234567895',
  format: 'svg'
})`}</pre>
  </div>
    </Card>
  );
}
