import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';

/** Sliding "this sitting" window for forYou creator boosts. */
const SESSION_TTL_SEC = 60 * 60 * 2;
const SESSION_MAX = 20;

/** Minimum progress before a watch counts as session dwell. */
export const SESSION_WATCH_MIN_PROGRESS_SEC = 15;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function sessionCreatorsKey(userId: string): string {
  return `user:session:creators:${userId}`;
}

export async function getSessionCreatorIds(
  redis: Redis,
  userId: string,
  log?: Logger,
): Promise<string[]> {
  const raw = await safeRedisGet(redis, sessionCreatorsKey(userId), log);
  return parseIds(raw).slice(0, SESSION_MAX);
}

/**
 * Prepend a creator watched with meaningful dwell. Refreshes the 2h TTL so
 * the sitting window slides with continued viewing.
 */
export async function pushSessionCreator(
  redis: Redis,
  userId: string,
  creatorId: string,
  log?: Logger,
): Promise<void> {
  if (!userId || !creatorId || userId === creatorId) return;
  const key = sessionCreatorsKey(userId);
  const existing = await getSessionCreatorIds(redis, userId, log);
  const ids = [creatorId, ...existing.filter((x) => x !== creatorId)].slice(0, SESSION_MAX);
  await safeRedisSetex(redis, key, SESSION_TTL_SEC, JSON.stringify(ids), log);
}
