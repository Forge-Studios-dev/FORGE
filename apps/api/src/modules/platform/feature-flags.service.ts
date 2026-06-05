import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private envFlags(): Set<string> {
    const raw = this.configService.get<string>('featureFlags') || '';
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }

  async isEnabled(flag: string): Promise<boolean> {
    const cached = await safeRedisGet(this.redis, `flag:${flag}`);
    if (cached === '1') return true;
    if (cached === '0') return false;
    return this.envFlags().has(flag);
  }

  async setFlag(flag: string, enabled: boolean, ttlSec = 3600): Promise<void> {
    await safeRedisSetex(this.redis, `flag:${flag}`, ttlSec, enabled ? '1' : '0');
  }
}
