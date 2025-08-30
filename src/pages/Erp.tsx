import { NexusProtectedHeader } from '@/components/NexusProtectedHeader';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Users, Truck, Boxes, Settings2, Tags } from 'lucide-react';
import { ErpSuppliers } from '@/components/erp/ErpSuppliers';
import { ErpCarriers } from '@/components/erp/ErpCarriers';
import { ErpClients } from '@/components/erp/ErpClients';
import { Card } from '@/components/ui/card';

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

function StockPlaceholder() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">Estoque</h2>
      <p className="text-sm text-muted-foreground mb-4">Movimentações (inventory_movements) e posição atual (view product_stock). Implementar: filtros por produto, data, tipo; lançamento rápido de entrada/saída; ajuste com motivo.</p>
      <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
        <li>Entrada: registra quantidade e custo unitário</li>
        <li>Saída: originada por venda/pedido (automatizar posteriormente)</li>
        <li>Ajuste: positivo/negativo com motivo (inventário, perda, quebra)</li>
      </ul>
    </Card>
  );
}

function LabelsPlaceholder() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">Etiquetas / Códigos</h2>
      <p className="text-sm text-muted-foreground mb-4">Gerar e armazenar códigos de barras (EAN13, Code128) e QR Codes para produtos em product_labels.</p>
      <div className="text-xs text-muted-foreground">Próximo passo: escolher lib (ex: jsbarcode + qrcode) e permitir lote de impressão baseado no estoque.</div>
    </Card>
  );
}
