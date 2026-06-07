import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import {
  safeRedisDel,
  safeRedisGetResult,
  safeRedisIncr,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';

@Injectable()
export class AuthAccountLockoutService {
  private readonly logger = new Logger(AuthAccountLockoutService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  private failClosed(): never {
    throw new ServiceUnavailableException(
      'Authentication temporarily unavailable. Please try again shortly.',
    );
  }

  private maxAttempts(): number {
    return this.configService.get<number>('auth.lockout.maxAttempts') ?? 10;
  }

  private windowSec(): number {
    return this.configService.get<number>('auth.lockout.windowSec') ?? 900;
  }

  private lockoutSec(): number {
    return this.configService.get<number>('auth.lockout.lockoutSec') ?? 1800;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private failKey(email: string, ip: string | null): string {
    const ipPart = ip ? ip.replace(/[^a-zA-Z0-9.:]/g, '_') : 'unknown';
    return `auth:fail:${this.normalizeEmail(email)}:${ipPart}`;
  }

  /** Email-global failure counter — not bypassable by rotating IPs. */
  private failEmailKey(email: string): string {
    return `auth:fail:${this.normalizeEmail(email)}`;
  }

  private lockKey(email: string): string {
    return `auth:lock:${this.normalizeEmail(email)}`;
  }

  private async lockAccount(email: string, ipFailKey?: string): Promise<void> {
    await safeRedisSetex(this.redis, this.lockKey(email), this.lockoutSec(), '1', this.logger);
    if (ipFailKey) {
      await safeRedisDel(this.redis, ipFailKey, this.logger);
    }
    await safeRedisDel(this.redis, this.failEmailKey(email), this.logger);
  }

  async assertNotLocked(email: string): Promise<void> {
    const result = await safeRedisGetResult(this.redis, this.lockKey(email), this.logger);
    if (!result.ok) {
      if (this.isProduction()) this.failClosed();
      return;
    }
    if (result.value === '1') {
      throw new UnauthorizedException({
        message: 'Too many failed attempts. Try again later or reset your password.',
        code: 'ACCOUNT_LOCKED',
      });
    }
  }

  async recordFailedLogin(email: string, ip: string | null): Promise<void> {
    const ipKey = this.failKey(email, ip);
    const ipCount = await safeRedisIncr(this.redis, ipKey, this.logger);
    if (ipCount === null) {
      if (this.isProduction()) this.failClosed();
      return;
    }
    if (ipCount === 1) {
      await safeRedisSetex(this.redis, ipKey, this.windowSec(), '1', this.logger);
    }

    const emailKey = this.failEmailKey(email);
    const emailCount = await safeRedisIncr(this.redis, emailKey, this.logger);
    if (emailCount === null) {
      if (this.isProduction()) this.failClosed();
      return;
    }
    if (emailCount === 1) {
      await safeRedisSetex(this.redis, emailKey, this.windowSec(), '1', this.logger);
    }

    if (emailCount >= this.maxAttempts()) {
      await this.lockAccount(email, ipKey);
    }
  }

  async clearFailures(email: string, ip: string | null): Promise<void> {
    await safeRedisDel(this.redis, this.failKey(email, ip), this.logger);
    await safeRedisDel(this.redis, this.failEmailKey(email), this.logger);
    await safeRedisDel(this.redis, this.lockKey(email), this.logger);
  }
}
