import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { safeRedisDel, safeRedisGet, safeRedisSetex } from '../redis/redis-safe.util';

export const STREAM_MOD_CACHE_PREFIX = 'stream:mod:status:';
export const STREAM_MOD_CACHE_TTL_SEC = 60;

export function streamModerationCacheKey(streamId: string, userId: string): string {
  return `${STREAM_MOD_CACHE_PREFIX}${streamId}:${userId}`;
}

/** Cached moderation status: ban | timeout | ok */
export type StreamModCacheStatus = 'ban' | 'timeout' | 'ok';

export async function getCachedModerationStatus(
  redis: Redis,
  streamId: string,
  userId: string,
  logger?: Logger,
): Promise<StreamModCacheStatus | null> {
  const raw = await safeRedisGet(redis, streamModerationCacheKey(streamId, userId), logger);
  if (raw === 'ban' || raw === 'timeout' || raw === 'ok') return raw;
  return null;
}

export async function setCachedModerationStatus(
  redis: Redis,
  streamId: string,
  userId: string,
  status: StreamModCacheStatus,
  ttlSec = STREAM_MOD_CACHE_TTL_SEC,
  logger?: Logger,
): Promise<void> {
  await safeRedisSetex(
    redis,
    streamModerationCacheKey(streamId, userId),
    ttlSec,
    status,
    logger,
  );
}

export async function bustModerationCache(
  redis: Redis,
  streamId: string,
  userId: string,
  logger?: Logger,
): Promise<void> {
  await safeRedisDel(redis, streamModerationCacheKey(streamId, userId), logger);
}
