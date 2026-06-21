import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { safeRedisDel, safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';

const REVOKED_TTL_SEC = 86400 * 8;
const ACTIVE_CACHE_TTL_SEC = 60;

@Injectable()
export class AuthSessionCacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private revokedKey(sessionId: string): string {
    return `auth:sid:revoked:${sessionId}`;
  }

  private activeKey(sessionId: string): string {
    return `auth:sid:active:${sessionId}`;
  }

  async markActive(sessionId: string, userId: string): Promise<void> {
    await safeRedisSetex(this.redis, this.activeKey(sessionId), ACTIVE_CACHE_TTL_SEC, userId);
    await safeRedisDel(this.redis, this.revokedKey(sessionId));
  }

  async markRevoked(sessionId: string): Promise<void> {
    await safeRedisSetex(this.redis, this.revokedKey(sessionId), REVOKED_TTL_SEC, '1');
    await safeRedisDel(this.redis, this.activeKey(sessionId));
  }

  /** Returns true when refresh session is still valid for this user. */
  async assertSessionActive(sessionId: string, userId: string): Promise<boolean> {
    const revoked = await safeRedisGet(this.redis, this.revokedKey(sessionId));
    if (revoked) return false;

    const cachedUserId = await safeRedisGet(this.redis, this.activeKey(sessionId));
    if (cachedUserId === userId) return true;
    if (cachedUserId && cachedUserId !== userId) return false;

    const row = await this.refreshTokenRepository.findOne({
      where: { id: sessionId, userId, revoked: false },
      select: ['id', 'expiresAt'],
    });
    if (!row || row.expiresAt < new Date()) return false;

    await this.markActive(sessionId, userId);
    return true;
  }
}
