import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  safeRedisDel,
  safeRedisGetResult,
  safeRedisSetexResult,
} from '../../common/redis/redis-safe.util';
import { toPublicUser } from '../users/user.mapper';

export type OAuthExchangePayload = {
  accessToken: string;
  sessionId: string;
  user: ReturnType<typeof toPublicUser>;
};

const EXCHANGE_TTL_SEC = 60;

@Injectable()
export class AuthOAuthExchangeService {
  private readonly logger = new Logger(AuthOAuthExchangeService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  private exchangeKey(code: string): string {
    return `auth:oauth_exchange:${createHash('sha256').update(code).digest('hex')}`;
  }

  async createExchangeCode(payload: OAuthExchangePayload): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const stored = await safeRedisSetexResult(
      this.redis,
      this.exchangeKey(code),
      EXCHANGE_TTL_SEC,
      JSON.stringify(payload),
      this.logger,
    );
    if (!stored.ok) {
      throw new ServiceUnavailableException(
        'OAuth sign-in temporarily unavailable. Please try again shortly.',
      );
    }
    return code;
  }

  async consumeExchangeCode(code: string): Promise<OAuthExchangePayload> {
    const key = this.exchangeKey(code.trim());
    const result = await safeRedisGetResult(this.redis, key, this.logger);
    if (!result.ok) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'OAuth sign-in temporarily unavailable. Please try again shortly.',
        );
      }
      throw new UnauthorizedException('Invalid or expired OAuth exchange code');
    }
    if (!result.value) {
      throw new UnauthorizedException('Invalid or expired OAuth exchange code');
    }
    await safeRedisDel(this.redis, key, this.logger);
    try {
      return JSON.parse(result.value) as OAuthExchangePayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth exchange code');
    }
  }

  /** Build exchange payload from issued tokens (OAuth callback). */
  payloadFromTokens(tokens: {
    accessToken: string;
    sessionId: string;
    user: ReturnType<typeof toPublicUser>;
  }): OAuthExchangePayload {
    return {
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
      user: tokens.user,
    };
  }
}
