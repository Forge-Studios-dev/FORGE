/**
 * FORGE uses ioredis/BullMQ (Redis protocol).
 * Production: set REDIS_URL (e.g. Redis Cloud redis:// or rediss://).
 */
export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string {
  const direct = env.REDIS_URL?.trim();
  if (direct) return direct;
  return 'redis://localhost:6379';
}
