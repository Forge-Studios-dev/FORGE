import { Permission } from '@forge/shared-types';
import { User } from '@/types';
import { hasPermission as checkPermission } from '@/lib/access';

export type { Permission };

export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  return checkPermission(user, permission, !!user);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('forge_user') || 'null') as User | null;
  } catch {
    return null;
  }
}

