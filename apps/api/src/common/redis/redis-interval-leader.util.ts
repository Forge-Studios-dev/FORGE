import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { safeRedisSetNx } from './redis-safe.util';

/**
 * Returns true when this process should run a periodic job (only one Fly replica at a time).
 * TTL should be slightly less than the interval so the lock expires before the next tick.
 */
export async function tryAcquireIntervalLeader(
  redis: Redis,
  lockKey: string,
  ttlSec: number,
  log?: Logger,
): Promise<boolean> {
  return safeRedisSetNx(redis, lockKey, '1', ttlSec, log);
}
