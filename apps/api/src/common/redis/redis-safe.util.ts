import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

/** True when Redis provider blocks commands due to quota or limits. */
export function isRedisQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('max requests limit exceeded');
}

export async function safeRedisGet(
  redis: Redis,
  key: string,
  log?: Logger,
): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    log?.warn(`redis GET ${key} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function safeRedisSetex(
  redis: Redis,
  key: string,
  ttlSec: number,
  value: string,
  log?: Logger,
): Promise<void> {
  try {
    await redis.setex(key, ttlSec, value);
  } catch (err) {
    log?.warn(`redis SETEX ${key} failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function safeRedisDel(redis: Redis, key: string, log?: Logger): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    log?.warn(`redis DEL ${key} failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function safeRedisIncr(redis: Redis, key: string, log?: Logger): Promise<number | null> {
  try {
    return await redis.incr(key);
  } catch (err) {
    log?.warn(`redis INCR ${key} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
