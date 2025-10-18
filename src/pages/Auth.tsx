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
// SMS standalone removido; fluxo integrado ao Criar Conta

export default function Auth() {
  const { user, loading, error, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Reset password dialog state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up Form State
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [inviteCode, setInviteCode] = useState('');

  // Removido fluxo de SMS do Criar Conta

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error('Informe seu email'); return; }
    try {
      setIsLoading(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (err) { toast.error(err.message || 'Falha ao enviar link de redefinição'); }
      else { toast.success('Enviamos instruções para redefinir sua senha'); setResetOpen(false); }
    } catch {
      toast.error('Erro inesperado ao solicitar redefinição');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) {
      toast.error('Preencha email e senha');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await signIn(signInEmail, signInPassword);
      if (error) toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validações básicas e exigência de convite
    if (!firstName) { toast.error('Informe seu nome'); return; }
    if (!signUpEmail || !signUpPassword) { toast.error('Preencha todos os campos obrigatórios'); return; }
    if (signUpPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    const codeTrim = (inviteCode || '').trim();
    if (!codeTrim) { toast.error('Informe o código de convite gerado pelo administrador'); return; }

    setIsLoading(true);
    try {
      // Validar convite ANTES de criar o usuário
      type InviteRow = { code?: string; company_id?: string | null; role?: 'user'|'admin'|'pdv'|string };
      let inviteRow: InviteRow | null = null;
      try {
        const rpc = await (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }> }).rpc('validate_invite', { inv_code: codeTrim });
        const invDataUnknown = rpc?.data as unknown;
        const invRow = Array.isArray(invDataUnknown) ? invDataUnknown[0] : invDataUnknown;
        if (invRow) inviteRow = invRow as InviteRow; else { toast.error('Código de convite inválido ou expirado'); setIsLoading(false); return; }
      } catch (err) {
        toast.error('Não foi possível validar o convite. Tente novamente.');
        setIsLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword.trim(),
        options: { emailRedirectTo: redirectUrl, data: { first_name: firstName.trim(), pending_invite_code: codeTrim } }
      });
      if (error) { toast.error(error.message || 'Falha ao criar conta'); setIsLoading(false); return; }

      // Se não há sessão (confirmação de email), finaliza aqui
      if (!data.session) {
        toast.success('Conta criada! Use o link enviado no email para acessar. Seu perfil será configurado no primeiro login.');
        setIsLoading(false);
        return;
      }

      // Com sessão ativa: garantir profile e aplicar convite se houver
      try { await (supabase as unknown as { rpc: (name: string) => Promise<unknown> }).rpc('ensure_profile'); } catch (e) { if (import.meta.env.DEV) console.warn('ensure_profile rpc falhou', e); }

      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const patch: Record<string, unknown> = { first_name: firstName, role };
          if (inviteRow?.role === 'admin') patch.role = 'admin';
          if (inviteRow?.company_id) patch.company_id = inviteRow.company_id;
          const { error: upErr } = await supabase.from('profiles').update(patch).eq('user_id', uid);
          if (upErr && import.meta.env.DEV) console.warn('Falha ao atualizar profile pós-signup', upErr);
          if (inviteRow?.code) await supabase.from('invite_codes').update({ used_by: uid, used_at: new Date().toISOString() }).eq('code', inviteRow.code);
          // Limpa a flag de invite pendente nos metadados, já aplicado
          try { await supabase.auth.updateUser({ data: { pending_invite_code: null } }); } catch (e) { /* noop */ }
        }
      } catch (e) { if (import.meta.env.DEV) console.warn('Falha ao finalizar patch de profile/convite', e); }

      toast.success('Conta criada com sucesso!');
    } catch {
      toast.error('Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  // fluxo de SMS está integrado no submit de Criar Conta

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 card-elevated">
        <div className="flex flex-col items-center mb-6">
          <img src="/NEXUS_SYSTECH.svg" alt="Nexus Systech" className="h-24 mb-1" style={{maxWidth:'90%'}} />
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

              {/* Campos de empresa removidos: agora a empresa vem do código de convite */}

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
                  required
                />
              </div>

              {/* Modal de seleção de empresa removido */}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-4 text-sm text-muted-foreground">
          <button className="underline" onClick={() => setResetOpen(true)}>Redefinir senha</button>
        </div>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redefinir senha</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? 'Enviando...' : 'Enviar link'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}