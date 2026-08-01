import { cache } from 'react';
import { serverApi } from '@/lib/api';
import { isValidProfileUsername } from '@/lib/username';
import type { User } from '@/types';

/**
 * Dedupes generateMetadata + page SSR in the same request
 * (React cache) and skips junk path segments before hitting the API.
 */
export const getUserByUsernameCached = cache(async (username: string): Promise<User | null> => {
  if (!isValidProfileUsername(username)) return null;
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return data.data;
  } catch {
    return null;
  }
});
