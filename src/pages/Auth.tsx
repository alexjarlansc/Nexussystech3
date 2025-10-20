import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// removed tabs/select to keep design simple and consistent
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
// SMS standalone removido; fluxo integrado ao Criar Conta

export default function Auth() {
  const { user, loading, error, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

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
  const [signUpPhone, setSignUpPhone] = useState('');
  const [role] = useState<'user' | 'admin'>('user');
  const [companyIdInput, setCompanyIdInput] = useState('');

  // Removido fluxo de SMS do Criar Conta

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
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
  // Validações básicas e exigência de ID da empresa
    if (!firstName) { toast.error('Informe seu nome'); return; }
  if (!signUpEmail || !signUpPassword) { toast.error('Preencha todos os campos obrigatórios'); return; }
    if (signUpPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
  if (!signUpPhone.trim()) { toast.error('Informe seu telefone'); return; }
  const companyId = (companyIdInput || '').trim();
  if (!companyId) { toast.error('Informe o ID da empresa'); return; }
  // validação simples de UUID v4 (best-effort), não bloqueia se falhar
  const uuidLike = /^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?$/;
  if (!uuidLike.test(companyId)) { toast.error('ID de empresa inválido (esperado UUID)'); return; }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword.trim(),
        options: { emailRedirectTo: redirectUrl, data: { first_name: firstName.trim(), phone: signUpPhone.trim(), pending_company_id: companyId } }
      });
      if (error) { toast.error(error.message || 'Falha ao criar conta'); setIsLoading(false); return; }

      // Se não há sessão (confirmação de email), finaliza aqui
      if (!data.session) {
        toast.success('Conta criada! Use o link enviado no email para acessar. Seu perfil será configurado no primeiro login.');
        setIsLoading(false);
        return;
      }

  // Com sessão ativa: garantir profile e aplicar company_id informado
      try { await (supabase as unknown as { rpc: (name: string) => Promise<unknown> }).rpc('ensure_profile'); } catch (e) { if (import.meta.env.DEV) console.warn('ensure_profile rpc falhou', e); }

      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const patch: Record<string, unknown> = { first_name: firstName, phone: signUpPhone.trim(), role, company_id: companyId };
          const { error: upErr } = await supabase.from('profiles').update(patch).eq('user_id', uid);
          if (upErr && import.meta.env.DEV) console.warn('Falha ao atualizar profile pós-signup', upErr);
          // Limpa a flag pendente nos metadados, já aplicado
          try { await supabase.auth.updateUser({ data: { pending_company_id: null } }); } catch (e) { /* noop */ }
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
  <div className="min-h-svh gradient-hero flex items-center justify-center p-4">
      <div className="flex flex-col items-center mb-6">
          <img src="/NEXUS_SYSTECH.svg" alt="Nexus Systech" className="h-40 mb-1" style={{maxWidth:'90%'}} />
      </div>
      <Card className="w-full max-w-md p-6 card-elevated">
        {error && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
            {error}
          </div>
        )}

        {!showSignUp && (
          <>
            <div className="space-y-4 w-full">
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
            </div>

            <div className="text-center mt-4 text-sm text-muted-foreground flex items-center justify-between">
              <button className="underline" onClick={() => setResetOpen(true)}>Redefinir senha</button>
              <button className="underline" onClick={() => setShowSignUp(true)}>Criar conta</button>
            </div>
          </>
        )}

        {showSignUp && (
          <>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="signup-name">Nome</Label>
                <Input id="signup-name" value={firstName} onChange={(e)=>setFirstName(e.target.value)} placeholder="Seu nome" required />
              </div>
              <div>
                <Label htmlFor="signup-phone">Telefone</Label>
                <Input id="signup-phone" value={signUpPhone} onChange={(e)=>setSignUpPhone(e.target.value)} placeholder="(DDD) 90000-0000" required />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={signUpEmail} onChange={(e)=>setSignUpEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div>
                <Label htmlFor="signup-password">Senha</Label>
                <Input id="signup-password" type="password" value={signUpPassword} onChange={(e)=>setSignUpPassword(e.target.value)} placeholder="Crie uma senha" required />
              </div>
              <div>
                <Label htmlFor="signup-company">ID da empresa</Label>
                <Input id="signup-company" value={companyIdInput} onChange={(e)=>setCompanyIdInput(e.target.value)} placeholder="Informe o ID (UUID) da empresa" required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando...' : 'Criar conta'}
              </Button>
            </form>
            <div className="text-center mt-4 text-sm text-muted-foreground">
              <button className="underline" onClick={() => setShowSignUp(false)}>Já tem conta? Entrar</button>
            </div>
          </>
        )}

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