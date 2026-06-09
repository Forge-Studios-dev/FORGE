import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

/** True when Redis provider blocks commands due to quota or limits. */
export function isRedisQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('max requests limit exceeded');
}

export type SafeRedisGetResult =
  | { ok: true; value: string | null }
  | { ok: false };

export async function safeRedisGet(
  redis: Redis,
  key: string,
  log?: Logger,
): Promise<string | null> {
  const result = await safeRedisGetResult(redis, key, log);
  return result.ok ? result.value : null;
}

export async function safeRedisGetResult(
  redis: Redis,
  key: string,
  log?: Logger,
): Promise<SafeRedisGetResult> {
  try {
    const value = await redis.get(key);
    return { ok: true, value };
  } catch (err) {
    log?.warn(`redis GET ${key} failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false };
  }
}

export type SafeRedisWriteResult = { ok: true } | { ok: false };

export async function safeRedisSetex(
  redis: Redis,
  key: string,
  ttlSec: number,
  value: string,
  log?: Logger,
): Promise<void> {
  await safeRedisSetexResult(redis, key, ttlSec, value, log);
}

export async function safeRedisSetexResult(
  redis: Redis,
  key: string,
  ttlSec: number,
  value: string,
  log?: Logger,
): Promise<SafeRedisWriteResult> {
  try {
    await redis.setex(key, ttlSec, value);
    return { ok: true };
  } catch (err) {
    log?.warn(`redis SETEX ${key} failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false };
  }
}

export async function safeRedisDel(redis: Redis, key: string, log?: Logger): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    log?.warn(`redis DEL ${key} failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function safeRedisSetNx(
  redis: Redis,
  key: string,
  value: string,
  ttlSec: number,
  log?: Logger,
): Promise<boolean> {
  try {
    const result = await redis.set(key, value, 'EX', ttlSec, 'NX');
    return result === 'OK';
  } catch (err) {
    log?.warn(`redis SET NX ${key} failed: ${err instanceof Error ? err.message : err}`);
    return true;
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

/** SCAN + DEL keys matching a glob pattern (e.g. streams:list:*). */
export async function safeRedisDelPattern(
  redis: Redis,
  pattern: string,
  log?: Logger,
): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    log?.warn(`redis DEL pattern ${pattern} failed: ${err instanceof Error ? err.message : err}`);
  }
}
