import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { safeRedisDel, safeRedisGet, safeRedisSetex } from '../redis/redis-safe.util';

export const NOTIF_UNREAD_CACHE_PREFIX = 'notif:unread:';
export const NOTIF_UNREAD_CACHE_TTL_SEC = 45;

export function notificationUnreadCacheKey(userId: string): string {
  return `${NOTIF_UNREAD_CACHE_PREFIX}${userId}`;
}

export async function getCachedUnreadCount(
  redis: Redis,
  userId: string,
  logger?: Logger,
): Promise<number | null> {
  const raw = await safeRedisGet(redis, notificationUnreadCacheKey(userId), logger);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export async function setCachedUnreadCount(
  redis: Redis,
  userId: string,
  count: number,
  logger?: Logger,
): Promise<void> {
  await safeRedisSetex(
    redis,
    notificationUnreadCacheKey(userId),
    NOTIF_UNREAD_CACHE_TTL_SEC,
    String(count),
    logger,
  );
}

export async function bustUnreadCountCache(
  redis: Redis,
  userId: string,
  logger?: Logger,
): Promise<void> {
  await safeRedisDel(redis, notificationUnreadCacheKey(userId), logger);
}
