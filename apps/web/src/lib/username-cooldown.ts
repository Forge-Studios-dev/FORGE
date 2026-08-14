/** Shared username rename cooldown (mirrors API USERNAME_CHANGE_COOLDOWN_DAYS). */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

/**
 * When the handle can be changed again, or null if rename is allowed now.
 * `usernameChangedAt` is an ISO string from the API (or null/undefined never renamed).
 */
export function usernameRenameUnlockAt(
  usernameChangedAt: string | null | undefined,
  nowMs: number = Date.now(),
): Date | null {
  if (!usernameChangedAt) return null;
  const changed = Date.parse(usernameChangedAt);
  if (!Number.isFinite(changed)) return null;
  const unlock = new Date(changed);
  unlock.setUTCDate(unlock.getUTCDate() + USERNAME_CHANGE_COOLDOWN_DAYS);
  if (unlock.getTime() <= nowMs) return null;
  return unlock;
}

export function isUsernameRenameLocked(
  usernameChangedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return usernameRenameUnlockAt(usernameChangedAt, nowMs) !== null;
}

/** YYYY-MM-DD for helper copy. */
export function formatUsernameUnlockDate(unlock: Date): string {
  return unlock.toISOString().slice(0, 10);
}
