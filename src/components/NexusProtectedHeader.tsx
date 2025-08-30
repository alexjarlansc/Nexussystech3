import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { LogOut, Settings, User, Building2, Key, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function NexusProtectedHeader() {
  const { user, profile, company, signOut, updateProfile, updateCompany, generateInviteCode, getInviteCodes } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [openCompany, setOpenCompany] = useState(false);
  const [openInvites, setOpenInvites] = useState(false);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);

  // Profile form
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');

  // Company form
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [cnpjCpf, setCnpjCpf] = useState(company?.cnpj_cpf || '');
  const [companyPhone, setCompanyPhone] = useState(company?.phone || '');
  const [companyEmail, setCompanyEmail] = useState(company?.email || '');
  const [address, setAddress] = useState(company?.address || '');

  const handleUpdateProfile = async () => {
    const { error } = await updateProfile({
      first_name: firstName,
      phone,
      email,
    });

    if (error) {
      toast.error('Erro ao atualizar perfil');
    } else {
      toast.success('Perfil atualizado com sucesso');
      setOpenProfile(false);
    }
  };

  const handleUpdateCompany = async () => {
    const { error } = await updateCompany({
      name: companyName,
      cnpj_cpf: cnpjCpf,
      phone: companyPhone,
      email: companyEmail,
      address,
    });

    if (error) {
      toast.error('Erro ao atualizar empresa');
    } else {
      toast.success('Empresa atualizada com sucesso');
      setOpenCompany(false);
    }
  };

  const handleGenerateInvite = async (role: 'user' | 'admin') => {
    const { code, error } = await generateInviteCode(role);

    if (error) {
      toast.error('Erro ao gerar código de convite');
    } else if (code) {
      toast.success(`Código gerado: ${code}`);
      loadInviteCodes();
    }
  };

  const loadInviteCodes = async () => {
    const { data, error } = await getInviteCodes();
    if (!error) {
      setInviteCodes(data);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  const openInviteModal = () => {
    setOpenInvites(true);
    loadInviteCodes();
  };

  return (
    <>
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 py-2">
          {/* Wrapper que permite empilhar no mobile e alinhar lado a lado em telas maiores */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div className="leading-tight min-w-0">
                <h1 className="font-bold text-primary text-lg sm:text-xl">Nexus System</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[240px]">
                  {company?.name}
                </p>
              </div>
            </div>

            {/* Ações / usuário */}
            <div className="flex items-center flex-wrap gap-1 sm:gap-2 justify-end">
              <div className="flex flex-col items-end leading-tight gap-0.5 pr-2 border-r sm:border-r-0">
                <p className="text-xs sm:text-sm font-medium max-w-[120px] truncate">
                  {profile?.first_name}
                </p>
                <Badge
                  variant={profile?.role === 'admin' ? 'default' : 'secondary'}
                  className="text-[10px] sm:text-xs px-1.5 py-0.5"
                >
                  {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Editar perfil"
                onClick={() => {
                  setFirstName(profile?.first_name || '');
                  setPhone(profile?.phone || '');
                  setEmail(profile?.email || '');
                  setOpenProfile(true);
                }}
              >
                <User className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Configurações da empresa"
                onClick={() => {
                  setCompanyName(company?.name || '');
                  setCnpjCpf(company?.cnpj_cpf || '');
                  setCompanyPhone(company?.phone || '');
                  setCompanyEmail(company?.email || '');
                  setAddress(company?.address || '');
                  setOpenCompany(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {profile?.role === 'admin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Gerar convites"
                  onClick={openInviteModal}
                >
                  <Key className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Sair"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="first-name">Nome</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenProfile(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateProfile}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Modal */}
      <Dialog open={openCompany} onOpenChange={setOpenCompany}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações da Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label htmlFor="cnpj-cpf">CNPJ/CPF</Label>
              <Input
                id="cnpj-cpf"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="company-phone">Telefone</Label>
                <Input
                  id="company-phone"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, cidade"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenCompany(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateCompany}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Codes Modal (Admin Only) */}
      {profile?.role === 'admin' && (
        <Dialog open={openInvites} onOpenChange={setOpenInvites}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Códigos de Convite</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => handleGenerateInvite('user')}
                  variant="outline"
                  className="flex-1"
                >
                  Gerar Código Usuário
                </Button>
                <Button
                  onClick={() => handleGenerateInvite('admin')}
                  className="flex-1"
                >
                  Gerar Código Admin
                </Button>
              </div>

              <div className="max-h-[60vh] overflow-auto space-y-2">
                {inviteCodes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum código gerado ainda
                  </p>
                )}
                {inviteCodes.map((invite) => (
                  <Card key={invite.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {invite.code}
                          </code>
                          <Badge variant={invite.role === 'admin' ? 'default' : 'secondary'}>
                            {invite.role === 'admin' ? 'Admin' : 'Usuário'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {invite.used_by ? (
                            <span className="text-green-600">✓ Usado</span>
                          ) : new Date(invite.expires_at) < new Date() ? (
                            <span className="text-red-600">✗ Expirado</span>
                          ) : (
                            <span className="text-blue-600">◯ Disponível</span>
                          )}
                          {' | '}
                          Expira: {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(invite.code)}
                        disabled={invite.used_by || new Date(invite.expires_at) < new Date()}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
