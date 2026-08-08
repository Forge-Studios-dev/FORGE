/** Handles reserved for app routes / product surfaces — cannot be claimed. */
export const RESERVED_USERNAMES = new Set(
  [
    'admin',
    'api',
    'auth',
    'embed',
    'explore',
    'feed',
    'help',
    'history',
    'library',
    'live',
    'login',
    'me',
    'messages',
    'notifications',
    'onboarding',
    'profile',
    'search',
    'settings',
    'shorts',
    'signup',
    'studio',
    'subscriptions',
    'support',
    'trending',
    'upload',
    'watch',
    'www',
    'forge',
  ].map((s) => s.toLowerCase()),
);

export const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
