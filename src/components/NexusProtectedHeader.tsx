import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { LogOut, Settings, User, Building2, Copy, Search } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";
import type { InviteCode } from '@/hooks/authTypes';
import { StorageKeys, setJSON } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';

export function NexusProtectedHeader() {
  const navigate = useNavigate();
  const { user, profile, company, signOut, updateProfile, updateCompany, generateInviteCode, getInviteCodes } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [openCompany, setOpenCompany] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [openInvites, setOpenInvites] = useState(false);
  const [openCostStatus, setOpenCostStatus] = useState(false);
  const [costStatusInitialTab, setCostStatusInitialTab] = useState<'cc'|'status'>('cc');
  // Helper para tipar componente definido mais abaixo neste arquivo
  const CostStatusManagerAny = CostStatusManager as unknown as (p: { initialTab?: 'cc'|'status' }) => JSX.Element;
  // Códigos de convite (tipo centralizado em authTypes com campos opcionais)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  // Mapa id->nome para resolver nomes de empresas dos convites
  const [companyLookup, setCompanyLookup] = useState<Record<string, string>>({});
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id:string;name:string}>>([]);
  // Não usamos paginação ao listar empresas no modal; buscamos tudo de uma vez
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [selectedCompanyForInvite, setSelectedCompanyForInvite] = useState<string | undefined>(undefined);
  const [openCompanySearchDialog, setOpenCompanySearchDialog] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(()=>{
    const t = setTimeout(()=>setDebouncedSearch(companySearch), 300);
    return ()=>clearTimeout(t);
  },[companySearch]);

  // when search changes, limpar lista para re-buscar
  useEffect(()=>{
    setAvailableCompanies([]);
  },[debouncedSearch]);

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
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null); // file selected while creating a new company
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

  // Listen to global event to open company modal from other pages (ERP)
  // Use refs to keep a stable listener and access latest company state without re-registering
  const companyRef = useRef(company);
  useEffect(() => { companyRef.current = company; }, [company]);

  // Exclusividade: se um modal abrir, garanta que o outro feche
  useEffect(() => {
    if (openProfile) setOpenCompany(false);
  }, [openProfile]);
  useEffect(() => {
    if (openCompany) setOpenProfile(false);
  }, [openCompany]);

  const openCompanyFromEventRef = useRef<(ev?: Event)=>void>();
  useEffect(() => {
    // Stable ref callback used by global event handlers to open the company modal
    openCompanyFromEventRef.current = (ev?: Event) => {
      try {
        const detail = ev && (ev as CustomEvent)?.detail as { mode?: string } | undefined;
        const mode = detail?.mode;
        if (mode === 'create') {
          // preparar formulário para criação
          setCompanyName('');
          setCnpjCpf('');
          setCompanyPhone('');
          setCompanyEmail('');
          setAddress('');
          setLogoDataUrl(undefined);
          setPendingLogoFile(null);
          setIsCreatingCompany(true);
        } else {
          // popular com dados da empresa atual
          const current = companyRef.current;
          setCompanyName(current?.name || '');
          setCnpjCpf(current?.cnpj_cpf || '');
          setCompanyPhone(current?.phone || '');
          setCompanyEmail(current?.email || '');
          setAddress(current?.address || '');
          setLogoDataUrl(undefined);
          setPendingLogoFile(null);
          setIsCreatingCompany(false);
        }
        setOpenCompany(true);
        setOpenProfile(false);
      } catch (e) {
        console.error('Failed to open company modal via event', e);
      }
    };
  }, []);

  // Register a global event listener that calls the stable ref above when triggered
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        openCompanyFromEventRef.current?.(ev);
      } catch (e) {
        console.error('Failed to handle erp:open-company-modal event', e);
      }
    };
    window.addEventListener('erp:open-company-modal', handler as EventListener);
    return () => window.removeEventListener('erp:open-company-modal', handler as EventListener);
  }, []);

  // Atualiza dados do perfil
  const handleUpdateProfile = async () => {
    const { error } = await updateProfile({
      first_name: firstName,
      phone,
      email,
    });
    if (error) {
      toast.error('Erro ao atualizar perfil');
      return;
    }
    toast.success('Perfil atualizado com sucesso');
    setOpenProfile(false);
  };

  // Cria ou atualiza empresa
  const handleUpdateCompany = async () => {
    if (isCreatingCompany) {
      try {
        // Tenta criar diretamente
        let newCompany: Record<string, unknown> | null = null;
        let insertError: unknown = null;
        const res = await supabase
          .from('companies')
          .insert({
            name: companyName,
            cnpj_cpf: cnpjCpf,
            phone: companyPhone,
            email: companyEmail,
            address,
            logo_url: logoDataUrl || null,
          })
          .select()
          .single();
  newCompany = res.data as Record<string, unknown> | null;
  insertError = (res as { error?: unknown }).error || null;

        // Fallback: se RLS bloquear, usa Edge Function (requer role adequada no servidor)
        if (insertError) {
          const msg = String(insertError.message || '');
          if (msg.toLowerCase().includes('row-level security')) {
            try {
              const { invokeFunction } = await import('@/lib/functions');
                const fx = await invokeFunction<{ ok?: boolean; data?: { company?: Record<string, unknown> } }>('admin-create-company', {
                body: {
                  name: companyName,
                  cnpj_cpf: cnpjCpf,
                  phone: companyPhone,
                  email: companyEmail,
                  address,
                    logo_url: logoDataUrl || null,
                },
              });
                if (fx.ok && fx.data?.company) {
                  newCompany = fx.data.company || null;
                insertError = null;
              }
            } catch (e) {
              // mantém insertError
            }
          }
        }

        if (insertError) {
          console.error('Erro ao criar empresa:', insertError);
          toast.error('Erro ao criar empresa: ' + (insertError.message || 'erro desconhecido'));
          return;
        }

        // Vincula o usuário atual à nova empresa
        try {
          const { data: u } = await supabase.auth.getUser();
          const uid = u?.user?.id;
          if (uid && newCompany?.id) {
            await supabase.from('profiles').update({ company_id: newCompany.id }).eq('user_id', uid);
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn('Falha ao vincular perfil à nova empresa', e);
        }

        // Se havia um arquivo de logo selecionado, subir agora para o caminho da nova empresa
        try {
          if (pendingLogoFile && newCompany?.id) {
            const file = pendingLogoFile;
            const ext = file.name.split('.').pop() || 'png';
            const path = `${newCompany.id}/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, cacheControl: '3600' });
        if (!upErr) {
      const pub = supabase.storage.from('logos').getPublicUrl(path);
      const publicUrl = (pub as { data?: { publicUrl?: string } } | null)?.data?.publicUrl;
              if (publicUrl) {
                try { await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', newCompany.id); } catch {/* noop */}
                setLogoDataUrl(publicUrl);
              }
            } else {
              console.warn('Erro ao subir logo após criação:', upErr);
            }
            setPendingLogoFile(null);
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn('Erro no upload pós-criação:', e);
        }

        // Persistir localmente para pré-visualização e PDFs
        try {
          setJSON(StorageKeys.company, {
            id: newCompany.id,
            name: newCompany.name,
            address: newCompany.address,
            cnpj_cpf: newCompany.cnpj_cpf,
            phone: newCompany.phone,
            email: newCompany.email,
            logoDataUrl: logoDataUrl,
          });
        } catch {/* ignore */}

        toast.success('Empresa criada com sucesso');
        setOpenCompany(false);
        setIsCreatingCompany(false);
      } catch (err) {
        console.error('Erro inesperado ao criar empresa', err);
        toast.error('Erro inesperado ao criar empresa');
      }
    } else {
      // Atualização de empresa existente
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
        try {
          const raw = localStorage.getItem(StorageKeys.company);
          const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          const prevLogo = (existing && typeof existing === 'object' && 'logoDataUrl' in existing)
            ? (existing as Record<string, unknown>).logoDataUrl as string | undefined
            : undefined;
          setJSON(StorageKeys.company, {
            ...existing,
            name: companyName,
            address,
            taxid: cnpjCpf,
            phone: companyPhone,
            email: companyEmail,
            cnpj_cpf: cnpjCpf,
            logoDataUrl: logoDataUrl || prevLogo,
          });
        } catch {/* ignore */}
        toast.success('Empresa atualizada com sucesso');
        setOpenCompany(false);
      }
    }
  };

  const handleGenerateInvite = async (role: 'user' | 'admin' | 'pdv' | 'master') => {
    // typed wrapper to allow optional company id without touching global type inference
  const gen = (generateInviteCode as unknown) as (r: 'user'|'admin'|'pdv'|'master', companyId?: string) => Promise<{ code?: string; error?: unknown }>;
    const { code, error } = await gen(role, selectedCompanyForInvite);

    if (error) {
      // Try to extract a useful message
      console.error('Erro ao gerar código de convite:', error);
      const maybeErr = error as unknown;
      let msg = '';
      if (maybeErr && typeof maybeErr === 'object' && 'message' in (maybeErr as Record<string, unknown>)) {
        const m = (maybeErr as Record<string, unknown>).message;
        if (typeof m === 'string') msg = m;
      }
      toast.error('Erro ao gerar código: ' + (msg || String(error) || 'erro desconhecido'));
    } else if (code) {
      toast.success(`Código gerado: ${code}`);
      loadInviteCodes();
    }
  };

  const loadInviteCodes = useCallback(async () => {
    const { data, error } = await getInviteCodes();
    if (!error) {
      setInviteCodes(data);
      // Resolver nomes das empresas referenciadas pelos convites
      try {
        const ids = Array.from(new Set((data || []).map((i) => i.company_id).filter((v): v is string => !!v)));
        if (ids.length > 0) {
          const { data: compRows, error: compErr } = await supabase.from('companies').select('id,name').in('id', ids);
          if (!compErr && Array.isArray(compRows)) {
            const map: Record<string, string> = {};
            compRows.forEach((r) => { const id = (r as { id?: string }).id; const name = (r as { name?: string }).name; if (id && name) map[id] = name; });
            setCompanyLookup(map);
          }
        }
      } catch (e) {
        console.warn('Falha ao resolver nomes de empresas dos convites', e);
      }
    }
  }, [getInviteCodes]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  // loadCompaniesForInvite is used by the invite modal and by the global event handler
  const loadCompaniesForInvite = useCallback(async () => {
    setCompaniesError(null);
    try {
      setCompaniesLoading(true);
      // Buscar todas as empresas (sem paginação) para listar no modal
   
  let query = supabase.from('companies').select('id,name').order('name');
      if (debouncedSearch.trim() !== '') {
        const s = debouncedSearch.trim();
        query = supabase.from('companies').select('id,name').ilike('name', `%${s}%`).order('name');
      }
       
      const { data, error } = await query;
      if (error) throw error;
      const list = ((data as unknown) as Array<{id:string;name:string}>) || [];
  setAvailableCompanies(list);
      // Default to current company if present and none selected yet
      if (company?.id && !selectedCompanyForInvite) setSelectedCompanyForInvite(company.id);
    } catch (err) {
      console.error('Erro ao carregar empresas para invite', err);
      const maybe = err as unknown;
      let msg = 'Erro ao carregar empresas';
      if (maybe && typeof maybe === 'object' && 'message' in (maybe as Record<string, unknown>)) {
        const m = (maybe as Record<string, unknown>).message;
        if (typeof m === 'string' && m.trim()) msg = m;
      }
      setCompaniesError(msg);
      try { toast.error('Falha ao carregar empresas: ' + msg); } catch (_) { /* ignore */ }
    } finally {
      setCompaniesLoading(false);
    }
  }, [debouncedSearch, company?.id, selectedCompanyForInvite]);

  const openInviteModal = useCallback(() => {
    setOpenInvites(true);
    loadInviteCodes();
    loadCompaniesForInvite();
  }, [loadInviteCodes, loadCompaniesForInvite]);

  // Listen to event to open invite codes modal from ERP (placed after helpers)
  // Register a single stable listener that calls the latest openInviteModal via ref
  const openInviteModalRef = useRef(openInviteModal);
  useEffect(() => { openInviteModalRef.current = openInviteModal; }, [openInviteModal]);
  useEffect(() => {
    const handler = () => {
      try {
        openInviteModalRef.current?.();
      } catch (e) {
        console.error('Failed to open invite modal via event', e);
      }
    };
    window.addEventListener('erp:open-invite-modal', handler as EventListener);
    return () => window.removeEventListener('erp:open-invite-modal', handler as EventListener);
  }, []);

  // Ensure companies are loaded when the invite modal opens or when the search changes
  useEffect(() => {
    if (!openInvites) return;
    // load first page when modal opens or when debouncedSearch changes
    (async () => {
      try {
        await loadCompaniesForInvite();
      } catch (e) {
        console.error('Erro ao carregar empresas ao abrir modal de convites', e);
      }
    })();
  }, [openInvites, debouncedSearch, loadCompaniesForInvite]);

  // Abertura de modais via eventos globais para a página /config
  useEffect(() => {
    const onOpenProfile = () => {
      try {
        setOpenCompany(false);
        setFirstName(profile?.first_name || '');
        setPhone(profile?.phone || '');
        setEmail(profile?.email || '');
        setOpenProfile(true);
      } catch {/* noop */}
    };
    const onOpenCompany = () => {
      try {
        setOpenProfile(false);
        setCompanyName(company?.name || '');
        setCnpjCpf(company?.cnpj_cpf || '');
        setCompanyPhone(company?.phone || '');
        setCompanyEmail(company?.email || '');
        setAddress(company?.address || '');
        setOpenCompany(true);
      } catch {/* noop */}
    };
    const onOpenCostStatus = (ev?: Event) => {
      try {
        setOpenProfile(false);
        setOpenCompany(false);
        const detail = ev && (ev as CustomEvent)?.detail as { tab?: 'cc'|'status' } | undefined;
        const nextTab = detail?.tab === 'status' ? 'status' : 'cc';
        setCostStatusInitialTab(nextTab);
        setOpenCostStatus(true);
      } catch {/* noop */}
    };
    window.addEventListener('open-profile-settings', onOpenProfile as EventListener);
    window.addEventListener('open-company-settings', onOpenCompany as EventListener);
    window.addEventListener('open-coststatus-settings', onOpenCostStatus as EventListener);
    return () => {
      window.removeEventListener('open-profile-settings', onOpenProfile as EventListener);
      window.removeEventListener('open-company-settings', onOpenCompany as EventListener);
      window.removeEventListener('open-coststatus-settings', onOpenCostStatus as EventListener);
    };
  }, [profile?.first_name, profile?.phone, profile?.email, company?.name, company?.cnpj_cpf, company?.phone, company?.email, company?.address]);

  

  // Type guard para extrair mensagem de erro sem usar `any`
  function isErrorWithMessage(v: unknown): v is { message: string } {
    return !!v && typeof v === 'object' && 'message' in v && typeof (v as Record<string, unknown>).message === 'string';
  }

  return (
    <>
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 fixed top-0 left-0 right-0 z-40" style={{height: 'var(--header-height)'}}>
  <div className="w-full mx-auto px-4 sm:px-6 py-0 h-full">
    {/* Wrapper que permite empilhar no mobile e alinhar lado a lado em telas maiores */}
    <div className="flex h-full items-center gap-2">
            <Link
              to="/"
              aria-label="Ir para início"
              className="flex items-center gap-3 min-w-0 group cursor-pointer select-none"
            >
              { (company?.logo_url || logoDataUrl) ? (
                <img src={company?.logo_url || logoDataUrl} alt={company?.name || 'Logo'} className="h-12 w-12 sm:h-16 sm:w-16 object-contain flex-shrink-0" />
              ) : (
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 text-primary flex-shrink-0 transition-transform group-hover:scale-105" />
              ) }
              <span className="sr-only">{company?.name || 'Início'}</span>
            </Link>

            {/* spacer to keep center clean */}
            <div className="flex-1" />

            {/* User actions on the right */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col items-end leading-tight gap-0.5 min-w-0">
                <p className="text-sm font-medium max-w-[160px] truncate">{profile?.first_name}</p>
                <Badge
                  variant={(profile?.role === 'admin' || profile?.role === 'master') ? 'default' : 'secondary'}
                  className="text-[11px] sm:text-xs px-2 py-1 rounded-full"
                >
                  {profile?.role === 'master' ? 'Administrador Mestre' : profile?.role === 'admin' ? 'Administrador' : profile?.role === 'pdv' ? 'PDV' : 'Usuário'}
                </Badge>
              </div>

              {profile?.role === 'pdv' && (
                <Link to="/pdv" className="text-xs font-medium px-2 py-1 border rounded hover:bg-muted">PDV</Link>
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
    <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
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

      {/* Cost Centers / Status Modal */}
      <Dialog open={openCostStatus} onOpenChange={setOpenCostStatus}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Centro de custos / Status</DialogTitle>
          </DialogHeader>
          <CostStatusManagerAny initialTab={costStatusInitialTab} />
        </DialogContent>
      </Dialog>

      {/* Company Modal */}
      <Dialog open={openCompany} onOpenChange={setOpenCompany}>
    <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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
                readOnly={profile?.role === 'user' || profile?.role === 'pdv'}
                disabled={profile?.role === 'user' || profile?.role === 'pdv'}
              />
            </div>
            <div>
              <Label htmlFor="cnpj-cpf">CNPJ/CPF</Label>
              <Input
                id="cnpj-cpf"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0000-00"
                readOnly={profile?.role === 'user' || profile?.role === 'pdv'}
                disabled={profile?.role === 'user' || profile?.role === 'pdv'}
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
                  readOnly={profile?.role === 'user' || profile?.role === 'pdv'}
                  disabled={profile?.role === 'user' || profile?.role === 'pdv'}
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
                  readOnly={profile?.role === 'user' || profile?.role === 'pdv'}
                  disabled={profile?.role === 'user' || profile?.role === 'pdv'}
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
                readOnly={profile?.role === 'user' || profile?.role === 'pdv'}
                disabled={profile?.role === 'user' || profile?.role === 'pdv'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenCompany(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateCompany} disabled={profile?.role === 'user' || profile?.role === 'pdv'}>
                Salvar
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Label className="block mb-1">Logo</Label>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingLogo || profile?.role === 'user' || profile?.role === 'pdv'}
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
                    const { data: upData, error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, cacheControl: '3600' });
                    if (upErr) {
                      // Log detalhado para ajudar diagnóstico (bucket inexistente, permissões, etc)
                      console.error('Erro upload logo (supabase):', upErr);
                      // Tentar fallback: gerar DataURL e usar localmente / atualizar empresa com DataURL
                      const dataUrl = await new Promise<string | null>((res) => {
                        const reader = new FileReader();
                        reader.onload = () => res(typeof reader.result === 'string' ? reader.result : null);
                        reader.onerror = () => res(null);
                        reader.readAsDataURL(file);
                      });
                      if (dataUrl) {
                        // Persistir localmente e tentar atualizar empresa com DataURL para permitir pré-visualização
                        setLogoDataUrl(dataUrl);
                        try { await updateCompany({ logo_url: dataUrl }); } catch (uErr) { console.error('Erro ao atualizar empresa com DataURL fallback', uErr); }
                        toast.success('Logo salva localmente (fallback) — verifique configuração do storage');
                      } else {
                        toast.error('Falha ao enviar logo: ' + (upErr.message || 'erro desconhecido'));
                      }
                      return;
                    }
                    // Se upload OK, obter URL pública
                    const pubRes = supabase.storage.from('logos').getPublicUrl(path);
                    let publicUrl: string | undefined = undefined;
                    if (pubRes && typeof pubRes === 'object' && 'data' in pubRes && pubRes.data) {
                      const d = pubRes.data as Record<string, unknown>;
                      if (typeof d.publicUrl === 'string') publicUrl = d.publicUrl;
                    }
                    if (publicUrl) {
                      setLogoDataUrl(publicUrl);
                      // atualizar empresa no banco
                      await updateCompany({ logo_url: publicUrl });
                      toast.success('Logo enviada');
                    } else {
                      // Caso raro: upload ok mas sem publicUrl
                      console.warn('Upload realizado mas publicUrl não retornada', upData);
                      toast.success('Logo enviada (upload ok)');
                    }
                  } catch (err) {
                    console.error('Erro upload logo (catch):', err);
                    // tentar extrair mensagem do erro do supabase
                    const unknownErr = err as unknown;
                    let msg = String(unknownErr);
                    if (unknownErr && typeof unknownErr === 'object' && 'message' in unknownErr && typeof (unknownErr as Record<string, unknown>).message === 'string') {
                      msg = (unknownErr as Record<string, unknown>).message as string;
                    }
                    toast.error('Falha ao enviar logo: ' + msg);
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

  {/* Invite Codes Modal (Admin or Master) */}
  {(profile?.role === 'admin' || profile?.role === 'master') && (
        <Dialog open={openInvites} onOpenChange={setOpenInvites}>
  <DialogContent className="max-w-5xl w-[min(1100px,96vw)] max-h-[92vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle>Códigos de Convite</DialogTitle>
            </DialogHeader>
              <div className="space-y-4">
              {/* Tabs estilizadas para geração rápida */}
              <div className="flex w-full rounded-lg overflow-hidden border bg-muted/40 flex-nowrap items-stretch box-border max-w-full">
                <div className='p-2 pl-3 pr-3 border-r flex flex-col gap-2 min-w-[280px] bg-transparent relative flex-shrink-0'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs'>Empresa</Label>
                    <Button size='sm' variant='ghost' onClick={()=>setOpenCompanySearchDialog(true)} className='h-7 w-7 p-0'>
                      <Search className='h-4 w-4' />
                    </Button>
                  </div>
                  <div>
                    <div className='text-sm font-medium'>{availableCompanies.find(c=>c.id===selectedCompanyForInvite)?.name || company?.name || 'Minha empresa'}</div>
                    <div className='text-xs text-muted-foreground'>{selectedCompanyForInvite || company?.id || ''}</div>
                  </div>
                  </div>
  {(['user','admin','pdv','master'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleGenerateInvite(role)}
                    className={"flex-1 px-3 py-2 text-sm font-medium focus:outline-none transition-colors rounded-none " +
                      (role==='user' ? 'data-[role=user]' : role==='admin' ? 'data-[role=admin]' : role==='pdv' ? 'data-[role=pdv]' : 'data-[role=master]') + ' '}
                    data-active={false}
                    data-role={role}
                  >
                    {role==='user' && 'Gerar Código Usuário'}
                    {role==='admin' && 'Gerar Código Admin'}
                    {role==='pdv' && 'Gerar Código PDV'}
                    {role==='master' && 'Gerar Código Master'}
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
                  const compName = invite.company_id ? (companyLookup[invite.company_id] || availableCompanies.find(c=>c.id===invite.company_id)?.name || invite.company_id) : undefined;
                  const compShort = typeof compName === 'string' ? (compName.length > 24 ? compName.slice(0,24) + '…' : compName) : undefined;
                  return (
                    <div key={invite.id} className="rounded-lg border p-2.5 bg-white shadow-sm flex items-center gap-3">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="px-2 py-1 rounded bg-muted text-xs font-mono tracking-wide">{invite.code}</code>
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border font-medium ${invite.role==='admin' ? 'bg-primary text-primary-foreground border-primary/70' : invite.role==='pdv' ? 'bg-secondary text-secondary-foreground border-secondary/60' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>{invite.role==='admin'?'Admin': invite.role==='pdv'?'PDV':'Usuário'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
                            {compShort ? `${compShort} ${statusLabel}` : statusLabel}
                          </span>
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

      {/* Company Search Dialog (abre ao clicar na lupa) */}
      <Dialog open={openCompanySearchDialog} onOpenChange={setOpenCompanySearchDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pesquisar Empresas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buscar empresa..." value={companySearch} onChange={(e)=>setCompanySearch(e.target.value)} />
            {companiesLoading && (
              <div className="text-sm text-muted-foreground">Carregando empresas...</div>
            )}
            {companiesError && (
              <div className="text-sm text-red-600">
                <div>Erro: {companiesError}</div>
                <div className="mt-2 flex gap-2">
                  <Button size='sm' variant='outline' onClick={()=>{ loadCompaniesForInvite(); }}>Tentar novamente</Button>
                  <Button size='sm' onClick={()=>setOpenCompanySearchDialog(false)}>Fechar</Button>
                </div>
              </div>
            )}
            {!companiesLoading && availableCompanies.length === 0 && !companiesError && (
              <div className='text-sm text-muted-foreground'>Nenhuma empresa encontrada</div>
            )}
            <div className="space-y-2">
              {availableCompanies.map(c => (
                <div key={c.id} className='flex items-center justify-between gap-2 p-1 rounded hover:bg-muted'>
                  <div className='min-w-0'>
                    <div className='text-sm truncate'>{c.name}</div>
                    <div className='text-xs text-muted-foreground truncate'>{c.id}</div>
                  </div>
                  <div className='flex gap-1'>
                    <Button size='sm' variant='ghost' onClick={async ()=>{ try{ await navigator.clipboard.writeText(c.id); toast.success('ID copiado'); }catch(e){ toast.error('Falha ao copiar'); } }}>Copiar</Button>
                    <Button size='sm' onClick={()=>{ setSelectedCompanyForInvite(c.id); setOpenCompanySearchDialog(false); toast.success('Empresa selecionada'); }}>Selecionar</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Gerenciador embutido: centros de custos e status
function CostStatusManager({ initialTab = 'cc' }: { initialTab?: 'cc'|'status' }) {
  const { profile } = useAuth();
  type SelectChain = {
    order: (f: string, opts?: unknown) => SelectChain;
    eq: (c: string, v: unknown) => Promise<{ data: unknown[] | null; error?: unknown }>;
  };
  type AnyFrom = {
    from: (t: string) => {
      select: (s: string) => SelectChain;
      insert: (row: unknown) => Promise<{ data?: unknown; error?: unknown }>;
      update: (row: unknown) => { eq: (c: string, v: unknown) => Promise<{ data?: unknown; error?: unknown }> };
      delete: () => { eq: (c: string, v: unknown) => Promise<{ data?: unknown; error?: unknown }> };
    }
  };
  const [tab, setTab] = useState<'cc'|'status'>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [loadingCC, setLoadingCC] = useState(false);
  const [loadingSt, setLoadingSt] = useState(false);
  const [cc, setCc] = useState<Array<{id:string; code:string; name:string; is_active:boolean}>>([]);
  const [st, setSt] = useState<Array<{id:string; name:string; domain:'ORCAMENTO'|'PEDIDO'; sort_order:number; is_active:boolean}>>([]);
  const [newCcCode, setNewCcCode] = useState('');
  const [newCcName, setNewCcName] = useState('');
  const [newStName, setNewStName] = useState('');
  const [newStDomain, setNewStDomain] = useState<'ORCAMENTO'|'PEDIDO'>('ORCAMENTO');
  const [newStSort, setNewStSort] = useState<number>(0);

  const canEdit = profile?.role === 'admin' || profile?.role === 'master';

  const loadCostCenters = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoadingCC(true);
    try {
  // typed-unknown cast porque a tabela não está no tipo gerado
  const from = supabase as unknown as AnyFrom;
  const q = from.from('cost_centers').select('id,code,name,is_active').order('code');
  const res = await q.eq('company_id', profile.company_id);
  const data = res?.data as Array<{id:string; code:string; name:string; is_active:boolean}>|null;
  const error = res?.error;
      if (error) throw error;
      setCc((data||[]) as Array<{id:string; code:string; name:string; is_active:boolean}>);
    } catch (e) {
      toast.error('Erro ao carregar centros de custos');
    } finally { setLoadingCC(false); }
  }, [profile?.company_id]);

  const loadStatuses = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoadingSt(true);
    try {
  const from = supabase as unknown as AnyFrom;
  const q = from.from('status_catalog').select('id,name,domain,sort_order,is_active').order('sort_order').order('name');
  const res = await q.eq('company_id', profile.company_id);
  const data = res?.data as Array<{id:string; name:string; domain:'ORCAMENTO'|'PEDIDO'; sort_order:number; is_active:boolean}>|null;
  const error = res?.error;
      if (error) throw error;
      setSt((data||[]) as Array<{id:string; name:string; domain:'ORCAMENTO'|'PEDIDO'; sort_order:number; is_active:boolean}>);
    } catch (e) { toast.error('Erro ao carregar status'); } finally { setLoadingSt(false); }
  }, [profile?.company_id]);

  useEffect(()=>{ loadCostCenters(); loadStatuses(); }, [loadCostCenters, loadStatuses]);

  async function addCC(){
    if (!canEdit) { toast.error('Sem permissão'); return; }
    if (!newCcCode.trim() || !newCcName.trim()) { toast.error('Código e nome são obrigatórios'); return; }
    try {
      const from = supabase as unknown as AnyFrom;
      const ins = await from.from('cost_centers').insert({ code:newCcCode.trim(), name:newCcName.trim(), is_active:true, company_id: profile?.company_id });
      if (ins?.error) throw ins.error;
      setNewCcCode(''); setNewCcName('');
      toast.success('Centro de custos adicionado');
      loadCostCenters();
    } catch(e){ toast.error('Falha ao adicionar centro de custos'); }
  }

  async function toggleCC(id:string, active:boolean){
    try {
      const from = supabase as unknown as AnyFrom;
      await from.from('cost_centers').update({ is_active: !active }).eq('id', id);
      loadCostCenters();
    } catch(e){ toast.error('Falha ao atualizar'); }
  }
  async function deleteCC(id:string){
    if (!canEdit) { toast.error('Sem permissão'); return; }
    try {
      const from = supabase as unknown as AnyFrom;
      await from.from('cost_centers').delete().eq('id', id);
      loadCostCenters();
    } catch(e){ toast.error('Falha ao excluir'); }
  }

  async function addStatus(){
    if (!canEdit) { toast.error('Sem permissão'); return; }
    if (!newStName.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      const from = supabase as unknown as AnyFrom;
      const ins = await from.from('status_catalog').insert({ name:newStName.trim(), domain:newStDomain, sort_order:newStSort||0, is_active:true, company_id: profile?.company_id });
      if (ins?.error) throw ins.error;
      setNewStName(''); setNewStSort(0);
      toast.success('Status adicionado');
      loadStatuses();
    } catch(e){ toast.error('Falha ao adicionar status'); }
  }
  async function toggleStatus(id:string, active:boolean){
    try {
      const from = supabase as unknown as AnyFrom;
      await from.from('status_catalog').update({ is_active: !active }).eq('id', id);
      loadStatuses();
    } catch(e){ toast.error('Falha ao atualizar'); }
  }
  async function deleteStatus(id:string){
    if (!canEdit) { toast.error('Sem permissão'); return; }
    try {
      const from = supabase as unknown as AnyFrom;
      await from.from('status_catalog').delete().eq('id', id);
      loadStatuses();
    } catch(e){ toast.error('Falha ao excluir'); }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border overflow-hidden">
        <button className={`px-3 py-1.5 text-sm ${tab==='cc'?'bg-primary text-primary-foreground':''}`} onClick={()=>setTab('cc')}>Centro de custos</button>
        <button className={`px-3 py-1.5 text-sm ${tab==='status'?'bg-primary text-primary-foreground':''}`} onClick={()=>setTab('status')}>Status</button>
      </div>

      {tab==='cc' && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <Label className="text-xs">Código</Label>
              <Input value={newCcCode} onChange={(e)=>setNewCcCode(e.target.value)} placeholder="Ex: 01" />
            </div>
            <div className="col-span-7">
              <Label className="text-xs">Nome</Label>
              <Input value={newCcName} onChange={(e)=>setNewCcName(e.target.value)} placeholder="Ex: Administrativo" />
            </div>
            <div className="col-span-2">
              <Button className="w-full" onClick={addCC} disabled={!canEdit}>Adicionar</Button>
            </div>
          </div>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs">
                <tr><th className="text-left px-2 py-1">Código</th><th className="text-left px-2 py-1">Nome</th><th className="text-center px-2 py-1">Ativo</th><th className="text-center px-2 py-1">Ações</th></tr>
              </thead>
              <tbody>
                {cc.map(row=> (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-1">{row.code}</td>
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1 text-center">{row.is_active ? 'Sim':'Não'}</td>
                    <td className="px-2 py-1 text-center">
                      <Button size="sm" variant="outline" className="mr-2" onClick={()=>toggleCC(row.id, row.is_active)}>Ativar/Desativar</Button>
                      <Button size="sm" variant="destructive" onClick={()=>deleteCC(row.id)} disabled={!canEdit}>Excluir</Button>
                    </td>
                  </tr>
                ))}
                {(!cc || cc.length===0) && (
                  <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-4">Nenhum centro de custos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='status' && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6">
              <Label className="text-xs">Nome do status</Label>
              <Input value={newStName} onChange={(e)=>setNewStName(e.target.value)} placeholder="Ex: Rascunho" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Tipo</Label>
              <Select value={newStDomain} onValueChange={(v)=>setNewStDomain(v as 'ORCAMENTO'|'PEDIDO')}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORCAMENTO">Orçamento</SelectItem>
                  <SelectItem value="PEDIDO">Pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Ordem</Label>
              <Input type="number" value={newStSort} onChange={(e)=>setNewStSort(Number(e.target.value||0))} />
            </div>
            <div className="col-span-2">
              <Button className="w-full" onClick={addStatus} disabled={!canEdit}>Adicionar</Button>
            </div>
          </div>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs">
                <tr><th className="text-left px-2 py-1">Nome</th><th className="text-left px-2 py-1">Tipo</th><th className="text-center px-2 py-1">Ordem</th><th className="text-center px-2 py-1">Ativo</th><th className="text-center px-2 py-1">Ações</th></tr>
              </thead>
              <tbody>
                {st.map(row=> (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1">{row.domain==='ORCAMENTO'?'Orçamento':'Pedido'}</td>
                    <td className="px-2 py-1 text-center">{row.sort_order}</td>
                    <td className="px-2 py-1 text-center">{row.is_active ? 'Sim':'Não'}</td>
                    <td className="px-2 py-1 text-center">
                      <Button size="sm" variant="outline" className="mr-2" onClick={()=>toggleStatus(row.id, row.is_active)}>Ativar/Desativar</Button>
                      <Button size="sm" variant="destructive" onClick={()=>deleteStatus(row.id)} disabled={!canEdit}>Excluir</Button>
                    </td>
                  </tr>
                ))}
                {(!st || st.length===0) && (
                  <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-4">Nenhum status</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
