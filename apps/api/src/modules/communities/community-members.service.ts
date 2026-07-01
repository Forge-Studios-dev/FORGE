import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toCsv } from '../../common/utils/csv.util';
import {
  CommunityMember,
  CommunityMemberSource,
  CommunityMemberStatus,
} from './entities/community-member.entity';
import { CommunitiesService } from './communities.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CommunityMembersService {
  constructor(
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @Inject(forwardRef(() => CommunitiesService))
    private readonly communitiesService: CommunitiesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestJoin(userId: string, communityId: string, viewerRole?: UserRole | null) {
    await this.communitiesService.assertCanRequestJoin(communityId, userId, viewerRole);
    const existing = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (existing) {
      if (existing.status === CommunityMemberStatus.ACTIVE) {
        throw new BadRequestException('Already a community member');
      }
      if (existing.status === CommunityMemberStatus.PENDING) {
        return { data: existing, pending: true };
      }
    }
    const row = await this.memberRepository.save(
      this.memberRepository.create({
        communityId,
        userId,
        status: CommunityMemberStatus.PENDING,
        source: CommunityMemberSource.JOIN_REQUEST,
      }),
    );
    return { data: row, pending: true };
  }

  async listMembers(creatorId: string, communityId: string, status?: CommunityMemberStatus) {
    await this.communitiesService.assertOwnedCommunity(creatorId, communityId);
    const where: { communityId: string; status?: CommunityMemberStatus } = { communityId };
    if (status) where.status = status;
    const rows = await this.memberRepository.find({
      where,
      relations: ['user'],
      order: { joinedAt: 'DESC' },
      take: 100,
    });
    return { data: rows };
  }

  async exportMembersCsv(creatorId: string, communityId: string): Promise<string> {
    await this.communitiesService.assertOwnedCommunity(creatorId, communityId);
    const rows = await this.memberRepository.find({
      where: { communityId },
      relations: ['user'],
      order: { joinedAt: 'DESC' },
      take: 5000,
    });
    return toCsv(
      ['userId', 'username', 'displayName', 'email', 'status', 'source', 'joinedAt'],
      rows.map((r) => [
        r.userId,
        r.user?.username ?? '',
        r.user?.displayName ?? '',
        r.user?.email ?? '',
        r.status,
        r.source,
        r.joinedAt?.toISOString() ?? '',
      ]),
    );
  }

  async approveMember(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityStudioAccess(
      actorId,
      communityId,
      viewerRole,
    );
    const row = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (!row) throw new NotFoundException('Join request not found');
    row.status = CommunityMemberStatus.ACTIVE;
    row.source = CommunityMemberSource.JOIN_REQUEST;
    await this.memberRepository.save(row);
    this.eventEmitter.emit('community.access.changed', {
      userId,
      creatorId: community.creatorId,
      communityId,
    });
    return { data: row };
  }

  async rejectMember(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityStudioAccess(actorId, communityId, viewerRole);
    const row = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (!row) throw new NotFoundException('Join request not found');
    row.status = CommunityMemberStatus.REJECTED;
    await this.memberRepository.save(row);
    return { data: row };
  }

  async isActiveMember(communityId: string, userId: string): Promise<boolean> {
    const row = await this.memberRepository.findOne({
      where: { communityId, userId, status: CommunityMemberStatus.ACTIVE },
    });
    return !!row;
  }

  /** Upsert active membership when a community-scoped subscription is granted. */
  async provisionFromSubscription(userId: string, communityId: string): Promise<void> {
    const existing = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (existing) {
      if (
        existing.status !== CommunityMemberStatus.ACTIVE ||
        existing.source !== CommunityMemberSource.SUBSCRIPTION
      ) {
        existing.status = CommunityMemberStatus.ACTIVE;
        existing.source = CommunityMemberSource.SUBSCRIPTION;
        await this.memberRepository.save(existing);
      }
      return;
    }
    await this.memberRepository.save(
      this.memberRepository.create({
        communityId,
        userId,
        status: CommunityMemberStatus.ACTIVE,
        source: CommunityMemberSource.SUBSCRIPTION,
      }),
    );
  }

  /** Suspend subscription-sourced membership when billing access is revoked. */
  async suspendFromSubscriptionLoss(userId: string, communityId: string): Promise<void> {
    const row = await this.memberRepository.findOne({
      where: { communityId, userId, source: CommunityMemberSource.SUBSCRIPTION },
    });
    if (!row || row.status === CommunityMemberStatus.SUSPENDED) return;
    row.status = CommunityMemberStatus.SUSPENDED;
    await this.memberRepository.save(row);
  }

  async suspendMember(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityStudioAccess(
      actorId,
      communityId,
      viewerRole,
    );
    const row = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (!row || row.status !== CommunityMemberStatus.ACTIVE) {
      throw new NotFoundException('Active member not found');
    }
    row.status = CommunityMemberStatus.SUSPENDED;
    await this.memberRepository.save(row);
    this.eventEmitter.emit('community.access.changed', {
      userId,
      creatorId: community.creatorId,
      communityId,
    });
    return { data: row };
  }

  async unsuspendMember(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityStudioAccess(
      actorId,
      communityId,
      viewerRole,
    );
    const row = await this.memberRepository.findOne({ where: { communityId, userId } });
    if (!row || row.status !== CommunityMemberStatus.SUSPENDED) {
      throw new NotFoundException('Suspended member not found');
    }
    row.status = CommunityMemberStatus.ACTIVE;
    await this.memberRepository.save(row);
    this.eventEmitter.emit('community.access.changed', {
      userId,
      creatorId: community.creatorId,
      communityId,
    });
    return { data: row };
  }
}
