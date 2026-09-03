import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { clampLimit } from '../../common/utils/pagination.util';
import { createReadStream, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { resolve as resolvePath, sep as pathSep } from 'path';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import {
  Video,
  VideoStatus,
  VideoVisibility,
  ModerationStatus,
  PublishStatus,
  TranscodeProvider,
  VideoType,
} from './entities/video.entity';
import { shortTypeChangeError } from './short-duration.util';
import { MUX_VOD_INGEST_QUEUE, muxVodIngestJobId } from './mux-vod.constants';
import { MuxVodService } from './mux-vod.service';
import { ScheduledPublishScheduler } from './scheduled-publish.scheduler';
import {
  sanitizeHlsUrl,
  sanitizeThumbnailUrl,
  sanitizeCaptionUrl,
} from '../../common/media/playback-url.util';
import { vttToPlainText } from './webvtt.util';
import {
  muxPlaybackIdFromHlsUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';
import {
  isMuxSigningConfigured,
  muxSignedHlsPlaybackUrl,
  muxSigningConfigFrom,
  requiresMuxSignedPlayback,
  type MuxSigningConfig,
} from '../../common/media/mux-signing.util';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { Category } from '../categories/entities/category.entity';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistVideo } from '../playlists/entities/playlist-video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { StudioVideosQueryDto } from './dto/studio-videos-query.dto';
import { buildStudioVideoFindOptions } from './studio-library-query.util';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RecordWatchDto } from './dto/record-watch.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { PublicVideo, serializeVideoForCache, toPublicVideo } from './video.mapper';
import { diversifyByCreator } from '../feed/feed-diversity.util';
import {
  getMutedChannelIds,
  getNotInterestedVideoIds,
} from '../feed/not-interested.util';
import {
  pushSessionCreator,
  SESSION_WATCH_MIN_PROGRESS_SEC,
} from '../feed/session-watch.util';
import { mergeExcludedCreatorIds } from '../feed/viewer-exclusions.util';
import { rankShortsByScore } from './shorts-rank.util';
import {
  isRedisQuotaError,
  safeRedisDel,
  safeRedisGet,
  safeRedisIncrEx,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';
import { jitterTtl, singleFlight } from '../../common/redis/cache-stampede.util';
import { RecordViewDto } from './dto/record-view.dto';
import { rewriteMediaUrlToCdn } from '../../common/media-url.util';
import {
  createS3Client,
  createS3ClientForBrowserPresign,
} from '../../common/create-s3-client';
import { videoDetailCacheKey } from './video-cache';
import { indexedAtOnReady, shouldIndexVideo } from './video-publish.util';
import { VideoMultipartService } from './video-multipart.service';
import { MultipartPartUrlsDto } from './dto/multipart-part-urls.dto';
import { MultipartCompletePartsDto } from './dto/multipart-complete-parts.dto';
import { MultipartCheckpointDto } from './dto/multipart-checkpoint.dto';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TierEntitlementResourceType } from '../entitlements/entities/tier-entitlement.entity';
import { EngagementService } from '../engagement/engagement.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';

import { VIDEO_PROCESSING_QUEUE } from './video-processing.constants';

const VIDEO_DETAIL_CACHE_TTL = 120;

/** YouTube-style: count after meaningful watch time, dedupe repeat plays ~24h. */
const VIEW_DEDUPE_TTL_SEC = 86_400;
const VIEW_MAX_THRESHOLD_SEC = 30;
const VIEW_MIN_THRESHOLD_SEC = 3;

export function viewCountThresholdSeconds(durationSeconds?: number | null): number {
  if (!durationSeconds || durationSeconds <= 0) return VIEW_MAX_THRESHOLD_SEC;
  return Math.max(
    VIEW_MIN_THRESHOLD_SEC,
    Math.min(VIEW_MAX_THRESHOLD_SEC, Math.floor(durationSeconds * 0.3)),
  );
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly s3: S3Client;
  private readonly presignS3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(SkillTag)
    private readonly skillTagRepository: Repository<SkillTag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistVideo)
    private readonly playlistVideoRepository: Repository<PlaylistVideo>,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue,
    @InjectQueue(MUX_VOD_INGEST_QUEUE)
    private readonly muxVodQueue: Queue,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly videoMultipart: VideoMultipartService,
    private readonly muxVodService: MuxVodService,
    private readonly entitlementsService: EntitlementsService,
    private readonly engagementService: EngagementService,
    private readonly accessSessionsService: AccessSessionsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly scheduledPublishScheduler: ScheduledPublishScheduler,
  ) {
    const awsCreds = {
      region: configService.get<string>('aws.region') || 'ap-south-1',
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      roleArn: configService.get<string>('aws.roleArn') || undefined,
    };
    this.s3 = createS3Client(awsCreds);
    this.presignS3 = createS3ClientForBrowserPresign(awsCreds);
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
    this.cdnDomain = configService.get<string>('aws.cloudfrontDomain') || '';
  }

  /** Presigned PUT URLs expire in 10 minutes — treat older incomplete rows as abandoned. */
  private static readonly PRESIGN_TTL_MS = 11 * 60 * 1000;
  /** Grace for an active browser PUT before the S3 object appears. */
  private static readonly ACTIVE_UPLOAD_GRACE_MS = 45 * 1000;
  /** S3 object present but /complete never called (smoke tests, failed publish). */
  private static readonly STUCK_INCOMPLETE_MS = 2 * 60 * 1000;

  async assertCanWatchVideo(
    video: Video,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    const isOwner = !!viewerId && viewerId === video.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    if (video.moderationStatus === ModerationStatus.BLOCKED && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.moderationStatus === ModerationStatus.HELD && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.visibility === VideoVisibility.PRIVATE && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is private');
    }

    if (viewerId && !isOwner && !isAdmin) {
      if (await this.engagementService.isBlockedEitherWay(viewerId, video.userId)) {
        throw new ForbiddenException('This video is not available');
      }
    }

    if (
      !isOwner &&
      !isAdmin &&
      [
        VideoVisibility.FOLLOWERS,
        VideoVisibility.SUBSCRIBERS,
        VideoVisibility.TIER,
        VideoVisibility.PAID_EVENT,
      ].includes(video.visibility)
    ) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: video.userId,
        visibility: video.visibility,
        requiredTierId: video.requiredTierId,
        viewerId,
        isOwner,
        isAdmin,
      });
      if (viewerId && !isOwner && !isAdmin) {
        const entitled = await this.entitlementsService.verifyMediaTierEntitlements(
          viewerId,
          video.userId,
          TierEntitlementResourceType.VIDEO,
          video.id,
        );
        if (!entitled) {
          throw new ForbiddenException('Your membership tier does not include this video');
        }
      }
      if (
        viewerId &&
        [VideoVisibility.SUBSCRIBERS, VideoVisibility.TIER].includes(video.visibility)
      ) {
        await this.accessSessionsService.requirePremiumSession(
          viewerId,
          video.userId,
          AccessSessionType.PLAYBACK,
          video.id,
        );
      }
    }

    if (!isOwner && !isAdmin) {
      if (video.status !== VideoStatus.READY) {
        throw new ForbiddenException('This video is not available yet');
      }
      if (video.publishStatus !== PublishStatus.PUBLISHED) {
        throw new ForbiddenException('This video is not published yet');
      }
    }

    const now = new Date();
    if (video.scheduledPublishAt && video.scheduledPublishAt > now && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not published yet');
    }
    if (video.publishedAt && video.publishedAt > now && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not published yet');
    }
  }

  mapToPublicVideo(video: Video, opts?: { includeDislikeCount?: boolean }): PublicVideo {
    const mapped = toPublicVideo(video, {
      rewriteMediaUrl: (url) => this.rewritePlaybackUrl(url),
      includeDislikeCount: opts?.includeDislikeCount,
    });
    if (mapped.thumbnailUrl) return mapped;
    const playbackId = muxPlaybackIdFromHlsUrl(mapped.hlsUrl ?? video.hlsUrl);
    if (playbackId) {
      return { ...mapped, thumbnailUrl: muxThumbnailUrl(playbackId) };
    }
    return mapped;
  }

  /**
   * Sign Mux HLS for non-public videos when signing keys are configured.
   * Owners/admins may pass bypassSigning. Missing keys → null + structured warn.
   */
  resolveViewerHlsUrl(
    video: Video,
    hlsUrl: string | null,
    bypassSigning = false,
  ): string | null {
    if (!hlsUrl) return null;
    if (bypassSigning || !requiresMuxSignedPlayback(video.visibility)) {
      return hlsUrl;
    }
    const playbackId = video.muxPlaybackId ?? muxPlaybackIdFromHlsUrl(hlsUrl);
    const signing = this.muxSigningConfig();
    if (!playbackId || !isMuxSigningConfigured(signing)) {
      this.logger.warn(
        JSON.stringify({
          msg: 'mux_signed_playback_missing_keys',
          kind: 'vod',
          videoId: video.id,
          visibility: video.visibility,
        }),
      );
      return null;
    }
    const ttl = this.configService.get<number>('mux.signedPlaybackTtlSec') ?? 3600;
    return muxSignedHlsPlaybackUrl(playbackId, signing, ttl);
  }

  private muxSigningConfig(): MuxSigningConfig | null {
    return muxSigningConfigFrom((k) => this.configService.get(k));
  }

  rewritePlaybackUrl(url: string | null | undefined): string | null {
    const safe = sanitizeHlsUrl(url) ?? sanitizeThumbnailUrl(url);
    if (!safe) return null;
    try {
      const host = new URL(safe).hostname.toLowerCase();
      if (host === 'stream.mux.com' || host === 'image.mux.com' || host.endsWith('.mux.com')) {
        return safe;
      }
    } catch {
      return null;
    }
    if (this.cdnDomain) return rewriteMediaUrlToCdn(safe, this.cdnDomain);
    return safe;
  }

  /**
   * Server-side caption fetch so the watch transcript UI is not blocked by CDN CORS.
   * Only URLs on our CDN / S3 / Mux text track hosts are allowed (SSRF guard).
   */
  async getCaptionTrackText(
    videoId: string,
    language: string | undefined,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<{ language: string; label: string; text: string }> {
    const video = await this.findById(videoId);
    await this.assertCanWatchVideo(video, viewerId, viewerRole);

    let tracks = [...(video.captionTracks ?? [])];
    if (!tracks.length && video.captionUrl) {
      tracks = [{ language: 'en', label: 'English', url: video.captionUrl }];
    }
    if (!tracks.length) {
      throw new NotFoundException('No captions for this video');
    }

    const lang = (language ?? 'en').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8) || 'en';
    const track = tracks.find((t) => t.language === lang) ?? tracks[0];
    const text = await this.fetchCaptionVttText(track.url, videoId);
    if (text === null) {
      throw new BadRequestException('Could not load captions');
    }
    return {
      language: track.language,
      label: track.label,
      text,
    };
  }

  /** Resolves, SSRF-checks, and fetches a caption track's raw WebVTT text. Returns null (not a throw) on failure — used by best-effort indexing as well as the user-facing transcript proxy. */
  private async fetchCaptionVttText(url: string, videoId: string): Promise<string | null> {
    const sanitized = sanitizeCaptionUrl(url);
    if (!sanitized) return null;
    let sanitizedHost = '';
    try {
      sanitizedHost = new URL(sanitized).hostname.toLowerCase();
    } catch {
      return null;
    }
    const resolved =
      sanitizedHost === 'stream.mux.com' || sanitizedHost.endsWith('.mux.com') || !this.cdnDomain
        ? sanitized
        : rewriteMediaUrlToCdn(sanitized, this.cdnDomain) ?? sanitized;
    if (!this.isAllowedCaptionFetchUrl(resolved)) return null;

    let res: Response;
    try {
      res = await fetch(resolved, {
        method: 'GET',
        headers: { Accept: 'text/vtt, text/plain, */*' },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (err) {
      this.logger.warn(
        `caption fetch failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 2_000_000) return null;
    return text;
  }

  /**
   * Fold every caption language track into `caption_text` for search_vector.
   * Caps tracks and total length so multi-lang uploads stay bounded.
   */
  private async buildCaptionSearchText(
    tracks: { language: string; label: string; url: string }[],
    videoId: string,
  ): Promise<string | null> {
    if (!tracks.length) return null;
    const parts: string[] = [];
    let total = 0;
    const maxTracks = 8;
    const maxChars = 200_000;
    for (const track of tracks.slice(0, maxTracks)) {
      const vtt = await this.fetchCaptionVttText(track.url, videoId);
      if (!vtt) continue;
      const plain = vttToPlainText(vtt).trim();
      if (!plain) continue;
      const chunk = plain.slice(0, maxChars - total);
      if (!chunk) break;
      parts.push(chunk);
      total += chunk.length + 1;
      if (total >= maxChars) break;
    }
    return parts.length ? parts.join('\n') : null;
  }

  /**
   * Re-index caption_text after Mux (or other) mutates caption_tracks outside setCaptionUrl.
   * Best-effort — never throws to callers.
   */
  async reindexCaptionSearchText(videoId: string): Promise<void> {
    try {
      const video = await this.videoRepository.findOne({ where: { id: videoId } });
      if (!video) return;
      let tracks = [...(video.captionTracks ?? [])];
      if (!tracks.length && video.captionUrl) {
        tracks = [{ language: 'en', label: 'English', url: video.captionUrl }];
      }
      const captionText = await this.buildCaptionSearchText(tracks, videoId);
      await this.videoRepository.update(videoId, { captionText });
      await this.bustVideoDetailCache(videoId);
    } catch (err) {
      this.logger.warn(
        `caption reindex failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Admin batch: fill caption_text for videos that have tracks/URL but empty FTS text
   * (pre–Wave-39 uploads). Bounded per call so operators can re-run safely.
   */
  async backfillCaptionSearchText(
    limit = 25,
  ): Promise<{ scanned: number; updated: number }> {
    const take = Math.min(Math.max(Number(limit) || 25, 1), 50);
    const rows = await this.videoRepository
      .createQueryBuilder('v')
      .select(['v.id'])
      .where('(v.caption_text IS NULL OR btrim(v.caption_text) = :empty)', { empty: '' })
      .andWhere(
        `(v.caption_url IS NOT NULL OR (v.caption_tracks IS NOT NULL AND jsonb_array_length(v.caption_tracks) > 0))`,
      )
      .orderBy('v.updated_at', 'DESC')
      .take(take)
      .getMany();

    let updated = 0;
    for (const row of rows) {
      await this.reindexCaptionSearchText(row.id);
      const check = await this.videoRepository.findOne({
        where: { id: row.id },
        select: ['id', 'captionText'],
      });
      if (check?.captionText) updated += 1;
    }
    return { scanned: rows.length, updated };
  }

  private isAllowedCaptionFetchUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    const cdnHost = this.cdnDomain
      ? this.cdnDomain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
      : '';
    if (cdnHost && (host === cdnHost || host.endsWith(`.${cdnHost}`))) return true;
    if (this.bucket) {
      const bucket = this.bucket.toLowerCase();
      const s3Hosts = [
        `${bucket}.s3.amazonaws.com`,
        `${bucket}.s3.dualstack.us-east-1.amazonaws.com`,
      ];
      if (
        s3Hosts.includes(host) ||
        (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com'))
      ) {
        return true;
      }
    }
    if (host.endsWith('.amazonaws.com') || host.endsWith('.cloudfront.net')) return true;
    if (host === 'stream.mux.com' || host.endsWith('.mux.com')) return true;
    if (host === 'localhost' || host === '127.0.0.1') {
      return this.configService.get<string>('nodeEnv') !== 'production';
    }
    return false;
  }

  private usesMuxTranscode(): boolean {
    return this.configService.get<string>('video.transcodeProvider') === 'mux';
  }

  /** @deprecated use rewritePlaybackUrl */
  getSignedPlaybackUrl(hlsUrl: string): string {
    return this.rewritePlaybackUrl(hlsUrl) ?? hlsUrl;
  }

  private async s3ObjectExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private async deleteS3Prefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const list = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
      if (keys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }

  private async deleteVideoAssets(video: Video): Promise<void> {
    if (video.muxAssetId) {
      await this.muxVodService.deleteAsset(video.muxAssetId);
    }
    if (video.s3Key) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: video.s3Key }))
        .catch(() => undefined);
    }
    await this.deleteS3Prefix(`videos/${video.id}/`);
    await this.deleteS3Prefix(`videos/${video.userId}/${video.id}/`);
  }

  private async removeUploadRow(row: Video): Promise<void> {
    await this.videoMultipart.abortIfAny(this.s3, this.bucket, row.id, row.s3Key);
    await this.deleteVideoAssets(row);
    await this.bustVideoDetailCache(row.id);
    await this.videoRepository.remove(row);
  }

  /**
   * Clear ghost uploads: presign creates a DB row immediately; if the browser never
   * finishes PUT + /complete, the row must not block the next attempt.
   */
  private async releaseIncompleteUploads(userId: string): Promise<void> {
    const rows = await this.videoRepository.find({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    const now = Date.now();
    for (const row of rows) {
      if (row.uploadCompletedAt) continue;
      const ageMs = now - row.createdAt.getTime();
      const hasS3 = row.s3Key ? await this.s3ObjectExists(row.s3Key) : false;
      const presignExpired = ageMs > VideosService.PRESIGN_TTL_MS;
      const neverUploaded = !hasS3 && ageMs > VideosService.ACTIVE_UPLOAD_GRACE_MS;
      const uploadedButNotFinished =
        hasS3 && ageMs > VideosService.STUCK_INCOMPLETE_MS;

      if (presignExpired || neverUploaded || uploadedButNotFinished) {
        await this.removeUploadRow(row);
      }
    }
  }

  /** All own videos for Studio (uploading, processing, ready, failed). */
  /**
   * Creator Studio content library — every status, with optional server-side
   * filtering (status/visibility/category), title search, sorting, and
   * pagination so large libraries remain reachable and performant. Response is
   * backward compatible: `data` keeps the prior shape and `pagination` is added.
   */
  async listStudioVideos(userId: string, query: StudioVideosQueryDto = {}) {
    await this.releaseIncompleteUploads(userId);
    const { page, limit, where, order, skip, take } = buildStudioVideoFindOptions(userId, query);
    const [rows, total] = await this.videoRepository.findAndCount({ where, order, skip, take });
    return {
      data: rows.map((v) => this.mapToPublicVideo(v)),
      pagination: { page, limit, total, hasMore: page * limit < total },
    };
  }

  /** Cancel or remove a non-published video (uploading, processing, failed). */
  async cancelUpload(userId: string, videoId: string): Promise<{ ok: true }> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== userId) throw new ForbiddenException();

    const cancellable = [
      VideoStatus.UPLOADING,
      VideoStatus.PROCESSING,
      VideoStatus.FAILED,
      VideoStatus.PENDING,
    ];
    if (!cancellable.includes(video.status)) {
      throw new BadRequestException(
        'Only uploading, processing, or failed videos can be cancelled',
      );
    }

    if (video.status === VideoStatus.PROCESSING) {
      const jobId = `video-process-${videoId}`;
      try {
        const job = await this.videoQueue.getJob(jobId);
        if (job) await job.remove().catch(() => undefined);
      } catch (err) {
        this.logger.warn(
          `could not remove process job ${jobId}: ${err instanceof Error ? err.message : err}`,
        );
      }
      const muxJobId = muxVodIngestJobId(videoId);
      try {
        const muxJob = await this.muxVodQueue.getJob(muxJobId);
        if (muxJob) await muxJob.remove().catch(() => undefined);
      } catch (err) {
        this.logger.warn(
          `could not remove mux ingest job ${muxJobId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (video.muxAssetId) {
      await this.muxVodService.deleteAsset(video.muxAssetId);
    }

    await this.videoMultipart.abortIfAny(this.s3, this.bucket, videoId, video.s3Key);
    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
    return { ok: true };
  }

  /** Force-release every incomplete upload slot for this creator. */
  async releaseAllStuckUploads(userId: string): Promise<{ released: number }> {
    const rows = await this.videoRepository.find({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    let released = 0;
    for (const row of rows) {
      if (!row.uploadCompletedAt) {
        await this.removeUploadRow(row);
        released += 1;
      }
    }
    return { released };
  }

  async getPresignedUploadUrl(userId: string, dto: PresignedUrlDto) {
    await this.releaseIncompleteUploads(userId);

    const uploadingCount = await this.videoRepository.count({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    if (uploadingCount >= 1) {
      throw new BadRequestException(
        'An upload is still in progress. Wait a moment and try again, or cancel it from Studio → Videos.',
      );
    }

    const videoId = uuidv4();
    const ext = dto.contentType === 'video/quicktime' ? 'mov' : 'mp4';
    const key = `videos/${userId}/${videoId}/original.${ext}`;

    const video = this.videoRepository.create({
      id: videoId,
      userId,
      title: 'Untitled upload',
      description: null,
      status: VideoStatus.UPLOADING,
      visibility: VideoVisibility.PUBLIC,
      publishStatus: PublishStatus.DRAFT,
      s3Key: key,
      uploadContentType: dto.contentType,
      uploadFileSizeBytes: dto.fileSizeBytes,
      uploadCompletedAt: null,
      failureReason: null,
    });
    await this.videoRepository.save(video);

    if (this.videoMultipart.isEnabledForSize(dto.fileSizeBytes)) {
      return this.videoMultipart.initiate(
        this.presignS3,
        this.bucket,
        userId,
        video,
        dto.contentType,
        dto.fileSizeBytes,
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.presignS3, command, {
      expiresIn: 600,
      signableHeaders: new Set(['content-type']),
    });

    return { videoId, uploadUrl, key, expiresIn: 600, uploadMode: 'single' as const };
  }

  getMultipartProgress(userId: string, videoId: string) {
    return this.videoMultipart.getProgress(userId, videoId);
  }

  checkpointMultipart(userId: string, videoId: string, dto: MultipartCheckpointDto) {
    return this.videoMultipart.checkpoint(userId, videoId, dto.parts);
  }

  signMultipartPartUrls(userId: string, videoId: string, dto: MultipartPartUrlsDto) {
    return this.videoMultipart.signParts(
      this.presignS3,
      this.bucket,
      userId,
      videoId,
      dto.partNumbers,
    );
  }

  completeMultipartParts(userId: string, videoId: string, dto: MultipartCompletePartsDto) {
    return this.videoMultipart.completeParts(
      this.s3,
      this.bucket,
      userId,
      videoId,
      dto.parts,
    );
  }

  /** Presigned PUT for custom thumbnail (upload-time or Studio replace after ready). */
  async getThumbnailPresignedUrl(
    userId: string,
    videoId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string; expiresIn: number }> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();
    const allowedStatuses = [
      VideoStatus.UPLOADING,
      VideoStatus.PROCESSING,
      VideoStatus.READY,
    ];
    if (!allowedStatuses.includes(video.status)) {
      throw new BadRequestException('Thumbnail can only be set while uploading, processing, or ready');
    }

    const ext =
      contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `videos/${userId}/${videoId}/thumbnail.custom.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.presignS3, command, {
      expiresIn: 600,
      signableHeaders: new Set(['content-type']),
    });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain
      ? `https://${cdnDomain.replace(/^https?:\/\//, '')}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl, expiresIn: 600 };
  }

  async setThumbnailUrl(userId: string, videoId: string, thumbnailUrl: string | null) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();

    if (thumbnailUrl === null || thumbnailUrl === '') {
      video.thumbnailUrl = null;
    } else {
      const trimmed = thumbnailUrl.trim();
      const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
      const allowedPrefixes = [
        cdnDomain
          ? `https://${cdnDomain.replace(/^https?:\/\//, '')}/videos/${userId}/${videoId}/thumbnail.custom.`
          : null,
        `https://${this.bucket}.s3.amazonaws.com/videos/${userId}/${videoId}/thumbnail.custom.`,
      ].filter(Boolean) as string[];
      if (!allowedPrefixes.some((p) => trimmed.startsWith(p))) {
        throw new BadRequestException('Thumbnail URL must match this video custom thumbnail object');
      }
      video.thumbnailUrl = trimmed;
    }

    await this.videoRepository.save(video);
    await this.bustVideoDetailCache(videoId);
    return this.mapToPublicVideo(video);
  }

  /** Presigned PUT for a WebVTT caption file (Studio manual captions). */
  async getCaptionPresignedUrl(
    userId: string,
    videoId: string,
    contentType: string,
    language: string = 'en',
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string; expiresIn: number; language: string }> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();
    if (video.status !== VideoStatus.READY && video.status !== VideoStatus.PROCESSING) {
      throw new BadRequestException('Captions can only be added after upload completes');
    }
    const allowed = ['text/vtt', 'text/plain', 'application/octet-stream'];
    if (!allowed.includes(contentType)) {
      throw new BadRequestException('Caption file must be WebVTT (text/vtt)');
    }
    const lang = language.toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8) || 'en';

    const key = `videos/${userId}/${videoId}/captions/${lang}.vtt`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: 'text/vtt',
    });
    const uploadUrl = await getSignedUrl(this.presignS3, command, {
      expiresIn: 600,
      signableHeaders: new Set(['content-type']),
    });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain
      ? `https://${cdnDomain.replace(/^https?:\/\//, '')}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl, expiresIn: 600, language: lang };
  }

  async setCaptionUrl(
    userId: string,
    videoId: string,
    captionUrl: string | null,
    language: string = 'en',
  ) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();

    const lang = language.toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8) || 'en';
    const labelMap: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      hi: 'Hindi',
      pt: 'Portuguese',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
    };
    let tracks = [...(video.captionTracks ?? [])];
    if ((!tracks.length || tracks.length === 0) && video.captionUrl) {
      tracks = [{ language: 'en', label: 'English', url: video.captionUrl }];
    }

    if (captionUrl === null || captionUrl === '') {
      tracks = tracks.filter((t) => t.language !== lang);
    } else {
      const trimmed = captionUrl.trim();
      if (!/^https?:\/\//i.test(trimmed) || trimmed.length > 2000) {
        throw new BadRequestException('Invalid caption URL');
      }
      const next = {
        language: lang,
        label: labelMap[lang] ?? lang.toUpperCase(),
        url: trimmed,
      };
      const idx = tracks.findIndex((t) => t.language === lang);
      if (idx >= 0) tracks[idx] = next;
      else tracks.push(next);
    }

    video.captionTracks = tracks.length ? tracks : null;
    // Keep legacy captionUrl as default (English preferred, else first track)
    const primary =
      tracks.find((t) => t.language === 'en') ?? tracks[0] ?? null;
    video.captionUrl = primary?.url ?? null;

    // Index all language tracks into captionText for FTS (multi-lang search).
    video.captionText = await this.buildCaptionSearchText(tracks, videoId);

    await this.videoRepository.save(video);
    await this.bustVideoDetailCache(videoId);
    return this.mapToPublicVideo(video);
  }

  /**
   * Proxy upload when browser → S3 PUT fails (CORS, corporate firewall, etc.).
   * Multipart field name: `file`.
   */
  async receiveProxyUpload(
    userId: string,
    videoId: string,
    file: Express.Multer.File,
  ): Promise<{ ok: true }> {
    const nodeEnv = this.configService.get<string>('nodeEnv');
    if (
      nodeEnv === 'production' &&
      process.env.ALLOW_PROXY_UPLOAD !== 'true'
    ) {
      throw new BadRequestException(
        'Direct API upload is disabled in production — use presigned S3 upload',
      );
    }
    if (!file?.buffer?.length && !file?.path) {
      throw new BadRequestException('Missing upload file');
    }

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();
    if (video.status !== VideoStatus.UPLOADING) {
      throw new BadRequestException('Video is not in uploading state');
    }
    if (!video.s3Key) throw new BadRequestException('Missing upload key');

    const expected = Number(video.uploadFileSizeBytes ?? 0);
    if (expected > 0 && file.size !== expected) {
      throw new BadRequestException(
        `File size mismatch (expected ${expected} bytes, got ${file.size})`,
      );
    }

    const body = file.buffer?.length
      ? file.buffer
      : createReadStream(this.requireMulterTempPath(file.path));

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: video.s3Key,
          Body: body,
          ContentType: video.uploadContentType || file.mimetype || 'video/mp4',
          ContentLength: file.size,
        }),
      );
    } finally {
      // diskStorage() writes the proxy-upload multer temp file to os.tmpdir() (LOW-04);
      // always clean it up so a stream of uploads doesn't fill the container's disk.
      if (file.path) {
        try {
          const resolvedFilePath = this.requireMulterTempPath(file.path);
          await fsPromises.unlink(resolvedFilePath).catch((err) =>
            this.logger.warn(
              `Failed to remove proxy-upload temp file ${resolvedFilePath}: ${err.message}`,
            ),
          );
        } catch {
          this.logger.warn(`Refused to remove proxy-upload temp file outside tmpdir: ${file.path}`);
        }
      }
    }

    return { ok: true };
  }

  /** Multer diskStorage paths must resolve under os.tmpdir() (CodeQL path-injection). */
  private requireMulterTempPath(filePath: string): string {
    const resolvedTmpDir = resolvePath(tmpdir()) + pathSep;
    const resolvedFilePath = resolvePath(filePath);
    if (!resolvedFilePath.startsWith(resolvedTmpDir)) {
      throw new BadRequestException('Invalid upload path');
    }
    return resolvedFilePath;
  }

  /**
   * Legacy endpoint behavior (kept for compatibility):
   * register + enqueue processing immediately.
   *
   * New flow should use: presigned-url -> S3 PUT -> /videos/:id/complete.
   */
  async create(userId: string, dto: CreateVideoDto): Promise<PublicVideo> {
    this.assertOwnedOriginalS3Key(userId, dto.s3Key);

    const skillTags = dto.skillTagIds?.length
      ? await this.skillTagRepository.find({ where: { id: In(dto.skillTagIds) } })
      : [];

    const video = this.videoRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      s3Key: dto.s3Key,
      visibility: dto.visibility,
      skillTags,
      status: VideoStatus.PENDING,
    });
    const saved = await this.videoRepository.save(video);

    await this.enqueueTranscodeOrThrow(saved.id, dto.s3Key, userId);

    return this.mapToPublicVideo(saved);
  }

  /** Reject cross-user / traversal keys on the legacy register endpoint. */
  private assertOwnedOriginalS3Key(userId: string, s3Key: string): void {
    const prefix = `videos/${userId}/`;
    if (!s3Key.startsWith(prefix) || s3Key.includes('..')) {
      throw new BadRequestException('Invalid upload key');
    }
    const rest = s3Key.slice(prefix.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/original\.(mp4|mov)$/i.test(rest)) {
      throw new BadRequestException('Invalid upload key');
    }
  }

  async completeUpload(userId: string, videoId: string, dto: CompleteUploadDto) {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['skillTags'],
    });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();

    if (video.status !== VideoStatus.UPLOADING) {
      throw new BadRequestException('Video is not in uploading state');
    }

    if (!video.s3Key) throw new BadRequestException('Missing upload key');

    let head: HeadObjectCommandOutput;
    try {
      head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: video.s3Key }),
      );
    } catch {
      throw new BadRequestException('Upload not found in storage');
    }

    const storedSize = Number(head.ContentLength ?? 0);
    const expectedSize = Number(video.uploadFileSizeBytes ?? 0);
    if (expectedSize > 0 && storedSize > 0 && storedSize !== expectedSize) {
      throw new BadRequestException(
        `Uploaded file size mismatch (expected ${expectedSize}, stored ${storedSize})`,
      );
    }

    const category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const uniqueTagIds = [...new Set(dto.skillTagIds ?? [])];
    let skillTags =
      uniqueTagIds.length > 0
        ? await this.skillTagRepository.find({
            where: { id: In(uniqueTagIds) },
            relations: ['subcategory'],
          })
        : [];

    if (skillTags.length !== uniqueTagIds.length) {
      throw new BadRequestException('One or more skill tags were not found');
    }

    const invalidForCategory = skillTags.filter(
      (t) => t.subcategory?.categoryId !== dto.categoryId,
    );
    if (invalidForCategory.length > 0) {
      throw new BadRequestException('All skill tags must belong to the selected category');
    }

    if (skillTags.length === 0 && dto.skillTagName?.trim()) {
      const byName = await this.skillTagRepository
        .createQueryBuilder('tag')
        .leftJoinAndSelect('tag.subcategory', 'subcategory')
        .where('LOWER(tag.name) = LOWER(:name)', { name: dto.skillTagName.trim() })
        .andWhere('subcategory.categoryId = :categoryId', { categoryId: dto.categoryId })
        .getOne();
      if (byName) skillTags = [byName];
    }

    video.title = dto.title.trim();
    video.description = dto.description?.trim() ?? null;
    video.visibility = dto.visibility;
    if (dto.videoType === VideoType.SHORT || dto.videoType === VideoType.VIDEO) {
      video.videoType = dto.videoType;
    }
    video.categoryId = category.id;
    video.skillTags = skillTags;
    video.tagsSearchText = [
      category.name,
      ...skillTags.map((t) => t.name),
    ]
      .filter(Boolean)
      .join(' ');
    if (dto.scheduledPublishAt) {
      const scheduled = new Date(dto.scheduledPublishAt);
      if (Number.isNaN(scheduled.getTime())) {
        throw new BadRequestException('Invalid scheduled publish time');
      }
      if (scheduled.getTime() <= Date.now() + 14 * 60 * 1000) {
        throw new BadRequestException('Schedule must be at least 15 minutes in the future');
      }
      video.scheduledPublishAt = scheduled;
    } else {
      video.scheduledPublishAt = null;
    }
    video.status = VideoStatus.PROCESSING;
    video.publishStatus = PublishStatus.DRAFT;
    video.uploadCompletedAt = new Date();
    video.failureReason = null;

    const saved = await this.videoRepository.save(video);

    if (dto.playlistIds?.length) {
      await this.addVideoToPlaylists(userId, saved.id, dto.playlistIds);
    }

    await this.enqueueTranscodeOrThrow(saved.id, saved.s3Key!, userId);
    this.syncScheduledPublishJob(saved.id, saved.scheduledPublishAt);

    return this.mapToPublicVideo(saved);
  }

  private async addVideoToPlaylists(
    userId: string,
    videoId: string,
    playlistIds: string[],
  ): Promise<void> {
    const unique = [...new Set(playlistIds)];
    const playlists = await this.playlistRepository.find({
      where: { id: In(unique), userId },
    });
    if (playlists.length !== unique.length) {
      throw new BadRequestException('One or more playlists were not found');
    }
    const existingRows = await this.playlistVideoRepository.find({
      where: { videoId, playlistId: In(playlists.map((p) => p.id)) },
      select: ['playlistId'],
    });
    const existingIds = new Set(existingRows.map((r) => r.playlistId));
    const toInsert = playlists
      .filter((p) => !existingIds.has(p.id))
      .map((p) => this.playlistVideoRepository.create({ playlistId: p.id, videoId }));
    if (toInsert.length) {
      await this.playlistVideoRepository.save(toInsert);
    }
  }

  async findById(id: string, opts?: { skipCache?: boolean }): Promise<Video> {
    const cacheKey = videoDetailCacheKey(id);
    if (!opts?.skipCache) {
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        return this.videoRepository.create(JSON.parse(cached) as Video);
      }
    }
    // singleFlight: a cache-miss burst (viral video, or right after an edit
    // busts the cache) shares one DB query per instance instead of N.
    return singleFlight(cacheKey, async () => {
      const video = await this.videoRepository.findOne({
        where: { id },
        relations: ['user', 'skillTags'],
      });
      if (!video) throw new NotFoundException('Video not found');
      if (!opts?.skipCache) {
        await safeRedisSetex(
          this.redis,
          cacheKey,
          jitterTtl(VIDEO_DETAIL_CACHE_TTL),
          serializeVideoForCache(video),
          this.logger,
        );
      }
      return video;
    });
  }

  async bustVideoDetailCache(videoId: string): Promise<void> {
    await safeRedisDel(this.redis, videoDetailCacheKey(videoId), this.logger);
  }

  async getVideoForViewer(
    id: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<PublicVideo> {
    const video = await this.findById(id);
    const isOwner = !!viewerId && viewerId === video.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    if (video.moderationStatus === ModerationStatus.BLOCKED && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.moderationStatus === ModerationStatus.HELD && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.visibility === VideoVisibility.PRIVATE && !isOwner && !isAdmin) {
      throw new ForbiddenException('This video is private');
    }

    if (viewerId && !isOwner && !isAdmin) {
      const blocked = await this.engagementService.isBlockedEitherWay(viewerId, video.userId);
      if (blocked) {
        throw new ForbiddenException('This video is not available');
      }
    }

    if (!isOwner && !isAdmin) {
      if (video.status !== VideoStatus.READY) {
        throw new ForbiddenException('This video is not available yet');
      }
      if (video.publishStatus !== PublishStatus.PUBLISHED) {
        throw new ForbiddenException('This video is not published yet');
      }
      const now = new Date();
      if (video.scheduledPublishAt && video.scheduledPublishAt > now) {
        throw new ForbiddenException('This video is not published yet');
      }
      if (video.publishedAt && video.publishedAt > now) {
        throw new ForbiddenException('This video is not published yet');
      }
    }

    const access = await this.entitlementsService.checkAccess({
      creatorId: video.userId,
      visibility: video.visibility,
      requiredTierId: video.requiredTierId,
      viewerId,
      isOwner,
      isAdmin,
    });

    const mapped = this.mapToPublicVideo(video, { includeDislikeCount: isOwner || isAdmin });
    const pending = await this.getPendingViewCount(id);
    const withViews =
      pending > 0 ? { ...mapped, viewCount: mapped.viewCount + pending } : mapped;
    const withSignedHls = {
      ...withViews,
      hlsUrl: this.resolveViewerHlsUrl(video, withViews.hlsUrl, isOwner || isAdmin),
    };

    if (!access.allowed && !isOwner && !isAdmin) {
      return {
        ...withSignedHls,
        hlsUrl: null,
        accessDenied: true,
        accessReason: access.reason,
      };
    }

    if (viewerId && !isOwner) {
      const reaction = await this.engagementService.getViewerVideoReaction(viewerId, id);
      const viewerFollowingCreator = await this.engagementService.isFollowing(
        viewerId,
        video.userId,
      );
      return {
        ...withSignedHls,
        ...reaction,
        viewerFollowingCreator,
        viewerSubscribed: viewerFollowingCreator,
      };
    }

    return withSignedHls;
  }

  /** Paginated public shorts feed — ranked by freshness/engagement with soft creator diversity. */
  async listShorts(opts: { cursor?: string; limit?: number; viewerId?: string } = {}): Promise<{
    data: PublicVideo[];
    nextCursor: string | null;
  }> {
    const limit = clampLimit(opts.limit, 20, 50);
    const fetchLimit = Math.min(limit * 3, 60);
    const qb = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'creator')
      .leftJoinAndSelect('v.skillTags', 'st')
      .where('v.video_type = :type', { type: VideoType.SHORT })
      .andWhere('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.publish_status = :ps', { ps: PublishStatus.PUBLISHED })
      .andWhere('v.visibility = :vis', { vis: VideoVisibility.PUBLIC })
      .andWhere('v.moderation_status != :blocked', { blocked: ModerationStatus.BLOCKED })
      .orderBy('v.published_at', 'DESC')
      .take(fetchLimit + 1);

    if (opts.cursor) {
      qb.andWhere('v.published_at < :cursor', { cursor: new Date(opts.cursor) });
    }

    if (opts.viewerId) {
      const [mutedChannels, notInterested, blockedPeers] = await Promise.all([
        getMutedChannelIds(this.redis, opts.viewerId, this.logger),
        getNotInterestedVideoIds(this.redis, opts.viewerId, this.logger),
        this.engagementService.getBlockedPeerIds(opts.viewerId),
      ]);
      const excludedCreators = mergeExcludedCreatorIds(mutedChannels, blockedPeers);
      if (excludedCreators.length) {
        qb.andWhere('v.user_id NOT IN (:...mutedChannels)', { mutedChannels: excludedCreators });
      }
      if (notInterested.length) {
        qb.andWhere('v.id NOT IN (:...notInterested)', { notInterested });
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > fetchLimit;
    const candidates = rows.slice(0, fetchLimit);
    const ranked = diversifyByCreator(rankShortsByScore(candidates), 1).slice(0, limit);
    let data = ranked.map((v) => this.mapToPublicVideo(v));

    if (opts.viewerId && ranked.length > 0) {
      const creatorIds = [...new Set(ranked.map((v) => v.userId))];
      const [reactionByVideo, followingSet] = await Promise.all([
        this.engagementService.getViewerVideoReactions(
          opts.viewerId,
          ranked.map((v) => v.id),
        ),
        this.engagementService.getFollowingSet(opts.viewerId, creatorIds),
      ]);
      data = data.map((mapped, i) => {
        const v = ranked[i];
        const reaction = reactionByVideo.get(v.id) ?? {
          viewerLiked: false,
          viewerDisliked: false,
        };
        const following = followingSet.has(v.userId);
        return {
          ...mapped,
          ...reaction,
          viewerFollowingCreator: following,
          viewerSubscribed: following,
        };
      });
    }

    const nextCursor = hasMore
      ? ranked[ranked.length - 1]?.publishedAt?.toISOString() ?? null
      : null;
    return { data, nextCursor };
  }

  /** Re-queue Mux ingest after a failed transcode (creator-owned, source still in S3). */
  async retryTranscode(userId: string, videoId: string): Promise<{ ok: true }> {
    if (!this.usesMuxTranscode()) {
      throw new BadRequestException('Transcode retry is only available with Mux VOD');
    }
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== userId) throw new ForbiddenException();
    if (video.status !== VideoStatus.FAILED) {
      throw new BadRequestException('Only failed videos can be retried');
    }
    if (!video.s3Key) {
      throw new BadRequestException('Missing source upload in storage');
    }

    if (video.muxAssetId) {
      await this.muxVodService.deleteAsset(video.muxAssetId);
    }

    await this.videoRepository.update(videoId, {
      status: VideoStatus.PROCESSING,
      failureReason: null,
      muxAssetId: null,
      muxPlaybackId: null,
      hlsUrl: null,
      thumbnailUrl: null,
    });
    await this.bustVideoDetailCache(videoId);
    await this.enqueueMuxIngestOrThrow(videoId, video.s3Key, userId);
    return { ok: true };
  }

  async delete(requesterId: string, videoId: string): Promise<void> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();

    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
  }

  /**
   * System-triggered hard delete for a video whose owner's account has passed
   * the post-deletion grace period (see AccountPurgeService). No ownership
   * check -- the caller has already scoped this to a specific soft-deleted
   * account's videos.
   */
  async purgeVideoForDeletedAccount(video: Video): Promise<void> {
    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(video.id);
    this.eventEmitter.emit('video.updated', { videoId: video.id });
    await this.videoRepository.remove(video);
  }

  private pendingViewKey(videoId: string): string {
    return `video:views:pending:${videoId}`;
  }

  private viewDedupeKey(viewerKey: string, videoId: string): string {
    return `video:view:dedupe:${viewerKey}:${videoId}`;
  }

  async getPendingViewCount(videoId: string): Promise<number> {
    const raw = await safeRedisGet(this.redis, this.pendingViewKey(videoId), this.logger);
    return raw ? parseInt(raw, 10) || 0 : 0;
  }

  /**
   * Count a view after the viewer passes the watch-time threshold (not on page load).
   * Dedupes per viewerKey + video for 24h; skips creator watching own video.
   */
  async recordQualifiedView(
    videoId: string,
    viewerKey: string,
    dto: RecordViewDto,
    viewerUserId?: string,
  ): Promise<{ counted: boolean; reason?: string }> {
    const video = await this.findById(videoId);
    await this.assertCanWatchVideo(video, viewerUserId ?? null);
    if (video.status !== VideoStatus.READY) {
      return { counted: false, reason: 'not_ready' };
    }
    if (viewerUserId && viewerUserId === video.userId) {
      return { counted: false, reason: 'owner' };
    }
    const threshold = viewCountThresholdSeconds(
      dto.durationSeconds ?? video.durationSeconds ?? undefined,
    );
    if (dto.progressSeconds < threshold) {
      return { counted: false, reason: 'below_threshold' };
    }
    const counted = await this.incrementViewCount(videoId, viewerKey);
    return { counted, reason: counted ? undefined : 'deduped' };
  }

  /** Buffered in Redis; flushed to Postgres periodically (see ViewCountFlushService). */
  async incrementViewCount(videoId: string, viewerKey?: string): Promise<boolean> {
    if (viewerKey) {
      try {
        const dedupe = await this.redis.set(
          this.viewDedupeKey(viewerKey, videoId),
          '1',
          'EX',
          VIEW_DEDUPE_TTL_SEC,
          'NX',
        );
        if (dedupe !== 'OK') return false;
      } catch (err) {
        if (isRedisQuotaError(err)) return false;
        this.logger.warn(
          `view dedupe SET failed: ${err instanceof Error ? err.message : err}`,
        );
        return false;
      }
    }
    const n = await safeRedisIncrEx(this.redis, this.pendingViewKey(videoId), 48 * 3600, this.logger);
    if (n !== null) {
      try {
        await this.redis.sadd('video:views:pending:ids', videoId);
      } catch (err) {
        this.logger.warn(
          `pending view id set failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return n !== null;
  }

  async recordWatch(userId: string, videoId: string, dto: RecordWatchDto) {
    const video = await this.findById(videoId);
    await this.assertCanWatchVideo(video, userId);
    if (video.status !== VideoStatus.READY) {
      throw new BadRequestException('Video is not available');
    }
    const progressSeconds = dto.progressSeconds ?? 0;
    const historyPaused = await this.usersService.isWatchHistoryPaused(userId);
    if (!historyPaused) {
      await this.watchHistoryRepository.upsert(
        {
          userId,
          videoId,
          progressSeconds,
          watchedAt: new Date(),
        },
        { conflictPaths: ['userId', 'videoId'] },
      );
    }
    // Session dwell signal for forYou (independent of history pause — ranking only).
    if (progressSeconds >= SESSION_WATCH_MIN_PROGRESS_SEC) {
      await pushSessionCreator(this.redis, userId, video.userId, this.logger);
    }
    await this.recordQualifiedView(
      videoId,
      userId,
      {
        progressSeconds,
        durationSeconds: video.durationSeconds ?? undefined,
      },
      userId,
    );
    return { ok: true, historyPaused };
  }

  /**
   * Validate a replacement skill-tag set for an existing video and apply it,
   * recomputing the denormalized `tagsSearchText`. Tags must exist and belong
   * to the video's current category (mirrors the upload-time contract). The
   * generated `search_vector` column refreshes automatically from
   * title/description/tags_search_text, so discovery stays consistent.
   */
  private async applySkillTagUpdate(video: Video, skillTagIds: string[]): Promise<void> {
    const uniqueTagIds = [...new Set(skillTagIds)];
    if (uniqueTagIds.length === 0) {
      const category = video.categoryId
        ? await this.categoryRepository.findOne({ where: { id: video.categoryId } })
        : null;
      video.skillTags = [];
      video.tagsSearchText = (category?.name ?? '').slice(0, 2000);
      return;
    }
    const tags = await this.skillTagRepository.find({
      where: { id: In(uniqueTagIds) },
      relations: ['subcategory'],
    });
    if (tags.length !== uniqueTagIds.length) {
      throw new BadRequestException('One or more skill tags were not found');
    }
    const invalidForCategory = tags.filter((t) => t.subcategory?.categoryId !== video.categoryId);
    if (invalidForCategory.length > 0) {
      throw new BadRequestException("All skill tags must belong to the video's category");
    }
    const category = video.categoryId
      ? await this.categoryRepository.findOne({ where: { id: video.categoryId } })
      : null;
    video.skillTags = tags;
    video.tagsSearchText = [category?.name, ...tags.map((t) => t.name)]
      .filter(Boolean)
      .join(' ')
      .slice(0, 2000);
  }

  async updateVideo(requesterId: string, videoId: string, dto: UpdateVideoDto) {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();
    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description;
    const previousVisibility = video.visibility;
    if (dto.visibility !== undefined) video.visibility = dto.visibility;
    if (
      dto.visibility !== undefined &&
      requiresMuxSignedPlayback(previousVisibility) !== requiresMuxSignedPlayback(dto.visibility)
    ) {
      await this.muxVodService.syncPlaybackPolicy(video);
    }
    if (dto.videoType !== undefined) {
      const typeErr = shortTypeChangeError(dto.videoType, video.durationSeconds);
      if (typeErr) throw new BadRequestException(typeErr);
      video.videoType = dto.videoType;
    }
    if (dto.categoryId !== undefined) {
      const category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
      if (!category) throw new BadRequestException('Category not found');
      const categoryChanged = video.categoryId !== dto.categoryId;
      video.categoryId = category.id;
      // Tags are category-scoped — clear them on category change unless the
      // caller is also sending a fresh skillTagIds list for the new category.
      if (categoryChanged && dto.skillTagIds === undefined) {
        await this.applySkillTagUpdate(video, []);
      }
    }
    if (dto.skillTagIds !== undefined) {
      await this.applySkillTagUpdate(video, dto.skillTagIds);
    }
    if (dto.scheduledPublishAt !== undefined) {
      if (dto.scheduledPublishAt === null) {
        video.scheduledPublishAt = null;
      } else {
        const scheduled = new Date(dto.scheduledPublishAt);
        if (Number.isNaN(scheduled.getTime())) {
          throw new BadRequestException('Invalid scheduled publish time');
        }
        video.scheduledPublishAt = scheduled;
      }
    }
    if (shouldIndexVideo(video)) {
      video.indexedAt = video.indexedAt ?? indexedAtOnReady(video) ?? new Date();
    } else if (video.visibility !== VideoVisibility.PUBLIC) {
      video.indexedAt = null;
    }

    const saved = await this.videoRepository.save(video);
    await this.bustVideoDetailCache(videoId);
    if (dto.scheduledPublishAt !== undefined) {
      this.syncScheduledPublishJob(saved.id, saved.scheduledPublishAt);
    }
    this.eventEmitter.emit('video.updated', { videoId });
    return this.mapToPublicVideo(saved);
  }

  private syncScheduledPublishJob(videoId: string, scheduledAt: Date | null): void {
    if (scheduledAt && scheduledAt.getTime() > Date.now()) {
      void this.scheduledPublishScheduler.schedulePublish(videoId, scheduledAt);
    } else {
      void this.scheduledPublishScheduler.cancelPublish(videoId);
    }
  }

  private async enqueueTranscodeOrThrow(
    videoId: string,
    s3Key: string,
    userId: string,
  ): Promise<void> {
    if (this.usesMuxTranscode()) {
      await this.enqueueMuxIngestOrThrow(videoId, s3Key, userId);
      return;
    }
    await this.enqueueProcessJobOrThrow(videoId, s3Key, userId);
  }

  private async enqueueMuxIngestOrThrow(
    videoId: string,
    s3Key: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.videoRepository.update(videoId, {
        transcodeProvider: TranscodeProvider.MUX,
      });
      await this.muxVodQueue.add(
        'mux-vod-ingest',
        { videoId, s3Key, userId },
        {
          jobId: muxVodIngestJobId(videoId),
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnFail: { age: 7 * 24 * 3600 },
          removeOnComplete: { age: 24 * 3600, count: 500 },
        },
      );
    } catch (err) {
      const quota = isRedisQuotaError(err);
      this.logger.error(
        `enqueue mux-vod-ingest failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
      await this.videoRepository.update(videoId, {
        status: VideoStatus.FAILED,
        failureReason: quota
          ? 'Processing queue is temporarily unavailable (Redis quota). Try again later or contact support.'
          : 'Failed to start Mux transcoding. Try again shortly.',
      });
      throw new ServiceUnavailableException(
        quota
          ? 'Upload saved but processing could not start — platform cache/queue limit reached. Try again in a few minutes.'
          : 'Upload saved but processing could not start. Try again shortly.',
      );
    }
  }

  private async enqueueProcessJobOrThrow(
    videoId: string,
    s3Key: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.videoRepository.update(videoId, {
        transcodeProvider: TranscodeProvider.FFMPEG,
      });
      await this.videoQueue.add(
        'process-video',
        { videoId, s3Key, userId },
        {
          jobId: `video-process-${videoId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnFail: { age: 7 * 24 * 3600 },
          removeOnComplete: { age: 24 * 3600, count: 500 },
        },
      );
    } catch (err) {
      const quota = isRedisQuotaError(err);
      this.logger.error(
        `enqueue process-video failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
      await this.videoRepository.update(videoId, {
        status: VideoStatus.FAILED,
        failureReason: quota
          ? 'Processing queue is temporarily unavailable (Redis quota). Try again later or contact support.'
          : 'Failed to start video processing. Try again shortly.',
      });
      throw new ServiceUnavailableException(
        quota
          ? 'Upload saved but processing could not start — platform cache/queue limit reached. Try again in a few minutes.'
          : 'Upload saved but processing could not start. Try again shortly.',
      );
    }
  }
}
