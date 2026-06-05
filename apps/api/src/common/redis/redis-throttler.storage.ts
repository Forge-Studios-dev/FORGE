import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

const KEY_PREFIX = 'throttle:';

/**
 * Redis-backed rate limit storage — shared across Fly API replicas (audit F-throttler).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire: number }> {
    const redisKey = `${KEY_PREFIX}${key}`;
    try {
      const totalHits = await this.redis.incr(redisKey);
      let timeToExpire = await this.redis.pttl(redisKey);

      if (timeToExpire < 0) {
        await this.redis.pexpire(redisKey, ttl);
        timeToExpire = ttl;
      }

      return { totalHits, timeToExpire };
    } catch (err) {
      this.logger.warn(`Redis throttler fallback (allow): ${(err as Error).message}`);
      return { totalHits: 0, timeToExpire: ttl };
    }
  }
}
