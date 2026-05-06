import { User } from '@/types';

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'UPLOAD_VIDEO'
  | 'START_STREAM'
  | 'MANAGE_PLATFORM';

export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('forge_user') || 'null') as User | null;
  } catch {
    return null;
  }
}

