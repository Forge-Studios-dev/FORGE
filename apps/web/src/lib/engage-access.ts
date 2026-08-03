import { User } from '@/types';
import { canEngage } from '@/lib/access';

export type EngageBlockReason = 'guest' | 'unverified' | null;

/** Whether the user may like, comment, or follow (signed-in + email verified). */
export function getEngageBlockReason(
  user: User | null | undefined,
  isGuest: boolean,
): EngageBlockReason {
  if (isGuest || !user) return 'guest';
  if (!user.isVerified) return 'unverified';
  if (!canEngage(user, true)) return 'unverified';
  return null;
}

export function engageBlockedMessage(reason: EngageBlockReason): string {
  if (reason === 'unverified') {
    return 'Verify your email to like, comment, and subscribe.';
  }
  return 'Sign in to like, comment, and subscribe.';
}
