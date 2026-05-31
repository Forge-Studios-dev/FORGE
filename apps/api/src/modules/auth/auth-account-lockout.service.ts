import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { safeRedisDel, safeRedisGet, safeRedisIncr, safeRedisSetex } from '../../common/redis/redis-safe.util';

@Injectable()
export class AuthAccountLockoutService {
  private readonly logger = new Logger(AuthAccountLockoutService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private maxAttempts(): number {
    return this.configService.get<number>('auth.lockout.maxAttempts') ?? 10;
  }

  private windowSec(): number {
    return this.configService.get<number>('auth.lockout.windowSec') ?? 900;
  }

  private lockoutSec(): number {
    return this.configService.get<number>('auth.lockout.lockoutSec') ?? 1800;
  }

  private failKey(email: string, ip: string | null): string {
    const ipPart = ip ? ip.replace(/[^a-zA-Z0-9.:]/g, '_') : 'unknown';
    return `auth:fail:${email}:${ipPart}`;
  }

  private lockKey(email: string): string {
    return `auth:lock:${email}`;
  }

  async assertNotLocked(email: string): Promise<void> {
    const locked = await safeRedisGet(this.redis, this.lockKey(email), this.logger);
    if (locked === '1') {
      throw new UnauthorizedException({
        message: 'Too many failed attempts. Try again later or reset your password.',
        code: 'ACCOUNT_LOCKED',
      });
    }
  }

  async recordFailedLogin(email: string, ip: string | null): Promise<void> {
    const key = this.failKey(email, ip);
    const count = await safeRedisIncr(this.redis, key, this.logger);
    if (count === 1) {
      await safeRedisSetex(this.redis, key, this.windowSec(), '1', this.logger);
    }
    if (count !== null && count >= this.maxAttempts()) {
      await safeRedisSetex(this.redis, this.lockKey(email), this.lockoutSec(), '1', this.logger);
      await safeRedisDel(this.redis, key, this.logger);
    }
  }

  async clearFailures(email: string, ip: string | null): Promise<void> {
    await safeRedisDel(this.redis, this.failKey(email, ip), this.logger);
    await safeRedisDel(this.redis, this.lockKey(email), this.logger);
  }
}
