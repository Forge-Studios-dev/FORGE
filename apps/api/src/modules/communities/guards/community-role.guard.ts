import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { COMMUNITY_ROLES_KEY } from '../decorators/community-roles.decorator';
import { CommunityRole, CommunityRoleType } from '../entities/community-role.entity';
import { Community } from '../entities/community.entity';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class CommunityRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
  ) {}

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

    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new ForbiddenException('Community not found');

    if (community.creatorId === user.sub) return true;

    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: user.sub },
    });
    if (!assignment || !required.includes(assignment.role)) {
      throw new ForbiddenException('Insufficient community permissions');
    }
    return true;
  }
}
