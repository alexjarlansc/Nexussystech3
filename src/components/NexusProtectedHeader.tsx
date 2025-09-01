import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { LogOut, Settings, User, Building2, Key, Copy } from "lucide-react";
import { Link } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";
import type { InviteCode } from '@/hooks/authTypes';
import { StorageKeys, setJSON } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';

export function NexusProtectedHeader() {
  const { user, profile, company, signOut, updateProfile, updateCompany, generateInviteCode, getInviteCodes } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [openCompany, setOpenCompany] = useState(false);
  const [openInvites, setOpenInvites] = useState(false);
  // Códigos de convite (tipo centralizado em authTypes com campos opcionais)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);

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
  // Logo (apenas local / dataURL)
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined); // preview local
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Carregar logo persistida no localStorage ao abrir modal (ou inicialização)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(StorageKeys.company);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.logoDataUrl) setLogoDataUrl(parsed.logoDataUrl);
      }
    } catch {/* ignore */}
  }, []);

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
      // Persistir também localmente inclusive logo para PDF / pré-visualização
      try {
        const raw = localStorage.getItem(StorageKeys.company);
        const existing = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        const prevLogo = typeof existing === 'object' && existing && 'logoDataUrl' in (existing as Record<string, unknown>)
          ? (existing as Record<string, unknown>).logoDataUrl as string | undefined
          : undefined;
        setJSON(StorageKeys.company, {
          ...existing,
          name: companyName,
          address,
          taxid: cnpjCpf,
          phone: companyPhone,
          email: companyEmail,
          cnpj_cpf: cnpjCpf, // compatibilidade
          logoDataUrl: logoDataUrl || prevLogo
        });
      } catch {/* ignore */}
      toast.success('Empresa atualizada com sucesso');
      setOpenCompany(false);
    }
  };

  const handleGenerateInvite = async (role: 'user' | 'admin' | 'pdv') => {
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
  <div className="w-full mx-auto px-2 sm:px-4 py-2">
          {/* Wrapper que permite empilhar no mobile e alinhar lado a lado em telas maiores */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/"
              aria-label="Ir para início"
              className="flex items-center gap-3 min-w-0 group cursor-pointer select-none pr-4 mr-auto -ml-1 sm:-ml-2"
            >
              <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary flex-shrink-0 transition-transform group-hover:scale-105" />
              <div className="leading-tight min-w-0">
                <h1 className="font-bold text-primary text-lg sm:text-xl tracking-tight group-hover:opacity-90">Nexus System</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[240px] group-hover:text-primary/80 transition-colors">
                  {company?.name || 'Início'}
                </p>
              </div>
            </Link>

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
                  {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'pdv' ? 'PDV' : 'Usuário'}
                </Badge>
              </div>

              {profile?.role === 'admin' && (
                <Link
                  to="/erp"
                  className="text-xs font-medium px-2 py-1 border rounded hover:bg-muted order-0"
                  aria-label="ERP"
                  title="ERP"
                >ERP</Link>
              )}
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
              {profile?.role === 'pdv' && (
                <Link to="/pdv" className="text-xs font-medium px-2 py-1 border rounded hover:bg-muted">PDV</Link>
              )}
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
            <div className="pt-2 border-t">
              <Label className="block mb-1">Logo</Label>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 700) { // ~700KB limite maior para qualidade
                    toast.error('Imagem muito grande (máx 700KB)');
                    return;
                  }
                  setUploadingLogo(true);
                  try {
                    // Upload para bucket 'logos'
                    const ext = file.name.split('.').pop() || 'png';
                    const path = `${company?.id || 'company'}/${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, cacheControl: '3600' });
                    if (upErr) throw upErr;
                    const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
                    const publicUrl = pub?.publicUrl;
                    if (publicUrl) {
                      setLogoDataUrl(publicUrl);
                      // atualizar empresa no banco
                      await updateCompany({ logo_url: publicUrl });
                      toast.success('Logo enviada');
                    }
                  } catch (err) {
                    console.error('Erro upload logo', err);
                    toast.error('Falha ao enviar logo');
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
                className="text-sm"
              />
              {logoDataUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={logoDataUrl} alt="Logo" className="h-16 w-32 object-contain border rounded bg-white" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoDataUrl(undefined)}
                  >Remover</Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Formatos: PNG/JPG. Upload salvo no banco e usado no PDF / pré-visualização. {uploadingLogo && 'Enviando...'}</p>
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
              {/* Tabs estilizadas para geração rápida */}
              <div className="flex w-full rounded-lg overflow-hidden border bg-muted/40">
                {(['user','admin','pdv'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleGenerateInvite(role)}
                    className={"flex-1 px-3 py-2 text-sm font-medium focus:outline-none transition-colors " +
                      (role==='user' ? 'data-[role=user]' : role==='admin' ? 'data-[role=admin]' : 'data-[role=pdv]') + ' '}
                    data-active={false}
                    data-role={role}
                  >
                    {role==='user' && 'Gerar Código Usuário'}
                    {role==='admin' && 'Gerar Código Admin'}
                    {role==='pdv' && 'Gerar Código PDV'}
                  </button>
                ))}
              </div>
              <style>{`
                [data-role] { background:transparent; }
                [data-role]:hover { background:rgba(0,0,0,0.04); }
                [data-role=user] { color:#0a3d40; }
                [data-role=admin] { background:#0d5c61; color:#fff; }
                [data-role=admin]:hover { background:#0b4f53; }
                [data-role=pdv] { color:#0a3d40; }
                @media (max-width:640px){ [data-role] { font-size:11px; padding:8px 6px; } }
              `}</style>
              <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                {inviteCodes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum código gerado ainda
                  </p>
                )}
                {inviteCodes.map((invite) => {
                  const expiresDate = invite.expires_at ? new Date(invite.expires_at) : null;
                  const isExpired = expiresDate ? expiresDate < new Date() : false;
                  const statusColor = invite.used_by ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : isExpired ? 'bg-red-100 text-red-700 border-red-300' : 'bg-blue-100 text-blue-700 border-blue-300';
                  const statusLabel = invite.used_by ? 'Usado' : isExpired ? 'Expirado' : 'Disponível';
                  return (
                    <div key={invite.id} className="rounded-lg border p-2.5 bg-white shadow-sm flex items-center gap-3">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="px-2 py-1 rounded bg-muted text-xs font-mono tracking-wide">{invite.code}</code>
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border font-medium ${invite.role==='admin' ? 'bg-primary text-primary-foreground border-primary/70' : invite.role==='pdv' ? 'bg-secondary text-secondary-foreground border-secondary/60' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>{invite.role==='admin'?'Admin': invite.role==='pdv'?'PDV':'Usuário'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>{statusLabel}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                          <span>Expira: {expiresDate ? expiresDate.toLocaleDateString('pt-BR') : '—'}</span>
                          {invite.used_by && <span>Usuário: {invite.used_by.slice(0,8)}…</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(invite.code)}
                          disabled={!!invite.used_by || isExpired}
                          aria-label="Copiar código"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
