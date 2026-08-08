import { cache } from 'react';
import { isAxiosError } from 'axios';
import { serverApi } from '@/lib/api';
import { isValidProfileUsername } from '@/lib/username';
import type { User } from '@/types';

export type ProfileLookup =
  | { status: 'ok'; user: User }
  | { status: 'not_found' }
  /** Peer blocked the viewer (or bi-directional gate) — YouTube-style unavailable. */
  | { status: 'unavailable' };

/**
 * Dedupes generateMetadata + page SSR in the same request
 * (React cache) and skips junk path segments before hitting the API.
 */
export const lookupUserByUsernameCached = cache(async (username: string): Promise<ProfileLookup> => {
  if (!isValidProfileUsername(username)) return { status: 'not_found' };
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return { status: 'ok', user: data.data as User };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 403) {
      return { status: 'unavailable' };
    }
    return { status: 'not_found' };
  }
});

/** Convenience for callers that only need user-or-null (treats unavailable as missing). */
export const getUserByUsernameCached = cache(async (username: string): Promise<User | null> => {
  const result = await lookupUserByUsernameCached(username);
  return result.status === 'ok' ? result.user : null;
});
