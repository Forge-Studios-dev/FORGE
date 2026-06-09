import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorStatus, User, UserRole } from '../users/entities/user.entity';
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

export type AdminUserDetail = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: UserRole;
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

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    await this.userRepository.update(id, dto);
    await this.authUserCache.bust(id);
    if (dto.isActive === false) {
      await this.authService.logoutAll(id);
    }
    return this.findUserById(id);
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
    const suffix = id.replace(/-/g, '').slice(0, 12);
    user.deletedAt = new Date();
    user.isActive = false;
    user.isVerified = false;
    user.email = `deleted+${suffix}@removed.invalid`;
    user.username = `deleted_${suffix}`;
    user.displayName = 'Deleted user';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await this.userRepository.save(user);
    await this.authService.logoutAll(id);
    return { ok: true };
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
      .orderBy('s.created_at', 'DESC')
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
}
