import { NexusProtectedHeader } from '@/components/NexusProtectedHeader';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Users, Truck, Boxes, Settings2, Tags } from 'lucide-react';

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
              {section === 'clients' && <SectionPlaceholder title="Clientes" description="Cadastro completo de clientes (usar tabela existente)." />}
              {section === 'suppliers' && <SectionPlaceholder title="Fornecedores" description="Cadastro de fornecedores com documentos fiscais e contatos." />}
              {section === 'carriers' && <SectionPlaceholder title="Transportadoras" description="Cadastro de transportadoras com RNTRC e tipos de veículos." />}
              {section === 'products' && <SectionPlaceholder title="Produtos" description="Catálogo completo com tributação, variações e preços." />}
              {section === 'stock' && <SectionPlaceholder title="Estoque" description="Movimentações de entrada/saída e posição atual." />}
              {section === 'labels' && <SectionPlaceholder title="Etiquetas / Códigos" description="Geração de códigos de barras e QR Codes para produtos." />}
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
