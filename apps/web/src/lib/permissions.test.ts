import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredUser, hasPermission } from './permissions';
import { Permission } from '@forge/shared-types';
import type { User } from '@/types';

describe('getStoredUser', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredUser()).toBeNull();
  });

  it('parses a stored user', () => {
    const user = { id: 'u1', username: 'u', role: 'user' };
    localStorage.setItem('forge_user', JSON.stringify(user));
    expect(getStoredUser()).toEqual(user);
  });

  it('returns null instead of throwing on corrupted JSON', () => {
    localStorage.setItem('forge_user', '{not valid json');
    expect(getStoredUser()).toBeNull();
  });
});

describe('hasPermission', () => {
  it('delegates to the access-tier permission check', () => {
    const verifiedUser: User = {
      id: 'u1',
      email: 'u@example.com',
      username: 'u',
      displayName: 'U',
      role: 'user',
      isVerified: true,
      followerCount: 0,
      followingCount: 0,
      videoCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(hasPermission(verifiedUser, Permission.ENGAGE)).toBe(true);
    expect(hasPermission(null, Permission.ENGAGE)).toBe(false);
  });
});
