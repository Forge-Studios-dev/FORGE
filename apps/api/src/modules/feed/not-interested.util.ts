import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';

const PREF_TTL_SEC = 60 * 60 * 24 * 90;
const PREF_MAX = 500;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function getIdList(
  redis: Redis,
  key: string,
  log?: Logger,
): Promise<string[]> {
  const raw = await safeRedisGet(redis, key, log);
  return parseIds(raw).slice(0, PREF_MAX);
}

async function prependId(
  redis: Redis,
  key: string,
  id: string,
  log?: Logger,
): Promise<string[]> {
  const existing = await getIdList(redis, key, log);
  const ids = [id, ...existing.filter((x) => x !== id)].slice(0, PREF_MAX);
  await safeRedisSetex(redis, key, PREF_TTL_SEC, JSON.stringify(ids), log);
  return ids;
}

export function notInterestedKey(userId: string): string {
  return `user:not-interested:${userId}`;
}

export function mutedChannelsKey(userId: string): string {
  return `user:muted-channels:${userId}`;
}

export async function getNotInterestedVideoIds(
  redis: Redis,
  userId: string,
  log?: Logger,
): Promise<string[]> {
  return getIdList(redis, notInterestedKey(userId), log);
}

/** Persist “Not interested” (YouTube-style). Newest first; capped. */
export async function addNotInterestedVideo(
  redis: Redis,
  userId: string,
  videoId: string,
  log?: Logger,
): Promise<{ ok: true; videoIds: string[] }> {
  const videoIds = await prependId(redis, notInterestedKey(userId), videoId, log);
  return { ok: true, videoIds };
}

export async function getMutedChannelIds(
  redis: Redis,
  userId: string,
  log?: Logger,
): Promise<string[]> {
  return getIdList(redis, mutedChannelsKey(userId), log);
}

/** “Don’t recommend channel” — exclude creator from signed-in feeds/recs. */
export async function muteChannel(
  redis: Redis,
  userId: string,
  channelId: string,
  log?: Logger,
): Promise<{ ok: true; channelIds: string[] }> {
  const channelIds = await prependId(redis, mutedChannelsKey(userId), channelId, log);
  return { ok: true, channelIds };
}

/** Remove a channel from the muted list. */
export async function unmuteChannel(
  redis: Redis,
  userId: string,
  channelId: string,
  log?: Logger,
): Promise<{ ok: true; channelIds: string[] }> {
  const existing = await getMutedChannelIds(redis, userId, log);
  const channelIds = existing.filter((id) => id !== channelId);
  await safeRedisSetex(
    redis,
    mutedChannelsKey(userId),
    PREF_TTL_SEC,
    JSON.stringify(channelIds),
    log,
  );
  return { ok: true, channelIds };
}
