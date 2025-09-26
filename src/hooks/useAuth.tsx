import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import { Profile, Company, BasicResult, InviteCode, InviteCodeResult, CodesResult, AuthSignUpData } from './authTypes';
import type { AppDatabase } from '@/integrations/supabase/types';

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
  generateInviteCode: (role: 'user' | 'admin' | 'pdv', companyId?: string) => Promise<InviteCodeResult>;
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
  const profErrCode = (profileError && typeof profileError === 'object' && 'code' in profileError) ? (profileError as unknown as { code?: string }).code : undefined;
        if (retryCount < 2 && profErrCode !== 'PGRST116') {
          console.log(`🔄 Tentativa ${retryCount + 1} de carregar perfil...`);
          setTimeout(() => loadUserData(userId, retryCount + 1), 1000);
          return;
        }
        setError('Erro ao carregar dados do usuário');
        setLoading(false);
        return;
      }
      if (!profileData) {
        console.warn('⚠️ Perfil não encontrado – tentando criar via ensure_profile()');
        try {
          const rpcRes = await (supabase as unknown as { rpc: (name: string) => Promise<unknown> }).rpc('ensure_profile');
          const rpcObj = rpcRes as { data?: unknown; error?: unknown } | undefined;
          const { data: ensured, error: ensureErr } = rpcObj || {};
          if (ensureErr) {
            console.error('❌ Falha ensure_profile:', ensureErr);
            setError('Perfil inexistente e não foi possível criar automaticamente. Contate suporte.');
            setLoading(false);
            return;
          }
          if (ensured) {
            console.log('✅ Perfil criado automaticamente');
            // Recarrega dados (evita duplicar lógica)
            setTimeout(() => loadUserData(userId, retryCount + 1), 200);
            return;
          }
        } catch (err: unknown) {
          console.error('❌ Exceção ensure_profile', err);
          setError('Falha ao criar perfil automaticamente');
          setLoading(false);
          return;
        }
      }
  // Normalize permissions to an array if missing
  const maybePerms = (profileData as unknown as { permissions?: unknown }).permissions;
  const permsArray = Array.isArray(maybePerms) ? (maybePerms as string[]) : [];
  const normalized: Profile = { ...(profileData as Profile), permissions: permsArray } as Profile;
  setProfile(normalized);
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
  let subscription: unknown = null;
    try {
      const subRes = supabase.auth.onAuthStateChange((event, session) => {
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
      });
      // subRes may be shaped as { data: { subscription } } in some supabase clients, normalize to subscription
      // Use unknown and narrow to avoid no-explicit-any eslint directive
      const subUnknown = subRes as unknown;
      if (subUnknown && typeof subUnknown === 'object') {
        const maybeData = (subUnknown as { data?: unknown }).data;
        if (maybeData && typeof maybeData === 'object' && 'subscription' in (maybeData as object)) {
          subscription = (maybeData as { subscription?: unknown }).subscription as unknown;
        } else {
          subscription = subRes as unknown;
        }
      } else {
  subscription = subRes as unknown;
      }
    } catch (e) {
      console.warn('Falha ao registrar auth state listener', e);
    }

    // THEN check for existing session with timeout fallback
    let sessionLoaded = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      sessionLoaded = true;
      console.log('🔐 Sessão inicial:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('Falha ao obter sessão inicial', err);
      if (!isMounted) setLoading(false);
    });

    // Fallback: se a sessão não for carregada em 5s, limpar loading para evitar spinner preso
    const fallback = setTimeout(()=>{
      if (!sessionLoaded && isMounted) {
        console.warn('Sessão inicial não carregou em tempo — aplicando fallback para evitar loading travado');
        setLoading(false);
      }
    }, 5000);

    // Also allow manual reload via window event for environments without realtime
    const reloadHandler = () => {
      try {
        if (session?.user) {
          console.log('Manual profile reload triggered');
          loadUserData(session.user.id);
        }
      } catch (e) {
        console.warn('erp:reload-profile handler failed', e);
      }
    };
    window.addEventListener('erp:reload-profile', reloadHandler as EventListener);

    return () => {
      isMounted = false;
      try {
        // unsubscribe if available (narrow unknown -> any safely)
        const subCandidate = subscription as unknown;
        if (subCandidate && typeof subCandidate === 'object') {
          const subObj = subCandidate as { unsubscribe?: () => void } & Record<string, unknown>;
          if (typeof subObj.unsubscribe === 'function') {
            subObj.unsubscribe();
          } else {
            const sbCandidate = supabase as unknown;
            if (sbCandidate && typeof sbCandidate === 'object') {
              const sbObj = sbCandidate as { removeChannel?: (c: unknown) => void } & Record<string, unknown>;
              if (typeof sbObj.removeChannel === 'function') sbObj.removeChannel(subCandidate);
            }
          }
        }
      } catch (e) { /* noop */ }
      try { window.removeEventListener('erp:reload-profile', reloadHandler as EventListener); } catch (e) { /* noop */ }
      clearTimeout(fallback);
    };
  // We intentionally only depend on loadUserData here; other values are read dynamically.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserData]);

  // Separate effect: subscribe to realtime profile updates for the logged in user so permission changes propagate
  useEffect(() => {
    if (!session?.user) return;
    let profileChannel: unknown = null;
    try {
      const client = supabase as unknown as { channel: (name: string) => { on: (event: string, opts: unknown, handler: (payload: unknown) => void) => { subscribe: () => unknown } } };
      profileChannel = client.channel(`profile-updates-${session.user.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${session.user.id}` }, (payload: unknown) => {
        console.log('🔁 Perfil atualizado via realtime:', payload);
        // Reload full profile data
        loadUserData(session.user.id);
      }).subscribe();
    } catch (e) {
      console.warn('Não foi possível assinar updates de perfil (separate effect):', e);
    }

    return () => {
      try { const remover = supabase as unknown as { removeChannel?: (c: unknown) => void }; if (remover.removeChannel && profileChannel) remover.removeChannel(profileChannel); } catch (e) { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadUserData]);

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
  permissions: [],
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

  const generateInviteCode = async (role: 'user' | 'admin' | 'pdv', companyId?: string) => {
    try {
      if (profile?.role !== 'admin') {
        return { error: { message: 'Apenas administradores podem gerar códigos de convite' } };
      }

      const code = await supabase.rpc('generate_invite_code');
      
      // Build payload conditionally to avoid inserting `company_id` when the
      // column doesn't exist in the target database (prevent Postgres errors)
      type InviteInsert = AppDatabase['public']['Tables']['invite_codes']['Insert'];
      const payload: Partial<InviteInsert> = {
        code: (code as unknown as { data?: string })?.data || '',
        created_by: user?.id || '',
        role,
      } as Partial<InviteInsert>;
  if (companyId) (payload as Partial<InviteInsert & { company_id?: string }>).company_id = companyId;

      // Debug log to help diagnose server-side errors
      console.debug('[Auth] Inserting invite code payload:', payload);

      const { data, error } = await supabase
        .from('invite_codes')
        .insert(payload as AppDatabase['public']['Tables']['invite_codes']['Insert'])
        .select()
        .single();

      if (error) {
        console.warn('[Auth] invite_codes insert errored:', error);
        // If the DB/schema complains about company_id missing, retry without it
  const errUnknown = error as unknown;
  const errMsg = (errUnknown && typeof errUnknown === 'object' && 'message' in (errUnknown as Record<string, unknown>)) ? (errUnknown as Record<string, unknown>).message as string : String(error);
        if (errMsg && errMsg.toLowerCase().includes('company_id')) {
          try {
            console.info('[Auth] Retrying invite_codes insert without company_id (fallback)');
            const payloadNoCompany = { ...payload } as Record<string, unknown>;
            delete payloadNoCompany.company_id;
            const { data: data2, error: error2 } = await supabase
              .from('invite_codes')
              .insert(payloadNoCompany as AppDatabase['public']['Tables']['invite_codes']['Insert'])
              .select()
              .single();
            if (error2) {
              const e2u = error2 as unknown;
              const msg2 = (e2u && typeof e2u === 'object' && 'message' in (e2u as Record<string, unknown>)) ? (e2u as Record<string, unknown>).message as string : String(error2);
              return { error: { message: msg2 } };
            }
            const maybe2 = data2 as unknown;
            if (maybe2 && typeof maybe2 === 'object' && 'code' in (maybe2 as Record<string, unknown>)) {
              const obj2 = maybe2 as Record<string, unknown>;
              const codeVal2 = typeof obj2.code === 'string' ? obj2.code : undefined;
              return { code: codeVal2, error: null };
            }
            return { code: undefined, error: null };
          } catch (e2) {
            console.error('[Auth] fallback insert failed:', e2);
            return { code: undefined, error: { message: String(e2) } };
          }
        }
        return { error };
      }

      // safety: data might be nullish in some failure modes
      const maybe = data as unknown;
      if (maybe && typeof maybe === 'object' && 'code' in (maybe as Record<string, unknown>)) {
        const obj = maybe as Record<string, unknown>;
        const codeVal = typeof obj.code === 'string' ? obj.code : undefined;
        return { code: codeVal, error: null };
      }
      return { code: undefined, error: null };
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