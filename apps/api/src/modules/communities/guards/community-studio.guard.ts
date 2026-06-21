import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Community } from '../entities/community.entity';
import { CommunityRole, CommunityRoleType } from '../entities/community-role.entity';
import { UserRole } from '../../users/entities/user.entity';

/** Allows community creator or delegated OWNER/ADMIN to access studio mutation routes. */
@Injectable()
export class CommunityStudioGuard implements CanActivate {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub?: string; role?: UserRole } | undefined;
    if (!user?.sub) throw new ForbiddenException();

    if (user.role === UserRole.ADMIN) return true;

    const communityId = req.params?.communityId;
    if (!communityId) throw new ForbiddenException('Community context required');

    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    if (community.creatorId === user.sub) return true;

    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: user.sub },
    });
    if (
      assignment &&
      (assignment.role === CommunityRoleType.OWNER ||
        assignment.role === CommunityRoleType.ADMIN)
    ) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions for community studio');
  }
}
