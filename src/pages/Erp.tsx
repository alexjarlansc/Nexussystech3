import { NexusProtectedHeader } from '@/components/NexusProtectedHeader';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Users, Truck, Boxes, Settings2, Tags, Plus, RefreshCcw, FolderTree, Percent, Layers, Ruler, Wrench, FileText, ShoppingCart, BarChart2, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
// Ícone simples para trocas/devoluções (setas circulares)
const RotateIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 6.76 5.36L1 10" /><path d="M3.51 15A9 9 0 0 0 17.24 18.64L23 14" /></svg>;
import { ErpSuppliers } from '@/components/erp/ErpSuppliers';
import { ErpProducts } from '@/components/erp/ErpProducts';
import { ErpCarriers } from '@/components/erp/ErpCarriers';
import ErpProductGroups from '@/components/erp/ErpProductGroups';
import { ErpClients } from '@/components/erp/ErpClients';
import ErpServiceOrders from '@/components/erp/ErpServiceOrders';
import ErpStockMovements from '@/components/erp/ErpStockMovements';
import ErpStockAdjustments from '@/components/erp/ErpStockAdjustments';
import ErpStockTransfers from '@/components/erp/ErpStockTransfers';
import ErpStockReturns from '@/components/erp/ErpStockReturns';
import { Tables } from '@/integrations/supabase/types';
import { ErpPurchasesList } from '@/components/erp/ErpPurchasesList';
import { ErpPurchaseXmlImport } from '@/components/erp/ErpPurchaseXmlImport';
import { ErpPurchaseReturns } from '@/components/erp/ErpPurchaseReturns';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Checkbox } from '@/components/ui/checkbox';
/* eslint-disable @typescript-eslint/no-explicit-any */

type SectionKey =
  | 'dashboard'
  | 'clients'
  | 'suppliers'
  | 'carriers'
  | 'stock'
  | 'stock_movements'
  | 'stock_adjustments'
  | 'stock_transfers'
  | 'stock_returns'
  | 'products_manage'
  | 'products_pricing'
  | 'product_groups'
  
  | 'product_labels'
  | 'replenishment_orders'
  | 'services'
  | 'budgets'
  | 'service_orders'
  | 'sales_orders'
  | 'service_sales_orders'
  | 'purchases_list'
  | 'purchases_xml'
  | 'purchases_returns'
  | 'purchases_history'
  | 'fin_payables'
  | 'fin_receivables'
  | 'fin_payroll'
  | 'fiscal_docs'
  | 'report_stock_full'
  | 'report_sales_full'
  | 'report_finance_full'
  | 'reports_dashboard';

import ErpReplenishmentOrders from '@/components/erp/ErpReplenishmentOrders';
import ErpProductLabels from '@/components/erp/ErpProductLabels';

export default function Erp() {
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [quotesCount, setQuotesCount] = useState<number>(0);
  const [replOpenCount,setReplOpenCount]=useState<number>(0);

  // Carrega contagem inicial e assina mudanças de orçamentos
  useEffect(() => {
    let active = true;
    async function loadCount() {
      const { count } = await (supabase as any)
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('type','ORCAMENTO');
      if (active) setQuotesCount(count || 0);
    }
    loadCount();
    // Assinatura realtime para inserts/deletes
    const channel = (supabase as any)
      .channel('quotes-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, (payload:any) => {
        // Atualiza só se mudança relevante (tipo ORCAMENTO envolvido)
        loadCount();
      })
      .subscribe();
    return () => { active = false; (supabase as any).removeChannel(channel); };
  }, []);

  // Contagem de pedidos de reposição abertos
  useEffect(()=>{
    let active = true;
    async function loadRepl(){
      try {
        const { count } = await (supabase as any).from('replenishment_orders').select('id',{count:'exact', head:true}).eq('status','ABERTO');
        if(active) setReplOpenCount(count||0);
      } catch{ /* ignore count error */ }
    }
    loadRepl();
    const ch = (supabase as any).channel('replenishment-orders-count')
      .on('postgres_changes',{event:'*', schema:'public', table:'replenishment_orders'}, ()=>loadRepl())
      .subscribe();
    return ()=>{ active=false; (supabase as any).removeChannel(ch); };
  },[]);

  // Mantemos seção acessível mesmo sem orçamentos (apenas mostra vazio)
  // Scroll para topo ao mudar de seção
  useEffect(() => {
    try {
      const el = document.getElementById('erp-main-scroll');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      // fallback janela
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) { /* noop */ }
  }, [section]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <NexusProtectedHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white/90 backdrop-blur-sm dark:bg-slate-800/80 flex flex-col">
          <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulo ERP</div>
          <nav className="flex-1 px-2 space-y-1 text-sm">
            <ErpNavItem icon={<Boxes className='h-4 w-4' />} label="Visão Geral" active={section==='dashboard'} onClick={()=>setSection('dashboard')} />
            <GroupTitle icon={<FolderTree className="h-3.5 w-3.5" />} label="Cadastro" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Users className='h-4 w-4' />} label="Clientes" active={section==='clients'} onClick={()=>setSection('clients')} />
              <ErpNavItem icon={<Users className='h-4 w-4' />} label="Fornecedores" active={section==='suppliers'} onClick={()=>setSection('suppliers')} />
              <ErpNavItem icon={<Truck className='h-4 w-4' />} label="Transportadoras" active={section==='carriers'} onClick={()=>setSection('carriers')} />
            </div>
            <GroupTitle icon={<Package className="h-3.5 w-3.5" />} label="Produtos" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Package className='h-4 w-4' />} label="Gerenciar Produtos" active={section==='products_manage'} onClick={()=>setSection('products_manage')} />
              <ErpNavItem icon={<Percent className='h-4 w-4' />} label="Valores de Vendas" active={section==='products_pricing'} onClick={()=>setSection('products_pricing')} />
              <ErpNavItem icon={<FolderTree className='h-4 w-4' />} label="Grupos de Produtos" active={section==='product_groups'} onClick={()=>setSection('product_groups')} />
              
              <ErpNavItem icon={<Tags className='h-4 w-4' />} label="Etiquetas / Códigos" active={section==='product_labels'} onClick={()=>setSection('product_labels')} />
              <ErpNavItem icon={<Bell className='h-4 w-4' />} label="Pedidos Reposição" active={section==='replenishment_orders'} onClick={()=>setSection('replenishment_orders')} count={replOpenCount||undefined} />
            </div>
            <GroupTitle icon={<Settings2 className="h-3.5 w-3.5" />} label="Operação" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Settings2 className='h-4 w-4' />} label="Estoque" active={section==='stock'} onClick={()=>setSection('stock')} />
              <ErpNavItem icon={<Wrench className='h-4 w-4' />} label="Serviços" active={section==='services'} onClick={()=>setSection('services')} />
            </div>
            <GroupTitle icon={<Boxes className="h-3.5 w-3.5" />} label="Estoque" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Boxes className='h-4 w-4' />} label="Movimentações" active={section==='stock_movements'} onClick={()=>setSection('stock_movements')} />
              <ErpNavItem icon={<RefreshCcw className='h-4 w-4' />} label="Ajustes" active={section==='stock_adjustments'} onClick={()=>setSection('stock_adjustments')} />
              <ErpNavItem icon={<Truck className='h-4 w-4' />} label="Transferências" active={section==='stock_transfers'} onClick={()=>setSection('stock_transfers')} />
              <ErpNavItem icon={<RotateIcon /> as any} label="Trocas / Devoluções" active={section==='stock_returns'} onClick={()=>setSection('stock_returns')} />
            </div>
            <GroupTitle icon={<FileText className="h-3.5 w-3.5" />} label="Orçamentos" count={quotesCount} />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Listar Orçamentos" active={section==='budgets'} onClick={()=>setSection('budgets')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Listar Ordens de Serviços" active={section==='service_orders'} onClick={()=>setSection('service_orders')} />
            </div>
            <GroupTitle icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vendas" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Pedidos de Vendas" active={section==='sales_orders'} onClick={()=>setSection('sales_orders')} />
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Pedidos de Serviços" active={section==='service_sales_orders'} onClick={()=>setSection('service_sales_orders')} />
            </div>
            <GroupTitle icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Compras" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Lançamento de Compra" active={section==='purchases_list'} onClick={()=>setSection('purchases_list')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Gerar via XML" active={section==='purchases_xml'} onClick={()=>setSection('purchases_xml')} />
              <ErpNavItem icon={<RotateIcon /> as any} label="Troca / Devolução" active={section==='purchases_returns'} onClick={()=>setSection('purchases_returns')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Histórico de Compras" active={section==='purchases_history'} onClick={()=>setSection('purchases_history')} />
            </div>
            <GroupTitle icon={<FileText className="h-3.5 w-3.5" />} label="Financeiro" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Contas a Pagar" active={section==='fin_payables'} onClick={()=>setSection('fin_payables')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Contas a Receber" active={section==='fin_receivables'} onClick={()=>setSection('fin_receivables')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Folha de Pagamento" active={section==='fin_payroll'} onClick={()=>setSection('fin_payroll')} />
            </div>
            <GroupTitle icon={<FileText className="h-3.5 w-3.5" />} label="Notas Fiscais" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Emitir / Gerenciar" active={section==='fiscal_docs'} onClick={()=>setSection('fiscal_docs')} />
            </div>
            <GroupTitle icon={<FileText className="h-3.5 w-3.5" />} label="Relatórios" />
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Dashboard (KPIs)" active={section==='reports_dashboard'} onClick={()=>setSection('reports_dashboard')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Estoque completo" active={section==='report_stock_full'} onClick={()=>setSection('report_stock_full')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Vendas completo" active={section==='report_sales_full'} onClick={()=>setSection('report_sales_full')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Financeiro completo" active={section==='report_finance_full'} onClick={()=>setSection('report_finance_full')} />
            </div>
          </nav>
          <div className="p-3 border-t text-[10px] text-muted-foreground">
            MVP inicial do módulo ERP • Expandir funções posteriormente
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <ScrollArea id="erp-main-scroll" className="h-full">
            <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
              {section === 'dashboard' && <ErpDashboard />}
              {section === 'clients' && <ErpClients />}
              {section === 'suppliers' && <ErpSuppliers />}
              {section === 'carriers' && <ErpCarriers />}
              {section === 'products_manage' && <ErpProducts />}
              {section === 'products_pricing' && <ProductsPricingPlaceholder />}
              {section === 'product_groups' && <ErpProductGroups />}
              
              {section === 'product_labels' && <ErpProductLabels />} 
              {section === 'replenishment_orders' && <ErpReplenishmentOrders />}
              {section === 'stock' && <StockPlaceholder />}
              {section === 'stock_movements' && <ErpStockMovements />}
              {section === 'services' && <ServicesPlaceholder />}
              {section === 'stock_adjustments' && <ErpStockAdjustments />}
              {section === 'stock_transfers' && <ErpStockTransfers />}
              {section === 'stock_returns' && <ErpStockReturns />}
              {section === 'budgets' && <BudgetsPlaceholder />}
              {section === 'service_orders' && <ErpServiceOrders />}
              {section === 'sales_orders' && <SalesOrdersList />}
              {section === 'service_sales_orders' && <ServiceSalesOrdersList />}
              {section === 'purchases_list' && <ErpPurchasesList />}
              {section === 'purchases_xml' && <ErpPurchaseXmlImport />}
              {section === 'purchases_returns' && <ErpPurchaseReturns />}
              {section === 'purchases_history' && <ErpPurchasesList />}
              {section === 'fin_payables' && <FinancePayablesPlaceholder />}
              {section === 'fin_receivables' && <FinanceReceivablesPlaceholder />}
              {section === 'fin_payroll' && <FinancePayrollPlaceholder />}
              {section === 'fiscal_docs' && <FiscalDocsPlaceholder />}
              {section === 'report_stock_full' && <ReportStockFull />}
              {section === 'report_sales_full' && <ReportSalesFull />}
              {section === 'report_finance_full' && <ReportFinanceFull />}
              {section === 'reports_dashboard' && <ReportDashboard />}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

function ErpNavItem({ icon, label, active, onClick, count }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/10 text-left transition-colors ${active ? 'bg-primary/15 text-primary font-medium' : 'text-slate-600 dark:text-slate-300'}`}
    >
  {icon}<span className="truncate flex-1 text-left">{label}</span>
  {typeof count === 'number' && <span className="ml-auto text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">{count}</span>}
    </button>
  );
}

function GroupTitle({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="mt-5 first:mt-3 mb-1 flex items-center gap-2 px-2 py-1 rounded-md group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent opacity-70 dark:from-primary/20 dark:via-primary/10 pointer-events-none" />
      <div className="flex items-center gap-2 relative z-10">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary/20 text-primary shadow-sm">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary drop-shadow-sm">
          {label}
        </span>
      </div>
      {typeof count === 'number' && <span className="ml-auto relative z-10 text-[10px] font-medium rounded px-1.5 py-0.5 bg-primary/20 text-primary/90">{count}</span>}
    </div>
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

interface MovementRow { id:string; product_id:string; type:string; quantity:number; unit_cost:number|null; reference:string|null; notes:string|null; created_at:string }
interface StockRow { product_id:string; stock:number }

function StockPlaceholder() {
  const [movs, setMovs] = useState<MovementRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id:'', type:'ENTRADA', quantity:'', unit_cost:'', reference:'', notes:'' });
  const [loading, setLoading] = useState(false);
  const [inventoryMissing, setInventoryMissing] = useState(false);

  const load = useCallback(async () => {
    setInventoryMissing(false);
    const { data: m, error: e1 } = await (supabase as any).from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(50);
    if (e1) {
      // Erros típicos: relation does not exist (42P01) ou schema cache
      if (e1.code === '42P01' || (e1.message && /inventory_movements/.test(e1.message))) {
        setInventoryMissing(true);
      } else {
        toast.error('Erro movimentos');
      }
    } else {
      setMovs(m as MovementRow[]);
    }
    // Só tenta view se tabela base existir
    if (!inventoryMissing) {
      const { data: s, error: e2 } = await (supabase as any).from('product_stock').select('*');
      if (e2) {
        if (!(e2.code === '42P01' || (e2.message && /product_stock/.test(e2.message)))) toast.error('Erro estoque');
      } else setStock(s as StockRow[]);
    }
  },[inventoryMissing]);
  useEffect(()=>{ load(); },[load]);

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
      {inventoryMissing && (
        <Card className="p-4 border-dashed border-red-300 bg-red-50 dark:bg-red-950/20">
          <h2 className="font-semibold text-red-700 dark:text-red-300 mb-1">Módulo de Movimentação não instalado</h2>
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">A tabela <code>public.inventory_movements</code> não foi encontrada. É necessário aplicar as migrações.</p>
          <ol className="text-[11px] space-y-1 list-decimal pl-4">
            <li>Instale/atualize o CLI: <code>npm i -g supabase</code></li>
            <li>No diretório raiz execute: <code>supabase login</code> e depois <code>supabase link --project-ref &lt;ref&gt;</code></li>
            <li>Execute: <code>supabase db push</code> (ou <code>supabase migration up</code>)</li>
            <li>Se já aplicou e continua: rode SQL <code>NOTIFY pgrst, 'reload schema';</code></li>
          </ol>
          <div className="mt-2 flex gap-2">
            <UIButton size="sm" variant="outline" onClick={load}>Reverificar</UIButton>
          </div>
        </Card>
      )}
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

// ===== Placeholders Produtos =====
function ProductsManagePlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Gerenciar Produtos</h2><p className="text-sm text-muted-foreground mb-4">CRUD completo, tributação, status e sincronização futura.</p><div className="flex gap-2 mb-4"><Button size="sm" onClick={()=>toast.message('Novo Produto')}>Novo</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Importação CSV')}>Importar</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Sincronizar Tributos')}>Sync Tributos</Button></div><div className="text-xs text-muted-foreground">Tabela de produtos será renderizada aqui...</div></Card>;}
function ProductsPricingPlaceholder(){
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [product,setProduct]=useState<any|null>(null);
  const [cost,setCost]=useState<number|undefined>();
  const [rawCost,setRawCost]=useState<string>('');
  const [margin,setMargin]=useState<number|undefined>();
  const [rawMargin,setRawMargin]=useState<string>('');
  const [icms,setIcms]=useState<number|undefined>();
  const [rawIcms,setRawIcms]=useState<string>('');
  const [pis,setPis]=useState<number|undefined>();
  const [rawPis,setRawPis]=useState<string>('');
  const [cofins,setCofins]=useState<number|undefined>();
  const [rawCofins,setRawCofins]=useState<string>('');
  const [freight,setFreight]=useState<number|undefined>(); // % de frete sobre custo
  const [rawFreight,setRawFreight]=useState<string>('');
  const [calcMode,setCalcMode]=useState<'forward'|'reverse'>('forward'); // forward: custo->preço ; reverse: preço->margem
  const [sale,setSale]=useState<number|undefined>();
  const [rawSale,setRawSale]=useState<string>('');
  const [hasMarginCache,setHasMarginCache]=useState<boolean>(true);
  // Detectar presença opcional da coluna margin_cache (após migration)
  useEffect(()=>{(async()=>{
    try { await (supabase as any).from('products').select('margin_cache').limit(1); } catch { setHasMarginCache(false); }
  })();},[]);
  const saleComputed = (()=>{
    if(calcMode==='forward'){
      if(cost===undefined) return undefined;
    // Base sem tributos: custo + margem + frete (frete % aplicado sobre o custo)
    const base = cost * (1 + (margin||0)/100 + (freight||0)/100);
  const totalRate = (icms||0)+(pis||0)+(cofins||0);
  const taxVal = base * (totalRate/100);
  return +(base + taxVal).toFixed(2);
    } else {
      if(sale===undefined || cost===undefined) return undefined;
  // Remover tributos agregados antes de calcular margem efetiva
  const totalRate = (icms||0)+(pis||0)+(cofins||0);
  const baseWithoutTax = sale / (1+ totalRate/100);
    // baseWithoutTax = cost * (1 + margem + frete)
    // => margem = baseWithoutTax/cost - 1 - frete
    const effMargin = (baseWithoutTax/cost - 1 - (freight||0)/100)*100;
      return +effMargin.toFixed(2); // retorna margem calculada
    }
  })();
  async function fetchOne(){
    if(!search.trim()) return; setLoading(true);
    try {
  const q = (supabase as any).from('products').select('*').or(`name.ilike.%${search}%,code.ilike.%${search}%`).limit(1);
      const { data, error } = await q;
      if(error) throw error;
      if(data && data[0]){
  const p = data[0]; setProduct(p);
  const cVal = p.cost_price? Number(p.cost_price):undefined; setCost(cVal); setRawCost(cVal!==undefined? cVal.toFixed(2).replace('.',','):'');
  const sVal = p.sale_price? Number(p.sale_price): (p.price? Number(p.price): undefined); setSale(sVal); setRawSale(sVal!==undefined? sVal.toFixed(2).replace('.',','):'');
  setMargin(undefined); setRawMargin(''); setFreight(undefined); setRawFreight('');
  const iVal = p.icms_rate? Number(p.icms_rate):undefined; setIcms(iVal); setRawIcms(iVal!==undefined? iVal.toFixed(2).replace('.',','):'');
  const pisVal = p.pis_rate? Number(p.pis_rate):undefined; setPis(pisVal); setRawPis(pisVal!==undefined? pisVal.toFixed(2).replace('.',','):'');
  const cofVal = p.cofins_rate? Number(p.cofins_rate):undefined; setCofins(cofVal); setRawCofins(cofVal!==undefined? cofVal.toFixed(2).replace('.',','):'');
      } else { toast.error('Produto não encontrado'); }
    } catch(e:any){ toast.error('Falha: '+e.message); } finally { setLoading(false); }
  }
  async function apply(){
    if(!product){ toast.error('Busque um produto'); return; }
    try {
      const update: any = {};
  if(calcMode==='forward'){
    const finalSale = saleComputed; if(finalSale===undefined){ toast.error('Informe custo e/ou margem'); return; }
	update.price = finalSale; update.sale_price = finalSale; if(cost!==undefined) update.cost_price = cost; if(margin!==undefined && hasMarginCache) update.margin_cache = margin; if(icms!==undefined) update.icms_rate = icms; if(pis!==undefined) update.pis_rate = pis; if(cofins!==undefined) update.cofins_rate = cofins;
  } else { // reverse
    if(sale===undefined){ toast.error('Informe preço de venda'); return; }
	update.price = sale; update.sale_price = sale; if(cost!==undefined) update.cost_price = cost; if(saleComputed!==undefined && hasMarginCache) update.margin_cache = saleComputed; if(icms!==undefined) update.icms_rate = icms; if(pis!==undefined) update.pis_rate = pis; if(cofins!==undefined) update.cofins_rate = cofins;
  }
      // Validações
      const targetPrice = update.sale_price;
      if(update.cost_price!==undefined && targetPrice!==undefined && update.cost_price>targetPrice){ toast.error('Preço não pode ser menor que custo'); return; }
      if(calcMode==='forward' && margin!==undefined && margin<0){ toast.error('Margem negativa'); return; }
      if(calcMode==='reverse' && saleComputed!==undefined && saleComputed<0){ toast.error('Margem calculada negativa'); return; }
      // Capturar estado antigo para histórico
      const old = product;
      let { error } = await (supabase as any).from('products').update(update).eq('id', product.id).select('*').single();
      if(error){
        if(String(error.message||'').includes("margin_cache")){
          // remover campo e tentar novamente
          delete update.margin_cache; setHasMarginCache(false);
          ({ error } = await (supabase as any).from('products').update(update).eq('id', product.id).select('*').single());
        }
        if(error) throw error;
      }
      // Inserir histórico
      try {
        await (supabase as any).from('product_price_history').insert({
          product_id: product.id,
          old_price: old.sale_price||old.price,
          new_price: update.sale_price,
          old_cost: old.cost_price,
	    new_cost: update.cost_price,
          old_margin: old.margin_cache,
          new_margin: update.margin_cache,
          old_icms: old.icms_rate,
          new_icms: update.icms_rate,
          old_pis: old.pis_rate,
          new_pis: update.pis_rate,
          old_cofins: old.cofins_rate,
          new_cofins: update.cofins_rate,
          context: { mode: calcMode, retried_without_margin_cache: !hasMarginCache }
        });
      } catch(_) { /* silencioso */ }
      toast.success('Valores aplicados');
    } catch(e:any){ toast.error('Erro ao aplicar: '+e.message); }
  }
  return <Card className="p-6 space-y-4">
    <header className="space-y-1">
      <h2 className="text-xl font-semibold">Valores de Vendas</h2>
      <p className="text-sm text-muted-foreground">Calcule preço final a partir de custo, margem e tributação ou derive margem a partir do preço.</p>
    </header>
    <div className="flex flex-wrap gap-2 items-end text-xs">
      <Input placeholder="Nome ou código" value={search} onChange={e=>setSearch(e.target.value)} className="w-56 h-8" />
      <Button size="sm" onClick={fetchOne} disabled={loading}>{loading?'...':'Buscar'}</Button>
      {product && <span className="text-[11px] text-muted-foreground">{product.code? product.code+' • ':''}{product.name}</span>}
      <div className="ml-auto flex gap-2 items-center">
        <select value={calcMode} onChange={e=>setCalcMode(e.target.value as any)} className="h-8 border rounded px-2 bg-white">
          <option value="forward">Custo ⇒ Preço</option>
          <option value="reverse">Preço ⇒ Margem</option>
        </select>
  <Button size="sm" variant="outline" onClick={()=>{setProduct(null);setCost(undefined);setRawCost('');setMargin(undefined);setRawMargin('');setFreight(undefined);setRawFreight('');setIcms(undefined);setRawIcms('');setPis(undefined);setRawPis('');setCofins(undefined);setRawCofins('');setSale(undefined);setRawSale('');}}>Limpar</Button>
      </div>
    </div>
  <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80 border-b pb-4 space-y-4">
    <div className="grid md:grid-cols-6 gap-3 text-xs">
      <div>
        <label className="block text-[10px] font-medium uppercase mb-1">Custo</label>
  <Input disabled={!product} value={rawCost} onChange={e=>{
          const only = e.target.value.replace(/[^0-9,.]/g,'');
          setRawCost(only);
          const normalized = only.replace(',','.');
          const num = Number(normalized);
          if(!isNaN(num)) setCost(num); else if(only==='') setCost(undefined);
        }} onBlur={()=>{ if(rawCost){ const n = Number(rawCost.replace(',','.')); if(!isNaN(n)) setRawCost(n.toFixed(2)); } }} placeholder="0,00" inputMode="decimal" className="h-8" />
      </div>
      {calcMode==='forward' && <div>
        <label className="block text-[10px] font-medium uppercase mb-1">Margem %</label>
  <Input disabled={!product}
          value={rawMargin}
          onChange={e=>{
            const only = e.target.value.replace(/[^0-9,.-]/g,'');
            setRawMargin(only);
            const norm = only.replace(',','.');
            const num = Number(norm); if(!isNaN(num)) setMargin(num); else if(!only) setMargin(undefined);
          }}
          onBlur={()=>{ if(rawMargin){ const n=Number(rawMargin.replace(',','.')); if(!isNaN(n)) setRawMargin(n.toFixed(2).replace('.',',')); } }}
          placeholder="%"
          inputMode="decimal"
          className="h-8"
        />
      </div>}
      <div>
        <label className="block text-[10px] font-medium uppercase mb-1">Frete %</label>
  <Input disabled={!product}
          value={rawFreight}
          onChange={e=>{
            const only=e.target.value.replace(/[^0-9,.-]/g,'');
            setRawFreight(only);
            const n=Number(only.replace(',','.'));
            if(!isNaN(n)) setFreight(n); else if(!only) setFreight(undefined);
          }}
          onBlur={()=>{ if(rawFreight){ const n=Number(rawFreight.replace(',','.')); if(!isNaN(n)) setRawFreight(n.toFixed(2).replace('.',',')); } }}
          placeholder="%"
          inputMode="decimal"
          className="h-8"
        />
      </div>
      {calcMode==='reverse' && <div>
        <label className="block text-[10px] font-medium uppercase mb-1">Preço Venda</label>
  <Input disabled={!product} value={rawSale} onChange={e=>{
          const only = e.target.value.replace(/[^0-9,.]/g,'');
          setRawSale(only);
          const normalized = only.replace(',','.');
          const num = Number(normalized); if(!isNaN(num)) setSale(num); else if(only==='') setSale(undefined);
        }} onBlur={()=>{ if(rawSale){ const n = Number(rawSale.replace(',','.')); if(!isNaN(n)) setRawSale(n.toFixed(2)); } }} placeholder="0,00" inputMode="decimal" className="h-8" />
      </div>}
      <div>
        <label className="block text-[10px] font-medium uppercase mb-1">ICMS %</label>
  <Input disabled={!product}
          value={rawIcms}
          onChange={e=>{
            const only=e.target.value.replace(/[^0-9,.-]/g,'');
            setRawIcms(only);
            const n=Number(only.replace(',','.'));
            if(!isNaN(n)) setIcms(n); else if(!only) setIcms(undefined);
          }}
          onBlur={()=>{
            if(rawIcms){ const n=Number(rawIcms.replace(',','.')); if(!isNaN(n)) setRawIcms(n.toFixed(2).replace('.',',')); }
          }}
          placeholder="%"
          inputMode="decimal"
          className="h-8"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium uppercase mb-1">PIS %</label>
  <Input disabled={!product}
          value={rawPis}
          onChange={e=>{
            const only=e.target.value.replace(/[^0-9,.-]/g,'');
            setRawPis(only);
            const n=Number(only.replace(',','.'));
            if(!isNaN(n)) setPis(n); else if(!only) setPis(undefined);
          }}
          onBlur={()=>{
            if(rawPis){ const n=Number(rawPis.replace(',','.')); if(!isNaN(n)) setRawPis(n.toFixed(2).replace('.',',')); }
          }}
          placeholder="%"
          inputMode="decimal"
          className="h-8"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium uppercase mb-1">COFINS %</label>
  <Input disabled={!product}
          value={rawCofins}
          onChange={e=>{
            const only=e.target.value.replace(/[^0-9,.-]/g,'');
            setRawCofins(only);
            const n=Number(only.replace(',','.'));
            if(!isNaN(n)) setCofins(n); else if(!only) setCofins(undefined);
          }}
          onBlur={()=>{
            if(rawCofins){ const n=Number(rawCofins.replace(',','.')); if(!isNaN(n)) setRawCofins(n.toFixed(2).replace('.',',')); }
          }}
          placeholder="%"
          inputMode="decimal"
          className="h-8"
        />
      </div>
      <div className="md:col-span-2 flex flex-col">
        <label className="block text-[10px] font-medium uppercase mb-1">{calcMode==='forward'?'Preço Final':'Margem Calculada %'}</label>
        <div className="h-8 border rounded px-2 flex items-center bg-white font-semibold">
          {saleComputed!==undefined ? (calcMode==='forward'
            ? saleComputed.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
            : saleComputed.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})+' %') : '—'}
        </div>
      </div>
      <div className="md:col-span-6 flex gap-2 items-center">
  <Button size="sm" onClick={apply} disabled={!product}>Aplicar ao Produto</Button>
        {calcMode==='reverse' && saleComputed!==undefined && <span className="text-[11px] text-muted-foreground">Margem efetiva considerando que preço inclui tributo.</span>}
      </div>
    </div>
    {product && <Breakdown cost={cost} margin={margin} freight={freight} icms={icms} pis={pis} cofins={cofins} saleComputed={saleComputed} calcMode={calcMode} saleInput={sale} />}
  </div>
  <MassRecalcTool />
    {!product && <div className="text-[11px] text-muted-foreground">Busque um produto para iniciar o cálculo.</div>}
  <div className="text-[10px] text-muted-foreground">Modelo simples: Preço = Custo * (1 + Margem% + Frete%) + Tributos(ICMS/PIS/COFINS sobre a base). Ajuste conforme regras fiscais específicas depois.</div>
  </Card>;
}
// Breakdown de tributos e margem líquida
type BreakdownProps = { cost: number|undefined; margin: number|undefined; freight:number|undefined; icms:number|undefined; pis:number|undefined; cofins:number|undefined; saleComputed:number|undefined; calcMode:'forward'|'reverse'; saleInput:number|undefined; };
const Breakdown: React.FC<BreakdownProps> = ({cost, margin, freight, icms, pis, cofins, saleComputed, calcMode, saleInput}) => {
  if(cost===undefined) return null;
  const base = calcMode==='forward'
    ? (cost * (1 + (margin||0)/100 + (freight||0)/100))
    : (saleInput!==undefined && saleComputed!==undefined ? cost * (1 + (saleComputed/100) + (freight||0)/100) : undefined);
  if(base===undefined) return null;
  const icmsVal = base * ((icms||0)/100);
  const pisVal = base * ((pis||0)/100);
  const cofinsVal = base * ((cofins||0)/100);
  const totalTax = icmsVal+pisVal+cofinsVal;
  const finalPrice = calcMode==='forward' ? saleComputed : (saleInput!==undefined? saleInput: undefined);
  const grossMarginPct = calcMode==='forward' ? (margin||0) : (saleComputed||0);
  const freightValue = cost * ((freight||0)/100);
  const grossMarginValue = base - cost - freightValue; // margem exclui o frete (frete não é margem)
  const netAfterTax = finalPrice!==undefined? finalPrice - totalTax: undefined;
  const netMarginValue = netAfterTax!==undefined? netAfterTax - cost: undefined;
  const netMarginPct = netMarginValue!==undefined? (netMarginValue/cost)*100: undefined;
  // Markup sobre preço final (quanto a margem bruta representa do preço):
  const markupOverPricePct = finalPrice? (grossMarginValue / finalPrice)*100 : undefined;
  // Margem líquida sem ICMS (descontando apenas ICMS, mantendo PIS/COFINS)
  const netWithoutICMSPrice = finalPrice!==undefined? finalPrice - icmsVal: undefined; // remove só ICMS
  const netWithoutICMSMarginValue = netWithoutICMSPrice!==undefined? netWithoutICMSPrice - cost - (pisVal+cofinsVal): undefined; // remove também PIS/COFINS para margem pós todos exceto ICMS? (ajustado para remover só ICMS já que netWithoutICMSPrice ainda inclui PIS/COFINS)
  const netWithoutICMSMarginPct = netWithoutICMSMarginValue!==undefined? (netWithoutICMSMarginValue/cost)*100: undefined;
  const fmt = (v:number|undefined, pct=false)=> v===undefined? '—': pct? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})+' %' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <div className="border rounded p-3 bg-muted/40 text-[11px] space-y-1">
    <div className="font-semibold">Detalhamento</div>
    <div className="grid md:grid-cols-6 gap-x-4 gap-y-1">
  <div><span className="text-muted-foreground">Base s/ Tributos (Custo+Margem+Frete):</span><br/>{fmt(base)}</div>
  <div><span className="text-muted-foreground">Frete:</span><br/>{fmt(freightValue)} {freight? '('+freight+'%)':''}</div>
      <div><span className="text-muted-foreground">ICMS:</span><br/>{fmt(icmsVal)} {icms? '('+icms+'%)':''}</div>
      <div><span className="text-muted-foreground">PIS:</span><br/>{fmt(pisVal)} {pis? '('+pis+'%)':''}</div>
      <div><span className="text-muted-foreground">COFINS:</span><br/>{fmt(cofinsVal)} {cofins? '('+cofins+'%)':''}</div>
      <div><span className="text-muted-foreground">Tributos Totais:</span><br/>{fmt(totalTax)}</div>
      <div><span className="text-muted-foreground">Preço Final:</span><br/>{fmt(finalPrice)}</div>
      <div><span className="text-muted-foreground">Margem Bruta:</span><br/>{fmt(grossMarginValue)} ({fmt(grossMarginPct, true)})</div>
      <div><span className="text-muted-foreground">Preço Líq. (s/ Tributos):</span><br/>{fmt(netAfterTax)}</div>
      <div><span className="text-muted-foreground">Margem Líquida:</span><br/>{fmt(netMarginValue)} ({fmt(netMarginPct, true)})</div>
      <div><span className="text-muted-foreground">Markup sobre Preço:</span><br/>{markupOverPricePct!==undefined? markupOverPricePct.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—'}</div>
      <div><span className="text-muted-foreground">Preço s/ ICMS:</span><br/>{fmt(netWithoutICMSPrice)}</div>
      <div><span className="text-muted-foreground">Margem s/ ICMS:</span><br/>{fmt(netWithoutICMSMarginValue)} ({fmt(netWithoutICMSMarginPct, true)})</div>
    </div>
  </div>;
};
// Ferramenta de recalcular em massa
function MassRecalcTool(){
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState('');
  const [newMargin,setNewMargin]=useState<number|undefined>();
  const [applyICMS,setApplyICMS]=useState(false); const [icms,setIcms]=useState<number|undefined>();
  const [applyPIS,setApplyPIS]=useState(false); const [pis,setPis]=useState<number|undefined>();
  const [applyCOFINS,setApplyCOFINS]=useState(false); const [cofins,setCofins]=useState<number|undefined>();
  const [loading,setLoading]=useState(false);
  async function run(){
    if(newMargin===undefined){ toast.error('Informe margem'); return; }
    setLoading(true);
    try {
      // Buscar lote de produtos pelo filtro (name/code ilike)
      let q=(supabase as any).from('products').select('id,cost_price,price,sale_price,icms_rate,pis_rate,cofins_rate,margin_cache,name,code').limit(500);
      if(filter.trim()) q = q.or(`name.ilike.%${filter}%,code.ilike.%${filter}%`);
      const { data, error } = await q;
      if(error) throw error;
      if(!data || data.length===0){ toast.message('Nenhum produto'); return; }
      const updates=[]; const history=[];
      for(const p of data){
        const cost = Number(p.cost_price)||0; if(cost<=0) continue; // pula sem custo
        const base = cost * (1 + newMargin/100);
        let rateSum=0; const newFields:any={};
        if(applyICMS && icms!==undefined){ newFields.icms_rate = icms; rateSum+=icms; }
        else if(p.icms_rate) rateSum+=Number(p.icms_rate);
        if(applyPIS && pis!==undefined){ newFields.pis_rate = pis; rateSum+=pis; }
        else if(p.pis_rate) rateSum+=Number(p.pis_rate);
        if(applyCOFINS && cofins!==undefined){ newFields.cofins_rate = cofins; rateSum+=cofins; }
        else if(p.cofins_rate) rateSum+=Number(p.cofins_rate);
        const finalPrice = base + base*(rateSum/100);
        updates.push({ id: p.id, price: finalPrice, sale_price: finalPrice, cost_price: cost, margin_cache: newMargin, ...newFields });
        history.push({ product_id: p.id, old_price: p.sale_price||p.price, new_price: finalPrice, old_cost: p.cost_price, new_cost: cost, old_margin: p.margin_cache, new_margin: newMargin, old_icms: p.icms_rate, new_icms: newFields.icms_rate??p.icms_rate, old_pis: p.pis_rate, new_pis: newFields.pis_rate??p.pis_rate, old_cofins: p.cofins_rate, new_cofins: newFields.cofins_rate??p.cofins_rate, context:{ bulk:true, filter } });
      }
      if(updates.length===0){ toast.message('Sem produtos com custo válido'); return; }
      // Chunk em lotes de 100
      while(updates.length){
        const chunk = updates.splice(0,100);
        const { error:upErr } = await (supabase as any).from('products').upsert(chunk.map(c=>({id:c.id, ...c}))); if(upErr) throw upErr;
      }
      while(history.length){
        const chunk = history.splice(0,100);
        await (supabase as any).from('product_price_history').insert(chunk);
      }
      toast.success('Recalculo em massa concluído'); setOpen(false);
    } catch(e:any){ toast.error('Falha recalculo: '+e.message); } finally { setLoading(false); }
  }
  return <div className="border rounded p-3 bg-muted/40 text-[11px]">
    <div className="flex items-center justify-between"><div className="font-semibold">Recalcular em Massa</div><Button size="sm" variant="outline" onClick={()=>setOpen(o=>!o)}>{open?'Fechar':'Abrir'}</Button></div>
    {open && <div className="mt-2 space-y-2">
      <div className="grid md:grid-cols-6 gap-2">
        <div className="col-span-2"><label className="block text-[10px] font-medium mb-1">Filtro (nome ou código)</label><Input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ex: CAMISA" className="h-7" /></div>
        <div><label className="block text-[10px] font-medium mb-1">Nova Margem %</label><Input value={newMargin??''} onChange={e=>setNewMargin(e.target.value? Number(e.target.value):undefined)} className="h-7" placeholder="%" /></div>
        <div className="flex flex-col"><label className="block text-[10px] font-medium mb-1">ICMS %</label><div className="flex items-center gap-1"><Checkbox checked={applyICMS} onCheckedChange={v=>setApplyICMS(!!v)} /><Input disabled={!applyICMS} value={icms??''} onChange={e=>setIcms(e.target.value? Number(e.target.value):undefined)} className="h-7" placeholder="%" /></div></div>
        <div className="flex flex-col"><label className="block text-[10px] font-medium mb-1">PIS %</label><div className="flex items-center gap-1"><Checkbox checked={applyPIS} onCheckedChange={v=>setApplyPIS(!!v)} /><Input disabled={!applyPIS} value={pis??''} onChange={e=>setPis(e.target.value? Number(e.target.value):undefined)} className="h-7" placeholder="%" /></div></div>
        <div className="flex flex-col"><label className="block text-[10px] font-medium mb-1">COFINS %</label><div className="flex items-center gap-1"><Checkbox checked={applyCOFINS} onCheckedChange={v=>setApplyCOFINS(!!v)} /><Input disabled={!applyCOFINS} value={cofins??''} onChange={e=>setCofins(e.target.value? Number(e.target.value):undefined)} className="h-7" placeholder="%" /></div></div>
      </div>
      <div className="flex gap-2">
  <Button size="sm" onClick={run} disabled={loading}>{loading?'Processando...':'Executar'}</Button>
  <Button size="sm" variant="outline" onClick={()=>{setFilter('');setNewMargin(undefined);setApplyICMS(false);setApplyPIS(false);setApplyCOFINS(false);setIcms(undefined);setPis(undefined);setCofins(undefined);}}>Limpar</Button>
      </div>
      <div className="text-[10px] text-muted-foreground">Aplica nova margem sobre custo atual. Tributos somados somente se marcados. Limite 500 produtos por execução.</div>
    </div>}
  </div>;
}
// Substituído por componente funcional ErpProductGroups
function ProductUnitsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Unidades</h2><p className="text-sm text-muted-foreground mb-4">Cadastro de unidades comerciais.</p><Button size="sm" onClick={()=>toast.message('Nova Unidade')}>Nova Unidade</Button><div className="mt-4 text-xs text-muted-foreground">Tabela de unidades...</div></Card>;}
function ProductVariationsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Grades / Variações</h2><p className="text-sm text-muted-foreground mb-4">Gerencie SKUs por atributos.</p><Button size="sm" onClick={()=>toast.message('Nova Grade')}>Nova Grade</Button><div className="mt-4 text-xs text-muted-foreground">Configuração de atributos e geração de variações...</div></Card>;}
/* ================== ETIQUETAS ================== */
interface LabelProduct { id:string; code?:string|null; name?:string|null; sale_price?:any; }
function ProductLabels(){
  const [search,setSearch]=useState('');
  const [products,setProducts]=useState<LabelProduct[]>([]);
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [loading,setLoading]=useState(false);
  const [showConfig,setShowConfig]=useState(false);
  const [priceSource,setPriceSource]=useState<'sale_price'|'manual'>('sale_price');
  const [manualPrice,setManualPrice]=useState('');
  const [labelWidth,setLabelWidth]=useState(80); // mm
  const [labelHeight,setLabelHeight]=useState(40); // mm
  const [fontScale,setFontScale]=useState(1);
  const [showPreview,setShowPreview]=useState(false);

  useEffect(()=>{(async()=>{
    setLoading(true);
    try{
      let q = (supabase as any).from('products').select('id, code, name, sale_price').order('name').limit(200);
      if(search) q = q.ilike('name','%'+search+'%');
      const { data, error } = await q;
      if(error) throw error;
      setProducts(data||[]);
    }catch(e:any){ toast.error(e.message);}finally{setLoading(false);} 
  })();},[search]);

  function toggle(p:LabelProduct){
    setSelected(s=>{
      const next={...s};
      if(next[p.id]) delete next[p.id]; else next[p.id]=1;
      return next;
    });
  }
  function adjustQty(id:string,delta:number){
    setSelected(s=>{ const q=(s[id]||0)+delta; const n={...s}; if(q<=0) delete n[id]; else n[id]=q; return n;});
  }
  const selectedProducts = products.filter(p=> selected[p.id]);

  function buildPrintHtml(){
    const mmToPx = (mm:number)=> mm * 3.78; // 96dpi approx
    const wPx = mmToPx(labelWidth);
    const hPx = mmToPx(labelHeight);
    const css = `@page { size: ${labelWidth}mm ${labelHeight}mm; margin: 2mm; }
      body { font-family: Arial, sans-serif; }
      .sheet { display:flex; flex-wrap:wrap; gap:4px; }
      .lbl { box-sizing:border-box; width:${wPx}px; height:${hPx}px; border:1px solid #000; padding:4px 6px; display:flex; flex-direction:column; justify-content:space-between; }
      .name { font-size:${12*fontScale}px; font-weight:600; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .price { font-size:${24*fontScale}px; font-weight:700; text-align:right; }
      .code { font-size:${10*fontScale}px; letter-spacing:1px; }
      .barcode { font-size:0; }
    `;
    const rows: string[] = [];
    selectedProducts.forEach(p=>{
      const qty = selected[p.id];
      const priceValue = priceSource==='manual'? manualPrice : (p.sale_price!=null? Number(p.sale_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '');
      const code = p.code || p.id.slice(0,12).replace(/-/g,'').padEnd(12,'0');
      for(let i=0;i<qty;i++){
        rows.push(`<div class="lbl">
          <div class="name">${(p.name||'').toUpperCase()}</div>
          <div class="price">${priceValue}</div>
          <div class="code">${code}</div>
          <div class="barcode"><img src="https://api-bwipjs.metafloor.com/?bcid=ean13&text=${code}&scale=2&includetext=0" style="max-width:100%;height:32px;object-fit:contain" /></div>
        </div>`);
      }
    });
    return `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Etiquetas</title><style>${css}</style></head><body onload="window.print()"><div class='sheet'>${rows.join('\n')}</div></body></html>`;
  }

  function handlePrint(){
    if(!selectedProducts.length){ toast.warning('Selecione produtos'); return; }
    const html = buildPrintHtml();
    const w = window.open('','_blank','width=900,height=700');
    if(w){ w.document.write(html); w.document.close(); }
  }

  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-4 items-end">
      <div>
        <h2 className="text-xl font-semibold">Etiquetas / Códigos</h2>
        <p className="text-sm text-muted-foreground">Selecione produtos e gere etiquetas no modelo solicitado.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap items-center text-xs">
        <Input placeholder="Buscar produto" value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-48" />
        <Button size="sm" variant="outline" onClick={()=>setShowConfig(true)}>Configurar</Button>
        <Button size="sm" onClick={handlePrint} disabled={!Object.keys(selected).length}>Imprimir ({Object.values(selected).reduce((a,b)=>a+b,0)})</Button>
      </div>
    </header>
    <div className="border rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left">Sel</th><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1 text-right">Preço</th><th className="px-2 py-1 text-center">Qtd</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && products.map(p=>{
            const q = selected[p.id]||0;
            return <tr key={p.id} className="border-t hover:bg-muted/40">
              <td className="px-2 py-1"><input type="checkbox" checked={!!q} onChange={()=>toggle(p)} /></td>
              <td className="px-2 py-1 font-mono text-[10px]">{p.code||'-'}</td>
              <td className="px-2 py-1 truncate max-w-[240px]" title={p.name||''}>{p.name}</td>
              <td className="px-2 py-1 text-right">{p.sale_price!=null? Number(p.sale_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-'}</td>
              <td className="px-2 py-1 text-center">
                {q? <div className="inline-flex items-center gap-1">
                  <button className="px-2 border rounded" onClick={()=>adjustQty(p.id,-1)}>-</button>
                  <input value={q} onChange={e=>{const v=Number(e.target.value)||0; setSelected(s=>({...s,[p.id]:v}));}} className="w-10 h-6 text-center border rounded" />
                  <button className="px-2 border rounded" onClick={()=>adjustQty(p.id,1)}>+</button>
                </div>: <button className="text-primary underline" onClick={()=>adjustQty(p.id,1)}>Adicionar</button>}
              </td>
            </tr>;
          })}
          {!loading && !products.length && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum produto</td></tr>}
        </tbody>
      </table>
    </div>

    {/* Config dialog simples */}
    {showConfig && <Dialog open={showConfig} onOpenChange={setShowConfig}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Configuração de Etiquetas</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1"><span className="font-medium">Largura (mm)</span><Input type="number" value={labelWidth} onChange={e=>setLabelWidth(Number(e.target.value)||1)} /></label>
            <label className="space-y-1"><span className="font-medium">Altura (mm)</span><Input type="number" value={labelHeight} onChange={e=>setLabelHeight(Number(e.target.value)||1)} /></label>
            <label className="space-y-1"><span className="font-medium">Escala Fonte</span><Input type="number" step="0.1" value={fontScale} onChange={e=>setFontScale(Number(e.target.value)||1)} /></label>
            <label className="space-y-1"><span className="font-medium">Preço Manual</span><Input disabled={priceSource!=='manual'} value={manualPrice} onChange={e=>setManualPrice(e.target.value)} placeholder="Ex: 39,00" /></label>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1 text-xs"><input type="radio" name="priceSource" value="sale_price" checked={priceSource==='sale_price'} onChange={()=>setPriceSource('sale_price')} /> Usar preço produto</label>
            <label className="flex items-center gap-1 text-xs"><input type="radio" name="priceSource" value="manual" checked={priceSource==='manual'} onChange={()=>setPriceSource('manual')} /> Preço manual</label>
          </div>
          <div className="text-xs text-muted-foreground">O modelo inclui: Nome (linha 1), Preço em destaque, código numérico e código de barras EAN13 gerado (usa code, ou fallback uuid parcial). Use etiquetas térmicas {labelWidth}x{labelHeight}mm.</div>
          <Button size="sm" variant="outline" onClick={()=>{setShowPreview(true);}}>Pré-visualizar</Button>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={()=>{setShowConfig(false);}}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}

    {showPreview && <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
        <div className="overflow-auto border p-2 max-h-[60vh]">
          <iframe title="preview" style={{width:'100%',height:'400px',background:'#fff'}} srcDoc={buildPrintHtml()} />
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={()=>setShowPreview(false)}>Fechar</Button>
          <Button size="sm" onClick={()=>{handlePrint();}}>Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </Card>;
}
function ServicesPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Serviços</h2><p className="text-sm text-muted-foreground mb-4">Cadastro e gestão de serviços para ordens, contratos e faturamento.</p><div className="flex gap-2 mb-4"><Button size="sm" onClick={()=>toast.message('Novo Serviço')}>Novo</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Importar Serviços')}>Importar</Button></div><div className="text-xs text-muted-foreground">Tabela (código | descrição | unidade | custo | preço | tributos).</div></Card>;}
function BudgetsPlaceholder(){
  const [data,setData]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [period,setPeriod]=useState({from:'',to:''});
  const [search,setSearch]=useState('');
  async function load(){
    setLoading(true);
  let q = (supabase as any).from('quotes').select('*').eq('type','ORCAMENTO').order('created_at',{ascending:false}).limit(200);
    if(period.from) q = q.gte('created_at', period.from+'T00:00:00');
    if(period.to) q = q.lte('created_at', period.to+'T23:59:59');
    if(search) q = q.ilike('number','%'+search+'%');
    const { data, error } = await q;
    if(error) toast.error('Falha ao carregar'); else setData(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Orçamentos</h2>
        <p className="text-sm text-muted-foreground">Consulta consolidada de orçamentos de produtos e serviços.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap">
        <Input type="date" value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} className="w-40" />
        <Input type="date" value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} className="w-40" />
        <Input placeholder="Número" value={search} onChange={e=>setSearch(e.target.value)} className="w-32" />
        <Button size="sm" onClick={load} disabled={loading}>{loading?'Carregando...':'Filtrar'}</Button>
      </div>
    </header>
    <div className="border rounded max-h-[480px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Cliente</th><th className="px-2 py-1 text-left">Tipo</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1">Origem</th></tr></thead>
        <tbody>
          {data.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
            <td className="px-2 py-1 font-medium">{r.number}</td>
            <td className="px-2 py-1 truncate max-w-[140px]" title={r.customer_name||''}>{r.customer_name||'-'}</td>
            <td className="px-2 py-1">{r.type||'-'}</td>
            <td className="px-2 py-1 text-right">{r.total? Number(r.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-'}</td>
            <td className="px-2 py-1 text-xs text-muted-foreground">{r.origin_orc_number||'-'}</td>
          </tr>)}
          {data.length===0 && !loading && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem orçamentos</td></tr>}
          {loading && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="text-[10px] text-muted-foreground">Limite 200 resultados • adicionar paginação e exportação CSV posteriormente.</div>
  </Card>;
}

// ===== Financeiro Placeholders =====
function FinancePayablesPlaceholder(){
  return <FinanceGeneric kind="payables" title="Contas a Pagar" numberField="payable_number" amountField="amount" paidField="paid_amount" supplierField />;
}
function FinanceReceivablesPlaceholder(){
  return <FinanceGeneric kind="receivables" title="Contas a Receber" numberField="receivable_number" amountField="amount" paidField="received_amount" clientField />;
}
function FinancePayrollPlaceholder(){
  return <FinanceGeneric kind="payroll" title="Folha de Pagamento" numberField="payroll_number" amountField="gross_amount" paidField="net_amount" payroll />;
}
function FiscalDocsPlaceholder(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null);
  const [openNew,setOpenNew]=useState(false); const [creating,setCreating]=useState(false);
  const [saleSearch,setSaleSearch]=useState(''); const [sales,setSales]=useState<any[]>([]);
  const [selectedSale,setSelectedSale]=useState<any|null>(null);
  useEffect(()=>{(async()=>{ setLoading(true); try { const { data, error } = await (supabase as any).from('nfe_invoices').select('*').order('created_at',{ascending:false}).limit(100); if (error) throw error; setRows(data||[]);} catch(e:any){ setError(e.message);} finally { setLoading(false);} })();},[]);
  async function searchSales(){ const { data, error } = await (supabase as any).from('sales').select('*').ilike('sale_number','%'+saleSearch+'%').limit(20); if(!error) setSales(data||[]); }
  async function createFromSale(){ if(!selectedSale) return; setCreating(true); try {
    const numResp = await (supabase as any).rpc('next_nfe_number'); const nfe_number = numResp.data;
    // montar itens simples a partir de sale.items
    const saleItems = Array.isArray(selectedSale.items)? selectedSale.items : (typeof selectedSale.items==='object'? Object.values(selectedSale.items): []);
    const mapped = saleItems.map((it:any,idx:number)=> ({
      line_number: idx+1,
      product_id: it.product_id || it.id || it.productId || null,
      description: it.name||it.description||'Item',
      quantity: it.quantity||it.qty||1,
      unit_price: it.price||it.unit_price||0,
      total: (it.quantity||it.qty||1) * (it.price||it.unit_price||0)
    }));
    const totalProducts = mapped.reduce((s:any,i:any)=> s + Number(i.total||0),0);
    const payload = { nfe_number, sale_id: selectedSale.id, client_id: null, client_snapshot: selectedSale.client_snapshot||null, emit_snapshot:null, items: mapped, total_products: totalProducts, total_invoice: totalProducts, status:'DRAFT'};
    const { error } = await (supabase as any).from('nfe_invoices').insert(payload);
    if (error) throw error; toast.success('NF-e criada'); setOpenNew(false); setSelectedSale(null); } catch(e:any){ toast.error(e.message);} finally { setCreating(false);} }
  async function sign(inv:any){ const { data, error } = await (supabase as any).rpc('sign_nfe',{p_invoice_id: inv.id}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Erro'); toast.success('Assinada'); inv.status='SIGNED'; setRows(r=>[...r]); }
  async function transmit(inv:any){ const { data, error } = await (supabase as any).rpc('transmit_nfe',{p_invoice_id: inv.id}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Erro'); toast.success('Autorizada'); inv.status='AUTHORIZED'; setRows(r=>[...r]); }
  async function cancel(inv:any){ const reason='Cancelamento teste'; const { data, error } = await (supabase as any).rpc('cancel_nfe',{p_invoice_id: inv.id, p_reason: reason}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Erro'); toast.success('Cancelada'); inv.status='CANCELLED'; setRows(r=>[...r]); }
  async function computeTaxes(inv:any){ const { data, error } = await (supabase as any).rpc('compute_nfe_taxes',{p_invoice_id: inv.id}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Falha impostos'); toast.success('Impostos calculados'); }
  async function generateXml(inv:any){ const { data, error } = await (supabase as any).rpc('generate_nfe_xml',{p_invoice_id: inv.id}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Falha XML'); toast.success('XML gerado'); }
  async function correction(inv:any){ const txt='Correção exemplo'; const { data, error } = await (supabase as any).rpc('add_nfe_correction',{p_invoice_id: inv.id, p_text: txt}); if(error || !data?.ok) return toast.error(error?.message||data?.error||'Falha CC-e'); toast.success('CC-e registrada'); }
  async function danfe(inv:any){ const { data, error } = await (supabase as any).rpc('generate_danfe_html',{p_invoice_id: inv.id}); if(error) return toast.error(error.message); const w = window.open('about:blank','_blank'); if (w) { w.document.write(data); w.document.close(); }
  }
  return <Card className="p-6 space-y-4">
    <div className="flex items-start gap-4 flex-wrap">
      <div>
        <h2 className="text-xl font-semibold mb-1">Notas Fiscais (NF-e)</h2>
        <p className="text-sm text-muted-foreground">Emissão e status (mock). Produção futura: integração SEFAZ.</p>
      </div>
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={()=>setOpenNew(true)}>Nova NF-e (Venda)</Button>
      </div>
    </div>
    {error && <div className="text-sm text-red-500">{error}</div>}
    <div className="border rounded overflow-auto max-h-[500px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Total</th><th className="px-2 py-1 text-left">Ações</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem NF-e</td></tr>}
          {!loading && rows.map(inv=> <tr key={inv.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 whitespace-nowrap">{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
            <td className="px-2 py-1 font-medium">{inv.nfe_number}</td>
            <td className="px-2 py-1">{inv.status}</td>
            <td className="px-2 py-1">{Number(inv.total_invoice||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 flex gap-1 flex-wrap">
              {inv.status==='DRAFT' && <Button size="sm" variant="outline" onClick={()=>computeTaxes(inv)}>Impostos</Button>}
              {inv.status==='DRAFT' && <Button size="sm" variant="outline" onClick={()=>generateXml(inv)}>XML</Button>}
              {inv.status==='DRAFT' && <Button size="sm" variant="outline" onClick={()=>sign(inv)}>Assinar</Button>}
              {['SIGNED','SENT'].includes(inv.status) && <Button size="sm" variant="outline" onClick={()=>transmit(inv)}>Transmitir</Button>}
              {inv.status==='AUTHORIZED' && <Button size="sm" variant="outline" onClick={()=>cancel(inv)}>Cancelar</Button>}
              {['AUTHORIZED','REJECTED'].includes(inv.status) && <Button size="sm" variant="outline" onClick={()=>correction(inv)}>CC-e</Button>}
              <Button size="sm" variant="outline" onClick={()=>danfe(inv)}>DANFe</Button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="text-xs text-muted-foreground">Fluxo mock: DRAFT → SIGNED → AUTHORIZED (Transmitir) → CANCELLED. Próximos: XML real, carta de correção, eventos completos.</div>

    <Dialog open={openNew} onOpenChange={setOpenNew}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Nova NF-e (a partir de venda)</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Buscar Venda</label>
              <Input value={saleSearch} onChange={e=>setSaleSearch(e.target.value)} placeholder="Número da venda" />
            </div>
            <Button size="sm" variant="outline" onClick={searchSales}>Pesquisar</Button>
          </div>
          <div className="max-h-40 overflow-auto border rounded">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40"><tr><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Total</th><th className="px-2 py-1 text-left">Selecionar</th></tr></thead>
              <tbody>
                {sales.map(s=> <tr key={s.id} className={`border-t ${selectedSale?.id===s.id? 'bg-primary/10':''}`}>
                  <td className="px-2 py-1">{s.sale_number}</td>
                  <td className="px-2 py-1">{Number(s.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-2 py-1"><Button size="sm" variant="outline" onClick={()=>setSelectedSale(s)}>Selecionar</Button></td>
                </tr>)}
                {sales.length===0 && <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">Sem resultados</td></tr>}
              </tbody>
            </table>
          </div>
          {selectedSale && <div className="text-[11px] p-2 bg-muted rounded">Venda selecionada: {selectedSale.sale_number}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpenNew(false)}>Fechar</Button>
          <Button disabled={!selectedSale || creating} onClick={createFromSale}>{creating? 'Criando...' : 'Criar NF-e'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

interface FinanceGenericProps {
  kind:'payables'|'receivables'|'payroll';
  title:string;
  numberField:string;
  amountField:string;
  paidField:string;
  supplierField?:boolean;
  clientField?:boolean;
  payroll?:boolean;
}
function FinanceGeneric({ kind,title,numberField,amountField,paidField,supplierField,clientField,payroll}:FinanceGenericProps){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [page,setPage]=useState(1); const pageSize=15; const [total,setTotal]=useState(0);
  const [openNew,setOpenNew]=useState(false);
  const [openPay,setOpenPay]=useState<null|{id:string; amount:number; paid:number; number:string}>(null);
  const [form,setForm]=useState({ description:'', due_date:'', amount:'', reference_month:'', employee_name:'', gross_amount:'', deductions:'', net_amount:'' });
  const [payValue,setPayValue]=useState('');
  const remaining = (openPay? (openPay.amount - openPay.paid):0);
  useEffect(()=>{(async()=>{
    setLoading(true); setError(null);
    try {
      let q = (supabase as any).from(kind).select('*',{count:'exact'}).order('due_date' in ({} as any)?'due_date':'created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
      if (search) q = q.ilike(numberField,'%'+search+'%');
      if (status) q = q.eq('status',status);
      const { data, error, count } = await q;
      if (error) throw error;
      setRows(data||[]); setTotal(count||0);
    } catch(e:any){ setError(e.message);} finally { setLoading(false); }
  })();},[search,status,page,kind,numberField]);
  const totalPages = Math.max(1, Math.ceil(total/pageSize));

  async function handleCreate(){
    try {
      if (!form.description) return toast.error('Descrição obrigatória');
      if (!payroll && !form.due_date) return toast.error('Vencimento obrigatório');
      if (payroll && !form.reference_month) return toast.error('Ref mês obrigatório');
      let numberResp;
      if (kind==='payables') numberResp = await (supabase as any).rpc('next_payable_number');
      if (kind==='receivables') numberResp = await (supabase as any).rpc('next_receivable_number');
      if (kind==='payroll') numberResp = await (supabase as any).rpc('next_payroll_number');
      const numberVal = numberResp?.data;
      const payload:any = { [numberField]: numberVal, description: form.description };
      if (!payroll){ payload.due_date = form.due_date; payload.amount = Number(form.amount||0); }
      if (kind==='receivables'){ payload.received_amount=0; }
      if (kind==='payables'){ payload.paid_amount=0; }
      if (payroll){
        payload.reference_month=form.reference_month;
        payload.employee_name=form.employee_name||'Funcionário';
        payload.gross_amount=Number(form.gross_amount||0);
        payload.deductions=Number(form.deductions||0);
        payload.net_amount=Number(form.net_amount|| (Number(form.gross_amount||0)-Number(form.deductions||0)) );
      }
      const { error } = await (supabase as any).from(kind).insert(payload);
      if (error) throw error;
      toast.success('Criado');
      setOpenNew(false);
      setForm({ description:'', due_date:'', amount:'', reference_month:'', employee_name:'', gross_amount:'', deductions:'', net_amount:'' });
      // reload first page
      setPage(1); setSearch(''); setStatus('');
    } catch(e:any){ toast.error(e.message); }
  }

  async function handlePayment(){
    if (!openPay) return;
    const val = Number(payValue||0);
    if (val<=0) return toast.error('Valor inválido');
    if (val>remaining) return toast.error('Maior que saldo');
    try {
      const newPaid = openPay.paid + val;
      const fully = newPaid + 0.00001 >= openPay.amount; // tolerância
      const update:any = {};
      update[paidField] = newPaid;
      update.status = fully ? (kind==='receivables'?'RECEBIDO':'PAGO') : 'PARCIAL';
      if (fully) update[kind==='receivables'?'receipt_date':'payment_date'] = new Date().toISOString();
      const { error } = await (supabase as any).from(kind).update(update).eq('id',openPay.id);
      if (error) throw error;
      toast.success(fully?'Liquidado':'Baixa parcial registrada');
      setOpenPay(null); setPayValue('');
      // refresh current page
      setPage(p=>p); // trigger effect by changing dependency? We'll force reload by updating search dummy
      setSearch(s=>s);
    } catch(e:any){ toast.error(e.message); }
  }

  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">Listagem básica.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap text-xs">
        <Button size="sm" onClick={()=>setOpenNew(true)}>Novo</Button>
        <Input placeholder="Número" value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} className="w-32 h-8" />
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}} className="h-8 border rounded px-2">
          <option value="">Status</option>
          <option value="ABERTO">Aberto</option>
          <option value="PARCIAL">Parcial</option>
          <option value={kind==='receivables'?'RECEBIDO':'PAGO'}>{kind==='receivables'?'Recebido':'Pago'}</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <Button size="sm" variant="outline" onClick={()=>{setSearch('');setStatus('');setPage(1);}}>Limpar</Button>
      </div>
    </header>
    {error && <div className="text-sm text-red-500">{error}</div>}
    <div className="border rounded overflow-auto max-h-[500px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Número</th>{payroll && <th className="px-2 py-1 text-left">Ref</th>}<th className="px-2 py-1 text-left">Descrição</th><th className="px-2 py-1 text-left">Vencimento</th><th className="px-2 py-1 text-right">Valor</th><th className="px-2 py-1 text-right">Pago/Rec</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Ações</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Sem registros</td></tr>}
          {!loading && rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 font-medium">{r[numberField]}</td>
            {payroll && <td className="px-2 py-1">{r.reference_month}</td>}
            <td className="px-2 py-1 truncate max-w-[160px]">{r.description || r.employee_name}</td>
            <td className="px-2 py-1 whitespace-nowrap">{r.due_date? new Date(r.due_date).toLocaleDateString('pt-BR'): (r.payment_date? new Date(r.payment_date).toLocaleDateString('pt-BR'):'-')}</td>
            <td className="px-2 py-1 text-right">{Number(r[amountField]||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{Number(r[paidField]||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1">{r.status}</td>
            <td className="px-2 py-1">
              { !payroll && (r.status==='ABERTO' || r.status==='PARCIAL') && <Button size="sm" variant="outline" onClick={()=>setOpenPay({id:r.id, amount:Number(r[amountField]||0), paid:Number(r[paidField]||0), number:r[numberField]})}>Baixa</Button> }
              { payroll && r.status==='ABERTA' && <Button size="sm" variant="outline" onClick={async()=>{
                const { error } = await (supabase as any).from('payroll').update({ status:'PAGA', payment_date: new Date().toISOString() }).eq('id',r.id);
                if (error) toast.error(error.message); else { toast.success('Folha paga'); setPage(p=>p); }
              }}>Pagar</Button> }
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-center text-xs text-muted-foreground">
      <div>Página {page} de {totalPages} • {total} registros</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
      </div>
    </div>

    {/* Dialog Novo */}
    <Dialog open={openNew} onOpenChange={setOpenNew}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo {title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block mb-1 font-medium">Descrição</label>
            <Input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descrição" />
          </div>
          {!payroll && <div>
            <label className="block mb-1 font-medium">Vencimento</label>
            <Input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
          </div>}
          {!payroll && <div>
            <label className="block mb-1 font-medium">Valor</label>
            <Input type="number" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
          </div>}
          {payroll && <>
            <div>
              <label className="block mb-1 font-medium">Ref (YYYY-MM)</label>
              <Input value={form.reference_month} onChange={e=>setForm(f=>({...f,reference_month:e.target.value}))} placeholder="2025-08" />
            </div>
            <div>
              <label className="block mb-1 font-medium">Funcionário</label>
              <Input value={form.employee_name} onChange={e=>setForm(f=>({...f,employee_name:e.target.value}))} placeholder="Nome" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block mb-1 font-medium">Bruto</label>
                <Input type="number" step="0.01" value={form.gross_amount} onChange={e=>setForm(f=>({...f,gross_amount:e.target.value, net_amount: (Number(e.target.value||0)-Number(f.deductions||0)).toString()}))} />
              </div>
              <div>
                <label className="block mb-1 font-medium">Desc.</label>
                <Input type="number" step="0.01" value={form.deductions} onChange={e=>setForm(f=>({...f,deductions:e.target.value, net_amount: (Number(f.gross_amount||0)-Number(e.target.value||0)).toString()}))} />
              </div>
              <div>
                <label className="block mb-1 font-medium">Líquido</label>
                <Input type="number" step="0.01" value={form.net_amount} onChange={e=>setForm(f=>({...f,net_amount:e.target.value}))} />
              </div>
            </div>
          </>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpenNew(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog Baixa */}
    <Dialog open={!!openPay} onOpenChange={(o)=>{ if(!o) { setOpenPay(null); setPayValue(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Baixa {openPay?.number}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div>Saldo: {remaining.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          <div>
            <label className="block mb-1 font-medium">Valor a baixar</label>
            <Input type="number" step="0.01" value={payValue} onChange={e=>setPayValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>{setOpenPay(null); setPayValue('');}}>Cancelar</Button>
          <Button onClick={handlePayment}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

// Componente real de Ordens de Serviço integrado (placeholder removido)

// ===== Relatórios Placeholders =====
function BaseReportWrapper({ title, description, children, onExport, onExportXlsx }:{title:string; description:string; children:React.ReactNode; onExport?: ()=>void; onExportXlsx?:()=>void}) {
  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-start">
      <div>
        <h2 className="text-xl font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="ml-auto flex gap-2 items-center">
  <Button size="sm" variant="outline" onClick={() => onExport?.()}>CSV</Button>
  <Button size="sm" variant="outline" onClick={() => onExportXlsx?.()}>XLSX</Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button>
      </div>
    </header>
    {children}
    <div className="text-[10px] text-muted-foreground">Relatório resumido (MVP). Próximos passos: filtros avançados, agrupamentos, exportação XLSX/PDF.</div>
  </Card>;
}

function ReportStockFull(){
  // Relatório de estoque detalhado com filtros e métricas
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [filterCat,setFilterCat]=useState('');
  const [filterSector,setFilterSector]=useState('');
  const [filterSession,setFilterSession]=useState('');
  const [participationBase,setParticipationBase]=useState<'cost'|'sale'>('cost');
  const [sortField,setSortField]=useState<string>('category');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc');
  const LIMIT=1500;
  useEffect(()=>{(async()=>{
    setLoading(true);
    try {
      // Consulta composta juntando produtos + estoque + métricas
      // Como não há view pronta com custo médio e reservado, calculamos via subqueries.
      const filter = search ? `and (p.name ilike '%${search}%' or p.code ilike '%${search}%' or p.id ilike '%${search}%')` : '';
      // Usamos RPC via SQL raw (supabase-js não tem raw direta aqui; então montamos com .rpc custom? Como não temos função, fallback: múltiplas chamadas)
      // Simples abordagem: buscar produtos e depois enriquecer em JS com queries auxiliares (performance aceitável para MVP <=1500).
      let baseQ:any = (supabase as any).from('products').select('id, name, code, category, sector, session, cost_price, sale_price, price').limit(LIMIT).order('id');
      if(search) baseQ = baseQ.or(`name.ilike.%${search}%,code.ilike.%${search}%,id.ilike.%${search}%`);
      const { data: products, error: errP } = await baseQ;
      if(errP) throw errP;
      // Buscar estoque em lote
      const ids = (products||[]).map((p:any)=>p.id);
  const stockMap:Record<string,number>={};
      if(ids.length){
        const { data: stocks, error: errS } = await (supabase as any).from('product_stock').select('product_id,stock').in('product_id', ids);
        if(errS) throw errS; (stocks||[]).forEach((s:any)=> stockMap[s.product_id]=Number(s.stock||0));
      }
      // Calcular custo médio por produto (ponderado pelas entradas)
  const avgCostMap:Record<string,number>={};
      if(ids.length){
        const { data: moves, error: errM } = await (supabase as any).from('inventory_movements').select('product_id, type, quantity, unit_cost').in('product_id', ids);
        if(errM) throw errM;
        const acc:Record<string,{qty:number,total:number}>={};
        (moves||[]).forEach((m:any)=>{ if(m.type==='ENTRADA' && m.unit_cost!=null){ const q=Number(m.quantity||0); const c=Number(m.unit_cost||0); if(!acc[m.product_id]) acc[m.product_id]={qty:0,total:0}; acc[m.product_id].qty+=q; acc[m.product_id].total+= q*c; }});
        Object.entries(acc).forEach(([pid,v])=>{ if(v.qty>0) avgCostMap[pid]= v.total / v.qty; });
      }
      // Placeholder de reservas (não há tabela identificada). Valores = 0.
      const enriched = (products||[]).map((p:any)=>{
        const stock = stockMap[p.id]??0;
  const avg_cost = ((avgCostMap[p.id] ?? Number(p.cost_price||0)) || 0);
        const sale_price = (p.sale_price!=null? Number(p.sale_price): (p.price!=null? Number(p.price): null));
        const stock_positive = stock>0? stock:0;
        const stock_negative = stock<0? stock:0;
        const total_cost_value = +(stock * avg_cost).toFixed(2);
        const total_sale_value = sale_price!=null? +(stock * sale_price).toFixed(2): null;
        const reserved_qty = 0; // TODO: integrar reservas
        const reserved_total_cost = 0; const reserved_total_sale = 0;
        return { product_id: p.id, name: p.name, code: p.code, category: p.category, sector: p.sector, session: p.session, stock, stock_positive, stock_negative, avg_cost, sale_price, total_cost_value, total_sale_value, reserved_qty, reserved_total_cost, reserved_total_sale };
      });
      setRows(enriched);
    } catch(e:any){ toast.error(e.message); } finally { setLoading(false); }
  })();},[search]);
  // Aplicar filtros em memória
  let filtered = rows.filter(r=> (
    (!filterCat || r.category===filterCat) &&
    (!filterSector || r.sector===filterSector) &&
    (!filterSession || r.session===filterSession)
  ));
  // Ordenação
  filtered = [...filtered].sort((a,b)=>{
    const va = a[sortField]; const vb = b[sortField];
    if(va==null && vb!=null) return sortDir==='asc'? -1:1;
    if(va!=null && vb==null) return sortDir==='asc'? 1:-1;
    if(va==null && vb==null) return 0;
    if(typeof va==='number' && typeof vb==='number') return sortDir==='asc'? (va-vb):(vb-va);
    return sortDir==='asc'? String(va).localeCompare(String(vb)): String(vb).localeCompare(String(va));
  });
  const totalQtd = filtered.reduce((s:any,r:any)=> s + Number(r.stock||0),0);
  const totalCost = filtered.reduce((s:any,r:any)=> s + Number(r.total_cost_value||0),0);
  const totalSale = filtered.reduce((s:any,r:any)=> s + Number((r.total_sale_value||0)),0);
  const totalReserved = filtered.reduce((s:any,r:any)=> s + Number(r.reserved_qty||0),0);
  const [page,setPage]=useState(1); const pageSize = 100; const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page-1)*pageSize, page*pageSize);
  const cats = Array.from(new Set(rows.map(r=>r.category).filter(Boolean))).sort();
  const sectors = Array.from(new Set(rows.filter(r=>!filterCat || r.category===filterCat).map(r=>r.sector).filter(Boolean))).sort();
  const sessions = Array.from(new Set(rows.filter(r=>(!filterCat || r.category===filterCat) && (!filterSector || r.sector===filterSector)).map(r=>r.session).filter(Boolean))).sort();
  function exportStockCsv(){
    const friendly = filtered.map(r=> ({
      Categoria: r.category||'', Setor: r.sector||'', Sessao: r.session||'', Codigo: r.code||'', Produto: r.name||r.product_id,
      Estoque: r.stock, Estoque_Pos: r.stock_positive, Estoque_Neg: r.stock_negative,
      Custo_Medio: r.avg_cost, Preco_Venda: r.sale_price,
      Total_Custo: r.total_cost_value, Total_Venda: r.total_sale_value,
      Reservado: r.reserved_qty, Reservado_Total_Custo: r.reserved_total_cost, Reservado_Total_Venda: r.reserved_total_sale,
      Participacao_Percent: (participationBase==='cost'? (totalCost? +((r.total_cost_value/totalCost)*100).toFixed(2):0) : (totalSale? +(((r.total_sale_value||0)/totalSale)*100).toFixed(2):0)),
      Margem_Potencial: (r.total_sale_value!=null? +( (r.total_sale_value - r.total_cost_value) ).toFixed(2): null),
      Margem_Potencial_Pct: (r.total_sale_value? +(((r.total_sale_value - r.total_cost_value)/r.total_sale_value)*100).toFixed(2): null)
    })); exportCsv(friendly,'estoque_completo.csv'); }
  function exportStockXlsx(){
    const friendly = filtered.map(r=> ({
      Categoria: r.category||'', Setor: r.sector||'', Sessao: r.session||'', Codigo: r.code||'', Produto: r.name||r.product_id,
      Estoque: r.stock, Estoque_Pos: r.stock_positive, Estoque_Neg: r.stock_negative,
      Custo_Medio: r.avg_cost, Preco_Venda: r.sale_price,
      Total_Custo: r.total_cost_value, Total_Venda: r.total_sale_value,
      Reservado: r.reserved_qty, Reservado_Total_Custo: r.reserved_total_cost, Reservado_Total_Venda: r.reserved_total_sale,
      Participacao_Percent: (participationBase==='cost'? (totalCost? +((r.total_cost_value/totalCost)*100).toFixed(2):0) : (totalSale? +(((r.total_sale_value||0)/totalSale)*100).toFixed(2):0)),
      Margem_Potencial: (r.total_sale_value!=null? +( (r.total_sale_value - r.total_cost_value) ).toFixed(2): null),
      Margem_Potencial_Pct: (r.total_sale_value? +(((r.total_sale_value - r.total_cost_value)/r.total_sale_value)*100).toFixed(2): null)
    })); exportXlsx(friendly,'estoque_completo.xlsx'); }
  return <BaseReportWrapper title="Estoque Completo" description="Posição atual de estoque por produto (limite 1500 registros)" onExport={exportStockCsv} onExportXlsx={exportStockXlsx}>
    <div className="flex gap-2 mb-2 text-xs flex-wrap items-end">
      <Input placeholder="Produto" value={search} onChange={e=>setSearch(e.target.value)} className="w-40 h-8" />
      <Button size="sm" variant="outline" onClick={()=>setSearch('')}>Limpar</Button>
      <select className="h-8 border rounded px-2" value={filterCat} onChange={e=>{setFilterCat(e.target.value); setFilterSector(''); setFilterSession(''); setPage(1);}}>
        <option value="">Categoria</option>
        {cats.map(c=> <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="h-8 border rounded px-2" value={filterSector} onChange={e=>{setFilterSector(e.target.value); setFilterSession(''); setPage(1);}} disabled={cats.length===0 && !filterCat}>
        <option value="">Setor</option>
        {sectors.map(c=> <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="h-8 border rounded px-2" value={filterSession} onChange={e=>{setFilterSession(e.target.value); setPage(1);}} disabled={sectors.length===0 && !filterSector}>
        <option value="">Sessão</option>
        {sessions.map(c=> <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex gap-2 items-center">
        <label className="text-[10px] uppercase font-medium">Participação</label>
        <select className="h-8 border rounded px-2" value={participationBase} onChange={e=>setParticipationBase(e.target.value as any)}>
          <option value="cost">Base: Custo</option>
          <option value="sale">Base: Venda</option>
        </select>
      </div>
      <div className="ml-auto flex gap-4 font-medium text-[11px]">
        <span>SKUs: {rows.length}</span>
        <span>Total Estoque: {totalQtd}</span>
        <span>Valor Custo: {totalCost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        <span>Valor Venda: {totalSale.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        <span>Reservado: {totalReserved}</span>
      </div>
    </div>
    <div className="border rounded max-h-[480px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="px-2 py-1 text-left">Categoria</th>
            <th className="px-2 py-1 text-left">Setor</th>
            <th className="px-2 py-1 text-left">Sessão</th>
            <th className="px-2 py-1 text-left">Produto</th>
            <th className="px-2 py-1 text-right">Estoque</th>
            <th className="px-2 py-1 text-right">Est. +</th>
            <th className="px-2 py-1 text-right">Est. -</th>
            <th className="px-2 py-1 text-right">Custo Médio</th>
            <th className="px-2 py-1 text-right">Preço Venda</th>
            <th className="px-2 py-1 text-right">Total Custo</th>
            <th className="px-2 py-1 text-right">Total Venda</th>
            <th className="px-2 py-1 text-right">Reservado</th>
            <th className="px-2 py-1 text-right">Val. Res. Custo</th>
            <th className="px-2 py-1 text-right">Val. Res. Venda</th>
            <th className="px-2 py-1 text-right cursor-pointer" onClick={()=>{ setSortField('total_cost_value'); setSortDir(d=> sortField==='total_cost_value' && sortDir==='asc'? 'desc':'asc'); }}>Part. % {sortField==='total_cost_value' && (participationBase==='cost')? (sortDir==='asc'?'↑':'↓'):''}</th>
            <th className="px-2 py-1 text-right">Margem Pot.</th>
            <th className="px-2 py-1 text-right">Margem Pot. %</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={17} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && filtered.length===0 && <tr><td colSpan={17} className="text-center py-6 text-muted-foreground">Sem dados</td></tr>}
          {!loading && pageRows.map(r=> <tr key={r.product_id} className={`border-t ${r.stock<0? 'bg-red-50 dark:bg-red-900/20':''}`}>
            <td className="px-2 py-1" title={r.category}>{r.category||'-'}</td>
            <td className="px-2 py-1" title={r.sector}>{r.sector||'-'}</td>
            <td className="px-2 py-1" title={r.session}>{r.session||'-'}</td>
            <td className="px-2 py-1" title={r.name}>{r.code? r.code+' • ':''}{r.name||r.product_id}</td>
            <td className="px-2 py-1 text-right">{r.stock}</td>
            <td className="px-2 py-1 text-right">{r.stock_positive}</td>
            <td className="px-2 py-1 text-right text-red-600">{r.stock_negative}</td>
            <td className="px-2 py-1 text-right">{Number(r.avg_cost||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{r.sale_price!=null? Number(r.sale_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</td>
            <td className="px-2 py-1 text-right">{Number(r.total_cost_value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{r.total_sale_value!=null? Number(r.total_sale_value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</td>
            <td className="px-2 py-1 text-right">{r.reserved_qty}</td>
            <td className="px-2 py-1 text-right">{Number(r.reserved_total_cost||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{Number(r.reserved_total_sale||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{participationBase==='cost'
              ? (totalCost? ((r.total_cost_value/totalCost)*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—')
              : (totalSale? (((r.total_sale_value||0)/totalSale)*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—')}
            </td>
            <td className="px-2 py-1 text-right">{r.total_sale_value!=null? (r.total_sale_value - r.total_cost_value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</td>
            <td className="px-2 py-1 text-right">{r.total_sale_value? (((r.total_sale_value - r.total_cost_value)/r.total_sale_value)*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-center mt-2 text-[11px] text-muted-foreground">
      <span>Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
      </div>
    </div>
  </BaseReportWrapper>;
}

function ReportSalesFull(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(false);
  const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [status,setStatus]=useState(''); const [payStatus,setPayStatus]=useState('');
  useEffect(()=>{(async()=>{
    setLoading(true);
    try {
      const applyFilters = (query:any)=>{
        if (from) query = query.gte('created_at', from+'T00:00:00');
        if (to) query = query.lte('created_at', to+'T23:59:59');
        if (status) query = query.eq('status', status);
        if (payStatus) query = query.eq('payment_status', payStatus);
        return query;
      };
  const q = applyFilters((supabase as any).from('sales').select('created_at,total,sale_number,status,payment_status').order('created_at',{ascending:false}).limit(1000));
  const { data: initialData, error } = await q;
      if (error) {
        const msg = (error.message||'').toLowerCase();
        if (msg.includes('column') && msg.includes('total')) {
          // fallback: buscar subtotal/discount/freight e calcular total localmente
          const q2 = applyFilters((supabase as any).from('sales').select('created_at,subtotal,discount,freight,sale_number,status,payment_status').order('created_at',{ascending:false}).limit(1000));
          const { data: data2, error: err2 } = await q2;
            if (err2) throw err2;
          const calc = (r:any)=> ({...r, total: (Number(r.subtotal||0) - Number(r.discount||0) + Number(r.freight||0))});
          setRows((data2||[]).map(calc));
          toast.message('Coluna total ausente - usando cálculo local');
        } else throw error;
      } else {
  const enriched = (initialData||[]).map((r:any)=> r.total==null ? ({...r, total: (Number(r.subtotal||0) - Number(r.discount||0) + Number(r.freight||0))}) : r);
        setRows(enriched);
      }
    } catch(e:any){ toast.error(e.message);} finally { setLoading(false); }
  })();},[from,to,status,payStatus]);
  const total = rows.reduce((s:any,r:any)=> s + Number(r.total||0),0);
  const avg = rows.length? total/rows.length : 0;
  const [page,setPage]=useState(1); const pageSize=100; const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
  const pageRows = rows.slice((page-1)*pageSize, page*pageSize);
  // resumo mensal
  const monthly = rows.reduce((acc:any,r:any)=>{ const d=new Date(r.created_at); const k=d.getFullYear()+ '-' + String(d.getMonth()+1).padStart(2,'0'); acc[k]=(acc[k]||0)+ Number(r.total||0); return acc;},{});
  const monthlyEntries = Object.entries(monthly).sort().slice(-6); // últimos 6
  return <BaseReportWrapper title="Vendas Completo" description="Pedidos de venda consolidados (últimos 1000)" onExport={()=>exportCsv(rows,'vendas_completo.csv')} onExportXlsx={()=>exportXlsx(rows,'vendas_completo.xlsx')}>
    <div className="flex gap-2 mb-2 text-xs flex-wrap items-end">
      <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-8" />
      <Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-8" />
      <select value={status} onChange={e=>setStatus(e.target.value)} className="h-8 border rounded px-2">
        <option value="">Status</option>
        <option value="ABERTO">Aberto</option>
        <option value="FATURADO">Faturado</option>
        <option value="CANCELADO">Cancelado</option>
      </select>
      <select value={payStatus} onChange={e=>setPayStatus(e.target.value)} className="h-8 border rounded px-2">
        <option value="">Pagamento</option>
        <option value="PENDENTE">Pendente</option>
        <option value="PAGO">Pago</option>
        <option value="PARCIAL">Parcial</option>
      </select>
      <Button size="sm" variant="outline" onClick={()=>{setFrom('');setTo('');setStatus('');setPayStatus('');}}>Limpar</Button>
      <div className="ml-auto flex gap-4 font-medium text-[11px]">
        <span>Registros: {rows.length}</span>
        <span>Total: {total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        <span>Ticket Médio: {avg.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
      </div>
    </div>
    <div className="border rounded max-h-[480px] overflow-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/50 sticky top-0"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Pagamento</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem vendas</td></tr>}
          {!loading && pageRows.map(r=> <tr key={r.sale_number} className="border-t"><td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td><td className="px-2 py-1 font-medium">{r.sale_number}</td><td className="px-2 py-1 text-right">{Number(r.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-2 py-1">{r.status}</td><td className="px-2 py-1">{r.payment_status}</td></tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-start mt-2 flex-wrap gap-4">
      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
        <span>Página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
        </div>
      </div>
      <div className="text-[11px] bg-muted/40 rounded p-2 w-full md:w-auto">
        <div className="font-medium mb-1 flex items-center gap-1"><BarChart2 className="h-3 w-3"/>Últimos meses</div>
        <div className="h-28 w-full md:w-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyEntries.map(([m,v])=>({mes:m, valor:v}))}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="mes" tick={{fontSize:10}} />
              <YAxis tick={{fontSize:10}} width={48} />
              <ReTooltip formatter={(v)=> (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Bar dataKey="valor" fill="#2563eb" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </BaseReportWrapper>;
}

function ReportFinanceFull(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(false);
  const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [kind,setKind]=useState<'payables'|'receivables'>('payables');
  const [status,setStatus]=useState('');
  useEffect(()=>{(async()=>{
    setLoading(true);
    try {
      const table = kind; // payables | receivables
      let q = (supabase as any).from(table).select('*').order('due_date',{ascending:false}).limit(2000);
      if (from) q = q.gte('due_date', from);
      if (to) q = q.lte('due_date', to);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error; setRows(data||[]);
    } catch(e:any){ toast.error(e.message);} finally { setLoading(false); }
  })();},[from,to,kind,status]);
  const totalValor = rows.reduce((s:any,r:any)=> s + Number(r.amount||0),0);
  const totalPago = rows.reduce((s:any,r:any)=> s + Number((r.paid_amount||r.received_amount)||0),0);
  const totalAberto = totalValor - totalPago;
  const [page,setPage]=useState(1); const pageSize=120; const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
  const pageRows = rows.slice((page-1)*pageSize, page*pageSize);
  // agregação por mês
  const monthly = rows.reduce((acc:any,r:any)=>{ if(!r.due_date) return acc; const d=new Date(r.due_date); const k=d.getFullYear()+ '-' + String(d.getMonth()+1).padStart(2,'0'); acc[k]=(acc[k]||0)+ Number(r.amount||0); return acc;},{});
  const monthlyEntries = Object.entries(monthly).sort().slice(-6);
  return <BaseReportWrapper title="Financeiro Completo" description="Consolidado de contas a pagar/receber (limite 2000)" onExport={()=>exportCsv(rows,'financeiro_completo.csv')} onExportXlsx={()=>exportXlsx(rows,'financeiro_completo.xlsx')}>
    <div className="flex gap-2 mb-2 text-xs flex-wrap items-end">
      <select value={kind} onChange={e=>{setKind(e.target.value as any); setStatus('');}} className="h-8 border rounded px-2">
        <option value="payables">Contas a Pagar</option>
        <option value="receivables">Contas a Receber</option>
      </select>
      <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-8" />
      <Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-8" />
      <select value={status} onChange={e=>setStatus(e.target.value)} className="h-8 border rounded px-2">
        <option value="">Status</option>
        <option value="ABERTO">Aberto</option>
        <option value="PARCIAL">Parcial</option>
        <option value={kind==='payables'?'PAGO':'RECEBIDO'}>{kind==='payables'?'Pago':'Recebido'}</option>
        <option value="CANCELADO">Cancelado</option>
      </select>
      <Button size="sm" variant="outline" onClick={()=>{setFrom('');setTo('');setStatus('');}}>Limpar</Button>
      <div className="ml-auto flex gap-4 font-medium text-[11px] flex-wrap">
        <span>Valor: {totalValor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        <span>{kind==='payables'?'Pago':'Recebido'}: {totalPago.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        <span>Em Aberto: {totalAberto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
      </div>
    </div>
    <div className="border rounded max-h-[480px] overflow-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/50 sticky top-0"><tr><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Descrição</th><th className="px-2 py-1 text-left">Vencimento</th><th className="px-2 py-1 text-right">Valor</th><th className="px-2 py-1 text-right">Pago/Rec</th><th className="px-2 py-1 text-left">Status</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem registros</td></tr>}
          {!loading && pageRows.map(r=> <tr key={r.id} className="border-t"><td className="px-2 py-1 font-medium">{r.payable_number||r.receivable_number}</td><td className="px-2 py-1 truncate max-w-[180px]">{r.description}</td><td className="px-2 py-1 whitespace-nowrap">{r.due_date? new Date(r.due_date).toLocaleDateString('pt-BR'):'-'}</td><td className="px-2 py-1 text-right">{Number(r.amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-2 py-1 text-right">{Number((r.paid_amount||r.received_amount)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-2 py-1">{r.status}</td></tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-start mt-2 flex-wrap gap-4">
      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
        <span>Página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
        </div>
      </div>
      <div className="text-[11px] bg-muted/40 rounded p-2 w-full md:w-auto">
        <div className="font-medium mb-1 flex items-center gap-1"><BarChart2 className="h-3 w-3"/>Últimos meses</div>
        <div className="h-28 w-full md:w-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyEntries.map(([m,v])=>({mes:m, valor:v}))}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="mes" tick={{fontSize:10}} />
              <YAxis tick={{fontSize:10}} width={48} />
              <ReTooltip formatter={(v)=> (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Bar dataKey="valor" fill="#0f766e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </BaseReportWrapper>;
}

function exportCsv(rows:any[], filename:string){
  if (!rows || rows.length===0) { toast.message('Sem dados para exportar'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v:any)=> '"'+ String(v??'').replace(/"/g,'""') +'"';
  const csv = [headers.join(','), ...rows.map(r=> headers.map(h=>escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast.success('Exportado');
}

async function exportXlsx(rows:any[], filename:string){
  if (!rows || rows.length===0) { toast.message('Sem dados para exportar'); return; }
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    const wbout = XLSX.write(wb, { type:'array', bookType:'xlsx'});
    const blob = new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2500);
    toast.success('XLSX gerado');
  } catch(e:any){ toast.error(e.message); }
}

// ===== Dashboard de Relatórios =====
function ReportDashboard(){
  const [range,setRange]=useState<{from:string;to:string}>({from:'',to:''});
  const [loading,setLoading]=useState(false);
  const [kpi,setKpi]=useState<{vendas:number; pedidos:number; ticket:number; receber:number; pagar:number; saldo:number}>({vendas:0,pedidos:0,ticket:0,receber:0,pagar:0,saldo:0});
  const [topClientes,setTopClientes]=useState<any[]>([]);
  const [erro,setErro]=useState<string|null>(null);
  useEffect(()=>{(async()=>{
    setLoading(true); setErro(null);
    try {
      const from = range.from? range.from+'T00:00:00' : undefined;
      const to = range.to? range.to+'T23:59:59' : undefined;
      // vendas
      const applySaleFilters = (q:any)=>{ if (from) q = q.gte('created_at', from); if (to) q = q.lte('created_at', to); return q; };
  const qSales = applySaleFilters((supabase as any).from('sales').select('total,created_at,client_snapshot').limit(5000));
  const { data: salesData, error: salesErr } = await qSales;
  let salesDataLocal:any[]|null = salesData || [];
      if (salesErr) {
        const msg = (salesErr.message||'').toLowerCase();
        if (msg.includes('column') && msg.includes('total')) {
          // refaz query pegando subtotal/discount/freight
          const q2 = applySaleFilters((supabase as any).from('sales').select('subtotal,discount,freight,created_at,client_snapshot').limit(5000));
          const { data: s2, error: e2 } = await q2; if (e2) throw e2;
          salesDataLocal = (s2||[]).map((r:any)=> ({...r, total: (Number(r.subtotal||0)-Number(r.discount||0)+Number(r.freight||0))}));
          toast.message('Dashboard: coluna total ausente - cálculo local');
        } else throw salesErr;
      }
  const totalVendas = (salesDataLocal||[]).reduce((s:any,r:any)=> s + Number(r.total|| (Number(r.subtotal||0)-Number(r.discount||0)+Number(r.freight||0))),0);
  const pedidos = (salesDataLocal||[]).length;
      const ticket = pedidos? totalVendas/pedidos:0;
      // contas a receber
      let qRec = (supabase as any).from('receivables').select('amount,received_amount,created_at').limit(5000);
      if (from) qRec = qRec.gte('created_at', from); if (to) qRec = qRec.lte('created_at', to);
      const { data: recData } = await qRec;
      const receber = (recData||[]).reduce((s:any,r:any)=> s + (Number(r.amount||0) - Number(r.received_amount||0)),0);
      // contas a pagar
      let pagar = 0;
      try {
        let qPay = (supabase as any).from('payables').select('amount,paid_amount,created_at').limit(5000);
        if (from) qPay = qPay.gte('created_at', from); if (to) qPay = qPay.lte('created_at', to);
        const { data: payData, error: payErr } = await qPay;
        if (payErr) {
          const msg = (payErr.message||'').toLowerCase();
          if (msg.includes('payables')) {
            toast.message('Tabela payables ausente - KPI Pagar = 0');
          } else throw payErr;
        } else {
          pagar = (payData||[]).reduce((s:any,r:any)=> s + (Number(r.amount||0) - Number(r.paid_amount||0)),0);
        }
      } catch(inner:any){ console.warn('Falha payables', inner); }
      const saldo = receber - pagar;
      // top clientes por total (client_snapshot name)
      const mapa:any = {};
  (salesDataLocal||[]).forEach((r:any)=>{ let nome='-'; if(r.client_snapshot && typeof r.client_snapshot==='object'){ nome = (r.client_snapshot as any).name||(r.client_snapshot as any).company_name||'-'; } mapa[nome]=(mapa[nome]||0)+ Number(r.total||0); });
  const top = Object.entries(mapa).map(([cliente,valor])=>({cliente,valor:Number(valor)||0})).sort((a,b)=> (b.valor||0) - (a.valor||0)).slice(0,10);
      setTopClientes(top);
      setKpi({vendas:totalVendas,pedidos, ticket, receber, pagar, saldo});
    } catch(e:any){ setErro(e.message); } finally { setLoading(false); }
  })();},[range.from,range.to]);
  return <Card className="p-6 space-y-6">
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Dashboard de KPIs</h2>
        <p className="text-sm text-muted-foreground">Visão consolidada (limite 5000 registros por conjunto).</p>
      </div>
      <div className="flex gap-2 ml-auto text-xs items-end">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-medium">De</label>
          <Input type="date" value={range.from} onChange={e=>setRange(r=>({...r,from:e.target.value}))} className="h-8" />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-medium">Até</label>
          <Input type="date" value={range.to} onChange={e=>setRange(r=>({...r,to:e.target.value}))} className="h-8" />
        </div>
        <Button size="sm" variant="outline" onClick={()=>setRange({from:'',to:''})}>Limpar</Button>
      </div>
    </div>
    {erro && <div className="text-sm text-red-500">{erro}</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard label="Total Vendas" value={kpi.vendas} currency />
      <KpiCard label="Pedidos" value={kpi.pedidos} />
      <KpiCard label="Ticket Médio" value={kpi.ticket} currency />
      <KpiCard label="A Receber" value={kpi.receber} currency />
      <KpiCard label="A Pagar" value={kpi.pagar} currency />
      <KpiCard label="Saldo (Receber - Pagar)" value={kpi.saldo} currency highlight={kpi.saldo>=0} />
    </div>
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">Top 10 Clientes (Total Vendas)</h3>
      <div className="border rounded overflow-auto max-h-72">
        <table className="w-full text-xs">
          <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Cliente</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-right">%</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
            {!loading && topClientes.length===0 && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados</td></tr>}
            {!loading && topClientes.map(c=> <tr key={c.cliente} className="border-t"><td className="px-2 py-1 truncate max-w-[180px]" title={c.cliente}>{c.cliente}</td><td className="px-2 py-1 text-right">{Number(c.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-2 py-1 text-right">{kpi.vendas? ((c.valor/kpi.vendas)*100).toFixed(1)+'%':'-'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </Card>;
}

function KpiCard({label,value,currency,highlight}:{label:string; value:number; currency?:boolean; highlight?:boolean}){
  return <div className={`p-4 rounded border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-sm flex flex-col gap-1 ${highlight? 'border-emerald-500/40 ring-1 ring-emerald-500/30':''}`}> 
    <div className="text-[11px] uppercase font-medium text-slate-500 tracking-wide">{label}</div>
    <div className={`text-lg font-semibold ${highlight? 'text-emerald-600 dark:text-emerald-400':''}`}>{currency? value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}): value.toLocaleString('pt-BR')}</div>
  </div>;
}

// ===== Pedidos de Vendas (Placeholder) =====
function SalesOrdersList(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState<string|null>(null);
  useEffect(()=>{(async()=>{
    setLoading(true); setErro(null);
    try {
      // Tenta obter principais colunas; adapta se faltar
  const q = (supabase as any).from('sales').select('id, created_at, client_id, total').order('created_at',{ascending:false}).limit(200);
  const { data, error } = await q;
      if(error){
        const msg=(error.message||'').toLowerCase();
        if(msg.includes('column') && msg.includes('total')){
          // fallback calculando localmente
          const q2 = (supabase as any).from('sales').select('id, created_at, client_id, subtotal, discount, freight').order('created_at',{ascending:false}).limit(200);
      const r2 = await q2; if(r2.error) throw r2.error; const dataFallback = (r2.data||[]).map((r:any)=> ({...r,total: Number(r.subtotal||0)-Number(r.discount||0)+Number(r.freight||0)}));
      setRows(dataFallback||[]);
      toast.message('SalesOrders: coluna total ausente - cálculo local');
      return;
        } else throw error;
      }
  setRows(data||[]);
    } catch(e:any){ setErro(e.message); }
    finally{ setLoading(false); }
  })();},[]);
  return <Card className="p-6 space-y-4">
    <div className="flex items-center gap-2">
      <h2 className="text-xl font-semibold flex-1">Pedidos de Vendas</h2>
      <Button size="sm" onClick={()=>toast.message('Novo pedido (futuro)')}>Novo Pedido</Button>
    </div>
    {erro && <div className="text-sm text-red-500">{erro}</div>}
    <div className="border rounded overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Cliente</th><th className="px-2 py-1 text-right">Total</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum pedido</td></tr>}
          {!loading && rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={()=>toast.message('Abrir pedido '+r.id)}><td className="px-2 py-1">{r.id}</td><td className="px-2 py-1">{new Date(r.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td className="px-2 py-1">{r.client_id||'-'}</td><td className="px-2 py-1 text-right">{Number(r.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>)}
        </tbody>
      </table>
    </div>
  </Card>;
}

// ===== Pedidos de Serviços (Placeholder) =====
function ServiceSalesOrdersList(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{(async()=>{
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from('service_sales_orders').select('id, created_at, client_id, total').order('created_at',{ascending:false}).limit(200);
      if(error) throw error;
      setRows(data||[]);
    } catch(e:any){ toast.error(e.message); }
    finally{ setLoading(false); }
  })();},[]);
  return <Card className="p-6 space-y-4">
    <div className="flex items-center gap-2">
      <h2 className="text-xl font-semibold flex-1">Pedidos de Serviços</h2>
      <Button size="sm" onClick={()=>toast.message('Novo pedido serviço (futuro)')}>Novo Pedido</Button>
    </div>
    <div className="border rounded overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Cliente</th><th className="px-2 py-1 text-right">Total</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum pedido</td></tr>}
          {!loading && rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={()=>toast.message('Abrir pedido '+r.id)}><td className="px-2 py-1">{r.id}</td><td className="px-2 py-1">{new Date(r.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td className="px-2 py-1">{r.client_id||'-'}</td><td className="px-2 py-1 text-right">{Number(r.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>)}
        </tbody>
      </table>
    </div>
  </Card>;
}
