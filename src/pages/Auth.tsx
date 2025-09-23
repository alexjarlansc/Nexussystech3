import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function Auth() {
  const { user, loading, error, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up Form State
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [companies, setCompanies] = useState<Array<{id:string;name:string}>>([]);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [inviteCode, setInviteCode] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) {
      toast.error('Preencha email e senha');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(signInEmail, signInPassword);
    
    if (error) {
      toast.error(error.message || 'Erro ao fazer login');
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signUpEmail || !signUpPassword || !firstName || !companyName) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, {
      firstName,
      companyName,
      cnpjCpf,
      phone,
      companyEmail,
      address,
      role,
      inviteCode,
    });
    
    if (error) {
      toast.error(error.message || 'Erro ao criar conta');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 card-elevated">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary mb-2">NexusSystech</h1>
          <p className="text-muted-foreground">Sistema de Orçamentos</p>
          {error && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <Tabs defaultValue="signin" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signin-password">Senha</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="first-name">Nome *</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                  required
                />
              </div>

              <div>
                <Label htmlFor="signup-email">Email *</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="signup-password">Senha *</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company-name">Nome da Empresa *</Label>
                <div className="flex gap-2">
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Sua empresa"
                    required
                  />
                  <Button type="button" variant="outline" onClick={async ()=>{
                    setCompanyModalOpen(true);
                    try {
                      const { data, error } = await supabase.from('companies').select('id,name').order('name');
                      if (error) throw error;
                      setCompanies(((data as unknown) as Array<{id:string;name:string}>) || []);
                    } catch (err) {
                      console.error('Erro ao carregar empresas', err);
                      toast.error('Não foi possível carregar empresas');
                    }
                  }}>Selecionar</Button>
                </div>
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
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="company-email">Email da Empresa</Label>
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

              <div>
                <Label htmlFor="role">Tipo de Usuário</Label>
                <Select value={role} onValueChange={(v: 'user' | 'admin') => setRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invite-code">Código de Convite (obrigatório para Admin)</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Código fornecido pelo administrador"
                  required={role === 'admin'}
                />
              </div>

              <Dialog open={companyModalOpen} onOpenChange={(o)=>setCompanyModalOpen(o)}>
                <DialogContent className='sm:max-w-lg max-h-[70vh] overflow-y-auto'>
                  <DialogHeader>
                    <DialogTitle>Selecionar Empresa</DialogTitle>
                  </DialogHeader>
                  <div className='space-y-3 max-h-80 overflow-auto'>
                    {companies.length === 0 ? (
                      <div className='text-sm text-muted-foreground p-4'>Nenhuma empresa disponível</div>
                    ) : (
                      companies.map(c => (
                        <div key={c.id} className='flex items-center justify-between p-2 border rounded'>
                          <div>
                            <div className='font-medium'>{c.name}</div>
                            <div className='text-xs text-muted-foreground'>Código: {c.id}</div>
                          </div>
                          <div className='flex gap-2'>
                            <Button size='sm' variant='ghost' onClick={async ()=>{ try{ await navigator.clipboard.writeText(c.id); toast.success('Código copiado para a área de transferência'); }catch(e){ console.error(e); toast.error('Falha ao copiar'); } }}>Copiar código</Button>
                            <Button size='sm' onClick={()=>{ setCompanyName(c.name); setCompanyCode(c.id); setCompanyModalOpen(false); toast.success('Empresa selecionada'); }}>Selecionar</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant='outline' onClick={()=>setCompanyModalOpen(false)}>Fechar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-4 text-sm text-muted-foreground">
          <p>Esqueceu sua senha? Entre em contato com o administrador.</p>
        </div>
      </Card>
    </div>
  );
}