import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
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
} from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { Category } from '../categories/entities/category.entity';
import { UserRole } from '../users/entities/user.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistVideo } from '../playlists/entities/playlist-video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RecordWatchDto } from './dto/record-watch.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { PublicVideo, serializeVideoForCache, toPublicVideo } from './video.mapper';
import {
  isRedisQuotaError,
  safeRedisDel,
  safeRedisGet,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';
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

export const VIDEO_PROCESSING_QUEUE = 'video-processing';
export const VIDEO_PROCESSING_DLQ_QUEUE = 'video-processing-dlq';

const VIDEO_DETAIL_CACHE_TTL = 120;

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
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly videoMultipart: VideoMultipartService,
  ) {
    const awsCreds = {
      region: configService.get<string>('aws.region') || 'ap-south-1',
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
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

  assertCanWatchVideo(
    video: Video,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): void {
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

  mapToPublicVideo(video: Video): PublicVideo {
    return toPublicVideo(video, {
      rewriteMediaUrl: (url) => this.rewritePlaybackUrl(url),
    });
  }

  rewritePlaybackUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.cdnDomain) return rewriteMediaUrlToCdn(url, this.cdnDomain);
    return url;
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
  async listStudioVideos(userId: string, limit = 50) {
    await this.releaseIncompleteUploads(userId);
    const rows = await this.videoRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
    return { data: rows.map((v) => this.mapToPublicVideo(v)) };
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

  /** Presigned PUT for optional custom thumbnail (before /complete). */
  async getThumbnailPresignedUrl(
    userId: string,
    videoId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();
    if (video.status !== VideoStatus.UPLOADING) {
      throw new BadRequestException('Video is not in uploading state');
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

    return { uploadUrl, key, expiresIn: 600 };
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

    const body = file.buffer?.length ? file.buffer : createReadStream(file.path);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: video.s3Key,
        Body: body,
        ContentType: video.uploadContentType || file.mimetype || 'video/mp4',
        ContentLength: file.size,
      }),
    );

    return { ok: true };
  }

  /**
   * Legacy endpoint behavior (kept for compatibility):
   * register + enqueue processing immediately.
   *
   * New flow should use: presigned-url -> S3 PUT -> /videos/:id/complete.
   */
  async create(userId: string, dto: CreateVideoDto): Promise<PublicVideo> {
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

    await this.enqueueProcessJobOrThrow(saved.id, dto.s3Key, userId);

    return this.mapToPublicVideo(saved);
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

    const uniqueTagIds = [...new Set(dto.skillTagIds)];
    let skillTags = await this.skillTagRepository.find({
      where: { id: In(uniqueTagIds) },
      relations: ['subcategory'],
    });

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

    if (skillTags.length === 0) {
      throw new BadRequestException('At least one skill tag is required');
    }

    video.title = dto.title.trim();
    video.description = dto.description?.trim() ?? null;
    video.visibility = dto.visibility;
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

    await this.enqueueProcessJobOrThrow(saved.id, saved.s3Key!, userId);

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
    for (const playlist of playlists) {
      const existing = await this.playlistVideoRepository.findOne({
        where: { playlistId: playlist.id, videoId },
      });
      if (!existing) {
        await this.playlistVideoRepository.save(
          this.playlistVideoRepository.create({ playlistId: playlist.id, videoId }),
        );
      }
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
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['user', 'skillTags'],
    });
    if (!video) throw new NotFoundException('Video not found');
    if (!opts?.skipCache) {
      await safeRedisSetex(
        this.redis,
        cacheKey,
        VIDEO_DETAIL_CACHE_TTL,
        serializeVideoForCache(video),
        this.logger,
      );
    }
    return video;
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
    this.assertCanWatchVideo(video, viewerId, viewerRole);
    if (video.status === VideoStatus.READY) {
      await this.incrementViewCount(id, viewerId ?? undefined);
    }
    const mapped = this.mapToPublicVideo(video);
    const pending = await this.getPendingViewCount(id);
    if (pending > 0) {
      return { ...mapped, viewCount: mapped.viewCount + pending };
    }
    return mapped;
  }

  async delete(requesterId: string, videoId: string): Promise<void> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();

    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
  }

  private pendingViewKey(videoId: string): string {
    return `video:views:pending:${videoId}`;
  }

  private viewDedupeKey(viewerKey: string, videoId: string): string {
    return `video:view:dedupe:${viewerKey}:${videoId}`;
  }

  async getPendingViewCount(videoId: string): Promise<number> {
    const raw = await this.redis.get(this.pendingViewKey(videoId));
    return raw ? parseInt(raw, 10) || 0 : 0;
  }

  /** Buffered in Redis; flushed to Postgres periodically (see ViewCountFlushService). */
  async incrementViewCount(videoId: string, viewerKey?: string): Promise<void> {
    if (viewerKey) {
      const dedupe = await this.redis.set(
        this.viewDedupeKey(viewerKey, videoId),
        '1',
        'EX',
        3600,
        'NX',
      );
      if (dedupe !== 'OK') return;
    }
    await this.redis.incr(this.pendingViewKey(videoId));
  }

  async recordWatch(userId: string, videoId: string, dto: RecordWatchDto) {
    const video = await this.findById(videoId);
    this.assertCanWatchVideo(video, userId);
    if (video.status !== VideoStatus.READY) {
      throw new BadRequestException('Video is not available');
    }
    const progressSeconds = dto.progressSeconds ?? 0;
    await this.watchHistoryRepository.upsert(
      {
        userId,
        videoId,
        progressSeconds,
        watchedAt: new Date(),
      },
      { conflictPaths: ['userId', 'videoId'] },
    );
    return { ok: true };
  }

  async updateVideo(requesterId: string, videoId: string, dto: UpdateVideoDto) {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();
    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description;
    if (dto.visibility !== undefined) video.visibility = dto.visibility;
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
    this.eventEmitter.emit('video.updated', { videoId });
    return this.mapToPublicVideo(saved);
  }

  private async enqueueProcessJobOrThrow(
    videoId: string,
    s3Key: string,
    userId: string,
  ): Promise<void> {
    try {
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
