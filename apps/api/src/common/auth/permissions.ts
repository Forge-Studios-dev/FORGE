import { CreatorStatus, User, UserRole } from '../../modules/users/entities/user.entity';

/**
 * Keep in sync with packages/shared-types/src/access.ts
 * API permissions include MANAGE_PLATFORM for admins; consumer web/mobile use tier helpers
 * so admins do not see Studio/upload (YouTube: ops use separate admin tools).
 */
export enum Permission {
  ENGAGE = 'ENGAGE',
  USE_LIBRARY = 'USE_LIBRARY',
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  UPLOAD_VIDEO = 'UPLOAD_VIDEO',
  START_STREAM = 'START_STREAM',
  MANAGE_PLATFORM = 'MANAGE_PLATFORM',
}

type AccessTier =
  | 'guest'
  | 'viewer'
  | 'creator_pending'
  | 'creator_rejected'
  | 'creator'
  | 'admin';

function getAccessTier(user: User): AccessTier {
  if (user.role === UserRole.ADMIN) return 'admin';
  if (user.role === UserRole.CREATOR) {
    if (user.creatorStatus === CreatorStatus.REJECTED) return 'creator_rejected';
    if (user.creatorStatus === CreatorStatus.APPROVED && user.isVerified) return 'creator';
    return 'creator_pending';
  }
  return 'viewer';
}

export function permissionsForUser(user: User): Permission[] {
  if (user.isActive === false) return [];

  const tier = getAccessTier(user);
  const verified = user.isVerified === true;
  /** Browse-only until email verified — no like/comment/follow/library mutations. */
  const signedInVerified = verified
    ? [Permission.ENGAGE, Permission.USE_LIBRARY]
    : [];

  switch (tier) {
    case 'admin':
      return [
        Permission.ENGAGE,
        Permission.USE_LIBRARY,
        Permission.VIEW_DASHBOARD,
        Permission.UPLOAD_VIDEO,
        Permission.START_STREAM,
        Permission.MANAGE_PLATFORM,
      ];
    case 'creator':
      return [
        ...signedInVerified,
        Permission.VIEW_DASHBOARD,
        Permission.UPLOAD_VIDEO,
        Permission.START_STREAM,
      ];
    case 'creator_pending':
    case 'creator_rejected':
      return [...signedInVerified, Permission.VIEW_DASHBOARD];
    case 'viewer':
    default:
      return signedInVerified;
  }
}

export function permissionsFromJwtRole(role: UserRole): Permission[] {
  if (role === UserRole.ADMIN) {
    return permissionsForUser({ role: UserRole.ADMIN, isVerified: true } as User);
  }
  return [];
}
