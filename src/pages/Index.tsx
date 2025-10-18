import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Building2, ShoppingCart, Sparkles } from "lucide-react";

export default function Index() {
  const { user, profile } = useAuth();
  const displayName = profile?.first_name || user?.email || "Usuário";

  return (
    <div className="min-h-screen gradient-hero">
      <NexusProtectedHeader />
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Olá, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma opção para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/orcamento" className="group">
            <Card className="p-4 h-full transition hover:shadow-md">
              <div className="h-12 w-12 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <div className="font-medium">Orçamento</div>
              <div className="text-sm text-muted-foreground">
                Criar, editar e compartilhar orçamentos.
              </div>
              <div className="mt-3">
                <Button size="sm" className="transition group-hover:translate-x-0.5">Abrir</Button>
              </div>
            </Card>
          </Link>

          <Link to="/erp" className="group">
            <Card className="p-4 h-full transition hover:shadow-md">
              <div className="h-12 w-12 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="font-medium">ERP</div>
              <div className="text-sm text-muted-foreground">
                Gestão completa: estoque, vendas, compras e mais.
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="transition group-hover:translate-x-0.5">Ir para ERP</Button>
              </div>
            </Card>
          </Link>

          {/* Novo card: Configuração (atalho para área de configurações dentro do ERP) */}
          <Link to="/erp" className="group">
            <Card className="p-4 h-full transition hover:shadow-md">
              <div className="h-12 w-12 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="font-medium">Configuração</div>
              <div className="text-sm text-muted-foreground">
                Acesse permissões, usuários e empresas.
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="transition group-hover:translate-x-0.5">Abrir Configurações</Button>
              </div>
            </Card>
          </Link>

          <Link to="/pdv" className="group">
            <Card className="p-4 h-full transition hover:shadow-md">
              <div className="h-12 w-12 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="font-medium">PDV</div>
              <div className="text-sm text-muted-foreground">
                Frente de caixa rápido para vendas presenciais.
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="transition group-hover:translate-x-0.5">Abrir PDV</Button>
              </div>
            </Card>
          </Link>

          <Link to="/ai" className="group">
            <Card className="p-4 h-full transition hover:shadow-md">
              <div className="h-12 w-12 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="font-medium">API de IA</div>
              <div className="text-sm text-muted-foreground">
                Ferramentas inteligentes para acelerar seu trabalho.
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="transition group-hover:translate-x-0.5">Explorar</Button>
              </div>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
