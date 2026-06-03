/** Mirrors @forge/shared-types content visibility for API use without circular deps. */
export const ContentVisibility = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  TIER: 'tier',
  PRIVATE: 'private',
  PAID_EVENT: 'paid_event',
  UNLISTED: 'unlisted',
} as const;

export const StreamVisibility = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  TIER: 'tier',
  PRIVATE: 'private',
  PAID_EVENT: 'paid_event',
} as const;
