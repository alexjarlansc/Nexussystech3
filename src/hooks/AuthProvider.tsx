import { ReactNode } from 'react';
import { AuthContext, useAuthInternal } from './useAuth';

// Wrapper que expõe somente o Provider público
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthInternal();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;