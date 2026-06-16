import Redis from 'ioredis';

/** When set, periodic worker scans skip Postgres (refreshed on empty scan). */
export const PLATFORM_DORMANT_KEY = 'streams:platform:dormant';

export async function isPlatformDormant(redis: Redis): Promise<boolean> {
  try {
    return (await redis.get(PLATFORM_DORMANT_KEY)) === '1';
  } catch {
    return false;
  }
}
