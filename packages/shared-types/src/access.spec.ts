import {
  getAccessTier,
  permissionsForProfile,
  hasPermission,
  isPlatformAdminTier,
  isApprovedCreatorTier,
  canViewPersonalizedFeed,
  canUploadOnConsumerApp,
  canGoLiveOnConsumerApp,
  canOpenStudioEntry,
  Permission,
} from './access';

describe('getAccessTier', () => {
  it('returns guest when no session', () => {
    expect(getAccessTier(null, false)).toBe('guest');
    expect(getAccessTier({ role: 'user' }, false)).toBe('guest');
  });

  it('returns viewer for basic user with session', () => {
    expect(getAccessTier({ role: 'user' }, true)).toBe('viewer');
  });

  it('returns admin for admin role', () => {
    expect(getAccessTier({ role: 'admin' }, true)).toBe('admin');
  });

  it('returns creator for approved+verified creator', () => {
    expect(
      getAccessTier({ role: 'creator', creatorStatus: 'approved', isVerified: true }, true),
    ).toBe('creator');
  });

  it('returns creator_pending for approved creator without email verification', () => {
    expect(
      getAccessTier({ role: 'creator', creatorStatus: 'approved', isVerified: false }, true),
    ).toBe('creator_pending');
  });

  it('returns creator_pending for pending creator', () => {
    expect(
      getAccessTier({ role: 'creator', creatorStatus: 'pending', isVerified: true }, true),
    ).toBe('creator_pending');
  });

  it('returns creator_rejected for rejected creator', () => {
    expect(
      getAccessTier({ role: 'creator', creatorStatus: 'rejected', isVerified: true }, true),
    ).toBe('creator_rejected');
  });
});

describe('permissionsForProfile', () => {
  it('admin has all permissions', () => {
    const perms = permissionsForProfile({ role: 'admin' });
    expect(perms).toContain(Permission.MANAGE_PLATFORM);
    expect(perms).toContain(Permission.UPLOAD_VIDEO);
    expect(perms).toContain(Permission.START_STREAM);
  });

  it('creator has upload + stream but not manage_platform', () => {
    const perms = permissionsForProfile({
      role: 'creator',
      creatorStatus: 'approved',
      isVerified: true,
    });
    expect(perms).toContain(Permission.UPLOAD_VIDEO);
    expect(perms).toContain(Permission.START_STREAM);
    expect(perms).not.toContain(Permission.MANAGE_PLATFORM);
  });

  it('verified user has engage + use_library', () => {
    const perms = permissionsForProfile({ role: 'user', isVerified: true });
    expect(perms).toContain(Permission.ENGAGE);
    expect(perms).toContain(Permission.USE_LIBRARY);
  });

  it('unverified user has no permissions', () => {
    const perms = permissionsForProfile({ role: 'user', isVerified: false });
    expect(perms).toHaveLength(0);
  });
});

describe('hasPermission', () => {
  it('returns false when no session', () => {
    expect(
      hasPermission({ role: 'creator', creatorStatus: 'approved', isVerified: true }, [], Permission.UPLOAD_VIDEO, false),
    ).toBe(false);
  });

  it('returns true when permission in granted array', () => {
    expect(
      hasPermission({ role: 'user' }, [Permission.ENGAGE], Permission.ENGAGE, true),
    ).toBe(true);
  });

  it('returns true via derived permissions when not in granted', () => {
    expect(
      hasPermission(
        { role: 'admin' },
        undefined,
        Permission.MANAGE_PLATFORM,
        true,
      ),
    ).toBe(true);
  });
});

describe('tier predicates', () => {
  it('isPlatformAdminTier', () => {
    expect(isPlatformAdminTier('admin')).toBe(true);
    expect(isPlatformAdminTier('creator')).toBe(false);
  });

  it('isApprovedCreatorTier', () => {
    expect(isApprovedCreatorTier('creator')).toBe(true);
    expect(isApprovedCreatorTier('creator_pending')).toBe(false);
  });

  it('canViewPersonalizedFeed', () => {
    expect(canViewPersonalizedFeed('guest')).toBe(false);
    expect(canViewPersonalizedFeed('viewer')).toBe(true);
    expect(canViewPersonalizedFeed('creator')).toBe(true);
  });

  it('canUploadOnConsumerApp', () => {
    expect(canUploadOnConsumerApp('creator')).toBe(true);
    expect(canUploadOnConsumerApp('viewer')).toBe(false);
  });

  it('canGoLiveOnConsumerApp', () => {
    expect(canGoLiveOnConsumerApp('creator')).toBe(true);
    expect(canGoLiveOnConsumerApp('creator_pending')).toBe(false);
  });

  it('canOpenStudioEntry', () => {
    expect(canOpenStudioEntry('guest')).toBe(false);
    expect(canOpenStudioEntry('admin')).toBe(false);
    expect(canOpenStudioEntry('viewer')).toBe(true);
    expect(canOpenStudioEntry('creator')).toBe(true);
  });
});
