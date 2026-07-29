import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Repository, MoreThan } from 'typeorm';
import Mux from '@mux/mux-node';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamEndReason, StreamStatus, StreamVisibility, StreamChatMode } from './entities/stream.entity';
import { CreateStreamDto } from './dto/create-stream.dto';
import { Video, VideoStatus, VideoVisibility, PublishStatus } from '../content/entities/video.entity';
import { MuxVodService } from '../content/mux-vod.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TierEntitlementResourceType } from '../entitlements/entities/tier-entitlement.entity';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Community } from '../communities/entities/community.entity';
import {
  muxHlsPlaybackUrl,
  muxPlaybackIdFromHlsUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';
import {
  isMuxSigningConfigured,
  muxSignedHlsPlaybackUrl,
  normalizeMuxPrivateKey,
  type MuxSigningConfig,
} from '../../common/media/mux-signing.util';
import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { toPublicStream } from './stream.mapper';
import { StreamEventPurchase } from './entities/stream-event-purchase.entity';
import { StreamViewerService } from './stream-viewer.service';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { StreamReminderScheduler } from './stream-reminder.scheduler';
import {
  safeRedisGet,
  safeRedisSetex,
  safeRedisDel,
  safeRedisDelPattern,
} from '../../common/redis/redis-safe.util';
import {
  streamListCacheKey,
  streamListViewerKey,
  STREAM_LIST_CACHE_PREFIX,
} from '../../common/streaming/stream-list-cache.util';
import {
  streamDetailCacheKey,
  STREAM_DETAIL_CACHE_TTL_SEC,
} from '../../common/streaming/stream-detail-cache.util';
import { serializeStreamForCache } from './stream.mapper';
import {
  PREMIUM_CONTENT_NOTIFY_QUEUE,
  type PremiumContentNotifyJobData,
} from '../workers/premium-content-notify/premium-content-notify.constants';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly mux: Mux;
  private static readonly WEBHOOK_PROVIDER = 'mux';
  private static readonly LIVE_STREAMS_LIST_LIMIT = 100;
  private static readonly STREAM_LIST_CACHE_TTL_SEC = 20;
  private static readonly SOCKET_ACCESS_CACHE_TTL_SEC = 60;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StreamEventPurchase)
    private readonly purchaseRepository: Repository<StreamEventPurchase>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxVodService: MuxVodService,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    private readonly streamViewerService: StreamViewerService,
    private readonly muxLiveSyncService: MuxLiveSyncService,
    private readonly streamReminderScheduler: StreamReminderScheduler,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(PREMIUM_CONTENT_NOTIFY_QUEUE)
    private readonly premiumContentNotifyQueue: Queue<PremiumContentNotifyJobData>,
  ) {
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  async createStream(userId: string, dto: CreateStreamDto): Promise<Stream> {
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const muxTokenId = this.configService.get<string>('mux.tokenId');
    const muxTokenSecret = this.configService.get<string>('mux.tokenSecret');
    const muxConfigured =
      muxTokenId && muxTokenSecret && muxTokenId !== 'placeholder' && muxTokenSecret !== 'placeholder';

    if (nodeEnv === 'production' && !muxConfigured) {
      throw new ServiceUnavailableException('Live streaming is not configured');
    }

    let muxLiveStreamId = 'mock-stream-id';
    let streamKey = 'mock-stream-key';
    let playbackUrl: string | undefined;
    let thumbnailUrl: string | undefined = dto.thumbnailUrl?.trim() || undefined;

    const recordEnabled = dto.recordEnabled !== false;
    const visibility = dto.visibility ?? StreamVisibility.PUBLIC;

    if (visibility === StreamVisibility.PAID_EVENT) {
      if (!dto.ticketPriceCents || dto.ticketPriceCents < 100) {
        throw new BadRequestException('Paid events require ticketPriceCents of at least 100');
      }
    }

    let scheduledAt: Date | null = null;
    if (dto.scheduledAt) {
      scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt must be a valid future datetime');
      }
    }

    if (dto.communityId) {
      const community = await this.communityRepository.findOne({
        where: { id: dto.communityId, creatorId: userId },
      });
      if (!community) {
        throw new BadRequestException('Community not found or not owned by creator');
      }
    }

    try {
      const useSignedPlayback = this.requiresSignedPlayback(visibility);
      const dvrEnabled = dto.dvrEnabled === true;
      const response = await this.mux.video.liveStreams.create({
        playback_policy: [useSignedPlayback ? 'signed' : 'public'],
        new_asset_settings: recordEnabled
          ? { playback_policy: [useSignedPlayback ? 'signed' : 'public'] }
          : undefined,
        reduced_latency: !dvrEnabled,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any;
      muxLiveStreamId = raw.id ?? muxLiveStreamId;
      streamKey = raw.stream_key ?? streamKey;
      const playbackId = raw.playback_ids?.[0]?.id as string | undefined;
      if (playbackId) {
        playbackUrl = muxHlsPlaybackUrl(playbackId);
        if (!thumbnailUrl) {
          thumbnailUrl = muxThumbnailUrl(playbackId);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (nodeEnv === 'production') {
        this.logger.error(`Mux live stream create failed: ${message}`);
        throw new ServiceUnavailableException(
          'Live streaming is temporarily unavailable. Please try again shortly.',
        );
      }
      this.logger.warn('Mux API unavailable, using mock stream data', err);
    }

    const stream = this.streamRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      muxLiveStreamId,
      streamKey,
      rtmpUrl: 'rtmps://global-live.mux.com:443/app',
      playbackUrl,
      muxPlaybackId: playbackUrl ? muxPlaybackIdFromHlsUrl(playbackUrl) : null,
      status: StreamStatus.IDLE,
      visibility,
      categoryId: dto.categoryId ?? null,
      thumbnailUrl,
      chatEnabled: dto.chatEnabled !== false,
      chatMode: StreamChatMode.ALL,
      dvrEnabled: dto.dvrEnabled === true,
      recordEnabled,
      ageRestricted: dto.ageRestricted === true,
      requiredTierId: dto.requiredTierId ?? null,
      scheduledAt,
      ticketPriceCents:
        visibility === StreamVisibility.PAID_EVENT ? (dto.ticketPriceCents ?? null) : null,
      communityId: dto.communityId ?? null,
    });

    const saved = await this.streamRepository.save(stream);
    void this.invalidateStreamListCache();
    void this.bustStreamDetailCache(saved.id);
    await this.muxLiveSyncService.clearPlatformDormant();
    if (saved.scheduledAt) {
      await this.streamReminderScheduler.scheduleReminder(saved.id, saved.scheduledAt);
    }
    return saved;
  }

  async findById(id: string, opts?: { skipCache?: boolean }): Promise<Stream> {
    const cacheKey = streamDetailCacheKey(id);
    if (!opts?.skipCache) {
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Stream;
          return this.streamRepository.create({
            ...parsed,
            scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt as unknown as string) : null,
            startedAt: parsed.startedAt ? new Date(parsed.startedAt as unknown as string) : null,
            endedAt: parsed.endedAt ? new Date(parsed.endedAt as unknown as string) : null,
            muxIdleSince: parsed.muxIdleSince
              ? new Date(parsed.muxIdleSince as unknown as string)
              : null,
            reminderSentAt: parsed.reminderSentAt
              ? new Date(parsed.reminderSentAt as unknown as string)
              : null,
            createdAt: new Date(parsed.createdAt as unknown as string),
            updatedAt: new Date(parsed.updatedAt as unknown as string),
          } as Stream);
        } catch {
          await safeRedisDel(this.redis, cacheKey, this.logger);
        }
      }
    }

    const stream = await this.streamRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!stream) throw new NotFoundException('Stream not found');

    if (!opts?.skipCache) {
      await safeRedisSetex(
        this.redis,
        cacheKey,
        STREAM_DETAIL_CACHE_TTL_SEC,
        serializeStreamForCache(stream),
        this.logger,
      );
    }
    return stream;
  }

  async bustStreamDetailCache(streamId: string): Promise<void> {
    await safeRedisDel(this.redis, streamDetailCacheKey(streamId), this.logger);
  }

  async getStreamForViewer(
    id: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.findById(id);
    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const access = await this.entitlementsService.checkAccess({
      creatorId: stream.userId,
      visibility: stream.visibility,
      requiredTierId: stream.requiredTierId,
      streamId: stream.id,
      viewerId,
      isOwner,
      isAdmin,
    });

    let hidePlayback = !access.allowed;
    let accessReason = access.reason;

    if (
      !hidePlayback &&
      viewerId &&
      !isOwner &&
      !isAdmin &&
      [StreamVisibility.SUBSCRIBERS, StreamVisibility.TIER].includes(stream.visibility)
    ) {
      const entitled = await this.entitlementsService.verifyMediaTierEntitlements(
        viewerId,
        stream.userId,
        TierEntitlementResourceType.STREAM,
        stream.id,
      );
      if (!entitled) {
        hidePlayback = true;
        accessReason = 'tier_required';
      }
    }

    if (!hidePlayback && stream.ageRestricted && !isOwner && !isAdmin) {
      const ageOk = await this.viewerHasMatureContentAck(viewerId);
      if (!ageOk) {
        hidePlayback = true;
        accessReason = 'age_confirmation_required';
      }
    }

    if (
      !hidePlayback &&
      viewerId &&
      !isOwner &&
      !isAdmin &&
      [StreamVisibility.SUBSCRIBERS, StreamVisibility.TIER].includes(stream.visibility)
    ) {
      try {
        await this.accessSessionsService.requirePremiumSession(
          viewerId,
          stream.userId,
          AccessSessionType.LIVE,
          stream.id,
        );
      } catch (err) {
        hidePlayback = true;
        accessReason = 'subscription_required';
      }
    }

    return toPublicStream(stream, isOwner, {
      hidePlayback,
      accessReason,
      ticketPriceCents: stream.ticketPriceCents,
      scheduledAt: stream.scheduledAt,
      pinnedMessageId: stream.pinnedMessageId,
      playbackUrl: hidePlayback
        ? null
        : this.resolvePlaybackUrlForViewer(stream, isOwner || isAdmin),
      reconnectGraceSec: this.configService.get<number>('mux.idleGraceSec') ?? 60,
    });
  }

  /** Resolve HLS URL — signed token for restricted streams when configured. */
  resolvePlaybackUrlForViewer(stream: Stream, bypassSigning = false): string | null {
    if (stream.status !== StreamStatus.LIVE || !stream.playbackUrl) return null;
    if (bypassSigning || !this.requiresSignedPlayback(stream.visibility)) {
      return stream.playbackUrl;
    }

    const signing = this.muxSigningConfig();
    const playbackId = stream.muxPlaybackId ?? muxPlaybackIdFromHlsUrl(stream.playbackUrl);
    if (!playbackId || !isMuxSigningConfigured(signing)) {
      this.logger.warn(
        `Signed playback required for stream ${stream.id} but MUX signing keys are not configured`,
      );
      return null;
    }

    const ttl = this.configService.get<number>('mux.signedPlaybackTtlSec') ?? 3600;
    return muxSignedHlsPlaybackUrl(playbackId, signing, ttl);
  }

  private requiresSignedPlayback(visibility: StreamVisibility): boolean {
    return visibility !== StreamVisibility.PUBLIC;
  }

  private muxSigningConfig(): MuxSigningConfig | null {
    const keyId = this.configService.get<string>('mux.signingKeyId') || '';
    const rawKey = this.configService.get<string>('mux.signingPrivateKey') || '';
    if (!keyId.trim() || !rawKey.trim()) return null;
    return { keyId: keyId.trim(), privateKeyPem: normalizeMuxPrivateKey(rawKey) };
  }

  private async viewerHasMatureContentAck(viewerId?: string | null): Promise<boolean> {
    if (!viewerId) return false;
    const user = await this.userRepository.findOne({
      where: { id: viewerId },
      select: ['id', 'matureContentAcknowledgedAt'],
    });
    return !!user?.matureContentAcknowledgedAt;
  }

  async getLiveStreams(viewerId?: string | null, viewerRole?: UserRole | null) {
    const viewerKey = streamListViewerKey(viewerId);
    const cacheKey = streamListCacheKey('live', viewerKey);
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        await this.redis.del(cacheKey);
      }
    }

    const streams = await this.streamRepository.find({
      where: { status: StreamStatus.LIVE },
      relations: ['user'],
      order: { startedAt: 'DESC' },
      take: StreamingService.LIVE_STREAMS_LIST_LIMIT,
    });

    const accessList = await this.entitlementsService.checkAccessMany(
      viewerId,
      viewerRole,
      streams.map((stream) => ({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId,
        isOwner: !!viewerId && viewerId === stream.userId,
      })),
    );

    const results = streams.map((stream, index) => {
      const access = accessList[index];
      const isOwner = !!viewerId && viewerId === stream.userId;
      if (!access.allowed && stream.visibility !== StreamVisibility.PUBLIC) {
        return toPublicStream(stream, false, {
          hidePlayback: true,
          accessReason: access.reason,
        });
      }
      return toPublicStream(stream, false, {
        hidePlayback: !access.allowed,
        accessReason: access.reason,
        playbackUrl: access.allowed
          ? this.resolvePlaybackUrlForViewer(stream, isOwner || viewerRole === UserRole.ADMIN)
          : null,
      });
    });

    const filtered = results.filter(
      (s) => s.visibility === StreamVisibility.PUBLIC || !s.accessDenied,
    );
    await safeRedisSetex(
      this.redis,
      cacheKey,
      StreamingService.STREAM_LIST_CACHE_TTL_SEC,
      JSON.stringify(filtered),
      this.logger,
    );
    return filtered;
  }

  /** Invalidate cached live/upcoming lists after stream lifecycle changes. */
  async invalidateStreamListCache(): Promise<void> {
    await safeRedisDelPattern(this.redis, `${STREAM_LIST_CACHE_PREFIX}*`, this.logger);
  }

  /** Bust short-lived socket entitlement cache after access grants. */
  async bustStreamAccessCache(userId: string, streamId: string): Promise<void> {
    await safeRedisDel(this.redis, `ent:stream-access:${userId}:${streamId}`, this.logger);
  }

  /**
   * Socket join gate with short-lived Redis cache (avoids DB on reconnect storms).
   * Returns false when viewer is not entitled.
   */
  async assertStreamSocketAccess(
    streamId: string,
    userId: string,
    role: UserRole,
  ): Promise<boolean> {
    const cacheKey = `ent:stream-access:${userId}:${streamId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached === '1') return true;
    if (cached === '0') return false;

    const stream = await this.getStreamForViewer(streamId, userId, role);
    const allowed = !stream.accessDenied;
    await safeRedisSetex(
      this.redis,
      cacheKey,
      StreamingService.SOCKET_ACCESS_CACHE_TTL_SEC,
      allowed ? '1' : '0',
      this.logger,
    );
    return allowed;
  }

  async endStream(userId: string, streamId: string): Promise<Stream> {
    const stream = await this.findById(streamId);

    if (stream.userId !== userId) {
      throw new NotFoundException('Stream not found');
    }

    if (stream.muxLiveStreamId && stream.muxLiveStreamId !== 'mock-stream-id') {
      try {
        await this.mux.video.liveStreams.disable(stream.muxLiveStreamId);
      } catch (err) {
        this.logger.warn('Failed to disable Mux stream', err);
      }
    }

    stream.status = StreamStatus.ENDED;
    stream.endedAt = new Date();
    stream.endReason = StreamEndReason.HOST_ENDED;
    stream.uniqueViewerCount = await this.streamViewerService.finalizeUniqueViewers(streamId);
    const saved = await this.streamRepository.save(stream);
    await this.streamViewerService.trackStreamEnded(saved.id);
    this.logger.log(`Stream ${saved.id} ended by host — cleanup completed`);
    this.eventEmitter.emit('stream.ended', {
      streamId: saved.id,
      userId: saved.userId,
      title: saved.title,
      communityId: saved.communityId ?? null,
      endReason: StreamEndReason.HOST_ENDED,
    });
    void this.invalidateStreamListCache();
    void this.bustStreamDetailCache(saved.id);
    return saved;
  }

  async getUpcomingStreams(viewerId?: string | null, viewerRole?: UserRole | null) {
    const viewerKey = streamListViewerKey(viewerId);
    const cacheKey = streamListCacheKey('upcoming', viewerKey);
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        await this.redis.del(cacheKey);
      }
    }

    const now = new Date();
    const streams = await this.streamRepository.find({
      where: {
        status: StreamStatus.IDLE,
        scheduledAt: MoreThan(now),
      },
      relations: ['user'],
      order: { scheduledAt: 'ASC' },
      take: 50,
    });

    const accessList = await this.entitlementsService.checkAccessMany(
      viewerId,
      viewerRole,
      streams.map((stream) => ({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId,
        isOwner: !!viewerId && viewerId === stream.userId,
      })),
    );

    const filtered = streams
      .map((stream, index) => {
        const access = accessList[index];
        if (!access.allowed && stream.visibility !== StreamVisibility.PUBLIC) {
          return toPublicStream(stream, false, {
            hidePlayback: true,
            accessReason: access.reason,
            scheduledAt: stream.scheduledAt,
            ticketPriceCents: stream.ticketPriceCents,
          });
        }
        return toPublicStream(stream, false, {
          hidePlayback: !access.allowed,
          accessReason: access.reason,
          scheduledAt: stream.scheduledAt,
          ticketPriceCents: stream.ticketPriceCents,
        });
      })
      .filter((s) => s.visibility === StreamVisibility.PUBLIC || !s.accessDenied);

    await safeRedisSetex(
      this.redis,
      cacheKey,
      StreamingService.STREAM_LIST_CACHE_TTL_SEC,
      JSON.stringify(filtered),
      this.logger,
    );
    return filtered;
  }

  async grantEventPurchase(input: {
    streamId: string;
    userId: string;
    amountCents: number;
    currency?: string;
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    grantSource?: string;
    grantedByUserId?: string | null;
    grantNote?: string | null;
  }): Promise<StreamEventPurchase> {
    const existing = await this.purchaseRepository.findOne({
      where: { streamId: input.streamId, userId: input.userId },
    });
    if (existing) {
      void this.bustStreamAccessCache(input.userId, input.streamId);
      return existing;
    }

    const saved = await this.purchaseRepository.save(
      this.purchaseRepository.create({
        streamId: input.streamId,
        userId: input.userId,
        amountCents: input.amountCents,
        currency: input.currency ?? 'usd',
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        status: 'completed',
        purchasedAt: new Date(),
        grantSource: input.grantSource ?? 'purchase',
        grantedByUserId: input.grantedByUserId ?? null,
        grantNote: input.grantNote ?? null,
      }),
    );

    void this.bustStreamAccessCache(input.userId, input.streamId);
    return saved;
  }

  async grantStreamEventAccess(
    granterId: string,
    streamId: string,
    targetUserId: string,
    opts: { isAdmin?: boolean; note?: string },
  ): Promise<StreamEventPurchase> {
    const stream = await this.findById(streamId);
    if (!opts.isAdmin && stream.userId !== granterId) {
      throw new NotFoundException('Stream not found');
    }
    if (stream.visibility !== StreamVisibility.PAID_EVENT && !opts.isAdmin) {
      throw new BadRequestException('Only paid events support manual access grants');
    }

    const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException('User not found');

    return this.grantEventPurchase({
      streamId,
      userId: targetUserId,
      amountCents: stream.ticketPriceCents ?? 0,
      currency: 'usd',
      grantSource: opts.isAdmin ? 'admin_grant' : 'creator_grant',
      grantedByUserId: granterId,
      grantNote: opts.note ?? null,
    });
  }

  async getStreamReplayVideo(
    streamId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.findById(streamId);
    const video = await this.videoRepository.findOne({
      where: { sourceStreamId: streamId, status: VideoStatus.READY },
      order: { publishedAt: 'DESC' },
      relations: ['user'],
    });
    if (!video) return null;

    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const access = await this.entitlementsService.checkAccess({
      creatorId: stream.userId,
      visibility: stream.visibility,
      requiredTierId: stream.requiredTierId,
      streamId: stream.id,
      viewerId,
      isOwner,
      isAdmin,
    });

    if (!access.allowed && !isOwner && !isAdmin) {
      return {
        id: video.id,
        title: video.title,
        hlsUrl: null,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        accessDenied: true,
        accessReason: access.reason,
      };
    }

    return {
      id: video.id,
      title: video.title,
      hlsUrl: this.resolveVodPlaybackUrlForViewer(video, isOwner || isAdmin),
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      accessDenied: false,
    };
  }

  /** Resolve VOD HLS URL — signed token for restricted replays when configured. */
  resolveVodPlaybackUrlForViewer(video: Video, bypassSigning = false): string | null {
    if (!video.hlsUrl) return null;
    if (bypassSigning || video.visibility === VideoVisibility.PUBLIC) {
      return video.hlsUrl;
    }

    const signing = this.muxSigningConfig();
    const playbackId = video.muxPlaybackId ?? muxPlaybackIdFromHlsUrl(video.hlsUrl);
    if (!playbackId || !isMuxSigningConfigured(signing)) {
      this.logger.warn(
        `Signed replay required for video ${video.id} but MUX signing keys are not configured`,
      );
      return null;
    }

    const ttl = this.configService.get<number>('mux.signedPlaybackTtlSec') ?? 3600;
    return muxSignedHlsPlaybackUrl(playbackId, signing, ttl);
  }

  async hasEventPurchase(streamId: string, userId: string): Promise<boolean> {
    const row = await this.purchaseRepository.findOne({
      where: { streamId, userId, status: 'completed' },
    });
    return !!row;
  }

  async setPinnedMessage(
    userId: string,
    streamId: string,
    messageId: string | null,
    opts?: { isAdmin?: boolean; allowModerator?: boolean },
  ): Promise<Stream> {
    const stream = await this.findById(streamId);
    const isAdmin = opts?.isAdmin === true;
    if (stream.userId !== userId && !isAdmin && !opts?.allowModerator) {
      throw new NotFoundException('Stream not found');
    }
    stream.pinnedMessageId = messageId;
    const saved = await this.streamRepository.save(stream);
    void this.bustStreamDetailCache(streamId);
    this.eventEmitter.emit('stream.chat.pinned', { streamId, messageId });
    return saved;
  }

  async setLivekitEgressId(streamId: string, egressId: string | null): Promise<void> {
    await this.streamRepository.update(streamId, { livekitEgressId: egressId });
    void this.bustStreamDetailCache(streamId);
  }

  async setSlowMode(
    userId: string,
    streamId: string,
    slowModeSeconds: number,
    opts?: { allowModerator?: boolean },
  ): Promise<Stream> {
    const stream = await this.findById(streamId);
    if (stream.userId !== userId && !opts?.allowModerator) {
      throw new NotFoundException('Stream not found');
    }
    stream.slowModeSeconds = slowModeSeconds;
    const saved = await this.streamRepository.save(stream);
    void this.bustStreamDetailCache(streamId);
    this.eventEmitter.emit('stream.slow-mode', { streamId, slowModeSeconds });
    return saved;
  }

  async updateChatSettings(
    streamId: string,
    patch: { chatEnabled?: boolean; chatMode?: StreamChatMode },
  ): Promise<Stream> {
    const stream = await this.findById(streamId);
    if (patch.chatEnabled !== undefined) stream.chatEnabled = patch.chatEnabled;
    if (patch.chatMode !== undefined) stream.chatMode = patch.chatMode;
    const saved = await this.streamRepository.save(stream);
    void this.bustStreamDetailCache(streamId);
    this.eventEmitter.emit('stream.chat.settings', {
      streamId,
      chatEnabled: saved.chatEnabled,
      chatMode: saved.chatMode,
    });
    return saved;
  }

  private muxConfigured(): boolean {
    const muxTokenId = this.configService.get<string>('mux.tokenId');
    const muxTokenSecret = this.configService.get<string>('mux.tokenSecret');
    return !!(
      muxTokenId &&
      muxTokenSecret &&
      muxTokenId !== 'placeholder' &&
      muxTokenSecret !== 'placeholder'
    );
  }

  private mapStreamVisibilityToVideo(visibility: StreamVisibility): VideoVisibility {
    switch (visibility) {
      case StreamVisibility.FOLLOWERS:
        return VideoVisibility.FOLLOWERS;
      case StreamVisibility.SUBSCRIBERS:
        return VideoVisibility.SUBSCRIBERS;
      case StreamVisibility.TIER:
        return VideoVisibility.TIER;
      case StreamVisibility.PRIVATE:
        return VideoVisibility.PRIVATE;
      case StreamVisibility.PAID_EVENT:
        return VideoVisibility.PAID_EVENT;
      default:
        return VideoVisibility.PUBLIC;
    }
  }

  async handleMuxWebhook(payload: Record<string, unknown>) {
    const eventId = (payload.id as string) || '';
    const eventType = payload.type as string;
    if (eventId) {
      const duplicate = await this.webhookIdempotency.isDuplicate(
        StreamingService.WEBHOOK_PROVIDER,
        eventId,
      );
      if (duplicate) return { handled: true, duplicate: true };
    }

    const data = payload.data as Record<string, unknown>;

    if (eventType === 'video.live_stream.active') {
      const muxLiveStreamId = data.id as string;
      await this.muxLiveSyncService.handleWebhookActive(muxLiveStreamId);
    } else if (eventType === 'video.live_stream.recording') {
      const muxLiveStreamId = data.id as string;
      const activeAssetId = data.active_asset_id as string | undefined;
      if (activeAssetId) {
        await this.streamRepository.update({ muxLiveStreamId }, { muxAssetId: activeAssetId });
      }
    } else if (eventType === 'video.live_stream.idle') {
      const muxLiveStreamId = data.id as string;
      await this.muxLiveSyncService.handleWebhookIdle(muxLiveStreamId);
    } else if (eventType === 'video.asset.ready') {
      const handledVod = await this.muxVodService.handleAssetReady(payload);
      if (handledVod) return;

      const assetId = data.id as string;
      const playbackIds = (data.playback_ids as Array<{ id: string; policy: string }> | undefined) || [];
      const playbackId = playbackIds[0]?.id;
      if (!assetId || !playbackId) return;

      const stream = await this.streamRepository.findOne({ where: { muxAssetId: assetId } });
      if (!stream) return;

      const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const videoVisibility = this.mapStreamVisibilityToVideo(stream.visibility);

      const video = await this.videoRepository.save(
        this.videoRepository.create({
          userId: stream.userId,
          title: stream.title || 'Live session',
          description: stream.description || null,
          status: VideoStatus.READY,
          visibility: videoVisibility,
          requiredTierId: stream.requiredTierId,
          sourceStreamId: stream.id,
          hlsUrl,
          thumbnailUrl: stream.thumbnailUrl || `https://image.mux.com/${playbackId}/thumbnail.jpg`,
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          s3Key: null,
          uploadContentType: null,
          uploadFileSizeBytes: null,
          uploadCompletedAt: null,
          failureReason: null,
          publishStatus: PublishStatus.PUBLISHED,
          publishedAt: new Date(),
        }),
      );

      try {
        await this.premiumContentNotifyQueue.add(
          'notify',
          {
            videoId: video.id,
            creatorId: stream.userId,
            visibility: videoVisibility,
            requiredTierId: stream.requiredTierId,
            title: video.title,
          },
          { jobId: `premium-replay-${video.id}` },
        );
      } catch (err) {
        this.logger.warn(
          `Premium replay notify enqueue failed for ${video.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else if (eventType === 'video.asset.errored') {
      await this.muxVodService.handleAssetErrored(payload);
    }

    if (eventId) {
      await this.webhookIdempotency.markProcessed(
        StreamingService.WEBHOOK_PROVIDER,
        eventId,
        eventType,
      );
    }

    return { handled: true };
  }

  // ── P07-T029: Multi-host live ──────────────────────────────────────────────

  static readonly MAX_CO_HOSTS = 5;

  async addCoHost(creatorId: string, streamId: string, coHostId: string): Promise<{ coHostIds: string[] }> {
    if (creatorId === coHostId) throw new BadRequestException('Creator cannot add themselves as co-host');
    const stream = await this.findById(streamId);
    if (stream.userId !== creatorId) throw new ForbiddenException('Only the stream creator can manage co-hosts');

    const existing = stream.coHostIds ?? [];
    if (existing.includes(coHostId)) throw new BadRequestException('User is already a co-host');
    if (existing.length >= StreamingService.MAX_CO_HOSTS) {
      throw new BadRequestException(`Maximum ${StreamingService.MAX_CO_HOSTS} co-hosts allowed`);
    }

    const updated = [...existing, coHostId];
    await this.streamRepository.update(streamId, { coHostIds: updated });
    this.eventEmitter.emit('stream.cohost.added', { streamId, creatorId, coHostId });
    return { coHostIds: updated };
  }

  async removeCoHost(creatorId: string, streamId: string, coHostId: string): Promise<{ coHostIds: string[] }> {
    const stream = await this.findById(streamId);
    if (stream.userId !== creatorId) throw new ForbiddenException('Only the stream creator can manage co-hosts');

    const updated = (stream.coHostIds ?? []).filter((id) => id !== coHostId);
    await this.streamRepository.update(streamId, { coHostIds: updated });
    return { coHostIds: updated };
  }

  async listCoHosts(streamId: string): Promise<{ streamId: string; coHostIds: string[] }> {
    const stream = await this.findById(streamId);
    return { streamId, coHostIds: stream.coHostIds ?? [] };
  }

  isCoHost(stream: Stream, userId: string): boolean {
    return (stream.coHostIds ?? []).includes(userId);
  }

  // ── P07-T030: VIP rooms live ───────────────────────────────────────────────

  async setVipTier(
    creatorId: string,
    streamId: string,
    vipTierId: string | null,
  ): Promise<{ streamId: string; vipTierId: string | null }> {
    const stream = await this.findById(streamId);
    if (stream.userId !== creatorId) throw new ForbiddenException('Only the stream creator can configure VIP');
    await this.streamRepository.update(streamId, { vipTierId });
    void this.bustStreamDetailCache(streamId);
    return { streamId, vipTierId };
  }

  async assertVipAccess(streamId: string, userId: string, userRole: UserRole): Promise<void> {
    if (userRole === UserRole.ADMIN) return;
    const stream = await this.findById(streamId);
    if (!stream.vipTierId) throw new BadRequestException('No VIP room configured for this stream');
    if (stream.userId === userId) return;
    if ((stream.coHostIds ?? []).includes(userId)) return;

    const result = await this.entitlementsService.checkAccess({
      creatorId: stream.userId,
      visibility: 'subscribers',
      requiredTierId: stream.vipTierId,
      viewerId: userId,
    });
    if (!result.allowed) throw new ForbiddenException('VIP room requires the configured membership tier');
  }
}
