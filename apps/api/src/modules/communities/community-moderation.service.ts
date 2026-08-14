import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CommunityMemberBan,
  CommunityReport,
} from './entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UserRole } from '../users/entities/user.entity';
import { CommunitiesService } from './communities.service';
import { CreatorAuditService } from './creator-audit.service';

@Injectable()
export class CommunityModerationService {
  constructor(
    @InjectRepository(CommunityReport)
    private readonly reportRepository: Repository<CommunityReport>,
    @InjectRepository(CommunityMemberBan)
    private readonly banRepository: Repository<CommunityMemberBan>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityPoll)
    private readonly pollRepository: Repository<CommunityPoll>,
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    @InjectRepository(CommunityRoomMessage)
    private readonly roomMessageRepository: Repository<CommunityRoomMessage>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => CommunitiesService))
    private readonly communitiesService: CommunitiesService,
    private readonly auditService: CreatorAuditService,
  ) {}

  async reportMessage(
    reporterId: string,
    input: {
      communityId: string;
      channelId?: string;
      roomId?: string;
      messageId?: string;
      postId?: string;
      pollId?: string;
      reportedUserId?: string;
      targetType?: string;
      reason: string;
    },
    viewerRole?: UserRole | null,
  ) {
    return this.createReport(reporterId, input, viewerRole);
  }

  async createReport(
    reporterId: string,
    input: {
      communityId: string;
      channelId?: string;
      roomId?: string;
      messageId?: string;
      postId?: string;
      pollId?: string;
      reportedUserId?: string;
      targetType?: string;
      reason: string;
    },
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(
      input.communityId,
      reporterId,
      viewerRole,
      // YouTube parity: reporting remains available after a block.
      { skipBlockGate: true },
    );

    const targetType = input.targetType ?? 'message';

    if (targetType === 'message') {
      if (!input.messageId || (!input.channelId && !input.roomId)) {
        throw new BadRequestException('messageId and channelId or roomId required for message reports');
      }
      if (input.roomId) {
        const room = await this.roomRepository.findOne({
          where: { id: input.roomId, communityId: input.communityId },
        });
        if (!room) throw new BadRequestException('Room not found in this community');
        const message = await this.roomMessageRepository.findOne({
          where: { id: input.messageId, roomId: input.roomId },
        });
        if (!message) throw new BadRequestException('Message not found in this room');
      } else {
        const channel = await this.channelRepository.findOne({
          where: { id: input.channelId, communityId: input.communityId },
        });
        if (!channel) throw new BadRequestException('Channel not found in this community');

        const message = await this.messageRepository.findOne({
          where: { id: input.messageId, channelId: input.channelId },
        });
        if (!message) throw new BadRequestException('Message not found in this channel');
      }
    } else if (targetType === 'post') {
      if (!input.postId) throw new BadRequestException('postId required for post reports');
      const post = await this.postRepository.findOne({
        where: { id: input.postId, communityId: input.communityId },
      });
      if (!post) throw new BadRequestException('Post not found in this community');
    } else if (targetType === 'poll') {
      if (!input.pollId) throw new BadRequestException('pollId required for poll reports');
      const poll = await this.pollRepository.findOne({
        where: { id: input.pollId, communityId: input.communityId },
      });
      if (!poll) throw new BadRequestException('Poll not found in this community');
    } else if (targetType === 'user') {
      if (!input.reportedUserId) {
        throw new BadRequestException('reportedUserId required for user reports');
      }
      if (input.reportedUserId === reporterId) {
        throw new BadRequestException('Cannot report yourself');
      }
    } else {
      throw new BadRequestException('Invalid report target type');
    }

    const report = await this.reportRepository.save(
      this.reportRepository.create({
        communityId: input.communityId,
        targetType,
        channelId: input.channelId ?? null,
        roomId: input.roomId ?? null,
        messageId: input.messageId ?? null,
        postId: input.postId ?? null,
        pollId: input.pollId ?? null,
        reportedUserId: input.reportedUserId ?? null,
        reporterId,
        reason: input.reason.trim(),
        status: 'open',
      }),
    );
    return { id: report.id, status: report.status, targetType: report.targetType };
  }

  /** System-generated report from async moderation queue (no member reporter). */
  async createAutoSpamReport(input: {
    communityId: string;
    reportedUserId: string;
    targetType: string;
    reason: string;
  }) {
    const community = await this.communityRepository.findOne({
      where: { id: input.communityId },
    });
    if (!community) return null;

    const report = await this.reportRepository.save(
      this.reportRepository.create({
        communityId: input.communityId,
        targetType: input.targetType,
        reportedUserId: input.reportedUserId,
        reporterId: community.creatorId,
        reason: input.reason.trim(),
        status: 'open',
      }),
    );
    return { id: report.id, status: report.status };
  }

  async listReports(status = 'open', limit = 50) {
    return this.reportRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async resolveReport(reportId: string, resolverId: string) {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = 'resolved';
    report.resolvedBy = resolverId;
    report.resolvedAt = new Date();
    await this.reportRepository.save(report);
    return { resolved: true };
  }

  async resolveReportForCommunity(
    actorId: string,
    communityId: string,
    reportId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.assertReportAccess(actorId, communityId, viewerRole);
    const report = await this.reportRepository.findOne({ where: { id: reportId, communityId } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = 'resolved';
    report.resolvedBy = actorId;
    report.resolvedAt = new Date();
    await this.reportRepository.save(report);
    return { resolved: true };
  }

  async banMember(
    actorId: string,
    communityId: string,
    userId: string,
    reason?: string,
    expiresAt?: Date | null,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.assertModeratorAccess(actorId, communityId, viewerRole);
    const existing = await this.banRepository.findOne({ where: { communityId: community.id, userId } });
    if (existing) {
      existing.reason = reason ?? null;
      existing.expiresAt = expiresAt ?? null;
      existing.createdBy = actorId;
      await this.banRepository.save(existing);
    } else {
      await this.banRepository.save(
        this.banRepository.create({
          communityId: community.id,
          userId,
          reason: reason ?? null,
          expiresAt: expiresAt ?? null,
          createdBy: actorId,
        }),
      );
    }
    void this.notificationsService
      .create({
        userId,
        type: NotificationType.COMMUNITY_BANNED,
        title: 'Removed from community',
        body: reason?.trim() || 'You have been banned from this community.',
        metadata: { communityId: community.id },
      })
      .catch(() => undefined);
    await this.auditService.log({
      creatorId: community.creatorId,
      actorId,
      action: 'member.ban',
      resourceType: 'community',
      resourceId: community.id,
      metadata: { userId, reason: reason ?? null },
    });
    return { banned: true };
  }

  async unbanMember(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.assertModeratorAccess(actorId, communityId, viewerRole);
    await this.banRepository.delete({ communityId, userId });
    await this.auditService.log({
      creatorId: community.creatorId,
      actorId,
      action: 'member.unban',
      resourceType: 'community',
      resourceId: community.id,
      metadata: { userId },
    });
    return { unbanned: true };
  }

  async assignRole(
    actorId: string,
    communityId: string,
    userId: string,
    role: CommunityRoleType,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.assertAdminAccess(actorId, communityId, viewerRole);
    if (
      (role === CommunityRoleType.OWNER || role === CommunityRoleType.ADMIN) &&
      !(await this.hasOwnerPrivileges(community, actorId, viewerRole))
    ) {
      throw new ForbiddenException('Only the community owner can assign owner or admin roles');
    }
    const existing = await this.roleRepository.findOne({ where: { communityId, userId } });
    if (existing) {
      existing.role = role;
      await this.roleRepository.save(existing);
    } else {
      await this.roleRepository.save(
        this.roleRepository.create({ communityId, userId, role }),
      );
    }
    void this.notificationsService
      .create({
        userId,
        type: NotificationType.COMMUNITY_ROLE_ASSIGNED,
        title: 'Community role updated',
        body: `You are now a ${role} in this community.`,
        metadata: { communityId, role },
      })
      .catch(() => undefined);
    return { assigned: true, role };
  }

  async listRoles(actorId: string, communityId: string, viewerRole?: UserRole | null) {
    await this.assertAdminAccess(actorId, communityId, viewerRole);
    const roles = await this.roleRepository.find({
      where: { communityId },
      order: { createdAt: 'ASC' },
    });
    return roles.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      createdAt: r.createdAt,
    }));
  }

  async removeRole(
    actorId: string,
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.assertAdminAccess(actorId, communityId, viewerRole);
    await this.roleRepository.delete({ communityId, userId });
    return { removed: true };
  }

  async listBans(actorId: string, communityId: string, viewerRole?: UserRole | null) {
    await this.assertModeratorAccess(actorId, communityId, viewerRole);
    const bans = await this.banRepository.find({
      where: { communityId },
      order: { createdAt: 'DESC' },
    });
    return bans.map((b) => ({
      id: b.id,
      userId: b.userId,
      reason: b.reason,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
    }));
  }

  async listReportsForCommunity(
    actorId: string,
    communityId: string,
    status = 'open',
    viewerRole?: UserRole | null,
  ) {
    await this.assertReportAccess(actorId, communityId, viewerRole);
    return this.reportRepository.find({
      where: { communityId, status },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listUnifiedReportsForCreator(userId: string, status = 'open') {
    const [owned, roles] = await Promise.all([
      this.communityRepository.find({
        where: { creatorId: userId },
        select: ['id', 'name', 'slug'],
      }),
      this.roleRepository.find({
        where: { userId },
        relations: ['community'],
      }),
    ]);

    const byId = new Map<string, { id: string; name: string; slug: string }>();
    for (const community of owned) {
      byId.set(community.id, community);
    }
    for (const assignment of roles) {
      if (!assignment.community) continue;
      byId.set(assignment.community.id, {
        id: assignment.community.id,
        name: assignment.community.name,
        slug: assignment.community.slug,
      });
    }

    const communities = [...byId.values()];
    const communityIds = communities.map((c) => c.id);
    if (!communityIds.length) return { data: [] };
    const reports = await this.reportRepository.find({
      where: { communityId: In(communityIds), status },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const nameById = new Map(communities.map((c) => [c.id, c.name]));
    return {
      data: reports.map((r) => ({
        ...r,
        communityName: nameById.get(r.communityId) ?? r.communityId,
      })),
    };
  }

  async isBanned(communityId: string, userId: string): Promise<boolean> {
    const ban = await this.banRepository.findOne({ where: { communityId, userId } });
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt <= new Date()) {
      await this.banRepository.delete({ id: ban.id });
      return false;
    }
    return true;
  }

  private async assertReportAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (await this.hasReportPrivileges(community, actorId, viewerRole)) return community;
    throw new ForbiddenException('Insufficient community permissions');
  }

  private async assertModeratorAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (await this.hasModeratorPrivileges(community, actorId, viewerRole)) return community;
    throw new ForbiddenException('Insufficient community permissions');
  }

  private async assertAdminAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (await this.hasAdminPrivileges(community, actorId, viewerRole)) return community;
    throw new ForbiddenException('Insufficient community permissions');
  }

  private async hasReportPrivileges(
    community: Community,
    actorId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (await this.hasModeratorPrivileges(community, actorId, viewerRole)) return true;
    if (viewerRole === UserRole.ADMIN) return true;
    if (community.creatorId === actorId) return true;
    const assignment = await this.roleRepository.findOne({
      where: { communityId: community.id, userId: actorId },
    });
    return assignment?.role === CommunityRoleType.COACH;
  }

  private async hasModeratorPrivileges(
    community: Community,
    actorId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (community.creatorId === actorId) return true;
    const assignment = await this.roleRepository.findOne({
      where: { communityId: community.id, userId: actorId },
    });
    if (!assignment) return false;
    return (
      assignment.role === CommunityRoleType.ADMIN ||
      assignment.role === CommunityRoleType.MODERATOR ||
      assignment.role === CommunityRoleType.OWNER
    );
  }

  private async hasAdminPrivileges(
    community: Community,
    actorId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (community.creatorId === actorId) return true;
    const assignment = await this.roleRepository.findOne({
      where: { communityId: community.id, userId: actorId },
    });
    if (!assignment) return false;
    return (
      assignment.role === CommunityRoleType.ADMIN ||
      assignment.role === CommunityRoleType.OWNER
    );
  }

  /** Owner-tier only — creator, platform admin, or an assigned OWNER role. Excludes ADMIN, per COMMUNITY-PERMISSION-MATRIX.md's `assign_roles` key. */
  private async hasOwnerPrivileges(
    community: Community,
    actorId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (community.creatorId === actorId) return true;
    const assignment = await this.roleRepository.findOne({
      where: { communityId: community.id, userId: actorId },
    });
    return assignment?.role === CommunityRoleType.OWNER;
  }
}
