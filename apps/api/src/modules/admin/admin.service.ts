import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AdminTier, CreatorStatus, User, UserRole } from '../users/entities/user.entity';
import {
  ModerationStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from '../content/entities/video.entity';
import { Report, ReportStatus } from '../reports/entities/report.entity';
import { UsersService } from '../users/users.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { VideosService } from '../content/videos.service';
import { AdminVideo, toAdminVideo, toAdminVideos } from '../content/video.mapper';
import { permissionsForUser } from '../../common/auth/permissions';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateAdminVideoDto } from './dto/update-admin-video.dto';
import { AuthUserCacheService } from '../auth/auth-user-cache.service';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';
import { StreamingService } from '../streaming/streaming.service';
import { StreamLiveService } from '../streaming/stream-live.service';
import { Stream, StreamStatus } from '../streaming/entities/stream.entity';
import { StreamChatService } from '../stream-chat/stream-chat.service';
import { Community, CommunityVisibility } from '../communities/entities/community.entity';
import { CommunityReport } from '../communities/entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from '../communities/entities/community-role.entity';
import { StripeConnectService } from '../billing/stripe-connect.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OAuthAccount } from '../auth/entities/oauth-account.entity';
import { UpdateAdminCommunityDto } from './dto/update-admin-community.dto';

export type AdminUserDetail = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: UserRole;
  /** Present when role=admin — full can mutate platform settings; moderator is read+moderation. */
  adminTier?: AdminTier;
  isVerified: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  emailVerificationPending: boolean;
  creatorStatus: CreatorStatus | null;
  creatorRequestedAt: Date | null;
  creatorReviewedAt: Date | null;
  creatorReviewNote: string | null;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
  permissions: ReturnType<typeof permissionsForUser>;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityReport)
    private readonly communityReportRepository: Repository<CommunityReport>,
    @InjectRepository(CommunityRole)
    private readonly communityRoleRepository: Repository<CommunityRole>,
    @InjectRepository(OAuthAccount)
    private readonly oauthAccountRepository: Repository<OAuthAccount>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly playlistsService: PlaylistsService,
    private readonly authService: AuthService,
    private readonly authUserCache: AuthUserCacheService,
    private readonly analyticsService: AnalyticsService,
    private readonly videosService: VideosService,
    private readonly eventEmitter: EventEmitter2,
    private readonly streamingService: StreamingService,
    private readonly streamLiveService: StreamLiveService,
    private readonly streamChatService: StreamChatService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async moderateVideo(
    id: string,
    adminId: string,
    dto: UpdateAdminVideoDto,
  ): Promise<AdminVideo> {
    const video = await this.videoRepository.findOne({ where: { id }, relations: ['user'] });
    if (!video) throw new NotFoundException('Video not found');

    if (dto.status !== undefined) video.status = dto.status;
    if (dto.visibility !== undefined) video.visibility = dto.visibility;
    if (dto.moderationStatus !== undefined) {
      video.moderationStatus = dto.moderationStatus;
      video.moderatedAt = new Date();
      video.moderatedBy = adminId;
      if (dto.moderationStatus === ModerationStatus.BLOCKED) {
        video.visibility = VideoVisibility.PRIVATE;
      }
    }
    if (dto.moderationNote !== undefined) video.moderationNote = dto.moderationNote;
    if (dto.clearScheduledPublish) video.scheduledPublishAt = null;

    const saved = await this.videoRepository.save(video);
    await this.videosService.bustVideoDetailCache(id);
    this.eventEmitter.emit('video.updated', { videoId: id });
    return toAdminVideo(saved);
  }

  async updateUser(id: string, dto: UpdateAdminUserDto, adminId?: string) {
    const { currentAdminPassword, ...patch } = dto;

    if (patch.role === UserRole.ADMIN) {
      await this.assertAdminEscalationAllowed(id, adminId, currentAdminPassword);
    }

    if (patch.adminTier !== undefined) {
      const target = await this.userRepository.findOne({ where: { id }, select: ['id', 'role'] });
      const resultingRole = patch.role ?? target?.role;
      if (resultingRole !== UserRole.ADMIN) {
        throw new BadRequestException('adminTier can only be set on admin accounts');
      }
    }

    await this.userRepository.update(id, patch);
    await this.authUserCache.bust(id);
    if (dto.isActive === false) {
      await this.authService.logoutAll(id);
    }
    return this.findUserById(id);
  }

  /**
   * Step-up auth (MED-13): granting the admin role requires the calling admin
   * to re-enter their own current password. No-op if the target is already admin.
   */
  private async assertAdminEscalationAllowed(
    targetId: string,
    adminId: string | undefined,
    currentAdminPassword: string | undefined,
  ): Promise<void> {
    const target = await this.userRepository.findOne({ where: { id: targetId } });
    if (target?.role === UserRole.ADMIN) return;

    if (!adminId || !currentAdminPassword) {
      throw new ForbiddenException('Current password required to grant admin role');
    }
    const caller = await this.userRepository.findOne({ where: { id: adminId } });
    const valid = caller ? await bcrypt.compare(currentAdminPassword, caller.passwordHash) : false;
    if (!valid) {
      throw new ForbiddenException('Incorrect password');
    }
  }

  /** Bulk role/status change — one UPDATE for all rows, then per-user cache bust (unavoidable, cache is keyed per user). */
  async bulkUpdateUsers(ids: string[], dto: UpdateAdminUserDto, adminId?: string) {
    if (ids.length === 0) return { ok: true, updated: 0 };
    const { currentAdminPassword, ...patch } = dto;

    if (patch.role === UserRole.ADMIN) {
      // Same step-up auth as the single-user path (MED-13) — a batch
      // granting admin to up to 200 accounts must not skip it just because
      // it goes through the bulk endpoint.
      await this.assertBulkAdminEscalationAllowed(ids, adminId, currentAdminPassword);
    }

    await this.userRepository.update({ id: In(ids) }, patch);
    await Promise.all(ids.map((id) => this.authUserCache.bust(id)));
    if (dto.isActive === false) {
      await Promise.all(ids.map((id) => this.authService.logoutAll(id)));
    }
    return { ok: true, updated: ids.length };
  }

  private async assertBulkAdminEscalationAllowed(
    targetIds: string[],
    adminId: string | undefined,
    currentAdminPassword: string | undefined,
  ): Promise<void> {
    const targets = await this.userRepository.find({
      where: { id: In(targetIds) },
      select: ['id', 'role'],
    });
    const escalatesAnyone = targets.some((t) => t.role !== UserRole.ADMIN);
    if (!escalatesAnyone) return;

    if (!adminId || !currentAdminPassword) {
      throw new ForbiddenException('Current password required to grant admin role');
    }
    const caller = await this.userRepository.findOne({ where: { id: adminId } });
    const valid = caller ? await bcrypt.compare(currentAdminPassword, caller.passwordHash) : false;
    if (!valid) {
      throw new ForbiddenException('Incorrect password');
    }
  }

  async bulkApproveCreators(ids: string[]) {
    if (ids.length === 0) return { ok: true, updated: 0 };
    await this.userRepository.update(
      { id: In(ids) },
      {
        role: UserRole.CREATOR,
        creatorStatus: CreatorStatus.APPROVED,
        creatorReviewedAt: new Date(),
        creatorReviewNote: null,
        isVerified: true,
      },
    );
    await Promise.all(
      ids.map(async (id) => {
        await this.authUserCache.bust(id);
        this.eventEmitter.emit('creator.approved', { userId: id });
      }),
    );
    return { ok: true, updated: ids.length };
  }

  async bulkRejectCreators(ids: string[], note?: string) {
    if (ids.length === 0) return { ok: true, updated: 0 };
    await this.userRepository.update(
      { id: In(ids) },
      {
        role: UserRole.CREATOR,
        creatorStatus: CreatorStatus.REJECTED,
        creatorReviewedAt: new Date(),
        creatorReviewNote: note ?? null,
      },
    );
    await Promise.all(
      ids.map(async (id) => {
        await this.authUserCache.bust(id);
        this.eventEmitter.emit('creator.rejected', { userId: id, note: note ?? null });
      }),
    );
    return { ok: true, updated: ids.length };
  }

  async createImpersonation(adminId: string, targetUserId: string) {
    const result = await this.authService.createImpersonationToken(adminId, targetUserId);
    await this.analyticsService.ingest(adminId, {
      eventName: 'admin.impersonate',
      properties: { targetUserId, targetUsername: result.targetUser.username },
    });
    return result;
  }

  toAdminUserDetail(user: User): AdminUserDetail {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      role: user.role,
      adminTier: user.role === UserRole.ADMIN ? user.adminTier : undefined,
      isVerified: user.isVerified,
      isActive: user.isActive,
      deletedAt: user.deletedAt ?? null,
      emailVerificationPending: !user.isVerified,
      creatorStatus: user.creatorStatus,
      creatorRequestedAt: user.creatorRequestedAt,
      creatorReviewedAt: user.creatorReviewedAt,
      creatorReviewNote: user.creatorReviewNote,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      videoCount: user.videoCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions: permissionsForUser(user),
    };
  }

  async findUserById(id: string): Promise<AdminUserDetail> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return this.toAdminUserDetail(user);
  }

  async deleteUser(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot delete platform admin accounts');
    }

    // Cancel Stripe + local memberships before anonymizing so billing cannot
    // continue against a deleted customer (CEOS tracker 2026-08-22).
    await this.entitlementsService.cancelSubscriptionsForAccountDeletion(id);

    const suffix = id.replace(/-/g, '').slice(0, 12);
    user.deletedAt = new Date();
    user.isActive = false;
    user.isVerified = false;
    user.email = `deleted+${suffix}@removed.invalid`;
    user.username = `deleted_${suffix}`;
    user.displayName = 'Deleted user';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    // PII/media that would otherwise keep rendering on the anonymized
    // profile page (avatar/banner) or leaking real contact/social info
    // (bio/website/channelLinks) indefinitely after "deletion".
    user.bio = '';
    user.avatarUrl = '';
    user.bannerUrl = '';
    user.websiteUrl = null;
    user.channelLinks = null;
    user.mfaSecretEncrypted = null;
    user.mfaBackupCodeHashes = null;
    user.stripeConnectAccountId = null;
    await this.userRepository.save(user);
    await this.authService.logoutAll(id);

    // Not FK-cascaded because the user row is soft-deleted, not removed --
    // without this the real linked email (e.g. Google address) survives
    // indefinitely in an orphaned row.
    await this.oauthAccountRepository.delete({ userId: id });

    // Bulk UPDATE avoids loading every owned video into memory (heavy creators).
    const hideResult = await this.videoRepository
      .createQueryBuilder()
      .update(Video)
      .set({ visibility: VideoVisibility.PRIVATE })
      .where('user_id = :id', { id })
      .andWhere('visibility != :private', { private: VideoVisibility.PRIVATE })
      .returning(['id'])
      .execute();
    const hiddenIds = ((hideResult.raw as Array<{ id: string }> | undefined) ?? []).map(
      (row) => row.id,
    );
    if (hiddenIds.length) {
      const CHUNK = 50;
      for (let i = 0; i < hiddenIds.length; i += CHUNK) {
        const chunk = hiddenIds.slice(i, i + CHUNK);
        await Promise.all(
          chunk.map(async (videoId) => {
            await this.videosService.bustVideoDetailCache(videoId);
            this.eventEmitter.emit('video.updated', { videoId });
          }),
        );
      }
    }

    const activeStreams = await this.streamRepository.find({
      where: { userId: id, status: In([StreamStatus.LIVE, StreamStatus.IDLE]) },
    });
    for (const stream of activeStreams) {
      await this.streamingService.endStream(id, stream.id);
    }

    await this.transferOwnedCommunities(id);

    return { ok: true };
  }

  /**
   * A deleted user's owned communities can't stay pointed at an anonymized,
   * logged-out account with no way to exercise owner-tier actions. Promotes
   * the longest-standing OWNER-tier delegate if one exists, else ADMIN, else
   * MODERATOR. If none exist, privatizes the community so it leaves the public
   * discovery surface (orphaned private communities stay queryable for ops).
   */
  private async transferOwnedCommunities(deletedUserId: string): Promise<void> {
    const ownedCommunities = await this.communityRepository.find({
      where: { creatorId: deletedUserId },
    });
    if (!ownedCommunities.length) return;

    for (const community of ownedCommunities) {
      const roles = await this.communityRoleRepository.find({
        where: { communityId: community.id },
        order: { createdAt: 'ASC' },
      });
      const delegate =
        roles.find((r) => r.role === CommunityRoleType.OWNER) ??
        roles.find((r) => r.role === CommunityRoleType.ADMIN) ??
        roles.find((r) => r.role === CommunityRoleType.MODERATOR);

      if (delegate) {
        await this.communityRepository.update(community.id, { creatorId: delegate.userId });
        this.eventEmitter.emit('community.ownership_transferred', {
          communityId: community.id,
          previousOwnerId: deletedUserId,
          newOwnerId: delegate.userId,
          reason: 'owner_deleted',
        });
        continue;
      }

      // No delegate: hide from public discovery rather than leave a public
      // community owned by an anonymized account.
      await this.communityRepository.update(community.id, {
        visibility: CommunityVisibility.PRIVATE,
      });
      this.eventEmitter.emit('community.orphaned_on_owner_delete', {
        communityId: community.id,
        previousOwnerId: deletedUserId,
      });
    }
  }

  async resendUserVerificationEmail(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new NotFoundException('User not found');
    return this.authService.resendVerification(id);
  }

  async listUsers(options: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole;
    creatorStatus?: CreatorStatus;
    isActive?: boolean;
    emailVerified?: boolean;
    hasPendingReports?: boolean;
  }) {
    const page = clampPage(options.page);
    const limit = clampLimit(options.limit);
    const { search, role, creatorStatus, isActive, emailVerified, hasPendingReports } = options;
    const query = this.userRepository
      .createQueryBuilder('u')
      .where('u.deleted_at IS NULL')
      .orderBy('u.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(u.email ILIKE :search OR u.username ILIKE :search OR u.displayName ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (role) query.andWhere('u.role = :role', { role });
    if (creatorStatus) query.andWhere('u.creatorStatus = :creatorStatus', { creatorStatus });
    if (isActive === true) query.andWhere('u.is_active = true');
    if (isActive === false) query.andWhere('u.is_active = false');
    if (emailVerified === true) query.andWhere('u.is_verified = true');
    if (emailVerified === false) query.andWhere('u.is_verified = false');
    if (hasPendingReports === true) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM reports r
          WHERE r.status = 'pending'
          AND (
            (r.target_type = 'user' AND r.target_id = u.id)
            OR (r.target_type = 'video' AND r.target_id IN (
              SELECT v.id FROM videos v WHERE v.user_id = u.id
            ))
          )
        )`,
      );
    }

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = rows.map((u) => this.toAdminUserDetail(u));
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getUserVideos(
    userId: string,
    page = 1,
    limit = 20,
    status?: VideoStatus,
  ) {
    page = clampPage(page);
    limit = clampLimit(limit);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const query = this.videoRepository
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .orderBy('v.createdAt', 'DESC');

    if (status) query.andWhere('v.status = :status', { status });

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: toAdminVideos(rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserReports(userId: string, page = 1, limit = 20) {
    page = clampPage(page);
    limit = clampLimit(limit);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const qb = this.reportRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.reporter', 'reporter')
      .where(
        `(r.targetType = 'user' AND r.targetId = :userId)
         OR r.reporterId = :userId
         OR (r.targetType = 'video' AND r.targetId IN (
           SELECT v.id FROM videos v WHERE v.user_id = :userId
         ))`,
        { userId },
      )
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getUserWatchHistory(userId: string, limit = 20) {
    await this.findUserById(userId);
    return this.usersService.getWatchHistory(userId, clampLimit(limit), false);
  }

  async getUserPlaylists(userId: string) {
    await this.findUserById(userId);
    return this.playlistsService.listByUser(userId);
  }

  async getUserSummary(userId: string) {
    const user = await this.findUserById(userId);
    const [videosByStatus, pendingReports, playlists] = await Promise.all([
      this.videoRepository
        .createQueryBuilder('v')
        .select('v.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('v.userId = :userId', { userId })
        .groupBy('v.status')
        .getRawMany<{ status: string; count: string }>(),
      this.reportRepository
        .createQueryBuilder('r')
        .where('r.status = :status', { status: ReportStatus.PENDING })
        .andWhere(
          `(r.targetType = 'user' AND r.targetId = :userId)
           OR (r.targetType = 'video' AND r.targetId IN (
             SELECT v.id FROM videos v WHERE v.user_id = :userId
           ))`,
          { userId },
        )
        .getCount(),
      this.playlistsService.listByUser(userId),
    ]);

    const videoStats = Object.fromEntries(
      videosByStatus.map((row) => [row.status, Number(row.count)]),
    ) as Record<string, number>;

    return {
      user,
      videoStats,
      pendingReports,
      playlistCount: playlists.length,
    };
  }

  async listStreams(opts: { status?: StreamStatus; page?: number; limit?: number }) {
    const page = clampPage(opts.page ?? 1);
    const limit = clampLimit(opts.limit ?? 20);
    const qb = this.streamRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.status) {
      qb.andWhere('s.status = :status', { status: opts.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        visibility: s.visibility,
        userId: s.userId,
        creatorName: s.user?.displayName,
        viewerCount: s.viewerCount,
        scheduledAt: s.scheduledAt,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async forceEndStream(streamId: string, _adminId: string) {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    return this.streamingService.endStream(stream.userId, streamId);
  }

  async grantStreamAccess(
    adminId: string,
    streamId: string,
    dto: { userId?: string; username?: string; note?: string },
  ) {
    const userId = await this.usersService.resolveUserId(dto);
    return this.streamingService.grantStreamEventAccess(adminId, streamId, userId, {
      isAdmin: true,
      note: dto.note,
    });
  }

  async backfillMuxPlaybackIds() {
    const updated = await this.streamLiveService.backfillMuxPlaybackIds();
    return { updated };
  }

  async backfillCaptionSearchText(limit = 25) {
    return this.videosService.backfillCaptionSearchText(limit);
  }

  async getStreamChat(streamId: string, adminId: string, role: UserRole, limit = 50) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    return this.streamChatService.getMessages(streamId, limit, undefined, adminId, role);
  }

  async deleteStreamChatMessage(streamId: string, messageId: string, adminId: string, role: UserRole) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    return this.streamChatService.deleteMessage(streamId, messageId, adminId, role);
  }

  async listCommunities(page: number, limit: number, search?: string) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const qb = this.communityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .orderBy('c.createdAt', 'DESC');

    if (search?.trim()) {
      qb.andWhere(
        '(c.name ILIKE :search OR c.slug ILIKE :search OR creator.username ILIKE :search OR creator.email ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [rows, total] = await qb
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        visibility: c.visibility,
        creatorId: c.creatorId,
        creator: c.creator
          ? {
              id: c.creator.id,
              username: c.creator.username,
              displayName: c.creator.displayName,
              email: c.creator.email,
            }
          : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async updateCommunity(id: string, dto: UpdateAdminCommunityDto) {
    const community = await this.communityRepository.findOne({ where: { id } });
    if (!community) throw new NotFoundException('Community not found');
    if (dto.name !== undefined) community.name = dto.name.trim();
    if (dto.visibility !== undefined) community.visibility = dto.visibility;
    await this.communityRepository.save(community);
    return {
      data: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        visibility: community.visibility,
        updatedAt: community.updatedAt,
      },
    };
  }

  async getCommunityDetail(id: string) {
    const community = await this.communityRepository.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!community) throw new NotFoundException('Community not found');

    const [activeSubsRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM member_subscriptions
       WHERE creator_id = $1 AND status IN ('active', 'trial', 'grace_period')`,
      [community.creatorId],
    );
    const [xpMembersRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp WHERE community_id = $1`,
      [community.id],
    );
    const openReports = await this.communityReportRepository.count({
      where: { communityId: community.id, status: 'open' },
    });
    const connect = community.creator
      ? await this.stripeConnectService.getConnectStatus(community.creator.id)
      : { connected: false, message: 'Creator not found' };

    return {
      data: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        visibility: community.visibility,
        creatorId: community.creatorId,
        creator: community.creator
          ? {
              id: community.creator.id,
              username: community.creator.username,
              displayName: community.creator.displayName,
              email: community.creator.email,
            }
          : null,
        stats: {
          activeSubscribers: Number(activeSubsRow?.count ?? 0),
          engagedMembers: Number(xpMembersRow?.count ?? 0),
          openReports,
        },
        connect,
        createdAt: community.createdAt,
        updatedAt: community.updatedAt,
      },
    };
  }

  async listCreatorConnectStatus(
    page: number,
    limit: number,
    search?: string,
    filter?: 'all' | 'connected' | 'incomplete' | 'none',
  ) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.CREATOR })
      .orderBy('u.createdAt', 'DESC');

    if (search?.trim()) {
      qb.andWhere(
        '(u.email ILIKE :search OR u.username ILIKE :search OR u.displayName ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    if (filter === 'connected') {
      qb.andWhere('u.stripeConnectAccountId IS NOT NULL');
    } else if (filter === 'none') {
      qb.andWhere('u.stripeConnectAccountId IS NULL');
    }

    const [rows, total] = await qb
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    const data = await Promise.all(
      rows.map(async (creator) => {
        const status = await this.stripeConnectService.getConnectStatus(creator.id);
        if (filter === 'incomplete' && status.chargesEnabled) {
          return null;
        }
        return {
          id: creator.id,
          email: creator.email,
          username: creator.username,
          displayName: creator.displayName,
          stripeConnectAccountId: creator.stripeConnectAccountId,
          connect: status,
        };
      }),
    );

    const filtered = data.filter((row): row is NonNullable<typeof row> => row != null);

    return {
      data: filtered,
      meta: {
        total: filter === 'incomplete' ? filtered.length : total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil((filter === 'incomplete' ? filtered.length : total) / safeLimit),
      },
    };
  }

  /**
   * Read-only, cross-creator transaction ledger for support/dispute lookups —
   * unions member subscriptions (recurring) and paid stream-event purchases
   * (one-off), the two sources of real money movement on the platform today.
   * No refund/write action here; that stays a separate, deliberate step.
   */
  async getBillingLedger(options: { page?: number; limit?: number; search?: string }) {
    const safePage = clampPage(options.page);
    const safeLimit = clampLimit(options.limit, 20);
    const offset = (safePage - 1) * safeLimit;
    const search = options.search?.trim();

    const ledgerCte = `
      WITH ledger AS (
        SELECT
          s.id::text AS id,
          'subscription' AS type,
          s.user_id AS user_id,
          u.username AS username,
          u.display_name AS display_name,
          s.creator_id AS creator_id,
          c.username AS creator_username,
          t.price_cents AS amount_cents,
          t.currency AS currency,
          s.status AS status,
          s.created_at AS created_at
        FROM member_subscriptions s
        INNER JOIN users u ON u.id = s.user_id
        INNER JOIN users c ON c.id = s.creator_id
        INNER JOIN subscription_tiers t ON t.id = s.tier_id
        UNION ALL
        SELECT
          p.id::text AS id,
          'event_purchase' AS type,
          p.user_id AS user_id,
          u.username AS username,
          u.display_name AS display_name,
          st.user_id AS creator_id,
          c.username AS creator_username,
          p.amount_cents AS amount_cents,
          p.currency AS currency,
          p.status AS status,
          p.purchased_at AS created_at
        FROM stream_event_purchases p
        INNER JOIN users u ON u.id = p.user_id
        INNER JOIN streams st ON st.id = p.stream_id
        INNER JOIN users c ON c.id = st.user_id
      )
      SELECT * FROM ledger
      ${search ? 'WHERE username ILIKE $1 OR creator_username ILIKE $1' : ''}
    `;

    const params: unknown[] = search ? [`%${search}%`] : [];
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<
        Array<{
          id: string;
          type: string;
          user_id: string;
          username: string;
          display_name: string;
          creator_id: string;
          creator_username: string;
          amount_cents: string;
          currency: string;
          status: string;
          created_at: string;
        }>
      >(
        `${ledgerCte} ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        [...params, safeLimit, offset],
      ),
      this.dataSource.query<{ count: string }[]>(`SELECT COUNT(*)::int AS count FROM (${ledgerCte}) t`, params),
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    return {
      data: rows.map((r) => ({
        id: r.id,
        type: r.type as 'subscription' | 'event_purchase',
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        creatorId: r.creator_id,
        creatorUsername: r.creator_username,
        amountCents: Number(r.amount_cents),
        currency: r.currency,
        status: r.status,
        createdAt: r.created_at,
      })),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}
