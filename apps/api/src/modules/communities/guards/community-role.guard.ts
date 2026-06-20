import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { COMMUNITY_ROLES_KEY } from '../decorators/community-roles.decorator';
import { CommunityRole, CommunityRoleType } from '../entities/community-role.entity';
import { Community } from '../entities/community.entity';
import { UserRole } from '../../users/entities/user.entity';
import { safeRedisGet, safeRedisSetex } from '../../../common/redis/redis-safe.util';

const ROLE_CACHE_TTL_SEC = 60;

@Injectable()
export class CommunityRoleGuard implements CanActivate {
  private readonly logger = new Logger(CommunityRoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private roleCacheKey(communityId: string, userId: string): string {
    return `community:role:${communityId}:${userId}`;
  }

  private async getCachedRole(
    communityId: string,
    userId: string,
  ): Promise<CommunityRoleType | 'owner' | null | undefined> {
    const cached = await safeRedisGet(
      this.redis,
      this.roleCacheKey(communityId, userId),
      this.logger,
    );
    if (cached === null) return undefined;
    if (cached === 'none') return null;
    return cached as CommunityRoleType | 'owner';
  }

  private async setCachedRole(
    communityId: string,
    userId: string,
    role: CommunityRoleType | 'owner' | null,
  ): Promise<void> {
    await safeRedisSetex(
      this.redis,
      this.roleCacheKey(communityId, userId),
      ROLE_CACHE_TTL_SEC,
      role ?? 'none',
      this.logger,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<CommunityRoleType[]>(COMMUNITY_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub?: string; role?: UserRole } | undefined;
    if (!user?.sub) throw new ForbiddenException();

    if (user.role === UserRole.ADMIN) return true;

    const communityId =
      req.params?.communityId ?? req.body?.communityId ?? req.query?.communityId;
    if (!communityId) throw new ForbiddenException('Community context required');

    const cached = await this.getCachedRole(communityId, user.sub);
    if (cached === 'owner') return true;
    if (cached && required.includes(cached)) return true;
    if (cached === null) throw new ForbiddenException('Insufficient community permissions');

    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new ForbiddenException('Community not found');

    if (community.creatorId === user.sub) {
      await this.setCachedRole(communityId, user.sub, 'owner');
      return true;
    }

    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: user.sub },
    });
    if (!assignment || !required.includes(assignment.role)) {
      await this.setCachedRole(communityId, user.sub, null);
      throw new ForbiddenException('Insufficient community permissions');
    }

    await this.setCachedRole(communityId, user.sub, assignment.role);
    return true;
  }
}
