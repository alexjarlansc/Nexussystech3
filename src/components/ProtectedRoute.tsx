import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: Array<'user' | 'admin' | 'pdv'>;
}

export function ProtectedRoute({ children, requireAdmin = false, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Não redireciona para login enquanto ainda estamos resolvendo sessão/perfil
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Bloqueia usuários suspensos
  const isSuspended = Array.isArray(profile?.permissions) && profile?.permissions?.includes('suspended');
  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Conta suspensa</h2>
          <p className="text-muted-foreground">Entre em contato com o administrador para reativar seu acesso.</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Seu perfil não possui acesso.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}