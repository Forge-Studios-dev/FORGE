import { beforeEach, describe, expect, it } from 'vitest';
import { clearAdminSession, getAdminAccessToken, persistAdminSession } from './auth-storage';

describe('admin auth-storage', () => {
  beforeEach(() => {
    // Module-level memory cache persists across tests in the same file — reset it too.
    clearAdminSession();
    sessionStorage.clear();
  });

  it('returns null when no session has been persisted', () => {
    expect(getAdminAccessToken()).toBeNull();
  });

  it('persists the token to sessionStorage and returns it from memory', () => {
    persistAdminSession('admin-jwt');
    expect(getAdminAccessToken()).toBe('admin-jwt');
    expect(sessionStorage.getItem('forge_admin_token')).toBe('admin-jwt');
  });

  it('falls back to sessionStorage when the in-memory cache is empty (e.g. after a hard reload)', () => {
    sessionStorage.setItem('forge_admin_token', 'restored-jwt');
    expect(getAdminAccessToken()).toBe('restored-jwt');
  });

  it('clearAdminSession removes both the memory cache and sessionStorage', () => {
    persistAdminSession('admin-jwt');
    clearAdminSession();
    expect(getAdminAccessToken()).toBeNull();
    expect(sessionStorage.getItem('forge_admin_token')).toBeNull();
  });
});
