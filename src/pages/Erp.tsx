import { NexusProtectedHeader } from '@/components/NexusProtectedHeader';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Users, Truck, Boxes, Settings2, Tags, Plus, RefreshCcw, FolderTree, Percent, Layers, Ruler, Wrench, FileText, ShoppingCart } from 'lucide-react';
// Ícone simples para trocas/devoluções (setas circulares)
const RotateIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 6.76 5.36L1 10" /><path d="M3.51 15A9 9 0 0 0 17.24 18.64L23 14" /></svg>;
import { ErpSuppliers } from '@/components/erp/ErpSuppliers';
import { ErpCarriers } from '@/components/erp/ErpCarriers';
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
  | 'product_units'
  | 'product_variations'
  | 'product_labels'
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
  | 'fin_payroll';

export default function Erp() {
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [quotesCount, setQuotesCount] = useState<number>(0);

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

  // Mantemos seção acessível mesmo sem orçamentos (apenas mostra vazio)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <NexusProtectedHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white/90 backdrop-blur-sm dark:bg-slate-800/80 flex flex-col">
          <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulo ERP</div>
          <nav className="flex-1 px-2 space-y-1 text-sm">
            <ErpNavItem icon={<Boxes className='h-4 w-4' />} label="Visão Geral" active={section==='dashboard'} onClick={()=>setSection('dashboard')} />
            <div className="mt-3 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <FolderTree className="h-3.5 w-3.5" />
              <span>Cadastro</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Users className='h-4 w-4' />} label="Clientes" active={section==='clients'} onClick={()=>setSection('clients')} />
              <ErpNavItem icon={<Users className='h-4 w-4' />} label="Fornecedores" active={section==='suppliers'} onClick={()=>setSection('suppliers')} />
              <ErpNavItem icon={<Truck className='h-4 w-4' />} label="Transportadoras" active={section==='carriers'} onClick={()=>setSection('carriers')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Package className="h-3.5 w-3.5" />
              <span>Produtos</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Package className='h-4 w-4' />} label="Gerenciar Produtos" active={section==='products_manage'} onClick={()=>setSection('products_manage')} />
              <ErpNavItem icon={<Percent className='h-4 w-4' />} label="Valores de Vendas" active={section==='products_pricing'} onClick={()=>setSection('products_pricing')} />
              <ErpNavItem icon={<FolderTree className='h-4 w-4' />} label="Grupos de Produtos" active={section==='product_groups'} onClick={()=>setSection('product_groups')} />
              <ErpNavItem icon={<Ruler className='h-4 w-4' />} label="Unidades" active={section==='product_units'} onClick={()=>setSection('product_units')} />
              <ErpNavItem icon={<Layers className='h-4 w-4' />} label="Grades / Variações" active={section==='product_variations'} onClick={()=>setSection('product_variations')} />
              <ErpNavItem icon={<Tags className='h-4 w-4' />} label="Etiquetas / Códigos" active={section==='product_labels'} onClick={()=>setSection('product_labels')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Settings2 className="h-3.5 w-3.5" />
              <span>Operação</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Settings2 className='h-4 w-4' />} label="Estoque" active={section==='stock'} onClick={()=>setSection('stock')} />
              <ErpNavItem icon={<Wrench className='h-4 w-4' />} label="Serviços" active={section==='services'} onClick={()=>setSection('services')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Boxes className="h-3.5 w-3.5" />
              <span>Estoque</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<Boxes className='h-4 w-4' />} label="Movimentações" active={section==='stock_movements'} onClick={()=>setSection('stock_movements')} />
              <ErpNavItem icon={<RefreshCcw className='h-4 w-4' />} label="Ajustes" active={section==='stock_adjustments'} onClick={()=>setSection('stock_adjustments')} />
              <ErpNavItem icon={<Truck className='h-4 w-4' />} label="Transferências" active={section==='stock_transfers'} onClick={()=>setSection('stock_transfers')} />
              <ErpNavItem icon={<RotateIcon /> as any} label="Trocas / Devoluções" active={section==='stock_returns'} onClick={()=>setSection('stock_returns')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              <span>Orçamentos</span>
              <span className="ml-auto text-[9px] font-normal text-slate-400">{quotesCount}</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Listar Orçamentos" active={section==='budgets'} onClick={()=>setSection('budgets')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Listar Ordens de Serviços" active={section==='service_orders'} onClick={()=>setSection('service_orders')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Vendas</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Pedidos de Vendas" active={section==='sales_orders'} onClick={()=>setSection('sales_orders')} />
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Pedidos de Serviços" active={section==='service_sales_orders'} onClick={()=>setSection('service_sales_orders')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Compras</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<ShoppingCart className='h-4 w-4' />} label="Lançamento de Compra" active={section==='purchases_list'} onClick={()=>setSection('purchases_list')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Gerar via XML" active={section==='purchases_xml'} onClick={()=>setSection('purchases_xml')} />
              <ErpNavItem icon={<RotateIcon /> as any} label="Troca / Devolução" active={section==='purchases_returns'} onClick={()=>setSection('purchases_returns')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Histórico de Compras" active={section==='purchases_history'} onClick={()=>setSection('purchases_history')} />
            </div>
            <div className="mt-5 mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              <span>Financeiro</span>
            </div>
            <div className="space-y-1 pl-1 border-l border-slate-200 dark:border-slate-700 ml-2">
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Contas a Pagar" active={section==='fin_payables'} onClick={()=>setSection('fin_payables')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Contas a Receber" active={section==='fin_receivables'} onClick={()=>setSection('fin_receivables')} />
              <ErpNavItem icon={<FileText className='h-4 w-4' />} label="Folha de Pagamento" active={section==='fin_payroll'} onClick={()=>setSection('fin_payroll')} />
            </div>
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
              {section === 'products_manage' && <ProductsManagePlaceholder />}
              {section === 'products_pricing' && <ProductsPricingPlaceholder />}
              {section === 'product_groups' && <ProductGroupsPlaceholder />}
              {section === 'product_units' && <ProductUnitsPlaceholder />}
              {section === 'product_variations' && <ProductVariationsPlaceholder />}
              {section === 'product_labels' && <ProductLabelsPlaceholder />}
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
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

function SalesOrdersList(){
  const [rows,setRows]=useState<Tables<'sales'>[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [payStatus,setPayStatus]=useState('');
  const [page,setPage]=useState(1); const pageSize=20; const [total,setTotal]=useState(0);
  useEffect(()=>{(async()=>{
    setLoading(true); setError(null);
    try {
      let q = (supabase as any).from('sales').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*pageSize, page*pageSize-1);
      if (search) q = q.ilike('sale_number','%'+search+'%');
      if (status) q = q.eq('status',status);
      if (payStatus) q = q.eq('payment_status',payStatus);
      const { data, error, count } = await q;
      if (error) throw error;
      setRows(data||[]); setTotal(count||0);
    } catch(e:any){ setError(e.message);} finally { setLoading(false); }
  })();},[search,status,payStatus,page]);
  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pedidos de Vendas</h2>
        <p className="text-sm text-muted-foreground">Pedidos confirmados de produtos.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap text-xs">
        <Input placeholder="Número" value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} className="w-32 h-8" />
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}} className="h-8 border rounded px-2">
          <option value="">Status</option>
          <option value="ABERTO">Aberto</option>
          <option value="FATURADO">Faturado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <select value={payStatus} onChange={e=>{setPage(1);setPayStatus(e.target.value);}} className="h-8 border rounded px-2">
          <option value="">Pagamento</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
          <option value="PARCIAL">Parcial</option>
        </select>
        <Button size="sm" variant="outline" onClick={()=>{setSearch('');setStatus('');setPayStatus('');setPage(1);}}>Limpar</Button>
      </div>
    </header>
    {error && <div className="text-sm text-red-500">{error}</div>}
    <div className="border rounded overflow-auto max-h-[500px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Pagamento</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-left">Cliente</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem pedidos</td></tr>}
          {!loading && rows.map(r=> {
            let clientName='-';
            if (r.client_snapshot && typeof r.client_snapshot === 'object' && !Array.isArray(r.client_snapshot)) {
              const snap = r.client_snapshot as any;
              clientName = snap.name || snap.company_name || '-';
            }
            return <tr key={r.id} className="border-t hover:bg-muted/40">
              <td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
              <td className="px-2 py-1 font-medium">{r.sale_number}</td>
              <td className="px-2 py-1">{r.status}</td>
              <td className="px-2 py-1">{r.payment_status}</td>
              <td className="px-2 py-1 text-right">{Number(r.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
              <td className="px-2 py-1 truncate max-w-[160px]" title={clientName}>{clientName}</td>
            </tr>})}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-center text-xs text-muted-foreground">
      <span>Página {page} de {totalPages} • {total} registros</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
      </div>
    </div>
  </Card>;
}

function ServiceSalesOrdersList(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [status,setStatus]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1); const pageSize=15; const [total,setTotal]=useState(0);
  useEffect(()=>{(async()=>{
    setLoading(true); setError(null);
    try {
      let q = (supabase as any).from('service_orders').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1).not('service_sale_id','is',null);
      if (status) q = q.eq('status',status);
      if (search) q = q.ilike('number','%'+search+'%');
      const { data, error, count } = await q;
      if (error) throw error;
      setRows(data||[]); setTotal(count||0);
    } catch(e:any){ setError(e.message);} finally { setLoading(false); }
  })();},[status,search,page]);
  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pedidos de Serviços</h2>
        <p className="text-sm text-muted-foreground">OS faturadas / vinculadas a pedido de serviço.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap text-xs">
        <Input placeholder="Número" value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} className="w-32 h-8" />
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}} className="h-8 border rounded px-2">
          <option value="">Status</option>
          <option value="ABERTA">Aberta</option>
          <option value="EM_EXECUCAO">Em Execução</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <Button size="sm" variant="outline" onClick={()=>{setSearch('');setStatus('');setPage(1);}}>Limpar</Button>
      </div>
    </header>
    {error && <div className="text-sm text-red-500">{error}</div>}
    <div className="border rounded overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Data</th><th className="px-2 py-1 text-left">Número</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Total</th><th className="px-2 py-1 text-left">Pedido Serviço</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem pedidos de serviço</td></tr>}
          {!loading && rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
            <td className="px-2 py-1 font-medium">{r.number}</td>
            <td className="px-2 py-1">{r.status}</td>
            <td className="px-2 py-1">{r.total? Number(r.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-'}</td>
            <td className="px-2 py-1 text-xs">{r.service_sale_id || '-'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between items-center text-xs text-muted-foreground">
      <span>Página {page} de {totalPages} • {total} registros</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
      </div>
    </div>
  </Card>;
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

// ===== Placeholders Produtos =====
function ProductsManagePlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Gerenciar Produtos</h2><p className="text-sm text-muted-foreground mb-4">CRUD completo, tributação, status e sincronização futura.</p><div className="flex gap-2 mb-4"><Button size="sm" onClick={()=>toast.message('Novo Produto')}>Novo</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Importação CSV')}>Importar</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Sincronizar Tributos')}>Sync Tributos</Button></div><div className="text-xs text-muted-foreground">Tabela de produtos será renderizada aqui...</div></Card>;}
function ProductsPricingPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Valores de Vendas</h2><p className="text-sm text-muted-foreground mb-4">Gerir margens e listas de preço.</p><div className="flex gap-2 mb-4"><Button size="sm" onClick={()=>toast.message('Cadastrar Margem')}>Margem</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Recalcular Preços')}>Recalcular</Button></div><div className="text-xs text-muted-foreground">Tabela de preços será exibida...</div></Card>;}
function ProductGroupsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Grupos de Produtos</h2><p className="text-sm text-muted-foreground mb-4">Organize hierarquias.</p><Button size="sm" onClick={()=>toast.message('Novo Grupo')}>Novo Grupo</Button><div className="mt-4 text-xs text-muted-foreground">Lista/árvore de grupos...</div></Card>;}
function ProductUnitsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Unidades</h2><p className="text-sm text-muted-foreground mb-4">Cadastro de unidades comerciais.</p><Button size="sm" onClick={()=>toast.message('Nova Unidade')}>Nova Unidade</Button><div className="mt-4 text-xs text-muted-foreground">Tabela de unidades...</div></Card>;}
function ProductVariationsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Grades / Variações</h2><p className="text-sm text-muted-foreground mb-4">Gerencie SKUs por atributos.</p><Button size="sm" onClick={()=>toast.message('Nova Grade')}>Nova Grade</Button><div className="mt-4 text-xs text-muted-foreground">Configuração de atributos e geração de variações...</div></Card>;}
function ProductLabelsPlaceholder(){return <Card className="p-6"><h2 className="text-xl font-semibold mb-2">Etiquetas / Códigos</h2><p className="text-sm text-muted-foreground mb-4">Geração de códigos de barras e QR.</p><div className="flex gap-2 mb-4"><Button size="sm" onClick={()=>toast.message('Gerar Etiqueta')}>Gerar</Button><Button size="sm" variant="outline" onClick={()=>toast.message('Gerar em Lote')}>Lote</Button></div><div className="text-xs text-muted-foreground">Lista de etiquetas geradas...</div></Card>;}
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
  return <Card className="p-6 space-y-4">
    <header className="flex flex-wrap gap-3 items-end">
      <div>
        <h2 className="text-xl font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">Listagem básica.</p>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap text-xs">
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
        <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Número</th>{payroll && <th className="px-2 py-1 text-left">Ref</th>}<th className="px-2 py-1 text-left">Descrição</th><th className="px-2 py-1 text-left">Vencimento</th><th className="px-2 py-1 text-right">Valor</th><th className="px-2 py-1 text-right">Pago/Rec</th><th className="px-2 py-1 text-left">Status</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sem registros</td></tr>}
          {!loading && rows.map(r=> <tr key={r.id} className="border-t hover:bg-muted/40">
            <td className="px-2 py-1 font-medium">{r[numberField]}</td>
            {payroll && <td className="px-2 py-1">{r.reference_month}</td>}
            <td className="px-2 py-1 truncate max-w-[160px]">{r.description || r.employee_name}</td>
            <td className="px-2 py-1 whitespace-nowrap">{r.due_date? new Date(r.due_date).toLocaleDateString('pt-BR'): (r.payment_date? new Date(r.payment_date).toLocaleDateString('pt-BR'):'-')}</td>
            <td className="px-2 py-1 text-right">{Number(r[amountField]||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1 text-right">{Number(r[paidField]||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
            <td className="px-2 py-1">{r.status}</td>
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
  </Card>;
}

// Componente real de Ordens de Serviço integrado (placeholder removido)
