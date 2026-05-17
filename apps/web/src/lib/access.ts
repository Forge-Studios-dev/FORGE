import {
  getAccessTier,
  hasAccessPermission,
  Permission,
  isPlatformAdminTier,
  isApprovedCreatorTier,
  canViewPersonalizedFeed as sharedCanViewPersonalizedFeed,
  canUploadOnConsumerApp,
  canGoLiveOnConsumerApp,
  canOpenStudioEntry,
  type AccessTier,
  type UserAccessProfile,
} from '@forge/shared-types';
import { User } from '@/types';

export type { AccessTier, Permission };
export { getAccessTier, Permission as ForgePermission };

export function userToAccessProfile(user: User | null | undefined): UserAccessProfile | null {
  if (!user) return null;
  return {
    role: user.role,
    creatorStatus: user.creatorStatus ?? null,
    isVerified: user.isVerified,
  };
}

export function getTier(user: User | null | undefined, hasSession: boolean): AccessTier {
  return getAccessTier(userToAccessProfile(user), hasSession);
}

export function hasPermission(
  user: User | null | undefined,
  permission: Permission,
  hasSession = !!user,
): boolean {
  return hasAccessPermission(
    userToAccessProfile(user),
    user?.permissions as Permission[] | undefined,
    permission,
    hasSession,
  );
}

/** YouTube-style capability helpers (consumer web app) */

export const canBrowse = () => true;

export function canEngage(user: User | null | undefined, hasSession: boolean): boolean {
  return hasPermission(user, Permission.ENGAGE, hasSession);
}

export function canUseLibrary(user: User | null | undefined, hasSession: boolean): boolean {
  return hasPermission(user, Permission.USE_LIBRARY, hasSession);
}

export function canAccessStudio(user: User | null | undefined, hasSession: boolean): boolean {
  const tier = getTier(user, hasSession);
  return canOpenStudioEntry(tier);
}

/** Upload on web — approved creators only (not platform admin). */
export function canUpload(user: User | null | undefined, hasSession: boolean): boolean {
  if (!hasSession) return false;
  return canUploadOnConsumerApp(getTier(user, hasSession));
}

export function canGoLive(user: User | null | undefined, hasSession: boolean): boolean {
  if (!hasSession) return false;
  return canGoLiveOnConsumerApp(getTier(user, hasSession));
}

export function canApplyForCreator(tier: AccessTier): boolean {
  return tier === 'viewer' || tier === 'creator_rejected';
}

export function isApprovedCreator(tier: AccessTier): boolean {
  return isApprovedCreatorTier(tier);
}

export function isPlatformAdmin(tier: AccessTier): boolean {
  return isPlatformAdminTier(tier);
}

export function canViewPersonalizedFeed(tier: AccessTier): boolean {
  return sharedCanViewPersonalizedFeed(tier);
}
