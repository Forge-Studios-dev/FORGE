import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { createHash, randomInt } from 'crypto';
import {
  safeRedisDel,
  safeRedisGetResult,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';

@Injectable()
export class AuthEmailOtpService {
  private readonly logger = new Logger(AuthEmailOtpService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('auth.emailOtpEnabled') === true;
  }

  private isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  private failClosed(): never {
    throw new ServiceUnavailableException(
      'Verification temporarily unavailable. Please try again shortly.',
    );
  }

  private key(email: string) {
    return `auth:email_otp:${email.trim().toLowerCase()}`;
  }

  private attemptsKey(email: string) {
    return `auth:email_otp_attempts:${email.trim().toLowerCase()}`;
  }

  async issueOtp(email: string): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const hash = createHash('sha256').update(code).digest('hex');
    await safeRedisSetex(this.redis, this.key(email), 600, hash, this.logger);
    await safeRedisDel(this.redis, this.attemptsKey(email), this.logger);
    return code;
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const attemptsResult = await safeRedisGetResult(
      this.redis,
      this.attemptsKey(normalized),
      this.logger,
    );
    if (!attemptsResult.ok) {
      if (this.isProduction()) this.failClosed();
      throw new BadRequestException('Too many attempts. Request a new code.');
    }
    const attempts = parseInt(attemptsResult.value || '0', 10);
    if (attempts >= 5) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }
    const storedResult = await safeRedisGetResult(
      this.redis,
      this.key(normalized),
      this.logger,
    );
    if (!storedResult.ok) {
      if (this.isProduction()) this.failClosed();
      throw new BadRequestException('Code expired or not found. Resend verification.');
    }
    if (!storedResult.value) {
      throw new BadRequestException('Code expired or not found. Resend verification.');
    }
    const hash = createHash('sha256').update(code.trim()).digest('hex');
    if (hash !== storedResult.value) {
      const nextAttempts = attempts + 1;
      await safeRedisSetex(
        this.redis,
        this.attemptsKey(normalized),
        600,
        String(nextAttempts),
        this.logger,
      );
      throw new BadRequestException('Invalid verification code');
    }
    await safeRedisDel(this.redis, this.key(normalized), this.logger);
    await safeRedisDel(this.redis, this.attemptsKey(normalized), this.logger);
    return true;
  }
}
