/**
 * FORGE uses ioredis/BullMQ (Redis protocol), not Upstash REST.
 * If only UPSTASH_REDIS_REST_* is set, derive rediss:// from the REST endpoint hostname.
 */
export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string {
  const direct = env.REDIS_URL?.trim();
  if (direct) return direct;

  const restUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!restUrl || !token) {
    return 'redis://localhost:6379';
  }

  try {
    const host = new URL(restUrl).hostname;
    return `rediss://default:${encodeURIComponent(token)}@${host}:6379`;
  } catch {
    return 'redis://localhost:6379';
  }
}
