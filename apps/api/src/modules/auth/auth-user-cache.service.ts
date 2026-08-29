import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { AdminTier, UserRole, CreatorStatus } from '../users/entities/user.entity';
import { safeRedisDel, safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';

/** Cached fields required for JWT validation (F-501). */
export type CachedAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  creatorStatus: CreatorStatus | null;
  isVerified: boolean;
  isActive: boolean;
  deletedAt: string | null;
  mfaEnabled: boolean;
  adminTier: AdminTier;
};

const TTL_SEC = 60;
const key = (userId: string) => `auth:user:${userId}`;

@Injectable()
export class AuthUserCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(userId: string): Promise<CachedAuthUser | null> {
    const raw = await safeRedisGet(this.redis, key(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedAuthUser;
    } catch {
      await safeRedisDel(this.redis, key(userId));
      return null;
    }
  }

  async set(user: CachedAuthUser): Promise<void> {
    await safeRedisSetex(this.redis, key(user.id), TTL_SEC, JSON.stringify(user));
  }

  async bust(userId: string): Promise<void> {
    await safeRedisDel(this.redis, key(userId));
  }
}
