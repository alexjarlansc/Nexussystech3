import type { Profile } from '@/hooks/authTypes';

export function hasPermission(profile: Profile | null | undefined, perm: string) {
  if (!profile) return false;
  // master (tolerant to variants) is owner -> full access for all permissions
  if (isMasterRole(profile.role)) {
    return true;
  }
  if (!Array.isArray(profile.permissions)) return false;
  return profile.permissions.some(p => typeof p === 'string' && p === perm);
}

export function isMasterRole(role?: string | null) {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  // accept common synonyms / localized variants and combined strings
  if (['master', 'mestre', 'owner', 'dono'].includes(r)) return true;
  if (r.includes('master')) return true;
  if (r.includes('mestre')) return true;
  if (r.includes('owner')) return true;
  if (r.includes('dono')) return true;
  return false;
}

export function isAdminOrMasterRole(role?: string | null) {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  const adminVariants = ['admin', 'administrator', 'administrador', 'adm', 'administrador(a)'];
  return adminVariants.includes(r) || isMasterRole(r);
}
