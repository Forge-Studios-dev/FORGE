import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  Community,
  CommunityVisibility,
} from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import {
  CommunityMember,
  CommunityMemberStatus,
} from './entities/community-member.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import { CommunityModerationService } from './community-moderation.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { UserRole } from '../users/entities/user.entity';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { CommunityPermission, permissionsForRole } from './community-permissions.constants';

/**
 * Membership / role / entitlement gates for communities and channels.
 *
 * Extracted from CommunitiesService (C2 in FRESH_AUDIT_2026-07-26 — god-object
 * split). Public methods are still exposed via the CommunitiesService facade so
 * existing callers keep working unchanged.
 */
@Injectable()
export class CommunityAccessService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly memberRepository: Repository<ChannelMember>,
    @InjectRepository(CommunityMember)
    private readonly communityMemberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    private readonly entitlementsService: EntitlementsService,
    private readonly engagementService: EngagementService,
    @Inject(forwardRef(() => CommunityModerationService))
    private readonly moderationService: CommunityModerationService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** True when viewer and community creator are blocked either way (admins exempt). */
  async isBlockedFromCreator(
    viewerId: string | null | undefined,
    creatorId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (!viewerId || viewerId === creatorId || viewerRole === UserRole.ADMIN) return false;
    return this.engagementService.isBlockedEitherWay(viewerId, creatorId);
  }

  async assertCommunityAccess(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
    options?: { skipBlockGate?: boolean },
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (
      !options?.skipBlockGate &&
      (await this.isBlockedFromCreator(viewerId, community.creatorId, viewerRole))
    ) {
      throw new ForbiddenException('This community is not available');
    }
    if (viewerId && (await this.moderationService.isBanned(communityId, viewerId))) {
      throw new ForbiddenException('You are banned from this community');
    }
    if (viewerId) {
      const suspended = await this.communityMemberRepository.findOne({
        where: {
          communityId,
          userId: viewerId,
          status: CommunityMemberStatus.SUSPENDED,
        },
      });
      if (suspended) {
        throw new ForbiddenException('Your community membership is suspended');
      }
    }
    const canView = await this.canViewCommunity(community, viewerId, viewerRole, {
      skipBlockGate: options?.skipBlockGate,
    });
    if (!canView) throw new ForbiddenException('You do not have access to this community');
    return community;
  }

  async assertOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  /** Creator or delegated OWNER/ADMIN may manage community studio content. */
  async assertCommunityStudioAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (viewerRole === UserRole.ADMIN) return community;
    if (community.creatorId === actorId) return community;
    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: actorId },
    });
    if (
      assignment &&
      (assignment.role === CommunityRoleType.OWNER ||
        assignment.role === CommunityRoleType.ADMIN)
    ) {
      return community;
    }
    throw new ForbiddenException('Insufficient permissions for community studio');
  }

  /**
   * Permission-scoped studio access — for capabilities delegated roles hold
   * per `COMMUNITY_ROLE_PERMISSION_MATRIX` (e.g. `coach`'s `view_analytics`,
   * `moderator`/`coach`'s `manage_events`) that `assertCommunityStudioAccess`
   * doesn't grant (that one is OWNER/ADMIN-only by design for broader studio
   * mutations). Use this for routes the matrix says a narrower role may reach.
   */
  async assertCommunityPermission(
    actorId: string,
    communityId: string,
    permission: CommunityPermission,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (viewerRole === UserRole.ADMIN) return community;
    if (community.creatorId === actorId) return community;
    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: actorId },
    });
    if (assignment && permissionsForRole(assignment.role).includes(permission)) {
      return community;
    }
    throw new ForbiddenException(`Insufficient permissions: ${permission}`);
  }

  /** Validates a user may submit a join request (PRIVATE or INVITE communities without access). */
  async assertCanRequestJoin(
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (await this.isBlockedFromCreator(userId, community.creatorId, viewerRole)) {
      throw new ForbiddenException('This community is not available');
    }
    if (await this.moderationService.isBanned(communityId, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }
    if (userId === community.creatorId || viewerRole === UserRole.ADMIN) {
      throw new BadRequestException('You already have access to this community');
    }
    const allowsJoinRequest =
      community.visibility === CommunityVisibility.PRIVATE ||
      community.visibility === CommunityVisibility.INVITE;
    if (!allowsJoinRequest) {
      throw new BadRequestException('This community does not accept join requests');
    }
    if (await this.canViewCommunity(community, userId, viewerRole)) {
      throw new BadRequestException('You already have access to this community');
    }
    return community;
  }

  async canModerateCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (userId === creatorId) return true;
    const assignment = await this.roleRepository.findOne({ where: { communityId, userId } });
    if (!assignment) return false;
    return (
      assignment.role === CommunityRoleType.ADMIN ||
      assignment.role === CommunityRoleType.MODERATOR ||
      assignment.role === CommunityRoleType.OWNER
    );
  }

  async canCoachCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (userId === creatorId) return true;
    const assignment = await this.roleRepository.findOne({ where: { communityId, userId } });
    return assignment?.role === CommunityRoleType.COACH;
  }

  async canViewCommunity(
    community: Community,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
    options?: { skipBlockGate?: boolean },
  ): Promise<boolean> {
    const creatorId = community.creatorId;
    if (viewerId === creatorId) return true;
    if (viewerRole === UserRole.ADMIN) return true;
    if (
      !options?.skipBlockGate &&
      (await this.isBlockedFromCreator(viewerId, creatorId, viewerRole))
    ) {
      return false;
    }

    if (community.visibility === CommunityVisibility.PUBLIC) {
      return true;
    }

    if (!viewerId) return false;

    if (community.visibility === CommunityVisibility.PRIVATE) {
      const [role, activeMember] = await Promise.all([
        this.roleRepository.findOne({
          where: { communityId: community.id, userId: viewerId },
        }),
        this.communityMemberRepository.findOne({
          where: {
            communityId: community.id,
            userId: viewerId,
            status: CommunityMemberStatus.ACTIVE,
          },
        }),
      ]);
      return !!role || !!activeMember;
    }

    if (community.visibility === CommunityVisibility.PAID) {
      const membership = await this.entitlementsService.getMembershipForViewer(
        viewerId,
        creatorId,
        community.id,
      );
      return membership.active;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      const [role, activeMember, membership, inviteChannels] = await Promise.all([
        this.roleRepository.findOne({
          where: { communityId: community.id, userId: viewerId },
        }),
        this.communityMemberRepository.findOne({
          where: {
            communityId: community.id,
            userId: viewerId,
            status: CommunityMemberStatus.ACTIVE,
          },
        }),
        this.entitlementsService.getMembershipForViewer(viewerId, creatorId, community.id),
        this.channelRepository.find({
          where: { communityId: community.id, type: ChannelType.INVITE },
          select: ['id'],
        }),
      ]);
      if (role) return true;
      if (activeMember) return true;
      if (membership.active) return true;
      if (inviteChannels.length === 0) return false;
      const member = await this.memberRepository.findOne({
        where: {
          userId: viewerId,
          channelId: In(inviteChannels.map((c) => c.id)),
        },
      });
      return !!member;
    }

    return true;
  }

  /**
   * Same visibility rules as canViewCommunity but with all cross-entity data
   * pre-batched by the caller (single-query list path). Kept as an instance
   * method so both CommunitiesService and CommunityAccessService can share it.
   */
  canViewCommunityBatched(
    community: Community,
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    subscriptionCoversCommunity: boolean,
    role: CommunityRole | undefined,
    isActiveCommunityMember: boolean,
    inviteChannelIds: string[],
    invitedChannelIds: Set<string>,
  ): boolean {
    const creatorId = community.creatorId;
    if (viewerId === creatorId) return true;
    if (viewerRole === UserRole.ADMIN) return true;

    if (community.visibility === CommunityVisibility.PRIVATE) {
      if (!viewerId) return false;
      if (role) return true;
      return isActiveCommunityMember;
    }

    if (community.visibility === CommunityVisibility.PAID) {
      return !!viewerId && subscriptionCoversCommunity;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      if (!viewerId) return false;
      if (role) return true;
      if (isActiveCommunityMember) return true;
      if (subscriptionCoversCommunity) return true;
      if (!inviteChannelIds.length) return false;
      return inviteChannelIds.some((id) => invitedChannelIds.has(id));
    }

    return true;
  }

  async verifyChannelAccess(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, viewerId, viewerRole);
  }

  async assertChannelAccess(
    channel: Channel & { community: Community },
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
    action: 'read' | 'write' = 'read',
  ): Promise<void> {
    const creatorId = channel.community.creatorId;
    if (await this.isBlockedFromCreator(viewerId, creatorId, viewerRole)) {
      throw new ForbiddenException('This community is not available');
    }
    const isOwner = viewerId === creatorId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const isMember =
      channel.type === ChannelType.INVITE && viewerId
        ? !!(await this.memberRepository.findOne({
            where: { channelId: channel.id, userId: viewerId },
          }))
        : false;

    const access = await this.entitlementsService.checkChannelAccess(
      viewerId,
      {
        type: channel.type,
        requiredTierId: channel.requiredTierId,
        creatorId,
        communityId: channel.community.id,
        channelId: channel.id,
        isMember,
      },
      { isOwner, isAdmin, action },
    );

    if (!access.allowed) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }

  /** Lightweight access metadata for join-request UX (no channel payload). */
  async getCommunityAccessMeta(
    creatorId: string,
    slug: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communityRepository.findOne({ where: { creatorId, slug } });
    if (!community) throw new NotFoundException('Community not found');

    if (await this.isBlockedFromCreator(viewerId, creatorId, viewerRole)) {
      return {
        communityId: community.id,
        name: community.name,
        slug: community.slug,
        visibility: community.visibility,
        canView: false,
        canRequestJoin: false,
        joinRequestStatus: 'none' as const,
        unavailable: true,
      };
    }

    const canView = viewerId
      ? await this.canViewCommunity(community, viewerId, viewerRole)
      : community.visibility === CommunityVisibility.PUBLIC;

    let joinRequestStatus: 'none' | 'pending' | 'active' | 'rejected' = 'none';
    if (viewerId) {
      const member = await this.communityMemberRepository.findOne({
        where: { communityId: community.id, userId: viewerId },
      });
      if (member?.status === CommunityMemberStatus.PENDING) joinRequestStatus = 'pending';
      else if (member?.status === CommunityMemberStatus.ACTIVE) joinRequestStatus = 'active';
      else if (member?.status === CommunityMemberStatus.REJECTED) joinRequestStatus = 'rejected';
    }

    const canRequestJoin =
      !!viewerId &&
      !canView &&
      (community.visibility === CommunityVisibility.PRIVATE ||
        community.visibility === CommunityVisibility.INVITE) &&
      joinRequestStatus !== 'pending' &&
      joinRequestStatus !== 'active';

    return {
      communityId: community.id,
      name: community.name,
      slug: community.slug,
      visibility: community.visibility,
      canView,
      canRequestJoin,
      joinRequestStatus,
      unavailable: false,
    };
  }

  /** Invalidate cached community list visibility for a viewer. */
  async bustCommunityListCache(userId: string, creatorId: string): Promise<void> {
    await this.redis.del(`community:list:visible:${creatorId}:${userId}`);
  }

  /** Batch-load invite channel memberships for the viewer across a set of channel ids. */
  async loadInviteMemberChannelIds(
    viewerId: string,
    channelIds: string[],
  ): Promise<Set<string>> {
    const unique = [...new Set(channelIds.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const rows = await this.memberRepository.find({
      where: { userId: viewerId, channelId: In(unique) },
      select: ['channelId'],
    });
    return new Set(rows.map((r) => r.channelId));
  }

  async getChannelWithCommunity(
    channelId: string,
  ): Promise<Channel & { community: Community }> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId },
      relations: ['community'],
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel as Channel & { community: Community };
  }
}
