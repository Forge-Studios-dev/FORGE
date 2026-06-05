import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { Redis } from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = await multi.exec();
    const totalHits = (results?.[0]?.[1] as number) ?? 1;
    let timeToExpire = (results?.[1]?.[1] as number) ?? -1;

    if (totalHits === 1 || timeToExpire < 0) {
      await this.redis.pexpire(key, ttl);
      timeToExpire = ttl;
    }

    return { totalHits, timeToExpire };
  }
}
