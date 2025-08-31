import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import { Profile, Company, BasicResult, InviteCode, InviteCodeResult, CodesResult, AuthSignUpData } from './authTypes';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<BasicResult>;
  signUp: (email: string, password: string, userData: AuthSignUpData) => Promise<BasicResult>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<BasicResult>;
  updateCompany: (data: Partial<Company>) => Promise<BasicResult>;
  generateInviteCode: (role: 'user' | 'admin' | 'pdv') => Promise<InviteCodeResult>;
  getInviteCodes: () => Promise<CodesResult>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Função interna que monta e retorna o valor do contexto
export function useAuthInternal() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadUserData = useCallback(async (userId: string, retryCount = 0) => {
    try {
      console.log(`📊 Carregando dados do usuário: ${userId}`);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (profileError) {
        console.error('❌ Erro ao carregar perfil:', profileError);
        if (retryCount < 2 && profileError.code !== 'PGRST116') {
          console.log(`🔄 Tentativa ${retryCount + 1} de carregar perfil...`);
          setTimeout(() => loadUserData(userId, retryCount + 1), 1000);
          return;
        }
        setError('Erro ao carregar dados do usuário');
        setLoading(false);
        return;
      }
      if (!profileData) {
        console.warn('⚠️ Perfil não encontrado para o usuário');
        setError('Perfil não encontrado. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }
      setProfile(profileData);
      console.log('✅ Perfil carregado:', profileData.role);
      if (profileData?.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profileData.company_id)
          .maybeSingle();
        if (companyError) {
          console.error('❌ Erro ao carregar empresa:', companyError);
          setError('Erro ao carregar dados da empresa');
        } else if (companyData) {
          setCompany(companyData);
          console.log('✅ Empresa carregada:', companyData.name);
        }
        if (profileData.role === 'pdv') {
          if (window.location.pathname !== '/pdv') navigate('/pdv', { replace: true });
        } else if (window.location.pathname === '/auth') {
          navigate('/', { replace: true });
        }
      }
    } catch (error) {
      console.error('❌ Erro em loadUserData:', error);
      setError('Erro inesperado ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    console.log('🔐 Inicializando autenticação...');
    let isMounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`🔐 Auth event: ${event}`, session?.user?.email);
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
        
        if (session?.user) {
          // Defer data fetching to prevent deadlocks
          setTimeout(() => {
            if (isMounted) {
              loadUserData(session.user.id);
            }
          }, 100);
        } else {
          setProfile(null);
          setCompany(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      console.log('🔐 Sessão inicial:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // loadUserData redefinido acima

  const cleanupAuthState = () => {
    console.log('🧹 Limpando estado de autenticação...');
    
    // Selective cleanup - only remove auth-related keys
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('supabase.auth.') || 
      key.includes('sb-zjaqjxqtbwrkhijdlvyo') ||
      key.startsWith('supabase-auth-token')
    );
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Removido: ${key}`);
    });
    
    // Clear session storage if needed
    if (sessionStorage) {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 Iniciando login para:', email);
      setError(null);
      
      // Clean up existing state
      cleanupAuthState();
      
      // Attempt global sign out (non-blocking)
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.log('ℹ️ Sign out prévio falhou (normal)');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        return { error };
      }

      if (data.user) {
        console.log('✅ Login bem-sucedido para:', email);
        // Let the auth state change handler manage the navigation
        return { error: null };
      }

      return { error: null };
    } catch (error) {
      console.error('❌ Erro inesperado no login:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, userData: AuthSignUpData) => {
    try {
      // Check invite code if provided
      if (userData.inviteCode) {
        const { data: inviteData, error: inviteError } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', userData.inviteCode)
          .is('used_by', null)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (inviteError || !inviteData) {
          return { error: { message: 'Código de convite inválido ou expirado' } };
        }
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: userData.firstName,
          }
        }
      });

      if (error) return { error };

      if (data.user) {
        // Create company first
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: userData.companyName,
            cnpj_cpf: userData.cnpjCpf,
            phone: userData.phone,
            email: userData.companyEmail,
            address: userData.address,
          })
          .select()
          .single();

        if (companyError) {
          console.error('Error creating company:', companyError);
          return { error: companyError };
        }

        // Create profile
    const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            company_id: companyData.id,
            first_name: userData.firstName,
            phone: userData.phone,
            email: data.user.email,
      role: userData.role || 'user',
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          return { error: profileError };
        }

        // Mark invite code as used if provided
        if (userData.inviteCode) {
          await supabase
            .from('invite_codes')
            .update({
              used_by: data.user.id,
              used_at: new Date().toISOString(),
            })
            .eq('code', userData.inviteCode);
        }

        toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Fazendo logout...');
      
      // Clean up auth state first
      cleanupAuthState();
      
      // Clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      setCompany(null);
      setError(null);
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
        console.log('✅ Logout realizado');
      } catch (err) {
        console.log('ℹ️ Sign out remoto falhou (normal)');
      }
      
      // Use React Router navigation instead of forced reload
      window.location.href = '/auth';
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      // Fallback: force navigation even if logout fails
      window.location.href = '/auth';
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('user_id', user?.id);

      if (error) return { error };

      // Reload profile data
      if (user) {
        await loadUserData(user.id);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateCompany = async (data: Partial<Company>) => {
    try {
      if (!profile?.company_id) {
        return { error: { message: 'Nenhuma empresa encontrada' } };
      }

      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', profile.company_id);

      if (error) return { error };

      // Reload company data
      if (user) {
        await loadUserData(user.id);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const generateInviteCode = async (role: 'user' | 'admin' | 'pdv') => {
    try {
      if (profile?.role !== 'admin') {
        return { error: { message: 'Apenas administradores podem gerar códigos de convite' } };
      }

      const code = await supabase.rpc('generate_invite_code');
      
  const { data, error } = await supabase
        .from('invite_codes')
        .insert({
          code: code.data,
          created_by: user?.id,
          role,
        })
        .select()
        .single();

      if (error) return { error };

      return { code: data.code, error: null };
    } catch (error) {
      return { code: undefined, error };
    }
  };

  const getInviteCodes = async () => {
    try {
      if (profile?.role !== 'admin') {
        return { data: [], error: { message: 'Acesso negado' } };
      }

  const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false });

  return { data: (data as InviteCode[]) || [], error };
    } catch (error) {
  return { data: [], error: error as { message: string } | null };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    company,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateCompany,
    generateInviteCode,
    getInviteCodes,
  };
  return value;
}

// Nota: arquivo exporta provider + hook; fast refresh warning pode ser ignorado neste contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}