import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Building2 } from "lucide-react";

export default function Configuracoes() {
  const openProfile = () => {
    try {
      const ev = new Event('open-profile-settings');
      window.dispatchEvent(ev);
    } catch {
      /* noop */
    }
  };
  const openCompany = () => {
    try {
      const ev = new Event('open-company-settings');
      window.dispatchEvent(ev);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="min-h-screen gradient-hero">
      <NexusProtectedHeader />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-4">Configuração</h1>
        <p className="text-sm text-muted-foreground mb-6">Gerencie suas informações de perfil e os dados da empresa.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="h-12 w-12 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
              <User className="h-6 w-6" />
            </div>
            <div className="font-medium">Perfil do Usuário</div>
            <div className="text-sm text-muted-foreground">Atualize seu nome, telefone e email.</div>
            <div className="mt-3">
              <Button size="sm" onClick={openProfile}>Editar Perfil</Button>
            </div>
          </Card>
          <Card className="p-4">
            <div className="h-12 w-12 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="font-medium">Empresa</div>
            <div className="text-sm text-muted-foreground">Edite os dados da empresa e endereço.</div>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={openCompany}>Configurar Empresa</Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
