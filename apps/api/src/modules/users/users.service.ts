import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, ILike } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { CreatorStatus, User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { Video, VideoStatus, VideoType, VideoVisibility } from '../content/entities/video.entity';
import { VideosService } from '../content/videos.service';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { ModerationStatus } from '../content/entities/video.entity';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';
import { PresignProfileImageUploadDto } from './dto/profile-image-upload.dto';
import {
  isReservedUsername,
  normalizeUsername,
  USERNAME_CHANGE_COOLDOWN_DAYS,
} from './username.util';

const INTERESTS_TTL_SEC = 60 * 60 * 24 * 365;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_BANNER_BYTES = 8 * 1024 * 1024;

export type UserVideosTypeFilter = 'video' | 'short' | 'all';
export type UserVideosSort = 'newest' | 'oldest' | 'popular';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    private readonly videosService: VideosService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.s3 = new S3Client({
      region: configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      },
    });
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const normalized = username?.trim().replace(/^@/, '') ?? '';
    // Align with SignupDto: reject junk (favicon.ico, etc.) before hitting Postgres.
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalized)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userRepository.findOne({ where: { username: ILike(normalized) } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Resolve exactly one of userId or username to a user id. */
  async resolveUserId(input: { userId?: string; username?: string }): Promise<string> {
    const id = input.userId?.trim();
    const rawUsername = input.username?.trim().replace(/^@/, '');
    if (!!id === !!rawUsername) {
      throw new BadRequestException('Provide exactly one of userId or username');
    }
    if (id) {
      await this.findById(id);
      return id;
    }
    const user = await this.findByUsername(rawUsername!);
    return user.id;
  }

  async searchUsersForPicker(q: string, limit = 10) {
    const term = q.trim().replace(/^@/, '');
    if (term.length < 2) return [];
    const take = Math.min(Math.max(limit, 1), 20);
    const users = await this.userRepository.find({
      where: [{ username: ILike(`${term}%`) }, { displayName: ILike(`${term}%`) }],
      take,
      order: { username: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
    }));
  }

  async update(requesterId: string, targetId: string, dto: UpdateUserDto): Promise<User> {
    if (requesterId !== targetId) throw new ForbiddenException('Cannot update another user\'s profile');
    const user = await this.findById(targetId);

    if (dto.username !== undefined) {
      const next = normalizeUsername(dto.username);
      if (next !== user.username) {
        if (isReservedUsername(next)) {
          throw new BadRequestException('That username is reserved');
        }
        if (user.usernameChangedAt) {
          const unlockAt = new Date(user.usernameChangedAt);
          unlockAt.setUTCDate(unlockAt.getUTCDate() + USERNAME_CHANGE_COOLDOWN_DAYS);
          if (unlockAt.getTime() > Date.now()) {
            throw new BadRequestException(
              `You can change your username again after ${unlockAt.toISOString().slice(0, 10)}`,
            );
          }
        }
        const taken = await this.userRepository
          .createQueryBuilder('u')
          .where('LOWER(u.username) = LOWER(:username)', { username: next })
          .andWhere('u.id != :id', { id: user.id })
          .getOne();
        if (taken) {
          throw new BadRequestException('Username already taken');
        }
        user.username = next;
        user.usernameChangedAt = new Date();
      }
    }

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.websiteUrl !== undefined) {
      user.websiteUrl = dto.websiteUrl?.trim() ? dto.websiteUrl.trim() : null;
    }
    if (dto.channelLinks !== undefined) {
      if (dto.channelLinks === null) {
        user.channelLinks = null;
      } else {
        user.channelLinks = dto.channelLinks
          .map((l) => ({
            title: l.title.trim().slice(0, 60),
            url: l.url.trim().slice(0, 500),
          }))
          .filter((l) => l.title && l.url)
          .slice(0, 5);
        if (user.channelLinks.length === 0) user.channelLinks = null;
      }
    }
    return this.userRepository.save(user);
  }

  async getAvatarUploadUrl(
    requesterId: string,
    input: PresignProfileImageUploadDto,
    targetUserId: string,
  ) {
    return this.getImageUploadUrl(requesterId, input, targetUserId, 'avatar');
  }

  async getBannerUploadUrl(
    requesterId: string,
    input: PresignProfileImageUploadDto,
    targetUserId: string,
  ) {
    return this.getImageUploadUrl(requesterId, input, targetUserId, 'banner');
  }

  async completeAvatarUpload(requesterId: string, key: string, targetUserId: string) {
    return this.completeImageUpload(requesterId, key, targetUserId, 'avatar');
  }

  async completeBannerUpload(requesterId: string, key: string, targetUserId: string) {
    return this.completeImageUpload(requesterId, key, targetUserId, 'banner');
  }

  private async getImageUploadUrl(
    requesterId: string,
    input: PresignProfileImageUploadDto,
    targetUserId: string,
    kind: 'avatar' | 'banner',
  ) {
    if (requesterId !== targetUserId) {
      throw new ForbiddenException(
        kind === 'avatar'
          ? 'Cannot upload avatar for another user'
          : 'Cannot upload banner for another user',
      );
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const contentType = input.contentType?.trim() || 'image/jpeg';
    if (!allowed.includes(contentType)) {
      throw new BadRequestException('Unsupported image format');
    }
    const maxBytes = kind === 'avatar' ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES;
    if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes > maxBytes) {
      throw new BadRequestException(
        kind === 'avatar'
          ? `Avatar images must be ${Math.floor(MAX_AVATAR_BYTES / (1024 * 1024))}MB or smaller`
          : `Banner images must be ${Math.floor(MAX_BANNER_BYTES / (1024 * 1024))}MB or smaller`,
      );
    }

    const ext = contentType.split('/')[1];
    const folder = kind === 'avatar' ? 'avatars' : 'banners';
    const key = `${folder}/${requesterId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain
      ? `${cdnDomain}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl: url, publicUrl, key };
  }

  private async completeImageUpload(
    requesterId: string,
    key: string,
    targetUserId: string,
    kind: 'avatar' | 'banner',
  ) {
    if (requesterId !== targetUserId) {
      throw new ForbiddenException(
        kind === 'avatar'
          ? 'Cannot finalize avatar for another user'
          : 'Cannot finalize banner for another user',
      );
    }
    const expectedPrefix = `${kind === 'avatar' ? 'avatars' : 'banners'}/${requesterId}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new BadRequestException('Upload key does not match the target user');
    }
    const publicUrl = this.buildPublicUrl(key);
    if (kind === 'avatar') {
      await this.userRepository.update(requesterId, { avatarUrl: publicUrl });
    } else {
      await this.userRepository.update(requesterId, { bannerUrl: publicUrl });
    }
    return { publicUrl };
  }

  private buildPublicUrl(key: string): string {
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    return cdnDomain
      ? `${cdnDomain}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async getUserVideos(
    userId: string,
    limit = 20,
    cursor?: string,
    viewerId?: string,
    videoType: UserVideosTypeFilter = 'all',
    sort: UserVideosSort = 'newest',
  ) {
    const isOwner = viewerId === userId;
    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'creator')
      .leftJoinAndSelect('v.skillTags', 'skillTags')
      .where('v.user_id = :userId', { userId })
      .andWhere('v.status = :status', { status: 'ready' })
      .take(limit + 1);

    if (sort === 'popular') {
      query.orderBy('v.view_count', 'DESC').addOrderBy('v.created_at', 'DESC');
    } else if (sort === 'oldest') {
      query.orderBy('v.created_at', 'ASC');
    } else {
      query.orderBy('v.created_at', 'DESC');
    }

    if (videoType === 'short') {
      query.andWhere('v.video_type = :vtype', { vtype: VideoType.SHORT });
    } else if (videoType === 'video') {
      query.andWhere('v.video_type = :vtype', { vtype: VideoType.VIDEO });
    }

    if (!isOwner) {
      // Public profile listing must honour the platform discovery contract
      // (see isVideoDiscoverable / applyDiscoverableVideoFilters): only PUBLIC
      // videos are listed. UNLISTED is link-only and must not surface here, and
      // followers/subscribers/tier/paid content is gated elsewhere.
      query
        .andWhere('v.publish_status = :publishStatus', { publishStatus: 'published' })
        .andWhere('v.visibility = :vis', { vis: VideoVisibility.PUBLIC })
        .andWhere('v.moderation_status = :mod', { mod: ModerationStatus.NONE })
        .andWhere(
          '(v.scheduled_publish_at IS NULL OR v.scheduled_publish_at <= CURRENT_TIMESTAMP)',
        )
        .andWhere('(v.published_at IS NULL OR v.published_at <= CURRENT_TIMESTAMP)');
    }

    if (cursor && sort !== 'popular') {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      if (sort === 'oldest') {
        query.andWhere('v.created_at > :cursor', { cursor: cursorDate });
      } else {
        query.andWhere('v.created_at < :cursor', { cursor: cursorDate });
      }
    }

    const videos = await query.getMany();
    const hasMore = videos.length > limit;
    const data = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor =
      hasMore && sort !== 'popular'
        ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
        : null;

    return {
      data: data.map((v) => this.videosService.mapToPublicVideo(v)),
      meta: { cursor: nextCursor, hasMore: sort === 'popular' ? false : hasMore },
    };
  }

  async getWatchHistory(userId: string, limit = 20, incompleteOnly = false) {
    const take = Math.min(limit, 50);
    const qb = this.watchHistoryRepository
      .createQueryBuilder('wh')
      .leftJoinAndSelect('wh.video', 'video')
      .leftJoinAndSelect('video.user', 'user')
      .where('wh.userId = :userId', { userId })
      .orderBy('wh.watchedAt', 'DESC')
      .take(take);

    if (incompleteOnly) {
      qb.andWhere('video.durationSeconds IS NOT NULL');
      qb.andWhere('video.status = :ready', { ready: VideoStatus.READY });
      qb.andWhere('(wh.progressSeconds < (video.durationSeconds * 0.9))');
    }

    const rows = await qb.getMany();
    const ready = rows.filter((r) => r.video && r.video.status === VideoStatus.READY);
    if (incompleteOnly) {
      const videos = ready.map((r) => ({
        ...this.videosService.mapToPublicVideo(r.video as Video),
        viewerProgressSeconds: r.progressSeconds,
      }));
      return { data: videos, meta: { limit: take, incompleteOnly } };
    }
    const data = ready.map((r) => ({
      video: this.videosService.mapToPublicVideo(r.video as Video),
      progressSeconds: r.progressSeconds,
      watchedAt: r.watchedAt,
    }));
    return { data, meta: { limit: take, incompleteOnly } };
  }

  async clearWatchHistory(userId: string): Promise<{ ok: true; deleted: number }> {
    const result = await this.watchHistoryRepository.delete({ userId });
    return { ok: true, deleted: result.affected ?? 0 };
  }

  async removeWatchHistoryItem(
    userId: string,
    videoId: string,
  ): Promise<{ ok: true; deleted: number }> {
    const result = await this.watchHistoryRepository.delete({ userId, videoId });
    return { ok: true, deleted: result.affected ?? 0 };
  }

  async getPrivacySettings(userId: string): Promise<{ watchHistoryPaused: boolean }> {
    const user = await this.findById(userId);
    return { watchHistoryPaused: !!user.watchHistoryPaused };
  }

  async setPrivacySettings(
    userId: string,
    patch: { watchHistoryPaused?: boolean },
  ): Promise<{ watchHistoryPaused: boolean }> {
    const user = await this.findById(userId);
    if (typeof patch.watchHistoryPaused === 'boolean') {
      user.watchHistoryPaused = patch.watchHistoryPaused;
      await this.userRepository.save(user);
    }
    return { watchHistoryPaused: !!user.watchHistoryPaused };
  }

  async isWatchHistoryPaused(userId: string): Promise<boolean> {
    const row = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, watchHistoryPaused: true },
    });
    return !!row?.watchHistoryPaused;
  }

  async requestCreator(userId: string, applicationNote?: string): Promise<User> {
    const user = await this.findById(userId);

    if (!user.isVerified) {
      throw new BadRequestException('Verify your email before applying to become a creator');
    }

    if (user.role === UserRole.ADMIN) return user;

    if (user.role === UserRole.CREATOR && user.creatorStatus === CreatorStatus.APPROVED) {
      return user;
    }

    user.role = UserRole.CREATOR;
    user.creatorStatus = CreatorStatus.PENDING;
    user.creatorRequestedAt = user.creatorRequestedAt ?? new Date();
    user.creatorReviewedAt = null;
    const note = applicationNote?.trim();
    user.creatorReviewNote = note || null;

    return this.userRepository.save(user);
  }

  async acknowledgeMatureContent(userId: string): Promise<User> {
    const user = await this.findById(userId);
    user.matureContentAcknowledgedAt = new Date();
    return this.userRepository.save(user);
  }

  private interestsKey(userId: string) {
    return `user:interests:${userId}`;
  }

  async setInterestCategoryIds(userId: string, categoryIds: string[]) {
    const cleaned = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))].slice(0, 20);
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (cleaned.some((id) => !uuidRe.test(id))) {
      throw new BadRequestException('categoryIds must be valid UUIDs');
    }
    await safeRedisSetex(
      this.redis,
      this.interestsKey(userId),
      INTERESTS_TTL_SEC,
      JSON.stringify(cleaned),
      this.logger,
    );
    return { categoryIds: cleaned };
  }

  async getInterestCategoryIds(userId: string): Promise<string[]> {
    const raw = await safeRedisGet(this.redis, this.interestsKey(userId), this.logger);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
