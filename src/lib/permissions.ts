import type { Profile } from '@/hooks/authTypes';

export function hasPermission(profile: Profile | null | undefined, perm: string) {
  if (!profile) return false;
  // master is owner -> full access for all permissions
  if (profile.role === 'master') {
    return true;
  }
  if (!Array.isArray(profile.permissions)) return false;
  return profile.permissions.some(p => typeof p === 'string' && p === perm);
}
