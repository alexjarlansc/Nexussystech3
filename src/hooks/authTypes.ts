// Tipos e interfaces relacionados à autenticação extraídos de useAuth.tsx
export interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: 'user' | 'admin' | 'pdv';
  first_name?: string;
  phone?: string;
  email?: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj_cpf?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
}

export interface InviteCode {
  id?: string;
  code: string;
  role: 'user' | 'admin' | 'pdv';
  created_at?: string;
  expires_at?: string;
  used_by?: string | null;
}

export type BasicResult = { error: { message: string } | null };
export interface InviteCodeResult { code?: string; error: { message: string } | null }
export interface CodesResult { data: InviteCode[]; error: { message: string } | null }

export interface AuthSignUpData {
  firstName: string;
  companyName: string;
  cnpjCpf?: string;
  phone?: string;
  companyEmail?: string;
  address?: string;
  role?: 'user' | 'admin' | 'pdv';
  inviteCode?: string;
}
