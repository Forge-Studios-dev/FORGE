import { describe, expect, it } from 'vitest';
import {
  canApplyForCreator,
  canGoLive,
  canUpload,
  getTier,
  hasPermission,
  isApprovedCreator,
  isPlatformAdmin,
  ForgePermission,
} from './access';
import type { User } from '@/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
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
    ...overrides,
  };
}

describe('access tiers (getTier)', () => {
  it('is guest when there is no session, regardless of user data', () => {
    expect(getTier(makeUser(), false)).toBe('guest');
    expect(getTier(null, false)).toBe('guest');
  });

  it('is viewer for a signed-in plain user', () => {
    expect(getTier(makeUser({ role: 'user' }), true)).toBe('viewer');
  });

  it('is creator_pending for an unapproved or unverified creator', () => {
    expect(getTier(makeUser({ role: 'creator', creatorStatus: 'pending' }), true)).toBe(
      'creator_pending',
    );
    expect(
      getTier(makeUser({ role: 'creator', creatorStatus: 'approved', isVerified: false }), true),
    ).toBe('creator_pending');
  });

  it('is creator_rejected when the creator application was rejected', () => {
    expect(getTier(makeUser({ role: 'creator', creatorStatus: 'rejected' }), true)).toBe(
      'creator_rejected',
    );
  });

  it('is creator only when approved AND email-verified', () => {
    expect(
      getTier(makeUser({ role: 'creator', creatorStatus: 'approved', isVerified: true }), true),
    ).toBe('creator');
  });

  it('is admin for platform admins', () => {
    expect(getTier(makeUser({ role: 'admin' }), true)).toBe('admin');
  });
});

describe('canUpload', () => {
  it('denies upload without a session', () => {
    expect(canUpload(makeUser({ role: 'creator', creatorStatus: 'approved' }), false)).toBe(false);
  });

  it('denies upload for a pending creator', () => {
    expect(canUpload(makeUser({ role: 'creator', creatorStatus: 'pending' }), true)).toBe(false);
  });

  it('allows upload for an approved, verified creator', () => {
    expect(
      canUpload(makeUser({ role: 'creator', creatorStatus: 'approved', isVerified: true }), true),
    ).toBe(true);
  });

  it('allows upload when the API has explicitly granted UPLOAD_VIDEO, even off the default tier rule', () => {
    const user = makeUser({
      role: 'user',
      permissions: [ForgePermission.UPLOAD_VIDEO],
    });
    expect(canUpload(user, true)).toBe(true);
  });
});

describe('canGoLive', () => {
  it('mirrors the same approved+verified creator gate as upload', () => {
    const approved = makeUser({ role: 'creator', creatorStatus: 'approved', isVerified: true });
    expect(canGoLive(approved, true)).toBe(true);
    expect(canGoLive(makeUser({ role: 'user' }), true)).toBe(false);
  });

  it('denies without a session', () => {
    expect(canGoLive(makeUser({ role: 'creator', creatorStatus: 'approved' }), false)).toBe(false);
  });
});

describe('canApplyForCreator', () => {
  it('allows applying from viewer or a rejected prior application', () => {
    expect(canApplyForCreator('viewer')).toBe(true);
    expect(canApplyForCreator('creator_rejected')).toBe(true);
  });

  it('does not allow re-applying while already pending or approved', () => {
    expect(canApplyForCreator('creator_pending')).toBe(false);
    expect(canApplyForCreator('creator')).toBe(false);
  });
});

describe('isApprovedCreator / isPlatformAdmin', () => {
  it('only the creator tier counts as an approved creator', () => {
    expect(isApprovedCreator('creator')).toBe(true);
    expect(isApprovedCreator('creator_pending')).toBe(false);
    expect(isApprovedCreator('admin')).toBe(false);
  });

  it('only the admin tier counts as a platform admin', () => {
    expect(isPlatformAdmin('admin')).toBe(true);
    expect(isPlatformAdmin('creator')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('denies everything without a session', () => {
    expect(hasPermission(makeUser(), ForgePermission.ENGAGE, false)).toBe(false);
  });

  it('grants ENGAGE to a verified signed-in viewer', () => {
    expect(hasPermission(makeUser({ role: 'user', isVerified: true }), ForgePermission.ENGAGE, true)).toBe(
      true,
    );
  });

  it('denies ENGAGE to an unverified viewer', () => {
    expect(
      hasPermission(makeUser({ role: 'user', isVerified: false }), ForgePermission.ENGAGE, true),
    ).toBe(false);
  });

  it('grants MANAGE_PLATFORM only to admins', () => {
    expect(hasPermission(makeUser({ role: 'admin' }), ForgePermission.MANAGE_PLATFORM, true)).toBe(
      true,
    );
    expect(
      hasPermission(
        makeUser({ role: 'creator', creatorStatus: 'approved', isVerified: true }),
        ForgePermission.MANAGE_PLATFORM,
        true,
      ),
    ).toBe(false);
  });
});
