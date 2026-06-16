import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

/** Tracks chat messages per minute bucket (avoids COUNT on stream_messages during snapshots). */
export function streamChatMinuteBucketKey(streamId: string, minuteBucket?: number): string {
  const bucket = minuteBucket ?? Math.floor(Date.now() / 60_000);
  return `stream:chat:1m:${streamId}:${bucket}`;
}

export async function incrementStreamChatMinuteCounter(
  redis: Redis,
  streamId: string,
  logger?: Logger,
): Promise<void> {
  const key = streamChatMinuteBucketKey(streamId);
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 120);
    }
  } catch (err) {
    logger?.warn(
      `Chat minute counter incr failed for ${streamId}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export async function readStreamChatMessagesPerMin(
  redis: Redis,
  streamId: string,
): Promise<number> {
  try {
    const bucket = Math.floor(Date.now() / 60_000);
    const raw = await redis.get(streamChatMinuteBucketKey(streamId, bucket));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}
