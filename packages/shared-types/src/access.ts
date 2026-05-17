/**
 * YouTube-style access tiers and permissions (sync across API, web, admin, mobile).
 *
 * Mapped to YouTube (consumer site vs studio.youtube.com vs internal admin):
 *
 * | FORGE tier        | YouTube analogue              | Browse/watch | Like/comment/subscribe | Library/history | Studio entry | Upload/go live |
 * |-------------------|-------------------------------|--------------|------------------------|-----------------|--------------|----------------|
 * | guest             | Signed out                    | yes          | no (sign-in prompts)   | no              | no           | no             |
 * | viewer            | Signed in, no channel         | yes          | yes                    | yes             | apply        | no             |
 * | creator_pending   | Channel / YPP pending         | yes          | yes                    | yes             | status only  | no             |
 * | creator_rejected  | Monetization rejected         | yes          | yes                    | yes             | re-apply     | no             |
 * | creator           | Channel owner (approved)      | yes          | yes                    | yes             | full Studio  | yes*           |
 * | admin             | Internal ops (admin app only) | N/A on web   | N/A                    | N/A             | admin panel  | via API only   |
 *
 * *Creator upload/live requires email verified + creatorStatus approved.
 * Platform admins use the admin app (:3002), not consumer Studio/upload UI.
 */

export const Permission = {
  /** Like, comment, follow, report (signed-in viewer). */
  ENGAGE: 'ENGAGE',
  /** Playlists, watch history, notifications. */
  USE_LIBRARY: 'USE_LIBRARY',
  /** Creator studio shell (apply / status while pending). */
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  UPLOAD_VIDEO: 'UPLOAD_VIDEO',
  START_STREAM: 'START_STREAM',
  /** Admin panel / platform moderation only. */
  MANAGE_PLATFORM: 'MANAGE_PLATFORM',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export type UserRole = 'user' | 'creator' | 'admin';
export type CreatorStatus = 'pending' | 'approved' | 'rejected';

export type AccessTier =
  | 'guest'
  | 'viewer'
  | 'creator_pending'
  | 'creator_rejected'
  | 'creator'
  | 'admin';

export interface UserAccessProfile {
  role: UserRole;
  creatorStatus?: CreatorStatus | null;
  isVerified?: boolean;
}

export function getAccessTier(
  profile: UserAccessProfile | null | undefined,
  hasSession: boolean,
): AccessTier {
  if (!hasSession || !profile) return 'guest';
  if (profile.role === 'admin') return 'admin';
  if (profile.role === 'creator') {
    if (profile.creatorStatus === 'rejected') return 'creator_rejected';
    if (profile.creatorStatus === 'approved' && profile.isVerified === true) return 'creator';
    return 'creator_pending';
  }
  return 'viewer';
}

export function permissionsForProfile(profile: UserAccessProfile): Permission[] {
  const tier = getAccessTier(profile, true);
  const base: Permission[] = [Permission.ENGAGE, Permission.USE_LIBRARY];

  switch (tier) {
    case 'admin':
      return [
        ...base,
        Permission.VIEW_DASHBOARD,
        Permission.UPLOAD_VIDEO,
        Permission.START_STREAM,
        Permission.MANAGE_PLATFORM,
      ];
    case 'creator':
      return [...base, Permission.VIEW_DASHBOARD, Permission.UPLOAD_VIDEO, Permission.START_STREAM];
    case 'creator_pending':
    case 'creator_rejected':
      return [...base, Permission.VIEW_DASHBOARD];
    case 'viewer':
      return base;
    default:
      return [];
  }
}

export function hasPermission(
  profile: UserAccessProfile | null | undefined,
  granted: Permission[] | undefined,
  permission: Permission,
  hasSession: boolean,
): boolean {
  if (!hasSession || !profile) return false;
  if (Array.isArray(granted) && granted.includes(permission)) return true;
  return permissionsForProfile(profile).includes(permission);
}

/** Internal platform operator — use admin app, not consumer Studio. */
export function isPlatformAdminTier(tier: AccessTier): boolean {
  return tier === 'admin';
}

/** Approved creator channel (not guest, viewer, pending, rejected, or admin). */
export function isApprovedCreatorTier(tier: AccessTier): boolean {
  return tier === 'creator';
}

/** YouTube: home recommendations / For You require a signed-in account. */
export function canViewPersonalizedFeed(tier: AccessTier): boolean {
  return tier !== 'guest';
}

/** Consumer app create/upload button — channel owners only. */
export function canUploadOnConsumerApp(tier: AccessTier): boolean {
  return tier === 'creator';
}

export function canGoLiveOnConsumerApp(tier: AccessTier): boolean {
  return tier === 'creator';
}

/** Signed-in users can open Studio to apply or see status (like studio.youtube.com entry). */
export function canOpenStudioEntry(tier: AccessTier): boolean {
  return tier !== 'guest' && tier !== 'admin';
}
